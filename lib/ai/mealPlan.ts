import { anthropic, MEAL_PLAN_MODEL } from "./client";
import type Anthropic from "@anthropic-ai/sdk";
import type { NutritionPlanResult } from "./nutritionPlan";

export const MEAL_SCHEMA = {
  type: "object" as const,
  properties: {
    type: { type: "string", enum: ["BREAKFAST", "LUNCH", "DINNER", "SNACK"] },
    name: { type: "string" },
    description: { type: "string", description: "One short sentence (max ~12 words)." },
    ingredients: { type: "array", items: { type: "string" } },
    calories: { type: "integer" },
    proteinG: { type: "integer" },
    carbsG: { type: "integer" },
    fatG: { type: "integer" },
    sugarG: { type: "integer" },
    fiberG: { type: "integer" },
    prepMinutes: {
      type: "integer",
      description: "Realistic total active prep + cook time in minutes (e.g. a shake is ~5, a simmered stew is 45+).",
    },
  },
  required: [
    "type",
    "name",
    "description",
    "ingredients",
    "calories",
    "proteinG",
    "carbsG",
    "fatG",
    "sugarG",
    "fiberG",
    "prepMinutes",
  ],
  additionalProperties: false,
};

const RETURN_SINGLE_MEAL_TOOL: Anthropic.Tool = {
  name: "return_meal",
  description: "Return a single replacement meal.",
  strict: true,
  input_schema: MEAL_SCHEMA,
};

const RETURN_DAY_MEALS_TOOL: Anthropic.Tool = {
  name: "return_day_meals",
  description: "Return the replacement meals for a single day.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      meals: { type: "array", items: MEAL_SCHEMA },
    },
    required: ["meals"],
    additionalProperties: false,
  },
};

export interface MealResult {
  type: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
  name: string;
  description: string;
  ingredients: string[];
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  sugarG: number;
  fiberG: number;
  prepMinutes: number;
}

export interface MealPlanDayResult {
  dayOfWeek: number;
  meals: MealResult[];
}

export interface MealPlanResult {
  days: MealPlanDayResult[];
}

const HARD_CONSTRAINTS_NOTE = `CRITICAL: the conditions and preferences below are not optional flavor text — they are hard constraints that override any default assumption about meal structure or food texture. If the user has a swallowing difficulty, dysphagia, or otherwise needs soft, pureed, or liquid foods, EVERY meal must actually be soft/pureed/liquid (e.g. smoothies, purees, soups, protein shakes, blended meals) — do not include anything requiring chewing or a solid texture. If the user specified how many meals per day they want (e.g. only one meal a day), build exactly that many meals per day, not the default of breakfast/lunch/dinner/snack. Otherwise, always include breakfast, lunch, dinner, and a snack. Every meal is always exactly one serving eaten once — if the same item (e.g. a protein shake) should be had more than once in a day, create that many separate meal entries for it, one per occurrence. NEVER fold a quantity or multiplier into a meal's name (e.g. never write "x2", "x3", "(x3)", "3x") — a meal's name always describes a single serving.`;

const REALISM_NOTE = `Ground every meal in a real, well-known named dish (e.g. bolognese, carbonara, butter chicken, chicken tikka masala, beef stew, chicken curry, congee, shepherd's pie, meatball ragu, chicken cacciatore, risotto) adapted to fit the constraints above — do not just combine generic "protein + starch + vegetable" into an unnamed dish. If the user gives a specific example of something they like (e.g. "braised meat is good"), treat it as ONE example of an acceptable style, not a template to repeat for every meal — use it as inspiration for variety, not a rule to copy every day.`;

const GROUNDING_NOTE = `Use these SAME dish names, and treat the researched prep+cook time and nutrition figures as ground truth — only lightly scale portions if needed to fit the daily targets (scaling changes nutrition but not cook time). If a dish isn't covered above, estimate conservatively from the closest researched dish rather than guessing from scratch.`;

const USE_RESEARCH_NOTE = `Web-verified reference data for the dishes proposed above (dish name, prep+cook time, and nutrition per serving):`;

// These two variants are each reused verbatim across every call for their
// scope (single-meal / single-day, the latter now also used per-day for
// full-week generation/revision), so the prompt-caching breakpoint on the
// system block that wraps them (see callForToolUse and researchMealFacts)
// can actually hit on repeated calls of the same kind — e.g. disliking an
// ingredient present in several meals fires one regenerateMeal per meal,
// all sharing this exact string.
function constraintNotesForSingleMeal(): string {
  return `${HARD_CONSTRAINTS_NOTE}

${REALISM_NOTE}`;
}

function constraintNotesForDay(): string {
  return `${HARD_CONSTRAINTS_NOTE}

${REALISM_NOTE} If this day has more than one meal, they should differ from each other in protein and cooking method too, not just from other days.`;
}

function targetsBlock(nutritionPlan: NutritionPlanResult): string {
  return `Daily targets: Calories: ${nutritionPlan.calories}, Protein: ${nutritionPlan.proteinG}g, Carbs: ${nutritionPlan.carbsG}g, Fat: ${nutritionPlan.fatG}g, Sugar ceiling: ${nutritionPlan.sugarG}g, Fiber: ${nutritionPlan.fiberG}g
Rationale from the user's nutrition plan (may contain condition-specific dietary guidance — follow it): ${nutritionPlan.researchNotes}`;
}

function constraintsBlock(
  conditions: string[],
  dietaryPreferences: string[],
  dislikedIngredients: string[]
): string {
  return `Conditions/diagnoses the user reported: ${conditions.length > 0 ? conditions.join(", ") : "none"}
Dietary preferences to respect: ${dietaryPreferences.length > 0 ? dietaryPreferences.join(", ") : "none"}
Ingredients the user dislikes and must NOT appear: ${
    dislikedIngredients.length > 0 ? dislikedIngredients.join(", ") : "none"
  }`;
}

function summarizeMeals(meals: MealResult[]): string {
  return meals.map((m) => `${m.type}: ${m.name} (${m.calories} kcal) — ${m.description}`).join("\n");
}

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// `systemText` carries every instruction that's byte-identical across every
// call of this scope (constraints/realism/grounding notes, the final
// call-the-tool instruction) — putting it in `system` with a cache
// breakpoint, ahead of the per-call `prompt` data in `messages`, lets
// Anthropic serve it from cache (~0.1x cost) on repeated same-scope calls
// instead of reprocessing it as fresh input every time.
async function callForToolUse<T>(
  systemText: string,
  prompt: string,
  tool: Anthropic.Tool,
  maxTokens: number
): Promise<T> {
  const response = await anthropic.messages.create({
    model: MEAL_PLAN_MODEL,
    max_tokens: maxTokens,
    system: [{ type: "text", text: systemText, cache_control: { type: "ephemeral" } }],
    tools: [tool],
    tool_choice: { type: "tool", name: tool.name },
    messages: [{ role: "user", content: prompt }],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) throw new Error(`Claude did not call ${tool.name}`);

  return toolUse.input as T;
}

function researchMethodNote(maxSearches: number): string {
  return `Propose a real, well-known dish for each meal described above. Then use web search to verify each dish's typical active prep + cook time and its calories/protein/carbs/fat/sugar/fiber per serving, from a reputable recipe or nutrition source — batch similar dishes into the same search rather than one search per meal. Do at most ${maxSearches} searches. Report back one line per meal: day/slot, the real dish name, prep+cook time in minutes, and the nutrition figures, with a brief inline source.`;
}

// Meals are AI-composed to fit the user's constraints, not literal existing
// recipes, so there's no single URL to fetch per meal (that's what recipe
// import is for). Instead: propose real dishes for the brief, then use
// web_search to verify each one's typical prep+cook time and nutrition
// against real recipe/nutrition sources, so the final numbers are grounded
// rather than invented. Same two-phase pattern as nutritionPlan.ts's
// researchConditions() — forcing a tool call prevents Claude from also
// calling web_search, so research has to be a separate untooled call first.
async function researchMealFacts(brief: string, maxSearches: number, constraintNotes: string): Promise<string> {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: brief }];
  const system: Anthropic.Messages.TextBlockParam[] = [
    {
      type: "text",
      text: `${constraintNotes}\n\n${researchMethodNote(maxSearches)}`,
      cache_control: { type: "ephemeral" },
    },
  ];
  const tools: Anthropic.ToolUnion[] = [
    { type: "web_search_20260209", name: "web_search", max_uses: maxSearches },
  ];

  let response = await anthropic.messages.create({
    model: MEAL_PLAN_MODEL,
    max_tokens: 4096,
    system,
    tools,
    messages,
  });

  while (response.stop_reason === "pause_turn") {
    messages.push({ role: "assistant", content: response.content });
    response = await anthropic.messages.create({
      model: MEAL_PLAN_MODEL,
      max_tokens: 4096,
      system,
      tools,
      messages,
    });
  }

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

// Per-day search budget when generating/revising a full week — kept low
// since it's multiplied by 7 parallel calls (see generateMealPlan below);
// regenerateDay's own default stays higher since there it isn't multiplied.
const WEEK_DAY_SEARCH_BUDGET = 2;

async function generateOneDay(
  dayOfWeek: number,
  nutritionPlan: NutritionPlanResult,
  conditions: string[],
  dietaryPreferences: string[],
  dislikedIngredients: string[]
): Promise<MealResult[]> {
  const brief = `Create a full day of meals (${DAY_NAMES[dayOfWeek]}) for a user with these daily targets:
${targetsBlock(nutritionPlan)}

${constraintsBlock(conditions, dietaryPreferences, dislikedIngredients)}`;

  const constraintNotes = constraintNotesForDay();
  const research = await researchMealFacts(brief, WEEK_DAY_SEARCH_BUDGET, constraintNotes);

  const prompt = `${brief}

${USE_RESEARCH_NOTE}
${research}`;

  const systemText = `${constraintNotes}

${GROUNDING_NOTE} Keep each meal's description to one short sentence. Call return_day_meals with the complete set of meals for this day.`;

  const result = await callForToolUse<{ meals: MealResult[] }>(systemText, prompt, RETURN_DAY_MEALS_TOOL, 3000);
  return result.meals;
}

export async function generateMealPlan(
  nutritionPlan: NutritionPlanResult,
  conditions: string[],
  dietaryPreferences: string[],
  dislikedIngredients: string[]
): Promise<MealPlanResult> {
  // Generated as 7 independent parallel day-level calls rather than one
  // sequential whole-week call (research across all 7 days, then a single
  // 12000-token generation) — that pipeline reliably took 40-70s, over
  // Vercel's serverless function timeout. Wall-clock time here is bounded by
  // the slowest single day, not the sum of all seven. Trade-off: each day is
  // planned without visibility into what the others picked, so occasional
  // repeated dishes across the week are somewhat more likely than with one
  // holistic pass.
  const days = await Promise.all(
    [0, 1, 2, 3, 4, 5, 6].map(async (dayOfWeek) => ({
      dayOfWeek,
      meals: await generateOneDay(dayOfWeek, nutritionPlan, conditions, dietaryPreferences, dislikedIngredients),
    }))
  );
  return { days };
}

export async function regenerateMeal(
  mealType: MealResult["type"],
  nutritionPlan: NutritionPlanResult,
  conditions: string[],
  dietaryPreferences: string[],
  dislikedIngredients: string[]
): Promise<MealResult> {
  const brief = `Create a single replacement ${mealType} meal for a user with these daily targets:
${targetsBlock(nutritionPlan)}

${constraintsBlock(conditions, dietaryPreferences, dislikedIngredients)}`;

  const constraintNotes = constraintNotesForSingleMeal();
  const research = await researchMealFacts(brief, 2, constraintNotes);

  const prompt = `${brief}

${USE_RESEARCH_NOTE}
${research}`;

  const systemText = `${constraintNotes}

${GROUNDING_NOTE} Call return_meal with the replacement meal, including its full nutrition breakdown.`;

  return callForToolUse<MealResult>(systemText, prompt, RETURN_SINGLE_MEAL_TOOL, 2048);
}

export async function regenerateDay(
  currentMeals: MealResult[],
  nutritionPlan: NutritionPlanResult,
  conditions: string[],
  dietaryPreferences: string[],
  dislikedIngredients: string[],
  feedback: string,
  maxSearches = 4
): Promise<MealResult[]> {
  const brief = `A user's current meals for one day of their weekly meal plan are:
${summarizeMeals(currentMeals)}

${targetsBlock(nutritionPlan)}

${constraintsBlock(conditions, dietaryPreferences, dislikedIngredients)}

The user gave this feedback specifically for this day: "${feedback}"`;

  const constraintNotes = constraintNotesForDay();
  const research = await researchMealFacts(brief, maxSearches, constraintNotes);

  const prompt = `${brief}

${USE_RESEARCH_NOTE}
${research}`;

  const systemText = `${constraintNotes}

${GROUNDING_NOTE} Rebuild this day's meals to address the feedback while still hitting the daily targets in aggregate. You may change the number of meals if the feedback or conditions call for it. Keep each meal's description to one short sentence. Call return_day_meals with the complete replacement set of meals for this day.`;

  const result = await callForToolUse<{ meals: MealResult[] }>(systemText, prompt, RETURN_DAY_MEALS_TOOL, 3000);
  return result.meals;
}

export async function reviseMealPlan(
  currentPlan: MealPlanResult,
  nutritionPlan: NutritionPlanResult,
  conditions: string[],
  dietaryPreferences: string[],
  dislikedIngredients: string[],
  feedback: string
): Promise<MealPlanResult> {
  // Same parallel-per-day restructuring as generateMealPlan and for the
  // same reason — the whole-week feedback is passed to every day's own
  // regenerateDay call, run concurrently.
  const days = await Promise.all(
    currentPlan.days.map(async (day) => ({
      dayOfWeek: day.dayOfWeek,
      meals: await regenerateDay(
        day.meals,
        nutritionPlan,
        conditions,
        dietaryPreferences,
        dislikedIngredients,
        feedback,
        WEEK_DAY_SEARCH_BUDGET
      ),
    }))
  );
  return { days };
}
