"use client";

import { useState } from "react";
import { SubmitButton } from "./SubmitButton";

export function PortionLogger({
  mealId,
  profileId,
  calories,
  action,
}: {
  mealId: string;
  profileId: string;
  calories: number;
  action: (formData: FormData) => void;
}) {
  const [portionPct, setPortionPct] = useState(100);

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="mealId" value={mealId} />
      <input type="hidden" name="profileId" value={profileId} />
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
          className="w-24 accent-primary"
        />
        <span className="w-10 text-right text-xs font-medium text-ink-soft">{portionPct}%</span>
      </div>
      <p className="text-[11px] text-ink-faint">≈ {Math.round((calories * portionPct) / 100)} kcal</p>
      <SubmitButton
        pendingText="Logging..."
        className="rounded-full bg-primary px-3.5 py-2 text-sm font-bold text-white hover:bg-primary-hover"
      >
        Log it
      </SubmitButton>
    </form>
  );
}
