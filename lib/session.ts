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
