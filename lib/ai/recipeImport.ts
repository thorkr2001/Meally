import { anthropic, MEAL_PLAN_MODEL } from "./client";
import type Anthropic from "@anthropic-ai/sdk";
import type { NutritionPlanResult } from "./nutritionPlan";
import type { MealResult } from "./mealPlan";

const RETURN_RECIPE_MEAL_TOOL: Anthropic.Tool = {
  name: "return_recipe_meal",
  description: "Return the meal built from an imported recipe, adjusted to fit the user's plan.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "The recipe/dish name." },
      description: { type: "string", description: "One short sentence (max ~12 words)." },
      ingredients: {
        type: "array",
        items: { type: "string" },
        description: "Final ingredient list for this meal, after applying any exclusions/substitutions below.",
      },
      notes: {
        type: "string",
        description:
          "One short sentence on any ingredient left out or substituted and why (condition/preference/dislike), or an empty string if nothing needed changing.",
      },
      calories: { type: "integer" },
      proteinG: { type: "integer" },
      carbsG: { type: "integer" },
      fatG: { type: "integer" },
      sugarG: { type: "integer" },
      fiberG: { type: "integer" },
    },
    required: [
      "name",
      "description",
      "ingredients",
      "notes",
      "calories",
      "proteinG",
      "carbsG",
      "fatG",
      "sugarG",
      "fiberG",
    ],
    additionalProperties: false,
  },
};

async function fetchRecipeSummary(url: string): Promise<string> {
  const tools: Anthropic.ToolUnion[] = [
    { type: "web_fetch_20260209", name: "web_fetch", max_uses: 1, max_content_tokens: 4000 },
  ];
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Fetch this recipe page and read it: ${url}\n\nSummarize: the dish name, its full ingredient list with quantities, the stated serving size, and its calories/macros per serving if the page states them.`,
    },
  ];

  let response = await anthropic.messages.create({
    model: MEAL_PLAN_MODEL,
    max_tokens: 2000,
    tools,
    messages,
  });

  while (response.stop_reason === "pause_turn") {
    messages.push({ role: "assistant", content: response.content });
    response = await anthropic.messages.create({
      model: MEAL_PLAN_MODEL,
      max_tokens: 2000,
      tools,
      messages,
    });
  }

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

export interface RecipeMealResult extends MealResult {
  notes: string;
}

export async function importRecipeForMeal(
  url: string,
  mealType: MealResult["type"],
  nutritionPlan: NutritionPlanResult,
  conditions: string[],
  dietaryPreferences: string[],
  dislikedIngredients: string[]
): Promise<RecipeMealResult> {
  const recipeSummary = await fetchRecipeSummary(url);

  const prompt = `A user wants to eat this recipe for ${mealType}:
${recipeSummary}

Daily targets: Calories: ${nutritionPlan.calories}, Protein: ${nutritionPlan.proteinG}g, Carbs: ${nutritionPlan.carbsG}g, Fat: ${nutritionPlan.fatG}g, Sugar ceiling: ${nutritionPlan.sugarG}g, Fiber: ${nutritionPlan.fiberG}g
Rationale from the user's nutrition plan (may contain condition-specific dietary guidance — follow it): ${nutritionPlan.researchNotes}

Conditions/diagnoses the user reported: ${conditions.length > 0 ? conditions.join(", ") : "none"}
Dietary preferences to respect: ${dietaryPreferences.length > 0 ? dietaryPreferences.join(", ") : "none"}
Ingredients the user dislikes and must NOT appear: ${
    dislikedIngredients.length > 0 ? dislikedIngredients.join(", ") : "none"
  }

Tasks:
1. Estimate this meal's nutrition (calories, protein, carbs, fat, sugar, fiber) for a single serving sized to reasonably fit within this meal's share of the daily targets above — scale the recipe's stated serving if needed.
2. If any ingredient conflicts with the conditions, dietary preferences, or dislikes above (wrong texture, an allergen, a disliked item), leave it out of the final ingredients list or substitute it with something suitable, and say what you changed and why in "notes" (one short sentence). If nothing needs to change, set notes to an empty string.
3. Call return_recipe_meal with the final adjusted meal.`;

  const response = await anthropic.messages.create({
    model: MEAL_PLAN_MODEL,
    max_tokens: 2048,
    tools: [RETURN_RECIPE_MEAL_TOOL],
    tool_choice: { type: "tool", name: "return_recipe_meal" },
    messages: [{ role: "user", content: prompt }],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) throw new Error("Claude did not return a recipe meal tool call");

  const result = toolUse.input as Omit<RecipeMealResult, "type">;

  return { ...result, type: mealType };
}
