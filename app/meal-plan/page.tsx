import { redirect } from "next/navigation";
import { getActiveNutritionPlan, getDraftMealPlan, getActiveMealPlan, getProfile } from "@/lib/session";
import { currentDayOfWeek } from "@/lib/streaks";
import {
  generateMealPlanAction,
  acceptMealPlan,
  regenerateWholeMealPlan,
  reviseMealPlanAction,
} from "./actions";
import { SubmitButton } from "@/components/SubmitButton";
import { ConfirmForm } from "@/components/ConfirmForm";
import { MealPlanDays } from "@/components/MealPlanDays";

export const dynamic = "force-dynamic";

export default async function MealPlanPage() {
  const profile = await getProfile();
  if (!profile) redirect("/onboarding");

  const nutritionPlan = await getActiveNutritionPlan(profile.id);
  if (!nutritionPlan) redirect("/plan/review");

  const mealPlan =
    (await getDraftMealPlan(nutritionPlan.id)) ?? (await getActiveMealPlan(nutritionPlan.id));

  if (!mealPlan) {
    return (
      <div className="text-center">
        <h1 className="font-display text-[28px] font-bold text-ink">Let&apos;s build your meal plan</h1>
        <p className="mt-2 text-sm text-ink-soft">
          We&apos;ll create a full week of meals that hits your calorie and macro targets.
        </p>
        <form action={generateMealPlanAction} className="mt-6">
          <input type="hidden" name="nutritionPlanId" value={nutritionPlan.id} />
          <input type="hidden" name="profileId" value={profile.id} />
          <SubmitButton
            pendingText="Building your weekly meal plan..."
            className="w-full rounded-2xl bg-primary px-4 py-3.5 text-[15px] font-bold text-white hover:bg-primary-hover"
          >
            Generate my weekly meal plan
          </SubmitButton>
        </form>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-[28px] font-bold text-ink">Your weekly meal plan</h1>
      <p className="mt-1.5 text-sm text-ink-soft">
        Tap a day to review it, tap an ingredient you don&apos;t like to swap it out.
      </p>

      <MealPlanDays
        days={mealPlan.days}
        profileId={profile.id}
        mealPlanId={mealPlan.id}
        initialDay={currentDayOfWeek()}
      />

      <form
        action={reviseMealPlanAction}
        className="mt-5 flex flex-col gap-2.5 rounded-2xl bg-white p-5"
      >
        <input type="hidden" name="mealPlanId" value={mealPlan.id} />
        <label className="text-[13px] font-semibold text-ink">Feedback on the whole week?</label>
        <textarea
          name="feedback"
          rows={2}
          required
          placeholder="e.g. more variety in lunches, less repetition, swap out red meat"
          className="rounded-xl border-[1.5px] border-border-light px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
        />
        <SubmitButton
          pendingText="Rebuilding your week..."
          className="self-start rounded-xl border-[1.5px] border-border-light px-4 py-2.5 text-sm font-semibold text-ink hover:bg-app-bg/40"
        >
          Regenerate with feedback
        </SubmitButton>
      </form>

      {mealPlan.status === "DRAFT" && (
        <form action={acceptMealPlan} className="mt-6">
          <input type="hidden" name="mealPlanId" value={mealPlan.id} />
          <button
            type="submit"
            className="w-full rounded-2xl bg-primary px-4 py-3.5 text-[15px] font-bold text-white hover:bg-primary-hover"
          >
            Accept my meal plan
          </button>
        </form>
      )}

      <ConfirmForm
        action={regenerateWholeMealPlan}
        confirmMessage="Discard this meal plan and build a new one from scratch? This can't be undone."
        className="mt-3"
      >
        <input type="hidden" name="mealPlanId" value={mealPlan.id} />
        <SubmitButton
          pendingText="Regenerating your whole meal plan..."
          className="w-full rounded-2xl border-[1.5px] border-border-light px-4 py-3 text-sm font-semibold text-ink hover:bg-app-bg/40"
        >
          Not right? Regenerate the whole plan
        </SubmitButton>
      </ConfirmForm>
    </div>
  );
}
