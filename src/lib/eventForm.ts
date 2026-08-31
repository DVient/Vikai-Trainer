/**
 * VIKAI — Event form helpers (athlete-managed calendar events).
 *
 * Pure parsing/validation for the add/edit event screen. The athlete types a
 * calendar date and a wall-clock time in their own timezone; these helpers
 * produce the UTC instant the engine and calendar expect.
 */

export type EventFormParseResult =
  | { ok: true; iso: string }
  | { ok: false; error: string };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{1,2}:\d{2}$/;

/** "2026-01-15" + "18:00" in the athlete's timezone → UTC ISO instant. */
export function parseEventDateTime(
  dateText: string,
  timeText: string,
  timezone: string,
): EventFormParseResult {
  const date = dateText.trim();
  const time = timeText.trim();

  if (!DATE_PATTERN.test(date)) {
    return { ok: false, error: "Use a date like 2026-01-15" };
  }
  if (!TIME_PATTERN.test(time)) {
    return { ok: false, error: "Use a time like 18:00" };
  }

  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    return { ok: false, error: "Use a date like 2026-01-15" };
  }
  if (hours === undefined || minutes === undefined) {
    return { ok: false, error: "Use a time like 18:00" };
  }
  if (month < 1 || month > 12) {
    return { ok: false, error: "Month must be 1–12" };
  }
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth) {
    return { ok: false, error: `${month}/${year} has ${daysInMonth} days` };
  }
  if (hours > 23 || minutes > 59) {
    return { ok: false, error: "Time must be a real clock time" };
  }

  // Anchor at local noon of the typed date, then offset by the typed time.
  // Noon keeps the date stable across DST-offset edges (±14h max offset).
  const anchor = new Date(`${date}T12:00:00.000Z`);
  if (!Number.isFinite(anchor.getTime())) {
    return { ok: false, error: "Use a date like 2026-01-15" };
  }
  const localNoonMinutes = wallClockMinutesAt(anchor, timezone);
  const targetMinutes = hours * 60 + minutes;
  const offsetMinutes = targetMinutes - localNoonMinutes;
  const instant = new Date(anchor.getTime() + offsetMinutes * 60_000);

  // Confirm the wall clock in the athlete's timezone actually landed on the
  // typed date (guards DST gaps like spring-forward).
  if (wallClockMinutesAt(instant, timezone) !== targetMinutes) {
    return { ok: false, error: "That time does not exist on this date (clock change)" };
  }
  return { ok: true, iso: instant.toISOString() };
}

/** Minutes since local midnight for an instant, in the given timezone. */
function wallClockMinutesAt(instant: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).formatToParts(instant);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  // "24" appears at exactly midnight in some ICU versions.
  return ((hour % 24) * 60 + minute);
}

/** Prefill payload for the edit form. */
export interface EventFormPrefill {
  dateText: string;
  timeText: string;
}

/** Reverse of parseEventDateTime: an existing ISO instant → form fields. */
export function prefillFromIso(iso: string, timezone: string): EventFormPrefill {
  const instant = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  }).formatToParts(instant);
  const pick = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";
  const dateText = `${pick("year")}-${pick("month")}-${pick("day")}`;

  const minutes = wallClockMinutesAt(instant, timezone);
  const timeText = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  return { dateText, timeText };
}

/** True when the event has not kicked off yet (editable). */
export function isEventEditable(startAt: string, now: Date): boolean {
  const kickoff = new Date(startAt).getTime();
  return Number.isFinite(kickoff) && kickoff > now.getTime();
}
