const RING_COLORS = {
  calories: { light: "#2a78d6", dark: "#3987e5" },
  protein: { light: "#1baf7a", dark: "#199e70" },
  carbs: { light: "#eda100", dark: "#c98500" },
  fat: { light: "#008300", dark: "#008300" },
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
  const pct = target > 0 ? Math.min(value / target, 1) : 0;
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);
  const color = RING_COLORS[metric];

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg
        width="84"
        height="84"
        viewBox="0 0 84 84"
        className="[--ring-color:var(--ring-light)] dark:[--ring-color:var(--ring-dark)]"
        style={
          {
            "--ring-light": color.light,
            "--ring-dark": color.dark,
          } as React.CSSProperties
        }
      >
        <circle
          cx="42"
          cy="42"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-neutral-200"
        />
        <circle
          cx="42"
          cy="42"
          r={radius}
          fill="none"
          stroke="var(--ring-color)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 42 42)"
        />
        <text
          x="42"
          y="46"
          textAnchor="middle"
          className="fill-neutral-900 text-[15px] font-semibold"
        >
          {Math.round(value)}
        </text>
      </svg>
      <div className="text-center">
        <p className="text-xs font-medium text-neutral-700">{label}</p>
        <p className="text-[11px] text-neutral-400">
          / {target}
          {unit}
        </p>
      </div>
    </div>
  );
}
