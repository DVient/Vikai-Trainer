/**
 * VIKAI — Activity calendar helpers (design iteration).
 *
 * Pure month/day/timeline math over the store's existing records: past days
 * come from check-ins, activity logs, and workout logs; future days come
 * from scheduled events. Deterministic; the only engine import is the pure
 * `toLocalDateString` date bucketing helper.
 */

import { isCompetitionEvent, toLocalDateString } from "../engine/autoregulation";
import { planStatus } from "../plans/planBuilder";
import { ACTIVITY_TYPE_LABELS, SCHEDULED_EVENT_LABELS } from "./format";
import type { BuiltPlan, ScheduledEvent, ScheduledEventType } from "../types";

/* ───────────────────────────── Month matrix ───────────────────────────── */

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** "January 2026" style label. `month` is 1-based. */
export function monthLabel(year: number, month: number): string {
  const name = MONTH_NAMES[month - 1] ?? "";
  return `${name} ${year}`;
}

function utcDateKey(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

/**
 * Sunday-start weeks of "YYYY-MM-DD" cells (or `null` for padding outside
 * the month). `month` is 1-based. Uses UTC arithmetic on date-only keys so
 * results never shift with the host timezone.
 */
export function monthMatrix(year: number, month: number): ReadonlyArray<ReadonlyArray<string | null>> {
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const cells: Array<string | null> = [];
  for (let i = 0; i < firstDow; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(utcDateKey(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: Array<Array<string | null>> = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/* ─────────────────────────────── Day marks ────────────────────────────── */

export interface DayMark {
  checkedIn: boolean;
  activityCount: number;
  workoutCompleted: boolean;
  hasEvent: boolean;
  /** Any competition the athlete walks into wanting to perform. */
  isCompetition: boolean;
  /** A session is planned for this day (default plan or built plan). */
  plannedWorkout: boolean;
}

export interface DayMarkSources {
  readiness: ReadonlyArray<{ localDate: string }>;
  activities: ReadonlyArray<{ activityDate: string }>;
  workoutLogs: ReadonlyArray<{ activityDate: string }>;
  events: ReadonlyArray<{ startAt: string; eventType: ScheduledEventType }>;
  /** Local dates (today or later) with a planned session. */
  plannedWorkoutDates?: ReadonlyArray<string>;
}

/** Aggregates what happened (or is scheduled) on one calendar day. */
export function dayMarks(sources: DayMarkSources, date: string, timezone: string): DayMark {
  return {
    checkedIn: sources.readiness.some((entry) => entry.localDate === date),
    activityCount: sources.activities.filter((entry) => entry.activityDate === date).length,
    workoutCompleted: sources.workoutLogs.some((entry) => entry.activityDate === date),
    hasEvent: sources.events.some(
      (event) => eventDate(event.startAt, timezone) === date,
    ),
    isCompetition: sources.events.some(
      (event) =>
        isCompetitionEvent(event.eventType) && eventDate(event.startAt, timezone) === date,
    ),
    plannedWorkout: sources.plannedWorkoutDates?.includes(date) ?? false,
  };
}

function eventDate(startAt: string, timezone: string): string {
  const kickoff = new Date(startAt);
  if (!Number.isFinite(kickoff.getTime())) return "";
  return toLocalDateString(kickoff, timezone);
}

/** Marks for every real date cell of a month (padding cells are omitted). */
export function monthMarks(
  sources: DayMarkSources,
  weeks: ReadonlyArray<ReadonlyArray<string | null>>,
  timezone: string,
): Record<string, DayMark> {
  const marks: Record<string, DayMark> = {};
  for (const week of weeks) {
    for (const cell of week) {
      if (cell !== null) marks[cell] = dayMarks(sources, cell, timezone);
    }
  }
  return marks;
}

/* ────────────────────── Planned-session dates ─────────────────────────── */

/**
 * Today/future dates a plan (default or built) still covers and that have
 * no completed session yet — the violet "planned workout" dots. Pure, and
 * shared by the calendar screen and the event form's date picker so both
 * agree on which days carry a session.
 */
export function plannedWorkoutDatesFor(
  weeks: ReadonlyArray<ReadonlyArray<string | null>>,
  today: string,
  activePlan: Readonly<Pick<BuiltPlan, "startDate" | "periodWeeks">> | null,
  workoutLogs: ReadonlyArray<{ activityDate: string }>,
): string[] {
  const logged = new Set(workoutLogs.map((entry) => entry.activityDate));
  const dates: string[] = [];
  for (const week of weeks) {
    for (const cell of week) {
      if (cell === null || cell < today || logged.has(cell)) continue;
      if (activePlan && planStatus(activePlan, cell) === "ended") continue;
      dates.push(cell);
    }
  }
  return dates;
}

/* ──────────────────────────── Day timeline ────────────────────────────── */

export interface TimelineEntry {
  /** Formatted local clock time, e.g. "3:45 PM" ("" when unavailable). */
  time: string;
  emoji: string;
  text: string;
  /** Present on scheduled events so rows can link to edit. */
  eventId?: string;
  /** Total members when the event belongs to a recurring series (🔁 badge). */
  seriesCount?: number;
  /** Millisecond sort key (entries without a timestamp sort last). */
  sortKey: number;
}

/** What the plan says the athlete will do on a day (before it's logged). */
export interface PlannedWorkoutEntry {
  /** "Strength + speed" / "Practice + upper primer" / "Recovery & skills". */
  label: string;
  /** Optional secondary line ("Base template" / "GET STRONGER · Week 2"). */
  detail?: string;
}

/** Emoji for a planned-workout focus label (timeline rows). */
export function plannedWorkoutEmoji(label: string): string {
  if (label.includes("Practice")) return "🏀";
  if (label.includes("Recovery")) return "🧘";
  return "🏋️";
}

/**
 * Timestamped rows for one day, past or future: readiness, activities, and
 * completed sessions from the logs; scheduled games/practices from events;
 * the planned workout (today/future, unlogged days) sorts first.
 */
export function dayTimeline(
  sources: DayMarkSources & {
    activities: ReadonlyArray<{
      activityDate: string;
      createdAt?: string;
      activityType: keyof typeof ACTIVITY_TYPE_LABELS;
      sessionRpe?: number;
      durationMinutes?: number;
    }>;
    workoutLogs: ReadonlyArray<{ activityDate: string; createdAt?: string; notes?: string }>;
    events: ReadonlyArray<{
      id: string;
      startAt: string;
      eventType: ScheduledEventType;
      title?: string;
      seriesId?: string;
    }>;
    readiness: ReadonlyArray<{ localDate: string; recordedAt: string }>;
  },
  date: string,
  timezone: string,
  planned?: PlannedWorkoutEntry,
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  if (planned !== undefined) {
    const detail = planned.detail !== undefined ? ` — ${planned.detail}` : "";
    entries.push({
      time: "",
      emoji: plannedWorkoutEmoji(planned.label),
      text: `Planned: ${planned.label}${detail}`,
      sortKey: -1,
    });
  }

  for (const entry of sources.readiness) {
    if (entry.localDate !== date) continue;
    entries.push({
      time: formatTimeOfDay(entry.recordedAt, timezone),
      emoji: "✅",
      text: "Ready State locked in",
      sortKey: timestampOf(entry.recordedAt),
    });
  }

  for (const entry of sources.activities) {
    if (entry.activityDate !== date) continue;
    const load = (entry.sessionRpe ?? 0) * (entry.durationMinutes ?? 0);
    entries.push({
      time: formatTimeOfDay(entry.createdAt ?? "", timezone),
      emoji: "📝",
      text: `${ACTIVITY_TYPE_LABELS[entry.activityType]} · RPE ${entry.sessionRpe ?? "?"} · ${entry.durationMinutes ?? "?"} min · load ${load}`,
      sortKey: timestampOf(entry.createdAt ?? ""),
    });
  }

  for (const entry of sources.workoutLogs) {
    if (entry.activityDate !== date) continue;
    entries.push({
      time: formatTimeOfDay(entry.createdAt ?? "", timezone),
      emoji: "🏀",
      text: entry.notes ? `Game Plan completed — ${entry.notes}` : "Game Plan completed",
      sortKey: timestampOf(entry.createdAt ?? ""),
    });
  }

  const seriesCounts = new Map<string, number>();
  for (const event of sources.events) {
    if (event.seriesId !== undefined) {
      seriesCounts.set(event.seriesId, (seriesCounts.get(event.seriesId) ?? 0) + 1);
    }
  }

  for (const event of sources.events) {
    if (eventDate(event.startAt, timezone) !== date) continue;
    const label = SCHEDULED_EVENT_LABELS[event.eventType] ?? "📅 Event";
    entries.push({
      time: formatTimeOfDay(event.startAt, timezone),
      emoji: "📅",
      text: event.title ? `${label} — ${event.title}` : label,
      eventId: event.id,
      seriesCount: event.seriesId !== undefined ? seriesCounts.get(event.seriesId) : undefined,
      sortKey: timestampOf(event.startAt),
    });
  }

  return entries.sort((a, b) => a.sortKey - b.sortKey);
}

function timestampOf(iso: string): number {
  const time = new Date(iso).getTime();
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

/** Local clock time, e.g. "3:45 PM"; "" for invalid input. */
export function formatTimeOfDay(iso: string, timezone: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: timezone,
  }).format(date);
}

/** Human date label for a date-only key, e.g. "Fri, Jan 2". */
export function formatDateLong(date: string): string {
  const parsed = new Date(`${date}T12:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

/* ─────────────────── Scheduled commitments: next-7-days view ───────────── */

export interface WeekScheduleEvent {
  id: string;
  /** Formatted local clock time, e.g. "6:00 PM". */
  time: string;
  /** "🏆 Game — Home opener" style row text (same format as timelines). */
  text: string;
  /** Total members when the event belongs to a recurring series (🔁 badge). */
  seriesCount?: number;
}

export interface WeekScheduleDay {
  date: string;
  /** "Today", "Tomorrow", or a "Sat, Jan 10" style label. */
  label: string;
  /** Planned workout focus for the day, when one is planned. */
  planned?: { emoji: string; label: string };
  /** That day's scheduled events, soonest first. */
  events: WeekScheduleEvent[];
}

export interface WeekScheduleOptions {
  /** Window length in days (default 7, starting today). */
  days?: number;
  /** Pure callback supplying the planned-workout focus label for a date. */
  plannedLabelFor?: (date: string) => string | undefined;
}

/**
 * The forward schedule, day by day: one row per local date starting today,
 * each with its label, planned-workout focus (when the callback supplies
 * one), and scheduled events. Pure: no storage, no clock (now is injected).
 */
export function weekSchedule(
  events: ReadonlyArray<
    Pick<ScheduledEvent, "id" | "startAt" | "eventType" | "title"> & { seriesId?: string }
  >,
  now: Date,
  timezone: string,
  options: WeekScheduleOptions = {},
): WeekScheduleDay[] {
  const days = options.days ?? 7;
  const today = toLocalDateString(now, timezone);
  const parts = today.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const firstDay = Number(parts[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(firstDay)) {
    return [];
  }

  const seriesCounts = new Map<string, number>();
  for (const event of events) {
    if (event.seriesId !== undefined) {
      seriesCounts.set(event.seriesId, (seriesCounts.get(event.seriesId) ?? 0) + 1);
    }
  }

  const rows: WeekScheduleDay[] = [];
  for (let offset = 0; offset < days; offset += 1) {
    const date = utcDateKey(year, month, firstDay + offset);
    const label =
      offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : formatDateLong(date);

    const dayEvents = events
      .map((event) => ({ event, kickoff: new Date(event.startAt).getTime() }))
      .filter((entry) => Number.isFinite(entry.kickoff) && eventDate(entry.event.startAt, timezone) === date)
      .sort((a, b) => a.kickoff - b.kickoff)
      .map(({ event }) => {
        const eventLabel = SCHEDULED_EVENT_LABELS[event.eventType] ?? "📅 Event";
        return {
          id: event.id,
          time: formatTimeOfDay(event.startAt, timezone),
          text: event.title ? `${eventLabel} — ${event.title}` : eventLabel,
          seriesCount:
            event.seriesId !== undefined ? seriesCounts.get(event.seriesId) : undefined,
        };
      });

    const plannedLabel = options.plannedLabelFor?.(date);
    rows.push({
      date,
      label,
      planned:
        plannedLabel !== undefined
          ? { emoji: plannedWorkoutEmoji(plannedLabel), label: plannedLabel }
          : undefined,
      events: dayEvents,
    });
  }
  return rows;
}
