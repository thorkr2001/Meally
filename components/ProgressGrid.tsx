import type { DayEvaluation, MetricStatus } from "@/lib/progress";

const METRIC_ORDER: (keyof DayEvaluation["status"])[] = [
  "calories",
  "proteinG",
  "carbsG",
  "fatG",
  "sugarG",
  "fiberG",
];

const METRIC_LABELS: Record<keyof DayEvaluation["status"], string> = {
  calories: "Cal",
  proteinG: "Pro",
  carbsG: "Carb",
  fatG: "Fat",
  sugarG: "Sugar",
  fiberG: "Fiber",
};

const STATUS_STYLE: Record<MetricStatus, { symbol: string; className: string }> = {
  hit: { symbol: "✓", className: "bg-[#0ca30c]/15 text-[#0ca30c]" },
  under: { symbol: "▼", className: "bg-[#fab219]/20 text-[#a66a00]" },
  over: { symbol: "▲", className: "bg-[#d03b3b]/15 text-[#d03b3b]" },
};

function formatDayLabel(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString(undefined, { weekday: "short", month: "numeric", day: "numeric" });
}

export function ProgressGrid({ days }: { days: DayEvaluation[] }) {
  if (days.length === 0) {
    return <p className="text-sm text-neutral-400">Log a few meals to start tracking your progress.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] border-collapse text-xs">
        <thead>
          <tr>
            <th className="pb-1.5 text-left font-medium text-neutral-400">Day</th>
            {METRIC_ORDER.map((metric) => (
              <th key={metric} className="pb-1.5 text-center font-medium text-neutral-400">
                {METRIC_LABELS[metric]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.date} className="border-t border-neutral-100">
              <td className="py-1.5 pr-2 font-medium text-neutral-600">{formatDayLabel(day.date)}</td>
              {METRIC_ORDER.map((metric) => {
                const status = day.status[metric];
                const style = STATUS_STYLE[status];
                return (
                  <td key={metric} className="py-1.5 text-center">
                    <span
                      title={`${METRIC_LABELS[metric]}: ${day.totals[metric]} (${status})`}
                      className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${style.className}`}
                    >
                      {style.symbol}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-neutral-400">✓ on target · ▼ under · ▲ over (over ceiling for sugar)</p>
    </div>
  );
}
