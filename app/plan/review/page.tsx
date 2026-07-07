import { redirect } from "next/navigation";
import { getDraftNutritionPlan, getProfile } from "@/lib/session";
import { updatePlan, revisePlan, acceptPlan } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

export const dynamic = "force-dynamic";
// revisePlan's reviseNutritionPlan call can run long enough to need headroom
// past most serverless platforms' default function timeout.
export const maxDuration = 60;

const inputClass =
  "rounded-xl border-[1.5px] border-border-light px-3.5 py-2.5 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1";
const labelClass = "flex flex-col gap-1.5 text-[13px] font-semibold text-ink";
const outlineButtonClass =
  "rounded-xl border-[1.5px] border-border-light px-4 py-2.5 text-sm font-semibold text-ink hover:bg-app-bg/60";

export default async function PlanReviewPage() {
  const profile = await getProfile();
  if (!profile) redirect("/onboarding");

  const plan = await getDraftNutritionPlan(profile.id);
  if (!plan) redirect("/onboarding");

  return (
    <div className="rounded-[28px] bg-white px-11 py-12 shadow-shell">
      <h1 className="font-display text-[28px] font-bold text-ink">Your nutrition plan</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Review your daily targets. Tweak the numbers directly, or ask for a change below.
      </p>

      <div className="mt-6 rounded-2xl border-[1.5px] border-border-light bg-app-bg/40 p-4 text-sm text-ink-soft">
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
            <label key={field} className={labelClass}>
              {label}
              <input name={field} type="number" defaultValue={plan[field]} className={inputClass} />
            </label>
          ))}
        </div>
        <SubmitButton pendingText="Saving..." className={outlineButtonClass}>
          Save changes
        </SubmitButton>
      </form>

      <form action={revisePlan} className="mt-6 flex flex-col gap-2">
        <input type="hidden" name="id" value={plan.id} />
        <label className={labelClass}>Want something different?</label>
        <textarea
          name="feedback"
          rows={2}
          placeholder="e.g. a bit more protein, lower the carbs"
          className={`${inputClass} resize-y`}
        />
        <SubmitButton pendingText="Revising your plan..." className={`${outlineButtonClass} self-start`}>
          Regenerate with feedback
        </SubmitButton>
      </form>

      <form action={acceptPlan} className="mt-6">
        <input type="hidden" name="id" value={plan.id} />
        <SubmitButton
          pendingText="Saving..."
          className="w-full rounded-2xl bg-primary px-4 py-3.5 text-[15px] font-bold text-white hover:bg-primary-hover"
        >
          Accept plan &amp; build my meal plan
        </SubmitButton>
      </form>
    </div>
  );
}
