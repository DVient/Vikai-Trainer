/**
 * VIKAI — Base Training Plan (SPEC §21, §22)
 *
 * Static, code-owned session template for the default training objective
 * (strength, explosiveness, change of direction) organized on high/low
 * principles (SPEC §20). The Workout Generator maps engine restrictions onto
 * this plan at runtime; this file never reads engine state.
 *
 * NOTE: Season-phase selection (SPEC §24–§25) is a documented future
 * extension point — FLOW 4.4 renders this single base plan.
 */

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
