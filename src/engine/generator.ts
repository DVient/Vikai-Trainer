/**
 * VIKAI — Workout Generator: volume scaling & drill trimming (Phase 3.1)
 *
 * Implements SPECIFICATIONS §22–§23: maps EngineResult restrictions onto a
 * base training plan to produce today's prescription components.
 *
 * ARCHITECTURE GUARANTEES (AGENTS.md):
 * - The engine produced the restrictions; this generator owns ALL exercise /
 *   component decisions. The engine never selects exercises.
 * - Pure & deterministic: no storage access, no clocks, no randomness.
 *
 * TRUNCATION ORDER when volume reduction is required (SPEC §23):
 *   1. Remove optional accessory exercises           → handled per component.
 *   2. Remove redundant secondary drills             → not modeled in the §21
 *      schema (no "secondary" marker); plan authors should tag such drills
 *      `optional: true`, which routes them through step 1.
 *   3–4. Reduce accessory and primary set volume     → uniform region scaling
 *      via `scaleSets` (equivalent to applying steps 3 then 4 proportionally).
 *   5. Preserve execution quality                    → `scaleSets` never drops
 *      a surviving primary below 1 set, and `minimumVolume` is honored.
 *   6. Strip high-impact elements                    → hard removals applied
 *      FIRST (safety rules precede volume math).
 *
 * CLASSIFICATION (derived from the §21 schema, deterministic):
 * - Plyometric component: stress "HIGH" + type "EXPLOSIVENESS" (jump/plyo work).
 * - High-impact component: stress "HIGH" + any explosive/running/COD goal type.
 * - Body region: `bodyRegion` (additive extension) with undefined ⇒ "FULL".
 */

import type {
  ActivityLog,
  ActivityType,
  BodyRegion,
  ScheduledEvent,
  TrainingComponent,
  TrainingGoal,
  TrainingRestrictions,
} from "../types";
import { toLocalDateString } from "./autoregulation";

/* ──────────────────────── §23 — Volume scaling rules ──────────────────── */

/** SPEC §23 verbatim: never below 1 set, rounded half-up. */
export function scaleSets(baseSets: number, scale: number): number {
  return Math.max(1, Math.round(baseSets * scale));
}

/* ─────────────────────────── Prescription model ───────────────────────── */

export type ComponentModification = "KEPT" | "REDUCED" | "REMOVED";

/** One base-plan component after restriction mapping (consumed by Phase 4 UI). */
export interface ScaledComponent {
  component: TrainingComponent;
  modification: ComponentModification;
  /** Volume after scaling/removal (0 for removed components). */
  scaledVolume: number;
  /** Short, training-domain reason — no medical terminology. */
  modificationReason?: string;
}

/* ─────────────────────── Component classification helpers ─────────────── */

const HIGH_IMPACT_GOALS: readonly TrainingGoal[] = [
  "EXPLOSIVENESS",
  "SPEED",
  "ACCELERATION",
  "DECELERATION",
  "CHANGE_OF_DIRECTION",
];

function isPlyometricComponent(component: TrainingComponent): boolean {
  return component.stress === "HIGH" && component.type === "EXPLOSIVENESS";
}

function isHighImpactComponent(component: TrainingComponent): boolean {
  return component.stress === "HIGH" && HIGH_IMPACT_GOALS.includes(component.type);
}

function bodyRegionOf(component: TrainingComponent): BodyRegion {
  return component.bodyRegion ?? "FULL";
}

/* ──────────────── §20 — Consecutive high-stress day handling ──────────── */

/**
 * Activity types classified as HIGH stress for §20 purposes (SPEC §19: hard
 * team practices, games, strength/speed work, testing, unmonitored pickup
 * play). Ambiguous "OTHER" is excluded to keep the rule predictable.
 */
const HIGH_STRESS_ACTIVITY_TYPES: readonly ActivityType[] = [
  "TEAM_PRACTICE",
  "GAME",
  "STRENGTH_TRAINING",
  "SPEED_TRAINING",
  "PICKUP_BASKETBALL",
  "FITNESS_TESTING",
];

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * §20 rule detection: have games, practices, or tournaments forced
 * consecutive high-stress days (yesterday AND today, in the athlete's
 * timezone)? Logged activities and scheduled games/practices both count.
 */
export function hasConsecutiveHighStressDays(
  recentActivities: readonly ActivityLog[],
  upcomingEvents: readonly ScheduledEvent[],
  now: Date,
  athleteTimezone: string,
): boolean {
  const today = toLocalDateString(now, athleteTimezone);
  const yesterday = toLocalDateString(new Date(now.getTime() - DAY_MS), athleteTimezone);

  const highStressOn = (day: string): boolean =>
    recentActivities.some(
      (activity) =>
        activity.activityDate === day &&
        HIGH_STRESS_ACTIVITY_TYPES.includes(activity.activityType),
    ) ||
    upcomingEvents.some((event) => {
      if (event.eventType !== "GAME" && event.eventType !== "TEAM_PRACTICE") return false;
      const kickoff = new Date(event.startAt);
      return (
        Number.isFinite(kickoff.getTime()) && toLocalDateString(kickoff, athleteTimezone) === day
      );
    });

  return highStressOn(today) && highStressOn(yesterday);
}

/** Region scale: FULL components are governed by the stricter body region. */
function regionScaleFor(region: BodyRegion, restrictions: TrainingRestrictions): number {
  if (region === "LOWER") return restrictions.lowerBodyScale;
  if (region === "UPPER") return restrictions.upperBodyScale;
  return Math.min(restrictions.lowerBodyScale, restrictions.upperBodyScale);
}

function regionIsBlocked(region: BodyRegion, restrictions: TrainingRestrictions): boolean {
  if (region === "LOWER") return !restrictions.lowerBodyAllowed;
  if (region === "UPPER") return !restrictions.upperBodyAllowed;
  return !restrictions.lowerBodyAllowed || !restrictions.upperBodyAllowed;
}

function removed(
  component: TrainingComponent,
  reason: string,
): ScaledComponent {
  return { component, modification: "REMOVED", scaledVolume: 0, modificationReason: reason };
}

/* ───────────────────── §22/§23 — The generation pipeline ──────────────── */

export interface GeneratorOptions {
  /**
   * SPEC §20: when the schedule forces consecutive high-stress days, ALL
   * optional training volume is stripped automatically (no compensating
   * catch-up volume). Compute the flag with `hasConsecutiveHighStressDays`.
   */
  stripOptional?: boolean;
}

/**
 * Map engine restrictions onto a base plan. Hard removals (plyometrics, high
 * impact, blocked body regions) always win; surviving components are scaled
 * by their region's scale; optional accessories are stripped first whenever
 * their region requires volume reduction (SPEC §23 step 1).
 */
export function applyRestrictionsToBasePlan(
  basePlan: readonly TrainingComponent[],
  restrictions: TrainingRestrictions,
  options: GeneratorOptions = {},
): ScaledComponent[] {
  const prescription: ScaledComponent[] = [];

  for (const component of basePlan) {
    /* Step 6 first — safety-driven hard removals precede all volume math. */
    if (!restrictions.plyometricsAllowed && isPlyometricComponent(component)) {
      prescription.push(removed(component, "Removed: plyometrics are not allowed today."));
      continue;
    }
    if (!restrictions.highImpactAllowed && isHighImpactComponent(component)) {
      prescription.push(removed(component, "Removed: high-impact work is not allowed today."));
      continue;
    }

    /* §20 — forced overlap: optional volume is stripped automatically. */
    if (options.stripOptional === true && component.optional) {
      prescription.push(
        removed(
          component,
          "Removed: optional volume stripped for back-to-back high-stress days.",
        ),
      );
      continue;
    }

    const region = bodyRegionOf(component);
    if (regionIsBlocked(region, restrictions)) {
      const reason =
        region === "LOWER"
          ? "Removed: lower-body training is paused today."
          : region === "UPPER"
            ? "Removed: upper-body training is paused today."
            : "Removed: full-body training is paused today.";
      prescription.push(removed(component, reason));
      continue;
    }

    const scale = regionScaleFor(region, restrictions);

    /* Step 1 — optional accessories are stripped before any set reduction. */
    if (component.optional && scale < 1) {
      prescription.push(
        removed(component, "Removed: optional accessory stripped to protect recovery."),
      );
      continue;
    }

    const scaled = scaleSets(component.baseVolume, scale);
    const volume =
      component.minimumVolume !== undefined ? Math.max(component.minimumVolume, scaled) : scaled;

    if (volume < component.baseVolume) {
      prescription.push({
        component,
        modification: "REDUCED",
        scaledVolume: volume,
        modificationReason: `Reduced: volume scaled to ${scale}× for today's readiness.`,
      });
      continue;
    }

    prescription.push({ component, modification: "KEPT", scaledVolume: volume });
  }

  return prescription;
}
