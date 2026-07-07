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

// Streaks realistically span at most this many consecutive days; bounding
// the query keeps it cheap regardless of how much logging history piles up
// over months/years of use, instead of re-scanning every MealLog ever
// written on every /today and /profile page load.
const STREAK_LOOKBACK_DAYS = 400;

export function getRecentLoggedDates() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - STREAK_LOOKBACK_DAYS);
  return db.mealLog.findMany({ where: { loggedAt: { gte: cutoff } }, select: { loggedAt: true } });
}

/**
 * MealLog rows whose Meal was deleted out from under them (a regenerated
 * day/plan disconnects rather than deletes the log, to preserve history —
 * see disconnectMealLogs). Not scoped to today: the meal that got deleted
 * could have been on any day, so a log from last week is just as orphaned
 * and just as much in need of a place the user can see and remove it from.
 */
export function getOrphanedMealLogs() {
  return db.mealLog.findMany({ where: { mealId: null }, orderBy: { loggedAt: "desc" } });
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
