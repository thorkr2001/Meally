import { anthropic, MODEL } from "./client";
import { computeBaselineTargets, type ProfileInput } from "@/lib/nutrition";
import type Anthropic from "@anthropic-ai/sdk";

const RETURN_NUTRITION_PLAN_TOOL: Anthropic.Tool = {
  name: "return_nutrition_plan",
  description: "Return the finalized daily nutrition targets for the user.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      calories: { type: "integer", description: "Daily calorie target" },
      proteinG: { type: "integer", description: "Daily protein target in grams" },
      carbsG: { type: "integer", description: "Daily carbohydrate target in grams" },
      fatG: { type: "integer", description: "Daily fat target in grams" },
      sugarG: { type: "integer", description: "Daily added sugar ceiling in grams" },
      fiberG: { type: "integer", description: "Daily fiber target in grams" },
      researchNotes: {
        type: "string",
        description:
          "Brief (150 words max) explanation of the targets and, if conditions were provided, the condition-specific guidance that shaped them. If a 'Sources:' list was provided in the input, append it verbatim (with real URLs) at the end, uncounted toward the word limit.",
      },
    },
    required: ["calories", "proteinG", "carbsG", "fatG", "sugarG", "fiberG", "researchNotes"],
    additionalProperties: false,
  },
};

async function researchConditions(conditions: string[]): Promise<string> {
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Research current, evidence-based dietary guidance for someone managing the following condition(s): ${conditions.join(
        ", "
      )}. Focus on what this means for daily calorie intake, protein/carb/fat/sugar/fiber targets, and any foods or nutrients to limit or emphasize. Do at most 2-3 searches. Summarize the findings in 150 words or less, citing sources inline.`,
    },
  ];

  let response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }],
    messages,
  });

  while (response.stop_reason === "pause_turn") {
    messages.push({ role: "assistant", content: response.content });
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }],
      messages,
    });
  }

  const textBlocks = response.content.filter(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );
  const summary = textBlocks.map((block) => block.text).join("\n");

  const sources = new Map<string, string>();
  for (const block of textBlocks) {
    for (const citation of block.citations ?? []) {
      if (citation.type === "web_search_result_location") {
        sources.set(citation.url, citation.title ?? citation.url);
      }
    }
  }

  const sourcesList = [...sources.entries()].map(([url, title]) => `- ${title}: ${url}`).join("\n");

  return sourcesList ? `${summary}\n\nSources:\n${sourcesList}` : summary;
}

export interface NutritionPlanResult {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  sugarG: number;
  fiberG: number;
  researchNotes: string;
}

export async function generateNutritionPlan(
  profile: ProfileInput,
  conditions: string[],
  dietaryPreferences: string[]
): Promise<NutritionPlanResult> {
  const baseline = computeBaselineTargets(profile);

  const researchNotes = conditions.length > 0 ? await researchConditions(conditions) : null;

  const prompt = `A user has the following profile:
- Weight: ${profile.weightKg} kg
- Height: ${profile.heightCm} cm
- Age: ${profile.age}
- Sex: ${profile.sex}
- Activity level: ${profile.activityLevel}
- Goal: ${profile.goalType}
- Dietary preferences: ${dietaryPreferences.length > 0 ? dietaryPreferences.join(", ") : "none"}
- Conditions/diagnoses: ${conditions.length > 0 ? conditions.join(", ") : "none"}

A standard formula (Mifflin-St Jeor + activity multiplier) produces this baseline:
Calories: ${baseline.calories}, Protein: ${baseline.proteinG}g, Carbs: ${baseline.carbsG}g, Fat: ${baseline.fatG}g, Sugar ceiling: ${baseline.sugarG}g, Fiber: ${baseline.fiberG}g

${
  researchNotes
    ? `Condition-specific research findings:\n${researchNotes}\n\nAdjust the baseline targets above as needed to reflect this guidance.`
    : "The user has no conditions requiring adjustment — use the baseline targets above as-is unless the dietary preferences warrant a small adjustment."
}

Call return_nutrition_plan with the final targets and a researchNotes explanation. If the research findings above include a "Sources:" list, copy it verbatim (with the real URLs) at the end of researchNotes — do not paraphrase or drop the links.`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    tools: [RETURN_NUTRITION_PLAN_TOOL],
    tool_choice: { type: "tool", name: "return_nutrition_plan" },
    messages: [{ role: "user", content: prompt }],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) throw new Error("Claude did not return a nutrition plan tool call");

  return toolUse.input as NutritionPlanResult;
}

export async function reviseNutritionPlan(
  current: NutritionPlanResult,
  feedback: string
): Promise<NutritionPlanResult> {
  const prompt = `A user was given this daily nutrition plan:
Calories: ${current.calories}, Protein: ${current.proteinG}g, Carbs: ${current.carbsG}g, Fat: ${current.fatG}g, Sugar ceiling: ${current.sugarG}g, Fiber: ${current.fiberG}g
Rationale: ${current.researchNotes}

The user gave this feedback: "${feedback}"

Call return_nutrition_plan with a revised set of targets that addresses the feedback while keeping the plan nutritionally sound, and an updated researchNotes explanation.`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    tools: [RETURN_NUTRITION_PLAN_TOOL],
    tool_choice: { type: "tool", name: "return_nutrition_plan" },
    messages: [{ role: "user", content: prompt }],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) throw new Error("Claude did not return a nutrition plan tool call");

  return toolUse.input as NutritionPlanResult;
}
