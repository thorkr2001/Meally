"use client";

import { useState } from "react";
import type { Meal } from "@prisma/client";
import { SubmitButton } from "@/components/SubmitButton";
import { ConfirmForm } from "@/components/ConfirmForm";
import { MealRecipeInfo } from "@/components/MealRecipeInfo";
import { dislikeIngredient, regenerateDayAction, removeMeal } from "@/app/meal-plan/actions";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

interface DayWithMeals {
  id: string;
  dayOfWeek: number;
  meals: Meal[];
}

export function MealPlanDays({
  days,
  mealPlanId,
  initialDay,
}: {
  days: DayWithMeals[];
  mealPlanId: string;
  initialDay: number;
}) {
  const [selected, setSelected] = useState(
    days.some((d) => d.dayOfWeek === initialDay) ? initialDay : days[0]?.dayOfWeek ?? 0
  );
  const day = days.find((d) => d.dayOfWeek === selected);
  const totalPrepMinutes = day?.meals.reduce((sum, meal) => sum + meal.prepMinutes, 0) ?? 0;

  return (
    <>
      <div className="mt-6 flex flex-wrap gap-2">
        {days.map((d) => {
          const active = d.dayOfWeek === selected;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => setSelected(d.dayOfWeek)}
              className={`min-w-[76px] rounded-2xl px-4 py-3 text-[13px] font-semibold ${
                active
                  ? "bg-sidebar text-white"
                  : "border-[1.5px] border-border-light bg-white text-ink-soft hover:bg-app-bg/40"
              }`}
            >
              {DAY_LABELS[d.dayOfWeek]}
            </button>
          );
        })}
      </div>

      {day && (
        <div className="mt-5 flex flex-col gap-4 rounded-[22px] bg-white p-6">
          <p className="text-xs font-semibold text-ink-soft">⏱ ~{totalPrepMinutes} min of prep/cook today</p>
          {day.meals.map((meal) => {
            const ingredients: string[] = JSON.parse(meal.ingredients);
            return (
              <div key={meal.id} className="border-t border-border-light pt-3.5 first:border-none first:pt-0">
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] font-bold tracking-wide text-coral-text uppercase">{meal.type}</span>
                  <span className="text-xs text-ink-faint">
                    {meal.calories} kcal · ⏱ {meal.prepMinutes} min
                  </span>
                </div>
                <p className="mt-0.5 font-semibold text-ink">{meal.name}</p>
                <p className="mt-0.5 text-xs text-ink-soft">
                  P {meal.proteinG}g · C {meal.carbsG}g · F {meal.fatG}g · Sugar {meal.sugarG}g · Fiber {meal.fiberG}g
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {ingredients.map((ingredient) => (
                    <form key={ingredient} action={dislikeIngredient}>
                      <input type="hidden" name="mealPlanId" value={mealPlanId} />
                      <input type="hidden" name="ingredient" value={ingredient} />
                      <SubmitButton
                        pendingText="Swapping..."
                        className="rounded-full border border-border-light bg-white px-3 py-1.5 text-xs text-ink-soft hover:border-coral/50 hover:text-coral-text"
                      >
                        <span title="Don't like this">{ingredient} ✕</span>
                      </SubmitButton>
                    </form>
                  ))}
                </div>
                <MealRecipeInfo sourceUrl={meal.sourceUrl} notes={meal.notes} />

                <ConfirmForm
                  action={removeMeal}
                  confirmMessage={`Remove "${meal.name}" from your plan? This can't be undone.`}
                  className="mt-2 text-right"
                >
                  <input type="hidden" name="mealId" value={meal.id} />
                  <SubmitButton
                    pendingText="Removing..."
                    className="text-xs font-medium text-ink-faint hover:text-coral-text"
                  >
                    Remove meal
                  </SubmitButton>
                </ConfirmForm>
              </div>
            );
          })}

          <form action={regenerateDayAction} className="flex gap-2 border-t border-border-light pt-3.5">
            <input type="hidden" name="dayId" value={day.id} />
            <input
              type="text"
              name="feedback"
              required
              placeholder={`What do you want changed for ${DAY_NAMES[day.dayOfWeek]}?`}
              className="flex-1 rounded-lg border border-border-light px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
            />
            <SubmitButton
              pendingText="Updating..."
              className="rounded-lg border-[1.5px] border-border-light px-4 py-2 text-sm font-semibold text-ink hover:bg-app-bg/40"
            >
              Update day
            </SubmitButton>
          </form>
        </div>
      )}
    </>
  );
}
