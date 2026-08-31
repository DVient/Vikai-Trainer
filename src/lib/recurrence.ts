/**
 * VIKAI — Recurrence expansion for the event form (Gmail-style series).
 *
 * Pure date math: the athlete picks a start date, the days of the week that
 * repeat, and a length in weeks; these helpers produce the concrete local
 * dates the series materializes into. No React Native, no storage, no
 * engine imports. Deterministic given their arguments (AGENTS.md quality).
 *
 * The start date itself counts as an occurrence only when its weekday is
 * among the selected days — like Google Calendar, the series begins on the
 * first matching weekday at or after the typed date.
 */

/** 0 = Sunday … 6 = Saturday (matches `new Date().getDay()`). */
export type Weekday = number;

export const MAX_RECURRENCE_WEEKS = 52;

export const WEEKDAY_LABELS_SHORT: readonly string[] = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];

/** ISO local date ("2026-09-12") → weekday (0 Sun … 6 Sat). */
export function weekdayOfIsoDate(localDate: string): Weekday {
  return new Date(`${localDate}T00:00:00.000Z`).getUTCDay();
}

/** Dedupes, sorts (Sun-first), and clamps raw weekday picks to 0–6. */
export function normalizeWeekdays(raw: readonly Weekday[]): Weekday[] {
  return [...new Set(raw.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort(
    (a, b) => a - b,
  );
}

/** "6" → 6; anything that is not an integer 1–MAX_WEEKS → null. */
export function parseWeeksInput(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const weeks = Number(trimmed);
  if (weeks < 1 || weeks > MAX_RECURRENCE_WEEKS) return null;
  return weeks;
}

/**
 * All local dates in [start, start + weeks × 7 days) whose weekday is
 * selected, ascending. `weeks ≥ 1` guarantees at least one occurrence for
 * any non-empty weekday set (a full week contains every weekday once).
 */
export function expandRecurrence(
  startLocalDate: string,
  weekdays: readonly Weekday[],
  weeks: number,
): string[] {
  const chosen = normalizeWeekdays(weekdays);
  if (chosen.length === 0 || weeks < 1) return [];

  const start = new Date(`${startLocalDate}T00:00:00.000Z`);
  if (!Number.isFinite(start.getTime())) return [];

  const totalDays = weeks * 7;
  const dates: string[] = [];
  for (let offset = 0; offset < totalDays; offset += 1) {
    const day = new Date(start.getTime() + offset * 24 * 60 * 60 * 1000);
    if (chosen.includes(day.getUTCDay())) {
      dates.push(day.toISOString().slice(0, 10));
    }
  }
  return dates;
}

/** "12 events · Tue, Sep 15 – Thu, Oct 22" style summary for the preview. */
export function recurrenceSummary(dates: readonly string[]): string {
  if (dates.length === 0) return "No events yet";
  const count = dates.length === 1 ? "1 event" : `${dates.length} events`;
  const first = new Date(`${dates[0]}T12:00:00.000Z`);
  const last = new Date(`${dates[dates.length - 1]}T12:00:00.000Z`);
  const format = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  if (dates.length === 1) return `${count} · ${format.format(first)}`;
  return `${count} · ${format.format(first)} – ${format.format(last)}`;
}
