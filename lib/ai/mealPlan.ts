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
}

export interface MealPlanDayResult {
  dayOfWeek: number;
  meals: MealResult[];
}

export interface MealPlanResult {
  days: MealPlanDayResult[];
}

const HARD_CONSTRAINTS_NOTE = `CRITICAL: the conditions and preferences below are not optional flavor text — they are hard constraints that override any default assumption about meal structure or food texture. If the user has a swallowing difficulty, dysphagia, or otherwise needs soft, pureed, or liquid foods, EVERY meal must actually be soft/pureed/liquid (e.g. smoothies, purees, soups, protein shakes, blended meals) — do not include anything requiring chewing or a solid texture. If the user specified how many meals per day they want (e.g. only one meal a day), build exactly that many meals per day, not the default of breakfast/lunch/dinner/snack.`;

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

export async function generateMealPlan(
  nutritionPlan: NutritionPlanResult,
  conditions: string[],
  dietaryPreferences: string[],
  dislikedIngredients: string[]
): Promise<MealPlanResult> {
  const prompt = `Create a 7-day meal plan that hits these daily targets:
${targetsBlock(nutritionPlan)}

${constraintsBlock(conditions, dietaryPreferences, dislikedIngredients)}

${HARD_CONSTRAINTS_NOTE} Only fall back to a default of breakfast, lunch, dinner, and one snack per day if nothing above says otherwise.

${REALISM_NOTE}

${VARIETY_NOTE}

For each meal, list its ingredients (matching the required texture/form) and full nutrition breakdown. Keep each meal's description to one short sentence. Call return_meal_plan with the complete 7-day plan.`;

  return callForToolUse<MealPlanResult>(prompt, RETURN_MEAL_PLAN_TOOL, 12000);
}

export async function regenerateMeal(
  mealType: MealResult["type"],
  nutritionPlan: NutritionPlanResult,
  conditions: string[],
  dietaryPreferences: string[],
  dislikedIngredients: string[]
): Promise<MealResult> {
  const prompt = `Create a single replacement ${mealType} meal for a user with these daily targets:
${targetsBlock(nutritionPlan)}

${constraintsBlock(conditions, dietaryPreferences, dislikedIngredients)}

${HARD_CONSTRAINTS_NOTE}

${REALISM_NOTE}

Call return_meal with the replacement meal, including its full nutrition breakdown.`;

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
  const prompt = `A user's current meals for one day of their weekly meal plan are:
${summarizeMeals(currentMeals)}

${targetsBlock(nutritionPlan)}

${constraintsBlock(conditions, dietaryPreferences, dislikedIngredients)}

The user gave this feedback specifically for this day: "${feedback}"

${HARD_CONSTRAINTS_NOTE}

${REALISM_NOTE} If this day has more than one meal, they should differ from each other in protein and cooking method too, not just from other days.

Rebuild this day's meals to address the feedback while still hitting the daily targets in aggregate. You may change the number of meals if the feedback or conditions call for it. Keep each meal's description to one short sentence. Call return_day_meals with the complete replacement set of meals for this day.`;

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

  const prompt = `A user's current 7-day meal plan is:
${currentSummary}

${targetsBlock(nutritionPlan)}

${constraintsBlock(conditions, dietaryPreferences, dislikedIngredients)}

The user gave this feedback on the whole week: "${feedback}"

${HARD_CONSTRAINTS_NOTE} Only fall back to a default of breakfast, lunch, dinner, and one snack per day if nothing above says otherwise.

${REALISM_NOTE}

${VARIETY_NOTE}

Rebuild the complete 7-day plan to address the feedback while still hitting the daily targets in aggregate. Keep each meal's description to one short sentence. Call return_meal_plan with the complete revised 7-day plan.`;

  return callForToolUse<MealPlanResult>(prompt, RETURN_MEAL_PLAN_TOOL, 12000);
}
