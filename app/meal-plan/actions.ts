"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  generateMealPlan,
  regenerateMeal,
  regenerateDay,
  reviseMealPlan,
  type MealResult,
  type MealPlanResult,
} from "@/lib/ai/mealPlan";
import { getProfile, getProfileConstraints, addDislikedIngredientIfNew } from "@/lib/session";
import { toMealResult, mealFields, disconnectMealLogs } from "@/lib/meals";
import type { NutritionPlan } from "@prisma/client";

function startOfWeek(): Date {
  const now = new Date();
  const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1;
  now.setHours(0, 0, 0, 0);
  now.setDate(now.getDate() - dayOfWeek);
  return now;
}

async function savePreference(profileId: string, currentPreferences: string[], feedback: string) {
  if (currentPreferences.some((p) => p.toLowerCase() === feedback.toLowerCase())) return;

  await db.profile.update({
    where: { id: profileId },
    data: { dietaryPreferences: JSON.stringify([...currentPreferences, feedback]) },
  });
}

export async function generateMealPlanAction(formData: FormData) {
  const nutritionPlanId = String(formData.get("nutritionPlanId"));

  const profile = await getProfile();
  if (!profile) return;

  const nutritionPlan = await db.nutritionPlan.findFirst({
    where: { id: nutritionPlanId, profileId: profile.id },
  });
  if (!nutritionPlan) return;
  const { conditions, dietaryPreferences, dislikedIngredients } = await getProfileConstraints(profile.id);

  const result = await generateMealPlan(nutritionPlan, conditions, dietaryPreferences, dislikedIngredients);

  await db.mealPlan.create({
    data: {
      nutritionPlanId,
      weekStartDate: startOfWeek(),
      status: "DRAFT",
      days: {
        create: result.days.map((day) => ({
          dayOfWeek: day.dayOfWeek,
          date: new Date(startOfWeek().getTime() + day.dayOfWeek * 86400000),
          meals: { create: day.meals.map(mealFields) },
        })),
      },
    },
  });

  revalidatePath("/meal-plan");
}

async function regenerateAffectedMeal(
  meal: { id: string; type: string },
  nutritionPlan: NutritionPlan,
  conditions: string[],
  dietaryPreferences: string[],
  dislikedIngredients: string[]
) {
  const replacement = await regenerateMeal(
    meal.type as unknown as MealResult["type"],
    nutritionPlan,
    conditions,
    dietaryPreferences,
    dislikedIngredients
  );

  // Clear sourceUrl/notes: this meal's content is being fully replaced, so
  // any prior recipe-import link/notes no longer describe it.
  await db.meal.update({
    where: { id: meal.id },
    data: { ...mealFields(replacement), sourceUrl: null, notes: null },
  });
}

export async function dislikeIngredient(formData: FormData) {
  const mealPlanId = String(formData.get("mealPlanId"));
  const ingredient = String(formData.get("ingredient"));

  const profile = await getProfile();
  if (!profile) return;

  const mealPlan = await db.mealPlan.findFirst({
    where: { id: mealPlanId, nutritionPlan: { profileId: profile.id } },
    include: { days: { include: { meals: true } }, nutritionPlan: true },
  });
  if (!mealPlan) return;

  const dislikedIngredients = await addDislikedIngredientIfNew(profile.id, ingredient);
  const { conditions, dietaryPreferences } = await getProfileConstraints(profile.id);

  const affectedMeals = mealPlan.days
    .flatMap((day) => day.meals)
    .filter((meal) => (JSON.parse(meal.ingredients) as string[]).some(
      (i) => i.toLowerCase() === ingredient.toLowerCase()
    ));

  // Independent AI calls (one per affected meal) — run concurrently rather
  // than one-at-a-time so disliking an ingredient in several meals doesn't
  // multiply the wait.
  await Promise.all(
    affectedMeals.map((meal) =>
      regenerateAffectedMeal(meal, mealPlan.nutritionPlan, conditions, dietaryPreferences, dislikedIngredients)
    )
  );

  revalidatePath("/meal-plan");
}

// Removes a single meal entirely (no replacement) — used from both /today
// and /meal-plan, which read the same underlying Meal rows, so deleting it
// here makes it disappear from both automatically. Disconnects rather than
// deletes any of today's logs for it, consistent with every other
// plan-mutating action, so already-eaten history isn't silently erased.
export async function removeMeal(formData: FormData) {
  const mealId = String(formData.get("mealId"));

  const profile = await getProfile();
  if (!profile) return;

  const meal = await db.meal.findFirst({
    where: { id: mealId, mealPlanDay: { mealPlan: { nutritionPlan: { profileId: profile.id } } } },
  });
  if (!meal) return;

  await db.$transaction([disconnectMealLogs([mealId]), db.meal.delete({ where: { id: mealId } })]);

  revalidatePath("/today");
  revalidatePath("/meal-plan");
  revalidatePath("/profile");
}

export async function regenerateDayAction(formData: FormData) {
  const dayId = String(formData.get("dayId"));
  const feedback = String(formData.get("feedback") ?? "").trim();
  if (!feedback) return;

  const profile = await getProfile();
  if (!profile) return;

  const day = await db.mealPlanDay.findFirst({
    where: { id: dayId, mealPlan: { nutritionPlan: { profileId: profile.id } } },
    include: { meals: true, mealPlan: { include: { nutritionPlan: true } } },
  });
  if (!day) return;
  const profileId = day.mealPlan.nutritionPlan.profileId;
  const { conditions, dietaryPreferences, dislikedIngredients } = await getProfileConstraints(profileId);

  const newMeals = await regenerateDay(
    day.meals.map(toMealResult),
    day.mealPlan.nutritionPlan,
    conditions,
    dietaryPreferences,
    dislikedIngredients,
    feedback
  );

  await savePreference(profileId, dietaryPreferences, feedback);

  const mealIds = day.meals.map((m) => m.id);

  await db.$transaction([
    disconnectMealLogs(mealIds),
    db.meal.deleteMany({ where: { id: { in: mealIds } } }),
    db.meal.createMany({
      data: newMeals.map((meal) => ({ mealPlanDayId: dayId, ...mealFields(meal) })),
    }),
  ]);

  revalidatePath("/meal-plan");
}

export async function reviseMealPlanAction(formData: FormData) {
  const mealPlanId = String(formData.get("mealPlanId"));
  const feedback = String(formData.get("feedback") ?? "").trim();
  if (!feedback) return;

  const profile = await getProfile();
  if (!profile) return;

  const mealPlan = await db.mealPlan.findFirst({
    where: { id: mealPlanId, nutritionPlan: { profileId: profile.id } },
    include: { days: { include: { meals: true }, orderBy: { dayOfWeek: "asc" } }, nutritionPlan: true },
  });
  if (!mealPlan) return;
  const profileId = mealPlan.nutritionPlan.profileId;
  const { conditions, dietaryPreferences, dislikedIngredients } = await getProfileConstraints(profileId);

  const currentPlan: MealPlanResult = {
    days: mealPlan.days.map((day) => ({
      dayOfWeek: day.dayOfWeek,
      meals: day.meals.map(toMealResult),
    })),
  };

  const revised = await reviseMealPlan(
    currentPlan,
    mealPlan.nutritionPlan,
    conditions,
    dietaryPreferences,
    dislikedIngredients,
    feedback
  );

  await savePreference(profileId, dietaryPreferences, feedback);

  const mealIds = mealPlan.days.flatMap((d) => d.meals.map((m) => m.id));
  const dayIds = mealPlan.days.map((d) => d.id);

  await db.$transaction([
    disconnectMealLogs(mealIds),
    db.meal.deleteMany({ where: { id: { in: mealIds } } }),
    db.mealPlanDay.deleteMany({ where: { id: { in: dayIds } } }),
    db.mealPlan.update({
      where: { id: mealPlanId },
      data: {
        days: {
          create: revised.days.map((day) => ({
            dayOfWeek: day.dayOfWeek,
            date: new Date(mealPlan.weekStartDate.getTime() + day.dayOfWeek * 86400000),
            meals: { create: day.meals.map(mealFields) },
          })),
        },
      },
    }),
  ]);

  revalidatePath("/meal-plan");
}

export async function acceptMealPlan(formData: FormData) {
  const mealPlanId = String(formData.get("mealPlanId"));

  const profile = await getProfile();
  if (!profile) return;

  const result = await db.mealPlan.updateMany({
    where: { id: mealPlanId, nutritionPlan: { profileId: profile.id } },
    data: { status: "ACCEPTED" },
  });
  if (result.count === 0) return;

  redirect("/today");
}

export async function regenerateWholeMealPlan(formData: FormData) {
  const mealPlanId = String(formData.get("mealPlanId"));

  const profile = await getProfile();
  if (!profile) return;

  const mealPlan = await db.mealPlan.findFirst({
    where: { id: mealPlanId, nutritionPlan: { profileId: profile.id } },
    include: { days: { include: { meals: true } } },
  });
  if (!mealPlan) return;
  const mealIds = mealPlan.days.flatMap((day) => day.meals.map((m) => m.id));
  const dayIds = mealPlan.days.map((d) => d.id);

  await db.$transaction([
    disconnectMealLogs(mealIds),
    db.meal.deleteMany({ where: { id: { in: mealIds } } }),
    db.mealPlanDay.deleteMany({ where: { id: { in: dayIds } } }),
    db.mealPlan.delete({ where: { id: mealPlanId } }),
  ]);

  revalidatePath("/meal-plan");
}
