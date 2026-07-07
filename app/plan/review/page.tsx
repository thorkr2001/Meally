import { redirect } from "next/navigation";
import { getDraftNutritionPlan, getProfile } from "@/lib/session";
import { updatePlan, revisePlan, acceptPlan } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

export default async function PlanReviewPage() {
  const profile = await getProfile();
  if (!profile) redirect("/onboarding");

  const plan = await getDraftNutritionPlan(profile.id);
  if (!plan) redirect("/onboarding");

  return (
    <div className="mx-auto max-w-md px-6 py-10">
      <h1 className="text-2xl font-bold">Your nutrition plan</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Review your daily targets. Tweak the numbers directly, or ask for a change below.
      </p>

      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600">
        {plan.researchNotes}
      </div>

      <form key={plan.version} action={updatePlan} className="mt-6 flex flex-col gap-4">
        <input type="hidden" name="id" value={plan.id} />
        <div className="grid grid-cols-2 gap-4">
          {(
            [
              ["calories", "Calories"],
              ["proteinG", "Protein (g)"],
              ["carbsG", "Carbs (g)"],
              ["fatG", "Fat (g)"],
              ["sugarG", "Sugar ceiling (g)"],
              ["fiberG", "Fiber (g)"],
            ] as const
          ).map(([field, label]) => (
            <label key={field} className="flex flex-col gap-1 text-sm font-medium">
              {label}
              <input
                name={field}
                type="number"
                defaultValue={plan[field]}
                className="rounded-lg border border-neutral-300 px-3 py-2"
              />
            </label>
          ))}
        </div>
        <SubmitButton
          pendingText="Saving..."
          className="rounded-lg border border-neutral-300 px-4 py-2 font-medium hover:bg-neutral-50"
        >
          Save changes
        </SubmitButton>
      </form>

      <form action={revisePlan} className="mt-6 flex flex-col gap-2">
        <input type="hidden" name="id" value={plan.id} />
        <label className="text-sm font-medium">Want something different?</label>
        <textarea
          name="feedback"
          rows={2}
          placeholder="e.g. a bit more protein, lower the carbs"
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <SubmitButton
          pendingText="Revising your plan..."
          className="rounded-lg border border-neutral-300 px-4 py-2 font-medium hover:bg-neutral-50"
        >
          Regenerate with feedback
        </SubmitButton>
      </form>

      <form action={acceptPlan} className="mt-6">
        <input type="hidden" name="id" value={plan.id} />
        <SubmitButton
          pendingText="Saving..."
          className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700"
        >
          Accept plan &amp; build my meal plan
        </SubmitButton>
      </form>
    </div>
  );
}
