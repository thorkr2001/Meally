"use client";

import { useState } from "react";
import { SubmitButton } from "./SubmitButton";

export function PortionLogger({
  mealId,
  calories,
  action,
}: {
  mealId: string;
  calories: number;
  action: (formData: FormData) => void;
}) {
  const [portionPct, setPortionPct] = useState(100);

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="mealId" value={mealId} />
      <input type="hidden" name="portion" value={portionPct} />
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={25}
          max={200}
          step={25}
          value={portionPct}
          onChange={(e) => setPortionPct(Number(e.target.value))}
          aria-label="Portion size"
          className="w-24 accent-emerald-600"
        />
        <span className="w-10 text-right text-xs font-medium text-neutral-500">{portionPct}%</span>
      </div>
      <p className="text-[11px] text-neutral-400">≈ {Math.round((calories * portionPct) / 100)} kcal</p>
      <SubmitButton
        pendingText="Logging..."
        className="rounded-full bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
      >
        Log it
      </SubmitButton>
    </form>
  );
}
