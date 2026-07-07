import { createProfile } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

const inputClass =
  "rounded-xl border-[1.5px] border-border-light px-3.5 py-2.5 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1";
const labelClass = "flex flex-col gap-1.5 text-[13px] font-semibold text-ink";

export default function OnboardingPage() {
  return (
    <div className="rounded-[28px] bg-white px-11 py-12 shadow-shell">
      <span className="font-display text-base font-bold text-ink">Meally</span>
      <h1 className="mt-2 font-display text-[32px] font-bold text-ink">Welcome to Meally</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
        Tell us a bit about yourself so we can build your personalized nutrition plan.
      </p>

      <form action={createProfile} className="mt-8 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <label className={labelClass}>
            Weight (kg)
            <input name="weightKg" type="number" step="0.1" required className={inputClass} />
          </label>
          <label className={labelClass}>
            Height (cm)
            <input name="heightCm" type="number" step="0.1" required className={inputClass} />
          </label>
          <label className={labelClass}>
            Age
            <input name="age" type="number" required className={inputClass} />
          </label>
          <label className={labelClass}>
            Sex
            <select name="sex" required className={inputClass}>
              <option value="FEMALE">Female</option>
              <option value="MALE">Male</option>
            </select>
          </label>
        </div>

        <label className={labelClass}>
          Activity level
          <select name="activityLevel" required className={inputClass}>
            <option value="SEDENTARY">Sedentary (little to no exercise)</option>
            <option value="LIGHT">Light (1-3 days/week)</option>
            <option value="MODERATE">Moderate (3-5 days/week)</option>
            <option value="ACTIVE">Active (6-7 days/week)</option>
            <option value="VERY_ACTIVE">Very active (physical job or 2x/day)</option>
          </select>
        </label>

        <label className={labelClass}>
          Goal
          <select name="goalType" required className={inputClass}>
            <option value="LOSE">Lose weight</option>
            <option value="MAINTAIN">Maintain weight</option>
            <option value="GAIN">Gain weight</option>
          </select>
        </label>

        <label className={labelClass}>
          Goal weight (kg) — optional
          <input name="goalWeightKg" type="number" step="0.1" className={inputClass} />
        </label>

        <label className={labelClass}>
          Dietary preferences — optional
          <input name="dietaryPreferences" placeholder="vegetarian, halal, low-carb" className={inputClass} />
        </label>

        <label className={labelClass}>
          Conditions or diagnoses — optional
          <textarea
            name="conditions"
            placeholder="type 2 diabetes, high blood pressure"
            rows={2}
            className={`${inputClass} resize-y`}
          />
        </label>

        <SubmitButton
          pendingText="Researching & building your plan..."
          className="mt-3 w-full rounded-2xl bg-primary px-4 py-3.5 text-[15px] font-bold text-white hover:bg-primary-hover"
        >
          Build my nutrition plan
        </SubmitButton>
      </form>
    </div>
  );
}
