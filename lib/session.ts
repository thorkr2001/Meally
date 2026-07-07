import { db } from "@/lib/db";

export function getProfile() {
  return db.profile.findFirst({ orderBy: { createdAt: "asc" } });
}

export function getActiveNutritionPlan(profileId: string) {
  return db.nutritionPlan.findFirst({
    where: { profileId, status: "ACCEPTED" },
    orderBy: { createdAt: "desc" },
  });
}

export function getDraftNutritionPlan(profileId: string) {
  return db.nutritionPlan.findFirst({
    where: { profileId, status: "DRAFT" },
    orderBy: { createdAt: "desc" },
  });
}

export function getActiveMealPlan(nutritionPlanId: string) {
  return db.mealPlan.findFirst({
    where: { nutritionPlanId, status: "ACCEPTED" },
    orderBy: { createdAt: "desc" },
    include: { days: { include: { meals: true }, orderBy: { dayOfWeek: "asc" } } },
  });
}

export function getDraftMealPlan(nutritionPlanId: string) {
  return db.mealPlan.findFirst({
    where: { nutritionPlanId, status: "DRAFT" },
    orderBy: { createdAt: "desc" },
    include: { days: { include: { meals: true }, orderBy: { dayOfWeek: "asc" } } },
  });
}

export async function getDislikedNames(profileId: string): Promise<string[]> {
  const rows = await db.dislikedIngredient.findMany({ where: { profileId } });
  return rows.map((r) => r.name);
}

export interface ProfileConstraints {
  conditions: string[];
  dietaryPreferences: string[];
  dislikedIngredients: string[];
}

export async function getProfileConstraints(profileId: string): Promise<ProfileConstraints> {
  const profile = await db.profile.findUniqueOrThrow({
    where: { id: profileId },
    include: { dislikedIngredients: true },
  });
  return {
    conditions: JSON.parse(profile.conditions),
    dietaryPreferences: JSON.parse(profile.dietaryPreferences),
    dislikedIngredients: profile.dislikedIngredients.map((d) => d.name),
  };
}

/**
 * Adds a disliked ingredient if it's not already present (case-insensitively —
 * SQLite has no case-insensitive unique index, so "Tomatoes" and "tomatoes"
 * would otherwise both land). The only place that should ever write a
 * DislikedIngredient row, so this guarantee can't be silently reintroduced by
 * a future call site duplicating the check.
 */
export async function addDislikedIngredientIfNew(profileId: string, name: string): Promise<string[]> {
  const existing = await getDislikedNames(profileId);
  if (existing.some((n) => n.toLowerCase() === name.toLowerCase())) return existing;

  await db.dislikedIngredient.create({ data: { profileId, name } });
  return [...existing, name];
}
