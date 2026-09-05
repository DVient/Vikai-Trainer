/**
 * VIKAI — Default practice schedule (calendar seeding).
 *
 * Pure: builds the recurring team-practice series the app seeds on first
 * run — Tuesday, Wednesday & Thursday at 6:00 PM local, from the season
 * start through the end of the Fall 2026 competition phase. The store turns
 * the drafts into real, editable ScheduledEvents once, guarded by a
 * persistence flag so athlete edits and deletions always stick.
 */

import { DEFAULT_SEASON_CONFIG } from "../config/defaults";
import { parseEventDateTime } from "./eventForm";
import { expandRecurrence } from "./recurrence";
import { FALL_2026_PHASES } from "../plans/fall2026";
import type { ScheduledEventType } from "../types";

export const DEFAULT_PRACTICE_TITLE = "Team practice";

/** A single seeded event draft (the store assigns ids and timestamps). */
export interface DefaultEventDraft {
  eventType: ScheduledEventType;
  /** UTC ISO instant for the local wall-clock date + practice time. */
  startAt: string;
  title: string;
}

/**
 * All default practice drafts for the athlete's timezone: every Tue/Wed/Thu
 * from the season start through the Fall 2026 competition end, at 6:00 PM
 * local. Deterministic; empty when the configuration yields no dates.
 */
export function defaultPracticeEventDrafts(timezone: string): DefaultEventDraft[] {
  const seasonStart = DEFAULT_SEASON_CONFIG.seasonStart;
  const horizon = FALL_2026_PHASES[FALL_2026_PHASES.length - 1]?.endsOn ?? seasonStart;

  const startMs = new Date(`${seasonStart}T00:00:00.000Z`).getTime();
  const horizonMs = new Date(`${horizon}T00:00:00.000Z`).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(horizonMs) || horizonMs < startMs) {
    return [];
  }
  const weeks = Math.min(
    52,
    Math.max(1, Math.ceil((horizonMs - startMs) / (7 * 86_400_000))),
  );

  const drafts: DefaultEventDraft[] = [];
  for (const date of expandRecurrence(
    seasonStart,
    DEFAULT_SEASON_CONFIG.practiceWeekdays,
    weeks,
  )) {
    const parsed = parseEventDateTime(date, DEFAULT_SEASON_CONFIG.practiceTime, timezone);
    if (parsed.ok) {
      drafts.push({
        eventType: "TEAM_PRACTICE",
        startAt: parsed.iso,
        title: DEFAULT_PRACTICE_TITLE,
      });
    }
  }
  return drafts;
}
