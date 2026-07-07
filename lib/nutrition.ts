import type { ActivityLevel, GoalType, Sex } from "@prisma/client";

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  SEDENTARY: 1.2,
  LIGHT: 1.375,
  MODERATE: 1.55,
  ACTIVE: 1.725,
  VERY_ACTIVE: 1.9,
};

const GOAL_CALORIE_ADJUSTMENT: Record<GoalType, number> = {
  LOSE: -500,
  MAINTAIN: 0,
  GAIN: 300,
};

export interface BaselineTargets {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  sugarG: number;
  fiberG: number;
}

export interface ProfileInput {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
  activityLevel: ActivityLevel;
  goalType: GoalType;
}

export function computeBaselineTargets(profile: ProfileInput): BaselineTargets {
  const bmr =
    10 * profile.weightKg +
    6.25 * profile.heightCm -
    5 * profile.age +
    (profile.sex === "MALE" ? 5 : -161);

  const tdee = bmr * ACTIVITY_MULTIPLIERS[profile.activityLevel];
  const calories = Math.round(tdee + GOAL_CALORIE_ADJUSTMENT[profile.goalType]);

  const proteinG = Math.round(profile.weightKg * 1.8);
  const fatG = Math.round((calories * 0.3) / 9);
  const carbsG = Math.round((calories - proteinG * 4 - fatG * 9) / 4);
  const sugarG = Math.round((calories * 0.1) / 4);
  const fiberG = profile.sex === "MALE" ? 34 : 28;

  return { calories, proteinG, carbsG, fatG, sugarG, fiberG };
}
