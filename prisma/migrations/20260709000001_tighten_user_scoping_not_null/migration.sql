-- DropForeignKey
ALTER TABLE "MealLog" DROP CONSTRAINT "MealLog_profileId_fkey";

-- AlterTable
ALTER TABLE "MealLog" ALTER COLUMN "profileId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Profile" ALTER COLUMN "userId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "MealLog" ADD CONSTRAINT "MealLog_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
