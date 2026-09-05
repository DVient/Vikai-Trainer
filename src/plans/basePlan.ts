/**
 * VIKAI — Base Training Plan (SPEC §21, §22)
 *
 * Static, code-owned session template for the default training objective
 * (strength, explosiveness, change of direction) organized on high/low
 * principles (SPEC §20). The Workout Generator maps engine restrictions onto
 * this plan at runtime; this file never reads engine state.
 *
 * The default plan is weekday-structured around the team's practice schedule
 * (SPEC §1.2 defaults): practice nights keep the legs out of the gym, Sunday
 * stays light, and the remaining days carry the full strength/speed template.
 */

import { DEFAULT_SEASON_CONFIG } from "../config/defaults";
import { weekdayOf } from "./fall2026";
import type { TrainingComponent } from "../types";

export const DEFAULT_BASE_PLAN = [
  {
    id: "primary-lower-squat",
    type: "STRENGTH",
    stress: "HIGH",
    priority: 1,
    baseVolume: 4,
    minimumVolume: 2,
    optional: false,
    bodyRegion: "LOWER",
    estimatedMinutes: 16,
    muscleGroups: ["QUAD"],
  },
  {
    id: "primary-upper-push",
    type: "STRENGTH",
    stress: "HIGH",
    priority: 1,
    baseVolume: 4,
    minimumVolume: 2,
    optional: false,
    bodyRegion: "UPPER",
    estimatedMinutes: 16,
    muscleGroups: ["ARM", "SHOULDER"],
  },
  {
    id: "explosive-jumps",
    type: "EXPLOSIVENESS",
    stress: "HIGH",
    priority: 2,
    baseVolume: 4,
    minimumVolume: 2,
    optional: false,
    bodyRegion: "LOWER",
    estimatedMinutes: 10,
    muscleGroups: ["QUAD", "CALF", "ANKLE"],
  },
  {
    id: "acceleration-sprints",
    type: "SPEED",
    stress: "HIGH",
    priority: 2,
    baseVolume: 3,
    minimumVolume: 1,
    optional: false,
    bodyRegion: "FULL",
    estimatedMinutes: 8,
    muscleGroups: ["QUAD", "HAMSTRING", "CALF", "ANKLE", "FOOT"],
  },
  {
    id: "cod-drills",
    type: "CHANGE_OF_DIRECTION",
    stress: "HIGH",
    priority: 3,
    baseVolume: 3,
    minimumVolume: 1,
    optional: false,
    bodyRegion: "FULL",
    estimatedMinutes: 8,
    muscleGroups: ["QUAD", "ANKLE", "KNEE", "CALF"],
  },
  {
    id: "skill-ballhandling",
    type: "EXPLOSIVENESS",
    stress: "LOW",
    priority: 4,
    baseVolume: 3,
    optional: false,
    bodyRegion: "FULL",
    estimatedMinutes: 12,
  },
  {
    id: "accessory-upper",
    type: "STRENGTH",
    stress: "LOW",
    priority: 5,
    baseVolume: 3,
    optional: true,
    bodyRegion: "UPPER",
    estimatedMinutes: 10,
    muscleGroups: ["ARM", "SHOULDER"],
  },
  {
    id: "accessory-core",
    type: "STRENGTH",
    stress: "LOW",
    priority: 5,
    baseVolume: 2,
    optional: true,
    bodyRegion: "FULL",
    estimatedMinutes: 6,
    muscleGroups: ["ABS"],
  },
  {
    id: "mobility-recovery",
    type: "RECOVERY",
    stress: "RECOVERY",
    priority: 6,
    baseVolume: 1,
    optional: false,
    bodyRegion: "FULL",
    estimatedMinutes: 5,
  },
] as const satisfies readonly TrainingComponent[];

/** Athlete-facing display names for plan components (ids are machine keys). */
export const BASE_PLAN_TITLES: Record<string, string> = {
  "primary-lower-squat": "Squat pattern strength",
  "primary-upper-push": "Upper push strength",
  "explosive-jumps": "Jump & landing mechanics",
  "acceleration-sprints": "Acceleration sprints",
  "cod-drills": "Change-of-direction drills",
  "skill-ballhandling": "Ball-handling technique",
  "accessory-upper": "Upper accessory circuit",
  "accessory-core": "Core accessory circuit",
  "mobility-recovery": "Mobility & recovery flow",
};

/* ─────────────────── Weekday-structured default templates ─────────────── */

/** Blocks kept on practice nights: top-half and technique only — legs are
 * saved for the 6 PM practice (no high-stress lower-body loading). */
const PRACTICE_DAY_IDS: ReadonlySet<string> = new Set([
  "primary-upper-push",
  "skill-ballhandling",
  "accessory-upper",
  "accessory-core",
  "mobility-recovery",
]);

/** Sunday stays light: skill touch-up plus the recovery flow. */
const RECOVERY_DAY_IDS: ReadonlySet<string> = new Set([
  "skill-ballhandling",
  "mobility-recovery",
]);

function pickByIds(ids: ReadonlySet<string>): readonly TrainingComponent[] {
  return (DEFAULT_BASE_PLAN as readonly TrainingComponent[]).filter((component) =>
    ids.has(component.id),
  );
}

/**
 * The default plan for a local date: practice nights (Tue/Wed/Thu) run the
 * practice-day template, Sunday runs recovery, other days the full template.
 * A built plan (`activePlan`) always wins at the call site.
 */
export function defaultPlanForDate(localDate: string): readonly TrainingComponent[] {
  const weekday = weekdayOf(localDate);
  if (weekday === 0) return pickByIds(RECOVERY_DAY_IDS);
  if (DEFAULT_SEASON_CONFIG.practiceWeekdays.includes(weekday)) {
    return pickByIds(PRACTICE_DAY_IDS);
  }
  return DEFAULT_BASE_PLAN as readonly TrainingComponent[];
}

/** One-line focus label for the day's default plan (calendar + Game Plan). */
export function defaultPlanFocusLabel(localDate: string): string {
  const weekday = weekdayOf(localDate);
  if (weekday === 0) return "Recovery & skills";
  if (DEFAULT_SEASON_CONFIG.practiceWeekdays.includes(weekday)) {
    return "Practice + upper primer";
  }
  return "Strength + speed";
}
