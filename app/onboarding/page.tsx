import { createProfile } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

export default function OnboardingPage() {
  return (
    <div className="mx-auto max-w-md px-6 py-10">
      <h1 className="text-2xl font-bold">Welcome to Meally</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Tell us a bit about yourself so we can build your personalized nutrition plan.
      </p>

      <form action={createProfile} className="mt-8 flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Weight (kg)
            <input
              name="weightKg"
              type="number"
              step="0.1"
              required
              className="rounded-lg border border-neutral-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Height (cm)
            <input
              name="heightCm"
              type="number"
              step="0.1"
              required
              className="rounded-lg border border-neutral-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Age
            <input
              name="age"
              type="number"
              required
              className="rounded-lg border border-neutral-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Sex
            <select name="sex" required className="rounded-lg border border-neutral-300 px-3 py-2">
              <option value="FEMALE">Female</option>
              <option value="MALE">Male</option>
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Activity level
          <select name="activityLevel" required className="rounded-lg border border-neutral-300 px-3 py-2">
            <option value="SEDENTARY">Sedentary (little to no exercise)</option>
            <option value="LIGHT">Light (1-3 days/week)</option>
            <option value="MODERATE">Moderate (3-5 days/week)</option>
            <option value="ACTIVE">Active (6-7 days/week)</option>
            <option value="VERY_ACTIVE">Very active (physical job or 2x/day)</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Goal
          <select name="goalType" required className="rounded-lg border border-neutral-300 px-3 py-2">
            <option value="LOSE">Lose weight</option>
            <option value="MAINTAIN">Maintain weight</option>
            <option value="GAIN">Gain weight</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Goal weight (kg) — optional
          <input
            name="goalWeightKg"
            type="number"
            step="0.1"
            className="rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Dietary preferences (comma-separated) — optional
          <input
            name="dietaryPreferences"
            placeholder="vegetarian, halal, low-carb"
            className="rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Conditions or diagnoses (comma-separated) — optional
          <textarea
            name="conditions"
            placeholder="type 2 diabetes, high blood pressure"
            className="rounded-lg border border-neutral-300 px-3 py-2"
            rows={2}
          />
        </label>

        <SubmitButton
          pendingText="Researching & building your plan..."
          className="mt-2 rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700"
        >
          Build my nutrition plan
        </SubmitButton>
      </form>
    </div>
  );
}
