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

import type { TrainingComponent } from "../types";
import { componentsForRole, dayRoleFor } from "./weekStructure";

/**
 * The default template, ordered speed-power first: the athlete is freshest
 * at the top of the session, so acceleration work, jumps, and COD render
 * before any lifting (Charlie Francis's non-negotiable sequencing).
 */
export const DEFAULT_BASE_PLAN = [
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

/**
 * The default plan for a local date: the shared week-structure role decides
 * which blocks the day keeps (Sunday recovery, practice nights leg-free,
 * pre-season low days, post-practice Friday without speed), and the array's
 * speed-first order carries through. A built plan (`activePlan`) always
 * wins at the call site and is shaped by the same roles.
 */
export function defaultPlanForDate(localDate: string): readonly TrainingComponent[] {
  return componentsForRole(dayRoleFor(localDate), DEFAULT_BASE_PLAN);
}

/** One-line focus label for the day's default plan (calendar + Game Plan). */
export function defaultPlanFocusLabel(localDate: string): string {
  switch (dayRoleFor(localDate)) {
    case "recovery":
      return "Recovery & skills";
    case "practice":
      return "Practice + upper primer";
    case "post-practice":
      return "Strength + tempo";
    case "low":
      return "Skills + tempo primer";
    case "full":
      return "Strength + speed";
  }
}
