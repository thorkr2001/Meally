// One-off data migration helper: dumps every row from the current database
// (whatever DATABASE_URL points to) into a single JSON file, in dependency
// order, so it can be re-imported into a different database (e.g. moving
// from local SQLite to Supabase Postgres) via import-data.ts.
//
// Usage: npx tsx scripts/export-data.ts > backup.json
import { db } from "@/lib/db";

async function main() {
  const data = {
    profiles: await db.profile.findMany(),
    weightLogs: await db.weightLog.findMany(),
    nutritionPlans: await db.nutritionPlan.findMany(),
    dislikedIngredients: await db.dislikedIngredient.findMany(),
    mealPlans: await db.mealPlan.findMany(),
    mealPlanDays: await db.mealPlanDay.findMany(),
    meals: await db.meal.findMany(),
    mealLogs: await db.mealLog.findMany(),
    progressFeedback: await db.progressFeedback.findMany(),
  };

  console.log(JSON.stringify(data, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
