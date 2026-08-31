/**
 * VIKAI — Presentation helpers for Phase 4 screens.
 *
 * Pure functions and label maps: no React Native, no storage, no engine
 * imports. Deterministic given their arguments (AGENTS.md code quality).
 */

import type {
  ActivityType,
  ScheduledEvent,
  ScheduledEventType,
  TrainingGoal,
  TrainingStress,
} from "../types";

/* ───────────────────────────── Label maps ─────────────────────────────── */

export const SCHEDULED_EVENT_LABELS: Record<ScheduledEventType, string> = {
  TEAM_PRACTICE: "🏀 Team practice",
  GAME: "🏆 Game",
  STRENGTH_SESSION: "💪 Strength session",
  SKILL_SESSION: "🎯 Skill session",
  SCHOOL: "🏫 School",
  OTHER: "✨ Other",
  BASKETBALL_CAMP: "🏕️ Basketball camp",
  ID_SESSION: "🪪 ID session",
  OTHER_SPORTS_GAME: "🥅 Other sport game",
};

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  TEAM_PRACTICE: "🏀 Hoops (practice)",
  GAME: "🏆 Game",
  SCHOOL_PE: "🏫 PE",
  FITNESS_TESTING: "📋 Fitness testing",
  PICKUP_BASKETBALL: "🤾 Pickup hoops",
  SKILL_WORK: "🎯 Skill work",
  STRENGTH_TRAINING: "💪 Strength",
  SPEED_TRAINING: "⚡ Sprints",
  OTHER: "✨ Other",
};

export const TRAINING_GOAL_LABELS: Record<TrainingGoal, string> = {
  STRENGTH: "Strength",
  EXPLOSIVENESS: "Explosive",
  CHANGE_OF_DIRECTION: "Change of direction",
  ACCELERATION: "Acceleration",
  DECELERATION: "Deceleration",
  SPEED: "Speed",
  RECOVERY: "Recovery",
};

export const STRESS_LABELS: Record<TrainingStress, string> = {
  HIGH: "High",
  LOW: "Low",
  RECOVERY: "Recovery",
};

/* ─────────────────────────── Countdown helpers ────────────────────────── */

/** Athlete-friendly countdown, e.g. "in 45 min", "in 3h 20m", "in 2d 4h". */
export function formatCountdown(now: Date, target: Date): string {
  const ms = target.getTime() - now.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return "Now";
  const totalMinutes = Math.floor(ms / 60_000);
  if (totalMinutes < 60) return `in ${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  if (hours < 24) return `in ${hours}h ${totalMinutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `in ${days}d ${hours % 24}h`;
}

export interface UpcomingEventView {
  event: ScheduledEvent;
  countdown: string;
}

/** Future events soonest-first, limited; unparseable dates are skipped. */
export function nextUpcomingEvents(
  events: readonly ScheduledEvent[],
  now: Date,
  limit = 3,
): UpcomingEventView[] {
  return events
    .map((event) => ({ event, kickoff: new Date(event.startAt).getTime() }))
    .filter((entry) => Number.isFinite(entry.kickoff) && entry.kickoff > now.getTime())
    .sort((a, b) => a.kickoff - b.kickoff)
    .slice(0, limit)
    .map((entry) => ({
      event: entry.event,
      countdown: formatCountdown(now, new Date(entry.event.startAt)),
    }));
}

/* ─────────────────────── Activity form (SPEC §29) ─────────────────────── */

export interface RpeBand {
  maxRpe: number;
  label: string;
  colorClass: string;
}

/** Effort slider bands, chilled-out → all-out (youth micro-copy). */
export const RPE_BANDS: readonly RpeBand[] = [
  { maxRpe: 3, label: "Chilling", colorClass: "bg-sky-500" },
  { maxRpe: 6, label: "Warming Up", colorClass: "bg-green-500" },
  { maxRpe: 8, label: "Locked In", colorClass: "bg-yellow-500" },
  { maxRpe: 10, label: "All Out", colorClass: "bg-red-500" },
];

export function rpeBand(rpe: number): RpeBand {
  for (const band of RPE_BANDS) {
    if (rpe <= band.maxRpe) return band;
  }
  return RPE_BANDS[RPE_BANDS.length - 1] ?? { maxRpe: 10, label: "All Out", colorClass: "bg-red-500" };
}

export function rpeBandClass(rpe: number): string {
  return rpeBand(rpe).colorClass;
}

/**
 * Validate the activity form before persisting (SPEC §10 ranges).
 * Returns an athlete-friendly error message, or null when valid.
 */
export function validateActivityDraft(
  sessionRpe: number,
  durationMinutes: number,
): string | null {
  if (!Number.isInteger(sessionRpe) || sessionRpe < 1 || sessionRpe > 10) {
    return "Effort must be a whole number between 1 and 10.";
  }
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 600) {
    return "Duration must be between 1 and 600 minutes.";
  }
  return null;
}
