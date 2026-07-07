/**
 * Local calendar-day key (YYYY-MM-DD), NOT toISOString()'s UTC day — the app
 * always reasons about "today"/streaks in the user's local time, and mixing
 * the two silently mis-buckets evening logs in any non-UTC timezone.
 */
export function localDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
