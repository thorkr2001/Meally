export type MetricStatus = "hit" | "under" | "over";

export interface DayTotals {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  sugarG: number;
  fiberG: number;
}

export interface DayEvaluation {
  date: string;
  totals: DayTotals;
  status: Record<keyof DayTotals, MetricStatus>;
}

function bandStatus(consumed: number, target: number, tolerance = 0.15): MetricStatus {
  if (target <= 0) return "hit";
  const ratio = consumed / target;
  if (ratio < 1 - tolerance) return "under";
  if (ratio > 1 + tolerance) return "over";
  return "hit";
}

function minimumStatus(consumed: number, target: number, tolerance = 0.1): MetricStatus {
  if (target <= 0) return "hit";
  return consumed / target >= 1 - tolerance ? "hit" : "under";
}

function ceilingStatus(consumed: number, target: number): MetricStatus {
  if (target <= 0) return "hit";
  return consumed <= target ? "hit" : "over";
}

export function evaluateDay(date: string, totals: DayTotals, targets: DayTotals): DayEvaluation {
  return {
    date,
    totals,
    status: {
      calories: bandStatus(totals.calories, targets.calories),
      proteinG: minimumStatus(totals.proteinG, targets.proteinG),
      carbsG: bandStatus(totals.carbsG, targets.carbsG),
      fatG: bandStatus(totals.fatG, targets.fatG),
      sugarG: ceilingStatus(totals.sugarG, targets.sugarG),
      fiberG: minimumStatus(totals.fiberG, targets.fiberG),
    },
  };
}

export function groupLogsByDay<T extends { loggedAt: Date } & DayTotals>(
  logs: T[]
): Map<string, DayTotals> {
  const days = new Map<string, DayTotals>();

  for (const log of logs) {
    const key = log.loggedAt.toISOString().slice(0, 10);
    const existing = days.get(key) ?? { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, sugarG: 0, fiberG: 0 };
    days.set(key, {
      calories: existing.calories + log.calories,
      proteinG: existing.proteinG + log.proteinG,
      carbsG: existing.carbsG + log.carbsG,
      fatG: existing.fatG + log.fatG,
      sugarG: existing.sugarG + log.sugarG,
      fiberG: existing.fiberG + log.fiberG,
    });
  }

  return days;
}
