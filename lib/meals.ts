import { db } from "@/lib/db";
import type { MealResult } from "@/lib/ai/mealPlan";
import type { Meal } from "@prisma/client";

export function toMealResult(meal: Meal): MealResult {
  return {
    type: meal.type as unknown as MealResult["type"],
    name: meal.name,
    description: meal.description,
    ingredients: JSON.parse(meal.ingredients),
    calories: meal.calories,
    proteinG: meal.proteinG,
    carbsG: meal.carbsG,
    fatG: meal.fatG,
    sugarG: meal.sugarG,
    fiberG: meal.fiberG,
  };
}

export function mealFields(meal: MealResult) {
  return {
    type: meal.type,
    name: meal.name,
    description: meal.description,
    ingredients: JSON.stringify(meal.ingredients),
    calories: meal.calories,
    proteinG: meal.proteinG,
    carbsG: meal.carbsG,
    fatG: meal.fatG,
    sugarG: meal.sugarG,
    fiberG: meal.fiberG,
  };
}

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Disconnect (not delete) MealLog rows for the given meal ids. MealLog
 * already snapshots its own calories/macros, so this preserves logged
 * history instead of erasing already-eaten days when a meal/day/plan is
 * regenerated. Returns a Prisma promise — call inside a $transaction array.
 */
export function disconnectMealLogs(mealIds: string[]) {
  return db.mealLog.updateMany({ where: { mealId: { in: mealIds } }, data: { mealId: null } });
}
