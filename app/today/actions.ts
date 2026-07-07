"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getProfile, getActiveNutritionPlan, getActiveMealPlan, getProfileConstraints } from "@/lib/session";
import { currentDayOfWeek } from "@/lib/streaks";
import { mealFields, startOfToday } from "@/lib/meals";
import { importRecipeForMeal } from "@/lib/ai/recipeImport";
import { estimateQuickMeal } from "@/lib/ai/quickLog";
import type { MealResult } from "@/lib/ai/mealPlan";

export async function logMeal(formData: FormData) {
  const mealId = String(formData.get("mealId"));
  const portionPct = Number(formData.get("portion") ?? 100) || 100;
  const portion = portionPct / 100;

  const profile = await getProfile();
  if (!profile) return;

  const meal = await db.meal.findFirst({
    where: { id: mealId, mealPlanDay: { mealPlan: { nutritionPlan: { profileId: profile.id } } } },
  });
  if (!meal) return;

  await db.mealLog.create({
    data: {
      profileId: profile.id,
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
  const profile = await getProfile();
  if (!profile) return;
  const today = startOfToday();
  const tomorrow = new Date(today.getTime() + 86400000);

  await db.mealLog.deleteMany({
    where: { profileId: profile.id, mealId, loggedAt: { gte: today, lt: tomorrow } },
  });

  revalidatePath("/today");
  revalidatePath("/profile");
}

// Removes a MealLog directly by its own id, regardless of whether it's still
// connected to a Meal. Needed for logs whose Meal was later deleted (e.g. the
// day got regenerated after logging) — disconnectMealLogs preserves those
// rows on purpose, but unlogMeal can't reach them since it matches by mealId.
// deleteMany (not delete) so the profileId check is enforced in the same
// query rather than trusting the id alone — a mismatched profileId deletes
// nothing instead of throwing.
export async function removeMealLog(formData: FormData) {
  const logId = String(formData.get("logId"));
  const profile = await getProfile();
  if (!profile) return;
  await db.mealLog.deleteMany({ where: { id: logId, profileId: profile.id } });

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

  const profile = await getProfile();
  if (!profile) return;

  const meal = await db.meal.findFirst({
    where: { id: mealId, mealPlanDay: { mealPlan: { nutritionPlan: { profileId: profile.id } } } },
    include: { mealPlanDay: { include: { mealPlan: { include: { nutritionPlan: true } } } } },
  });
  if (!meal) return;
  const nutritionPlan = meal.mealPlanDay.mealPlan.nutritionPlan;
  const { conditions, dietaryPreferences, dislikedIngredients } = await getProfileConstraints(
    nutritionPlan.profileId
  );

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
