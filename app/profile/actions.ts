"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getActiveNutritionPlan } from "@/lib/session";
import { evaluateDay, groupLogsByDay } from "@/lib/progress";
import { generateProgressFeedback } from "@/lib/ai/progressFeedback";

const TRACKED_DAYS = 7;

export async function logWeight(formData: FormData) {
  const profileId = String(formData.get("profileId"));
  const weightKg = Number(formData.get("weightKg"));

  await db.weightLog.create({ data: { profileId, weightKg } });
  await db.profile.update({ where: { id: profileId }, data: { weightKg } });

  revalidatePath("/profile");
}

export async function removeDietaryPreference(formData: FormData) {
  const profileId = String(formData.get("profileId"));
  const preference = String(formData.get("preference"));

  const profile = await db.profile.findUniqueOrThrow({ where: { id: profileId } });
  const preferences: string[] = JSON.parse(profile.dietaryPreferences);

  await db.profile.update({
    where: { id: profileId },
    data: { dietaryPreferences: JSON.stringify(preferences.filter((p) => p !== preference)) },
  });

  revalidatePath("/profile");
}

export async function removeDislikedIngredient(formData: FormData) {
  const id = String(formData.get("id"));
  await db.dislikedIngredient.delete({ where: { id } });
  revalidatePath("/profile");
}

export async function generateProgressFeedbackAction(formData: FormData) {
  const profileId = String(formData.get("profileId"));

  const nutritionPlan = await getActiveNutritionPlan(profileId);
  if (!nutritionPlan) return;

  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - (TRACKED_DAYS - 1) * 86400000);
  periodStart.setHours(0, 0, 0, 0);

  const logs = await db.mealLog.findMany({ where: { loggedAt: { gte: periodStart } } });
  if (logs.length === 0) return;

  const dayTotals = groupLogsByDay(logs);
  const days = [...dayTotals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, totals]) => evaluateDay(date, totals, nutritionPlan));

  const feedback = await generateProgressFeedback(days, nutritionPlan);

  await db.progressFeedback.upsert({
    where: { profileId },
    create: {
      profileId,
      periodStart,
      periodEnd,
      summary: feedback.summary,
      doingWell: JSON.stringify(feedback.doingWell),
      improve: JSON.stringify(feedback.improve),
    },
    update: {
      periodStart,
      periodEnd,
      summary: feedback.summary,
      doingWell: JSON.stringify(feedback.doingWell),
      improve: JSON.stringify(feedback.improve),
    },
  });

  revalidatePath("/profile");
}

export async function resetApp() {
  await db.$transaction([
    db.mealLog.deleteMany(),
    db.meal.deleteMany(),
    db.mealPlanDay.deleteMany(),
    db.mealPlan.deleteMany(),
    db.dislikedIngredient.deleteMany(),
    db.progressFeedback.deleteMany(),
    db.nutritionPlan.deleteMany(),
    db.weightLog.deleteMany(),
    db.profile.deleteMany(),
  ]);

  redirect("/onboarding");
}
