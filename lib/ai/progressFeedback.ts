import { anthropic, MEAL_PLAN_MODEL } from "./client";
import type Anthropic from "@anthropic-ai/sdk";
import type { DayEvaluation } from "@/lib/progress";
import type { NutritionPlanResult } from "./nutritionPlan";

const RETURN_FEEDBACK_TOOL: Anthropic.Tool = {
  name: "return_progress_feedback",
  description: "Return motivational, specific feedback on the user's recent tracking.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      summary: { type: "string", description: "One encouraging sentence overview of the period." },
      doingWell: {
        type: "array",
        items: { type: "string" },
        description: "Up to 3 short, specific things the user is doing well (reference actual metrics/days).",
      },
      improve: {
        type: "array",
        items: { type: "string" },
        description:
          "Up to 3 short, specific, actionable suggestions for what to improve (reference actual metrics/days).",
      },
    },
    required: ["summary", "doingWell", "improve"],
    additionalProperties: false,
  },
};

export interface ProgressFeedbackResult {
  summary: string;
  doingWell: string[];
  improve: string[];
}

const METRIC_LABELS: Record<keyof DayEvaluation["status"], string> = {
  calories: "Calories",
  proteinG: "Protein",
  carbsG: "Carbs",
  fatG: "Fat",
  sugarG: "Sugar",
  fiberG: "Fiber",
};

function summarizeDays(days: DayEvaluation[]): string {
  return days
    .map((day) => {
      const parts = (Object.keys(day.status) as (keyof DayEvaluation["status"])[]).map(
        (metric) => `${METRIC_LABELS[metric]}: ${day.status[metric]} (${day.totals[metric]})`
      );
      return `${day.date} — ${parts.join(", ")}`;
    })
    .join("\n");
}

export async function generateProgressFeedback(
  days: DayEvaluation[],
  nutritionPlan: NutritionPlanResult
): Promise<ProgressFeedbackResult> {
  const prompt = `A user has been logging meals against this daily nutrition plan:
Calories: ${nutritionPlan.calories}, Protein: ${nutritionPlan.proteinG}g, Carbs: ${nutritionPlan.carbsG}g, Fat: ${nutritionPlan.fatG}g, Sugar ceiling: ${nutritionPlan.sugarG}g, Fiber: ${nutritionPlan.fiberG}g

Here is their day-by-day status for each metric ("hit" = on target, "under" = below target, "over" = above target; for sugar, "hit" means under the ceiling):
${summarizeDays(days)}

Write short, encouraging, specific feedback a fitness app would show the user to keep them motivated. Reference actual patterns (e.g. "You hit your protein target 5 of 7 days" or "Fiber was under target most days"). Keep it warm and positive even when pointing out misses — frame them as a next step, not a failure. Call return_progress_feedback with the result.`;

  const response = await anthropic.messages.create({
    model: MEAL_PLAN_MODEL,
    max_tokens: 1024,
    tools: [RETURN_FEEDBACK_TOOL],
    tool_choice: { type: "tool", name: "return_progress_feedback" },
    messages: [{ role: "user", content: prompt }],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) throw new Error("Claude did not return progress feedback");

  return toolUse.input as ProgressFeedbackResult;
}
