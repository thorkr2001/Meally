import { localDateKey } from "@/lib/dates";

export function computeStreak(loggedAtDates: Date[]): number {
  if (loggedAtDates.length === 0) return 0;

  const days = new Set(loggedAtDates.map(localDateKey));
  let streak = 0;
  const cursor = new Date();

  while (days.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export function currentDayOfWeek(): number {
  const jsDay = new Date().getDay(); // 0 = Sunday .. 6 = Saturday
  return jsDay === 0 ? 6 : jsDay - 1; // 0 = Monday .. 6 = Sunday
}
