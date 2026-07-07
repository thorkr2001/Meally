import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getProfile, getActiveNutritionPlan } from "@/lib/session";
import { computeStreak } from "@/lib/streaks";
import { evaluateDay, groupLogsByDay } from "@/lib/progress";
import { WeightChart } from "@/components/WeightChart";
import { Celebration } from "@/components/Celebration";
import { ResetButton } from "@/components/ResetButton";
import { ProgressGrid } from "@/components/ProgressGrid";
import { SubmitButton } from "@/components/SubmitButton";
import {
  logWeight,
  resetApp,
  removeDietaryPreference,
  removeDislikedIngredient,
  generateProgressFeedbackAction,
} from "./actions";

const TRACKED_DAYS = 7;

export const dynamic = "force-dynamic";

const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];

export default async function ProfilePage() {
  const profile = await getProfile();
  if (!profile) redirect("/onboarding");

  const weightLogs = await db.weightLog.findMany({
    where: { profileId: profile.id },
    orderBy: { loggedAt: "asc" },
  });
  const allMealLogs = await db.mealLog.findMany({ select: { loggedAt: true } });
  const dietaryPreferences: string[] = JSON.parse(profile.dietaryPreferences);
  const dislikedIngredients = await db.dislikedIngredient.findMany({
    where: { profileId: profile.id },
    orderBy: { addedAt: "desc" },
  });

  const streak = computeStreak(allMealLogs.map((l) => l.loggedAt));
  const hitStreakMilestone = STREAK_MILESTONES.includes(streak);

  const nutritionPlan = await getActiveNutritionPlan(profile.id);
  let trackedDays: ReturnType<typeof evaluateDay>[] = [];
  if (nutritionPlan) {
    const periodStart = new Date();
    periodStart.setHours(0, 0, 0, 0);
    periodStart.setDate(periodStart.getDate() - (TRACKED_DAYS - 1));
    const recentLogs = await db.mealLog.findMany({ where: { loggedAt: { gte: periodStart } } });
    const dayTotals = groupLogsByDay(recentLogs);
    trackedDays = [...dayTotals.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, totals]) => evaluateDay(date, totals, nutritionPlan));
  }
  const progressFeedback = await db.progressFeedback.findUnique({ where: { profileId: profile.id } });
  const doingWell: string[] = progressFeedback ? JSON.parse(progressFeedback.doingWell) : [];
  const improve: string[] = progressFeedback ? JSON.parse(progressFeedback.improve) : [];

  const startWeight = weightLogs[0]?.weightKg ?? profile.weightKg;
  const currentWeight = profile.weightKg;
  const goalWeight = profile.goalWeightKg;

  let progressPct: number | null = null;
  let reachedGoal = false;
  if (goalWeight != null && startWeight !== goalWeight) {
    const totalToChange = startWeight - goalWeight;
    const progressMade = startWeight - currentWeight;
    progressPct = Math.min(100, Math.max(0, (progressMade / totalToChange) * 100));
    reachedGoal = Math.abs(currentWeight - goalWeight) < 0.5;
  }

  return (
    <div className="mx-auto max-w-md px-6 py-8">
      <h1 className="text-2xl font-bold">Profile</h1>

      <div className="mt-4 flex flex-col gap-3">
        {reachedGoal && <Celebration message="You reached your goal weight!" />}
        {!reachedGoal && hitStreakMilestone && (
          <Celebration message={`${streak}-day logging streak! Keep it up.`} />
        )}
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-xl border border-neutral-200 bg-white p-4">
        <span className="text-2xl">🔥</span>
        <div>
          <p className="text-lg font-bold leading-tight">{streak} day{streak === 1 ? "" : "s"}</p>
          <p className="text-xs text-neutral-400">logging streak</p>
        </div>
      </div>

      {nutritionPlan && (
        <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-sm font-medium text-neutral-500">Your progress</p>
          <p className="mt-0.5 text-xs text-neutral-400">Last {TRACKED_DAYS} days vs. your targets</p>
          <div className="mt-3">
            <ProgressGrid days={trackedDays} />
          </div>

          {(doingWell.length > 0 || improve.length > 0) && (
            <div className="mt-4 border-t border-neutral-100 pt-3">
              {progressFeedback && <p className="text-sm text-neutral-700">{progressFeedback.summary}</p>}
              {doingWell.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Doing well</p>
                  <ul className="mt-1 list-disc pl-4 text-sm text-neutral-600">
                    {doingWell.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {improve.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Room to improve</p>
                  <ul className="mt-1 list-disc pl-4 text-sm text-neutral-600">
                    {improve.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {trackedDays.length > 0 && (
            <form action={generateProgressFeedbackAction} className="mt-4">
              <input type="hidden" name="profileId" value={profile.id} />
              <SubmitButton
                pendingText="Analyzing your week..."
                className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
              >
                {progressFeedback ? "Refresh feedback" : "Get feedback on my week"}
              </SubmitButton>
            </form>
          )}
        </div>
      )}

      <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-medium text-neutral-500">Current weight</p>
          <p className="text-xl font-bold">{currentWeight} kg</p>
        </div>
        {goalWeight != null && (
          <>
            <div className="mt-2 h-2 w-full rounded-full bg-neutral-100">
              <div
                className="h-2 rounded-full bg-emerald-500"
                style={{ width: `${progressPct ?? 0}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-neutral-400">
              Goal: {goalWeight} kg · {Math.round(progressPct ?? 0)}% there
            </p>
          </>
        )}
        <div className="mt-4">
          <WeightChart logs={weightLogs} />
        </div>
      </div>

      <form action={logWeight} className="mt-4 flex gap-2 rounded-xl border border-neutral-200 bg-white p-4">
        <input type="hidden" name="profileId" value={profile.id} />
        <input
          name="weightKg"
          type="number"
          step="0.1"
          required
          placeholder="Log today's weight (kg)"
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2"
        />
        <button
          type="submit"
          className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700"
        >
          Save
        </button>
      </form>

      {(dietaryPreferences.length > 0 || dislikedIngredients.length > 0) && (
        <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-sm font-medium text-neutral-500">Your food preferences</p>
          <p className="mt-0.5 text-xs text-neutral-400">
            Applied to every future meal plan. Remove anything that shouldn&apos;t be permanent.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {dietaryPreferences.map((preference) => (
              <form key={preference} action={removeDietaryPreference}>
                <input type="hidden" name="profileId" value={profile.id} />
                <input type="hidden" name="preference" value={preference} />
                <button
                  type="submit"
                  title="Remove"
                  className="rounded-full border border-neutral-200 px-2.5 py-1 text-xs text-neutral-600 hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                >
                  {preference} ✕
                </button>
              </form>
            ))}
            {dislikedIngredients.map((ingredient) => (
              <form key={ingredient.id} action={removeDislikedIngredient}>
                <input type="hidden" name="id" value={ingredient.id} />
                <button
                  type="submit"
                  title="Remove"
                  className="rounded-full border border-neutral-200 px-2.5 py-1 text-xs text-neutral-600 hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                >
                  🚫 {ingredient.name} ✕
                </button>
              </form>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8">
        <ResetButton action={resetApp} />
      </div>
    </div>
  );
}
