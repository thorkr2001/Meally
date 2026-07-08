"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { generateNutritionPlan } from "@/lib/ai/nutritionPlan";
import { createClient } from "@/lib/supabase/server";
import type { ActivityLevel, GoalType, Sex } from "@prisma/client";

function splitList(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Shared by createProfile (first attempt) and retryNutritionPlan (after a
// prior attempt's AI call failed). generateNutritionPlan can throw (rate
// limit, API outage, missing key) - since the Profile row already exists by
// this point, letting that crash uncaught would strand the user: onboarding
// can't re-run createProfile for them without colliding with the unique
// userId constraint, and there's no nutrition plan yet either.
async function generatePlanForProfile(profile: {
  id: string;
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
  activityLevel: ActivityLevel;
  goalType: GoalType;
  dietaryPreferences: string;
  conditions: string;
}) {
  let plan;
  try {
    plan = await generateNutritionPlan(
      {
        weightKg: profile.weightKg,
        heightCm: profile.heightCm,
        age: profile.age,
        sex: profile.sex,
        activityLevel: profile.activityLevel,
        goalType: profile.goalType,
      },
      JSON.parse(profile.conditions),
      JSON.parse(profile.dietaryPreferences)
    );
  } catch {
    redirect("/onboarding?error=1");
  }

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

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data) redirect("/login");

  const profile = await db.profile.create({
    data: {
      userId: data.claims.sub,
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

  await generatePlanForProfile(profile);
}

// Re-attempts plan generation for a profile that already exists but never
// got a NutritionPlan because a prior createProfile call's AI request
// failed partway through. Takes no form input - the profile's own saved
// details are reused as-is.
export async function retryNutritionPlan() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data) redirect("/login");

  const profile = await db.profile.findFirst({ where: { userId: data.claims.sub } });
  if (!profile) redirect("/onboarding");

  await generatePlanForProfile(profile);
}
