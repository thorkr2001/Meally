import { anthropic, MEAL_PLAN_MODEL } from "./client";
import type Anthropic from "@anthropic-ai/sdk";
import { MEAL_SCHEMA, type MealResult } from "./mealPlan";

const RETURN_QUICK_MEAL_TOOL: Anthropic.Tool = {
  name: "return_quick_meal",
  description: "Return the logged meal, classified and with a nutrition estimate.",
  strict: true,
  input_schema: MEAL_SCHEMA,
};

export async function estimateQuickMeal(description: string): Promise<MealResult> {
  const prompt = `A user just ate this and wants to quickly log it: "${description}"

Classify it as BREAKFAST, LUNCH, DINNER, or SNACK based on what's described (infer from context, e.g. eggs and toast is usually BREAKFAST, a small item between meals is SNACK). Give your best realistic nutrition estimate (calories, protein, carbs, fat, sugar, fiber) for a typical portion unless an amount was stated, list its rough ingredients, and estimate prepMinutes (realistic active prep + cook time for this item — e.g. a piece of fruit is ~0, a sandwich is ~5, a cooked dish is 15+). Call return_quick_meal with the result.`;

  const response = await anthropic.messages.create({
    model: MEAL_PLAN_MODEL,
    max_tokens: 1024,
    tools: [RETURN_QUICK_MEAL_TOOL],
    tool_choice: { type: "tool", name: "return_quick_meal" },
    messages: [{ role: "user", content: prompt }],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) throw new Error("Claude did not return a quick meal estimate");

  return toolUse.input as MealResult;
}
