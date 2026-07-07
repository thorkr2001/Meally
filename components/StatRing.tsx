"use client";

import { useEffect, useState } from "react";

const RING_COLORS = {
  calories: "var(--color-coral)",
  protein: "var(--color-teal-accent)",
  carbs: "var(--color-violet)",
  fat: "var(--color-yellowgreen)",
} as const;

export function StatRing({
  label,
  value,
  target,
  unit,
  metric,
}: {
  label: string;
  value: number;
  target: number;
  unit: string;
  metric: keyof typeof RING_COLORS;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const raf = requestAnimationFrame(() => {
      timeout = setTimeout(() => setMounted(true), 80);
    });
    return () => {
      cancelAnimationFrame(raf);
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  const pct = target > 0 ? Math.min(value / target, 1) : 0;
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const offset = mounted ? circumference * (1 - pct) : circumference;
  const color = RING_COLORS[metric];

  return (
    <div
      aria-label={`${label}: ${Math.round(value)} of ${target}${unit}`}
      className="flex flex-col items-center gap-2 rounded-[22px] bg-white px-2 py-[18px]"
    >
      <svg width={92} height={92} viewBox="0 0 92 92">
        <circle cx={46} cy={46} r={radius} fill="none" stroke="var(--color-border-light)" strokeWidth={9} />
        <circle
          cx={46}
          cy={46}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 46 46)"
          className="transition-[stroke-dashoffset] duration-[1100ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]"
        />
      </svg>
      <p className="text-[15px] font-bold text-ink">
        {Math.round(value)}
        {unit}
      </p>
      <p className="text-[11px] text-ink-soft">
        /{target}
        {unit} {label.toLowerCase()}
      </p>
    </div>
  );
}
