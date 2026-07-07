// Counterpart to export-data.ts: restores a JSON backup produced by that
// script into the database DATABASE_URL currently points to. Run this
// AFTER switching prisma/schema.prisma to the new database and applying
// migrations there, so the tables already exist.
//
// Usage: npx tsx scripts/import-data.ts backup.json
import { readFileSync } from "fs";
import { db } from "@/lib/db";

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("Usage: npx tsx scripts/import-data.ts <backup.json>");
    process.exit(1);
  }
  const data = JSON.parse(readFileSync(path, "utf-8"));

  // Dependency order: parents before children, matching the FK chain
  // Profile -> NutritionPlan -> MealPlan -> MealPlanDay -> Meal -> MealLog.
  await db.profile.createMany({ data: data.profiles });
  await db.weightLog.createMany({ data: data.weightLogs });
  await db.nutritionPlan.createMany({ data: data.nutritionPlans });
  await db.dislikedIngredient.createMany({ data: data.dislikedIngredients });
  await db.progressFeedback.createMany({ data: data.progressFeedback });
  await db.mealPlan.createMany({ data: data.mealPlans });
  await db.mealPlanDay.createMany({ data: data.mealPlanDays });
  await db.meal.createMany({ data: data.meals });
  await db.mealLog.createMany({ data: data.mealLogs });

  console.log("Import complete:", {
    profiles: data.profiles.length,
    weightLogs: data.weightLogs.length,
    nutritionPlans: data.nutritionPlans.length,
    dislikedIngredients: data.dislikedIngredients.length,
    progressFeedback: data.progressFeedback.length,
    mealPlans: data.mealPlans.length,
    mealPlanDays: data.mealPlanDays.length,
    meals: data.meals.length,
    mealLogs: data.mealLogs.length,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
