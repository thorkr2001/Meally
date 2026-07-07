-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Meal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mealPlanDayId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ingredients" TEXT NOT NULL,
    "calories" INTEGER NOT NULL,
    "proteinG" INTEGER NOT NULL,
    "carbsG" INTEGER NOT NULL,
    "fatG" INTEGER NOT NULL,
    "sugarG" INTEGER NOT NULL,
    "fiberG" INTEGER NOT NULL,
    "prepMinutes" INTEGER NOT NULL DEFAULT 20,
    "sourceUrl" TEXT,
    "notes" TEXT,
    CONSTRAINT "Meal_mealPlanDayId_fkey" FOREIGN KEY ("mealPlanDayId") REFERENCES "MealPlanDay" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Meal" ("calories", "carbsG", "description", "fatG", "fiberG", "id", "ingredients", "mealPlanDayId", "name", "notes", "proteinG", "sourceUrl", "sugarG", "type") SELECT "calories", "carbsG", "description", "fatG", "fiberG", "id", "ingredients", "mealPlanDayId", "name", "notes", "proteinG", "sourceUrl", "sugarG", "type" FROM "Meal";
DROP TABLE "Meal";
ALTER TABLE "new_Meal" RENAME TO "Meal";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
