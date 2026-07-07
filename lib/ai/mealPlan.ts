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

const RETURN_MEAL_PLAN_TOOL: Anthropic.Tool = {
  name: "return_meal_plan",
  description: "Return a full 7-day meal plan.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      days: {
        type: "array",
        description: "Exactly 7 entries, one per day of the week (dayOfWeek 0-6).",
        items: {
          type: "object",
          properties: {
            dayOfWeek: { type: "integer", enum: [0, 1, 2, 3, 4, 5, 6], description: "0 = Monday .. 6 = Sunday" },
            meals: { type: "array", items: MEAL_SCHEMA },
          },
          required: ["dayOfWeek", "meals"],
          additionalProperties: false,
        },
      },
    },
    required: ["days"],
    additionalProperties: false,
  },
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

const VARIETY_NOTE = `Rotate proteins, cooking methods, and cuisines across the week so no two days feel the same — e.g. one day slow-braised beef, another day a minced-meat dish like bolognese, another day a curry, another day roasted tender chicken, another day a soup or stew. Do not repeat the same dish, protein, or cooking method on more than one day of the week.`;

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

// The tool schema constrains each dayOfWeek to 0-6, but not the *set* of 7
// values as a whole — Claude could still return two Wednesdays and no Sunday.
// Catch that here with a clear error instead of letting it surface as an
// opaque Prisma unique-constraint crash (MealPlanDay is unique per
// [mealPlanId, dayOfWeek]) deep inside a $transaction.
function assertValidWeek(days: MealPlanDayResult[]): void {
  const seen = new Set(days.map((d) => d.dayOfWeek));
  if (days.length !== 7 || seen.size !== 7) {
    throw new Error(
      `Meal plan must cover exactly 7 unique days (0-6); got: ${days.map((d) => d.dayOfWeek).join(", ")}`
    );
  }
}

async function callForToolUse<T>(
  prompt: string,
  tool: Anthropic.Tool,
  maxTokens: number
): Promise<T> {
  const response = await anthropic.messages.create({
    model: MEAL_PLAN_MODEL,
    max_tokens: maxTokens,
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

// Meals are AI-composed to fit the user's constraints, not literal existing
// recipes, so there's no single URL to fetch per meal (that's what recipe
// import is for). Instead: propose real dishes for the brief, then use
// web_search to verify each one's typical prep+cook time and nutrition
// against real recipe/nutrition sources, so the final numbers are grounded
// rather than invented. Same two-phase pattern as nutritionPlan.ts's
// researchConditions() — forcing a tool call prevents Claude from also
// calling web_search, so research has to be a separate untooled call first.
async function researchMealFacts(brief: string, maxSearches: number): Promise<string> {
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `${brief}

Propose a real, well-known dish for each meal above. Then use web search to verify each dish's typical active prep + cook time and its calories/protein/carbs/fat/sugar/fiber per serving, from a reputable recipe or nutrition source — batch similar dishes into the same search rather than one search per meal. Do at most ${maxSearches} searches. Report back one line per meal: day/slot, the real dish name, prep+cook time in minutes, and the nutrition figures, with a brief inline source.`,
    },
  ];

  let response = await anthropic.messages.create({
    model: MEAL_PLAN_MODEL,
    max_tokens: 4096,
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: maxSearches }],
    messages,
  });

  while (response.stop_reason === "pause_turn") {
    messages.push({ role: "assistant", content: response.content });
    response = await anthropic.messages.create({
      model: MEAL_PLAN_MODEL,
      max_tokens: 4096,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: maxSearches }],
      messages,
    });
  }

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

const USE_RESEARCH_NOTE = `Web-verified reference data for the dishes proposed above (dish name, prep+cook time, and nutrition per serving):`;

const GROUNDING_NOTE = `Use these SAME dish names, and treat the researched prep+cook time and nutrition figures as ground truth — only lightly scale portions if needed to fit the daily targets (scaling changes nutrition but not cook time). If a dish isn't covered above, estimate conservatively from the closest researched dish rather than guessing from scratch.`;

export async function generateMealPlan(
  nutritionPlan: NutritionPlanResult,
  conditions: string[],
  dietaryPreferences: string[],
  dislikedIngredients: string[]
): Promise<MealPlanResult> {
  const brief = `Create a 7-day meal plan that hits these daily targets:
${targetsBlock(nutritionPlan)}

${constraintsBlock(conditions, dietaryPreferences, dislikedIngredients)}

${HARD_CONSTRAINTS_NOTE} Only fall back to a default of breakfast, lunch, dinner, and one snack per day if nothing above says otherwise.

${REALISM_NOTE}

${VARIETY_NOTE}`;

  const research = await researchMealFacts(brief, 10);

  const prompt = `${brief}

${USE_RESEARCH_NOTE}
${research}

${GROUNDING_NOTE} For each meal, list its ingredients (matching the required texture/form). Keep each meal's description to one short sentence. Call return_meal_plan with the complete 7-day plan.`;

  const result = await callForToolUse<MealPlanResult>(prompt, RETURN_MEAL_PLAN_TOOL, 12000);
  assertValidWeek(result.days);
  return result;
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

${constraintsBlock(conditions, dietaryPreferences, dislikedIngredients)}

${HARD_CONSTRAINTS_NOTE}

${REALISM_NOTE}`;

  const research = await researchMealFacts(brief, 2);

  const prompt = `${brief}

${USE_RESEARCH_NOTE}
${research}

${GROUNDING_NOTE} Call return_meal with the replacement meal, including its full nutrition breakdown.`;

  return callForToolUse<MealResult>(prompt, RETURN_SINGLE_MEAL_TOOL, 2048);
}

export async function regenerateDay(
  currentMeals: MealResult[],
  nutritionPlan: NutritionPlanResult,
  conditions: string[],
  dietaryPreferences: string[],
  dislikedIngredients: string[],
  feedback: string
): Promise<MealResult[]> {
  const brief = `A user's current meals for one day of their weekly meal plan are:
${summarizeMeals(currentMeals)}

${targetsBlock(nutritionPlan)}

${constraintsBlock(conditions, dietaryPreferences, dislikedIngredients)}

The user gave this feedback specifically for this day: "${feedback}"

${HARD_CONSTRAINTS_NOTE}

${REALISM_NOTE} If this day has more than one meal, they should differ from each other in protein and cooking method too, not just from other days.`;

  const research = await researchMealFacts(brief, 4);

  const prompt = `${brief}

${USE_RESEARCH_NOTE}
${research}

${GROUNDING_NOTE} Rebuild this day's meals to address the feedback while still hitting the daily targets in aggregate. You may change the number of meals if the feedback or conditions call for it. Keep each meal's description to one short sentence. Call return_day_meals with the complete replacement set of meals for this day.`;

  const result = await callForToolUse<{ meals: MealResult[] }>(prompt, RETURN_DAY_MEALS_TOOL, 3000);
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
  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const currentSummary = currentPlan.days
    .map((day) => `${dayNames[day.dayOfWeek]}:\n${summarizeMeals(day.meals)}`)
    .join("\n\n");

  const brief = `A user's current 7-day meal plan is:
${currentSummary}

${targetsBlock(nutritionPlan)}

${constraintsBlock(conditions, dietaryPreferences, dislikedIngredients)}

The user gave this feedback on the whole week: "${feedback}"

${HARD_CONSTRAINTS_NOTE} Only fall back to a default of breakfast, lunch, dinner, and one snack per day if nothing above says otherwise.

${REALISM_NOTE}

${VARIETY_NOTE}`;

  const research = await researchMealFacts(brief, 10);

  const prompt = `${brief}

${USE_RESEARCH_NOTE}
${research}

${GROUNDING_NOTE} Rebuild the complete 7-day plan to address the feedback while still hitting the daily targets in aggregate. Keep each meal's description to one short sentence. Call return_meal_plan with the complete revised 7-day plan.`;

  const result = await callForToolUse<MealPlanResult>(prompt, RETURN_MEAL_PLAN_TOOL, 12000);
  assertValidWeek(result.days);
  return result;
}
