"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getProfile, getActiveNutritionPlan, getActiveMealPlan, getDislikedNames } from "@/lib/session";
import { currentDayOfWeek } from "@/lib/streaks";
import { mealFields, startOfToday } from "@/lib/meals";
import { importRecipeForMeal } from "@/lib/ai/recipeImport";
import { estimateQuickMeal } from "@/lib/ai/quickLog";
import type { MealResult } from "@/lib/ai/mealPlan";

export async function logMeal(formData: FormData) {
  const mealId = String(formData.get("mealId"));
  const portionPct = Number(formData.get("portion") ?? 100) || 100;
  const portion = portionPct / 100;

  const meal = await db.meal.findUniqueOrThrow({ where: { id: mealId } });

  await db.mealLog.create({
    data: {
      mealId: meal.id,
      name: portionPct !== 100 ? `${meal.name} (${portionPct}% portion)` : meal.name,
      calories: Math.round(meal.calories * portion),
      proteinG: Math.round(meal.proteinG * portion),
      carbsG: Math.round(meal.carbsG * portion),
      fatG: Math.round(meal.fatG * portion),
      sugarG: Math.round(meal.sugarG * portion),
      fiberG: Math.round(meal.fiberG * portion),
    },
  });

  revalidatePath("/today");
  revalidatePath("/profile");
}

export async function unlogMeal(formData: FormData) {
  const mealId = String(formData.get("mealId"));
  const today = startOfToday();
  const tomorrow = new Date(today.getTime() + 86400000);

  await db.mealLog.deleteMany({ where: { mealId, loggedAt: { gte: today, lt: tomorrow } } });

  revalidatePath("/today");
  revalidatePath("/profile");
}

export async function logQuickMeal(formData: FormData) {
  const description = String(formData.get("description") ?? "").trim();
  if (!description) return;

  const profile = await getProfile();
  if (!profile) return;
  const nutritionPlan = await getActiveNutritionPlan(profile.id);
  if (!nutritionPlan) return;
  const mealPlan = await getActiveMealPlan(nutritionPlan.id);
  if (!mealPlan) return;

  const day = mealPlan.days.find((d) => d.dayOfWeek === currentDayOfWeek());
  if (!day) return;

  const estimate = await estimateQuickMeal(description);

  await db.meal.create({
    data: {
      mealPlanDayId: day.id,
      notes: `Quick-added: "${description}"`,
      ...mealFields(estimate),
    },
  });

  revalidatePath("/today");
  revalidatePath("/meal-plan");
}

export async function importRecipeAction(formData: FormData) {
  const mealId = String(formData.get("mealId"));
  const url = String(formData.get("url") ?? "").trim();
  if (!url) return;

  const meal = await db.meal.findUniqueOrThrow({
    where: { id: mealId },
    include: { mealPlanDay: { include: { mealPlan: { include: { nutritionPlan: true } } } } },
  });
  const nutritionPlan = meal.mealPlanDay.mealPlan.nutritionPlan;
  const profile = await db.profile.findUniqueOrThrow({ where: { id: nutritionPlan.profileId } });
  const conditions: string[] = JSON.parse(profile.conditions);
  const dietaryPreferences: string[] = JSON.parse(profile.dietaryPreferences);
  const dislikedIngredients = await getDislikedNames(profile.id);

  const result = await importRecipeForMeal(
    url,
    meal.type as unknown as MealResult["type"],
    nutritionPlan,
    conditions,
    dietaryPreferences,
    dislikedIngredients
  );

  await db.meal.update({
    where: { id: mealId },
    data: {
      ...mealFields(result),
      sourceUrl: url,
      notes: result.notes || null,
    },
  });

  revalidatePath("/today");
  revalidatePath("/meal-plan");
}
