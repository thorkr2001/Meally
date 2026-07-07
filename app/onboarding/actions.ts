"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { generateNutritionPlan } from "@/lib/ai/nutritionPlan";
import type { ActivityLevel, GoalType, Sex } from "@prisma/client";

function splitList(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function createProfile(formData: FormData) {
  const weightKg = Number(formData.get("weightKg"));
  const heightCm = Number(formData.get("heightCm"));
  const age = Number(formData.get("age"));
  const sex = formData.get("sex") as Sex;
  const activityLevel = formData.get("activityLevel") as ActivityLevel;
  const goalType = formData.get("goalType") as GoalType;
  const goalWeightKgRaw = formData.get("goalWeightKg");
  const goalWeightKg = goalWeightKgRaw ? Number(goalWeightKgRaw) : null;
  const dietaryPreferences = splitList(formData.get("dietaryPreferences"));
  const conditions = splitList(formData.get("conditions"));

  const profile = await db.profile.create({
    data: {
      weightKg,
      heightCm,
      age,
      sex,
      activityLevel,
      goalType,
      goalWeightKg,
      dietaryPreferences: JSON.stringify(dietaryPreferences),
      conditions: JSON.stringify(conditions),
    },
  });

  await db.weightLog.create({ data: { profileId: profile.id, weightKg } });

  const plan = await generateNutritionPlan(
    { weightKg, heightCm, age, sex, activityLevel, goalType },
    conditions,
    dietaryPreferences
  );

  await db.nutritionPlan.create({
    data: {
      profileId: profile.id,
      status: "DRAFT",
      calories: plan.calories,
      proteinG: plan.proteinG,
      carbsG: plan.carbsG,
      fatG: plan.fatG,
      sugarG: plan.sugarG,
      fiberG: plan.fiberG,
      researchNotes: plan.researchNotes,
    },
  });

  redirect("/plan/review");
}
