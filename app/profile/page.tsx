import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getProfile, getActiveNutritionPlan, getRecentLoggedDates } from "@/lib/session";
import { computeStreak } from "@/lib/streaks";
import { evaluateDay, groupLogsByDay, TRACKED_DAYS } from "@/lib/progress";
import { WeightChart } from "@/components/WeightChart";
import { Celebration } from "@/components/Celebration";
import { ResetButton } from "@/components/ResetButton";
import { ProgressGrid } from "@/components/ProgressGrid";
import { SubmitButton } from "@/components/SubmitButton";
import { FlameIcon } from "@/components/FlameIcon";
import {
  logWeight,
  resetApp,
  logout,
  removeDietaryPreference,
  removeDislikedIngredient,
  generateProgressFeedbackAction,
} from "./actions";

export const dynamic = "force-dynamic";

const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];

export default async function ProfilePage() {
  const profile = await getProfile();
  if (!profile) redirect("/onboarding");

  const periodStart = new Date();
  periodStart.setHours(0, 0, 0, 0);
  periodStart.setDate(periodStart.getDate() - (TRACKED_DAYS - 1));

  const [weightLogs, allMealLogs, dislikedIngredients, nutritionPlan, recentLogs, progressFeedback] =
    await Promise.all([
      db.weightLog.findMany({ where: { profileId: profile.id }, orderBy: { loggedAt: "asc" } }),
      getRecentLoggedDates(profile.id),
      db.dislikedIngredient.findMany({ where: { profileId: profile.id }, orderBy: { addedAt: "desc" } }),
      getActiveNutritionPlan(profile.id),
      db.mealLog.findMany({ where: { profileId: profile.id, loggedAt: { gte: periodStart } } }),
      db.progressFeedback.findUnique({ where: { profileId: profile.id } }),
    ]);
  const dietaryPreferences: string[] = JSON.parse(profile.dietaryPreferences);

  const streak = computeStreak(allMealLogs.map((l) => l.loggedAt));
  const hitStreakMilestone = STREAK_MILESTONES.includes(streak);

  let trackedDays: ReturnType<typeof evaluateDay>[] = [];
  if (nutritionPlan) {
    const dayTotals = groupLogsByDay(recentLogs);
    trackedDays = [...dayTotals.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, totals]) => evaluateDay(date, totals, nutritionPlan));
  }
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
    <div>
      <h1 className="font-display text-[28px] font-bold text-ink">Profile</h1>

      <div className="mt-4 flex flex-col gap-3">
        {reachedGoal && <Celebration message="You reached your goal weight!" />}
        {!reachedGoal && hitStreakMilestone && (
          <Celebration message={`${streak}-day logging streak! Keep it up.`} />
        )}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <div className="flex items-center gap-3.5 rounded-[20px] bg-white p-5">
          <FlameIcon size={26} />
          <div>
            <p className="font-display text-[22px] font-bold text-ink">
              {streak} day{streak === 1 ? "" : "s"}
            </p>
            <p className="text-xs text-ink-faint">logging streak</p>
          </div>
        </div>
        <div className="rounded-[20px] bg-white p-5">
          <div className="flex items-baseline justify-between">
            <p className="text-[13px] font-semibold text-ink-soft">Current weight</p>
            <p className="font-display text-xl font-bold text-ink">{currentWeight} kg</p>
          </div>
          {goalWeight != null && (
            <>
              <div className="mt-2.5 h-2 w-full rounded-full bg-border-light/60">
                <div className="h-2 rounded-full bg-primary" style={{ width: `${progressPct ?? 0}%` }} />
              </div>
              <p className="mt-1.5 text-[11px] text-ink-faint">
                Goal: {goalWeight} kg · {Math.round(progressPct ?? 0)}% there
              </p>
            </>
          )}
        </div>
      </div>

      {nutritionPlan && (
        <div className="mt-3.5 rounded-[20px] bg-white p-5">
          <p className="text-[13px] font-semibold text-ink-soft">Your progress</p>
          <p className="mt-0.5 text-[11px] text-ink-faint">Last {TRACKED_DAYS} days vs. your targets</p>
          <div className="mt-3.5">
            <ProgressGrid days={trackedDays} />
          </div>

          {(doingWell.length > 0 || improve.length > 0) && (
            <div className="mt-4 border-t border-border-light pt-3.5">
              {progressFeedback && <p className="text-sm text-ink">{progressFeedback.summary}</p>}
              {doingWell.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-bold tracking-wide text-primary-hover uppercase">Doing well</p>
                  <ul className="mt-1 list-disc pl-4 text-sm text-ink-soft">
                    {doingWell.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {improve.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-bold tracking-wide text-amber-text uppercase">Room to improve</p>
                  <ul className="mt-1 list-disc pl-4 text-sm text-ink-soft">
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
                className="w-full rounded-xl border-[1.5px] border-border-light px-4 py-2.5 text-sm font-semibold text-ink hover:bg-app-bg/40"
              >
                {progressFeedback ? "Refresh feedback" : "Get feedback on my week"}
              </SubmitButton>
            </form>
          )}
        </div>
      )}

      <div className="mt-3.5 rounded-[20px] bg-white p-5">
        <p className="mb-3 text-[13px] font-semibold text-ink-soft">Weight trend</p>
        <WeightChart logs={weightLogs} />
      </div>

      <form action={logWeight} className="mt-3.5 flex items-center gap-2.5 rounded-2xl bg-white p-4">
        <input type="hidden" name="profileId" value={profile.id} />
        <input
          name="weightKg"
          type="number"
          step="0.1"
          required
          placeholder="Log today's weight (kg)"
          className="flex-1 rounded-lg border-[1.5px] border-border-light px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
        />
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-hover"
        >
          Save
        </button>
      </form>

      {(dietaryPreferences.length > 0 || dislikedIngredients.length > 0) && (
        <div className="mt-3.5 rounded-2xl bg-white p-5">
          <p className="text-[13px] font-semibold text-ink-soft">Your food preferences</p>
          <p className="mt-0.5 text-[11px] text-ink-faint">
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
                  className="rounded-full border border-border-light px-3 py-1.5 text-xs text-ink-soft hover:border-coral/50 hover:text-coral-text"
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
                  className="rounded-full border border-border-light px-3 py-1.5 text-xs text-ink-soft hover:border-coral/50 hover:text-coral-text"
                >
                  🚫 {ingredient.name} ✕
                </button>
              </form>
            ))}
          </div>
        </div>
      )}

      <form action={logout} className="mt-6">
        <button
          type="submit"
          className="w-full rounded-2xl border-[1.5px] border-border-light px-4 py-3 text-[13px] font-semibold text-ink-soft hover:bg-app-bg/40"
        >
          Log out
        </button>
      </form>

      <div className="mt-3.5">
        <ResetButton profileId={profile.id} action={resetApp} />
      </div>
    </div>
  );
}
