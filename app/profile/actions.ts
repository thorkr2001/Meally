"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getProfile, getActiveNutritionPlan } from "@/lib/session";
import { evaluateDay, groupLogsByDay, TRACKED_DAYS } from "@/lib/progress";
import { generateProgressFeedback } from "@/lib/ai/progressFeedback";
import { createClient } from "@/lib/supabase/server";

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function logWeight(formData: FormData) {
  const weightKg = Number(formData.get("weightKg"));

  const profile = await getProfile();
  if (!profile) return;

  await db.weightLog.create({ data: { profileId: profile.id, weightKg } });
  await db.profile.update({ where: { id: profile.id }, data: { weightKg } });

  revalidatePath("/profile");
}

export async function removeDietaryPreference(formData: FormData) {
  const preference = String(formData.get("preference"));

  const profile = await getProfile();
  if (!profile) return;
  const preferences: string[] = JSON.parse(profile.dietaryPreferences);

  await db.profile.update({
    where: { id: profile.id },
    data: { dietaryPreferences: JSON.stringify(preferences.filter((p) => p !== preference)) },
  });

  revalidatePath("/profile");
}

export async function removeDislikedIngredient(formData: FormData) {
  const id = String(formData.get("id"));

  const profile = await getProfile();
  if (!profile) return;

  await db.dislikedIngredient.deleteMany({ where: { id, profileId: profile.id } });
  revalidatePath("/profile");
}

export async function generateProgressFeedbackAction() {
  const profile = await getProfile();
  if (!profile) return;
  const profileId = profile.id;

  const nutritionPlan = await getActiveNutritionPlan(profileId);
  if (!nutritionPlan) return;

  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - (TRACKED_DAYS - 1) * 86400000);
  periodStart.setHours(0, 0, 0, 0);

  const logs = await db.mealLog.findMany({ where: { profileId, loggedAt: { gte: periodStart } } });
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

// Wipes only this profile's data (nutrition/meal plans, logs, preferences)
// and this profile row itself — not every user's data, which the old
// unscoped deleteMany()s did. The Supabase auth account stays intact, so
// the user is still logged in afterward; getProfile() returning null then
// sends them straight back to onboarding, same as before.
export async function resetApp() {
  const profile = await getProfile();
  if (!profile) return;
  const profileId = profile.id;

  const nutritionPlans = await db.nutritionPlan.findMany({ where: { profileId }, select: { id: true } });
  const nutritionPlanIds = nutritionPlans.map((p) => p.id);

  const mealPlans = await db.mealPlan.findMany({
    where: { nutritionPlanId: { in: nutritionPlanIds } },
    select: { id: true },
  });
  const mealPlanIds = mealPlans.map((p) => p.id);

  const mealPlanDays = await db.mealPlanDay.findMany({
    where: { mealPlanId: { in: mealPlanIds } },
    select: { id: true },
  });
  const mealPlanDayIds = mealPlanDays.map((d) => d.id);

  const meals = await db.meal.findMany({ where: { mealPlanDayId: { in: mealPlanDayIds } }, select: { id: true } });
  const mealIds = meals.map((m) => m.id);

  await db.$transaction([
    db.mealLog.deleteMany({ where: { profileId } }),
    db.meal.deleteMany({ where: { id: { in: mealIds } } }),
    db.mealPlanDay.deleteMany({ where: { id: { in: mealPlanDayIds } } }),
    db.mealPlan.deleteMany({ where: { id: { in: mealPlanIds } } }),
    db.dislikedIngredient.deleteMany({ where: { profileId } }),
    db.progressFeedback.deleteMany({ where: { profileId } }),
    db.nutritionPlan.deleteMany({ where: { profileId } }),
    db.weightLog.deleteMany({ where: { profileId } }),
    db.profile.delete({ where: { id: profileId } }),
  ]);

  redirect("/onboarding");
}
