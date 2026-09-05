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
  SoreArea,
  TrainingComponent,
  TrainingGoal,
  TrainingRestrictions,
} from "../types";
import { isHighStressEvent, toLocalDateString } from "./autoregulation";
import { soreAreaLabel } from "../lib/bodyMap";

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
      if (!isHighStressEvent(event.eventType)) return false;
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

/* ─────────────── Phase 7 — Body-map soreness mapping ──────────────────── */

/**
 * How the engine's per-area `sorenessScale` lands on ONE component:
 * - EXEMPT  — untagged (skills, recovery) or nothing it targets is sore.
 * - REMOVE  — every area the block targets is sore: the whole block sits
 *             out today (targeted equivalent of the RED region removal).
 * - SCALE   — partial overlap: the block survives at the sorest overlapping
 *             area's scale (region scales still apply on top).
 * Deterministic and pure; unknown/untagged components are never affected.
 */
type SorenessAdjustment =
  | { kind: "EXEMPT" }
  | { kind: "REMOVE"; areas: readonly SoreArea[] }
  | { kind: "SCALE"; scale: number; areas: readonly SoreArea[] };

function sorenessAdjustmentFor(
  component: TrainingComponent,
  restrictions: TrainingRestrictions,
): SorenessAdjustment {
  const muscles = component.muscleGroups;
  if (muscles === undefined || muscles.length === 0) return { kind: "EXEMPT" };
  const scaleMap = restrictions.sorenessScale;
  if (scaleMap === undefined) return { kind: "EXEMPT" };
  const sore = muscles.filter((area) => scaleMap[area] !== undefined);
  if (sore.length === 0) return { kind: "EXEMPT" };
  if (sore.length === muscles.length) return { kind: "REMOVE", areas: sore };
  return { kind: "SCALE", scale: Math.min(...sore.map((area) => scaleMap[area] ?? 1)), areas: sore };
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
  /**
   * The athlete's primary training goals (additive). When provided, volume
   * reductions land on the LEAST goal-relevant work first: non-goal
   * secondary components take an extra 0.5× cut before goal-primary blocks
   * lose anything beyond the region scale. Goal-primary and priority-1
   * components always keep the plain region scale. Omitted ⇒ uniform
   * region scaling (previous behavior).
   */
  primaryGoals?: readonly TrainingGoal[];
  /**
   * Phase 8.3 — performance-based loading: per-goal scales derived from the
   * athlete's objective completion history (see src/plans/adherence.ts).
   * Eligible goals under-completed recently map to <1 scales; exempt goals
   * (skills/technique, top speed, recovery) are absent. The engine never
   * sees this — it is completion bookkeeping, mapped here like the region
   * and soreness scales.
   */
  performanceScales?: Partial<Record<TrainingGoal, number>>;
}

/**
 * Map engine restrictions onto a base plan. Hard removals (plyometrics, high
 * impact, blocked body regions, a block whose every targeted sore area is
 * flagged) always win; surviving components are scaled by their region's
 * scale times any partial soreness scale — with goal-aware redistribution
 * when the athlete's primary goals are provided (non-goal secondaries are
 * cut deeper first). Optional accessories are stripped before any set
 * reduction (SPEC §23 step 1). A duration cap, when the engine set one, is
 * enforced by dropping the least goal-relevant components until the plan fits.
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
      /*
       * Plyometric-classified components answer only to the plyometrics
       * flag (SPEC §17: the 12–24h pre-game primer allows reduced
       * plyometrics) — the blanket high-impact rule never deletes them.
       * Conditioning-style high impact (sprints, COD) stays governed here.
       */
      if (!isPlyometricComponent(component)) {
        prescription.push(removed(component, "Removed: high-impact work is not allowed today."));
        continue;
      }
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

    /* Phase 7 — targeted soreness: whole-block sit-out precedes volume math. */
    const soreness = sorenessAdjustmentFor(component, restrictions);
    if (soreness.kind === "REMOVE") {
      const labels = soreness.areas.map(soreAreaLabel).join(" & ");
      prescription.push(
        removed(
          component,
          `Removed: ${labels} ${soreness.areas.length > 1 ? "are" : "is"} sore — this block sits out today.`,
        ),
      );
      continue;
    }
    const sorenessScale = soreness.kind === "SCALE" ? soreness.scale : 1;

    /* Phase 8.3 — performance-based loading for eligible goals. */
    const performanceScale = options.performanceScales?.[component.type] ?? 1;

    const scale = regionScaleFor(region, restrictions) * sorenessScale * performanceScale;

    /* Step 1 — optional accessories are stripped before any set reduction. */
    if (component.optional && scale < 1) {
      prescription.push(
        removed(component, "Removed: optional accessory stripped to protect recovery."),
      );
      continue;
    }

    const effectiveScale = goalAwareScale(component, scale, options.primaryGoals);
    const scaled = scaleSets(component.baseVolume, effectiveScale);
    const volume =
      component.minimumVolume !== undefined ? Math.max(component.minimumVolume, scaled) : scaled;

    if (volume < component.baseVolume) {
      const modificationReason =
        soreness.kind === "SCALE"
          ? `Reduced: ${soreness.areas.map(soreAreaLabel).join(" & ")} ${
              soreness.areas.length > 1 ? "are" : "is"
            } sore — volume scaled for today.`
          : performanceScale < 1
            ? "Reduced: volume matched to your recent completion pattern."
            : `Reduced: volume scaled to ${effectiveScale}× for today's readiness.`;
      prescription.push({
        component,
        modification: "REDUCED",
        scaledVolume: volume,
        modificationReason,
      });
      continue;
    }

    prescription.push({ component, modification: "KEPT", scaledVolume: volume });
  }

  return enforceDurationCap(prescription, restrictions.maxTrainingDurationMinutes, options);
}

/**
 * Goal-aware effective scale (additive): on a reduced day, non-goal secondary
 * components absorb the cut first (extra 0.5×), goal-primary and priority-1
 * blocks keep the plain region scale. No goals provided ⇒ unchanged scale.
 */
function goalAwareScale(
  component: TrainingComponent,
  regionScale: number,
  primaryGoals: readonly TrainingGoal[] | undefined,
): number {
  if (regionScale >= 1) return regionScale;
  if (primaryGoals === undefined || primaryGoals.length === 0) return regionScale;
  const goalPrimary = primaryGoals.includes(component.type) || component.priority === 1;
  if (goalPrimary) return regionScale;
  return regionScale * 0.5;
}

/* ──────────────── §18 — Duration cap enforcement (safety net) ──────────── */

/** Estimated minutes a prescription entry now occupies (0 when unknown). */
function estimatedMinutesOf(entry: ScaledComponent): number {
  const estimate = entry.component.estimatedMinutes;
  if (estimate === undefined || entry.component.baseVolume <= 0) return 0;
  return (estimate / entry.component.baseVolume) * entry.scaledVolume;
}

/**
 * Enforces the engine's `maxTrainingDurationMinutes` by dropping the LEAST
 * goal-relevant components first (non-goal → higher priority number → longer
 * estimate). Recovery work and priority-1 primaries are never dropped; when
 * only those remain the overflow is accepted (with minimum volumes the RED
 * template always fits).
 */
function enforceDurationCap(
  prescription: readonly ScaledComponent[],
  cap: number | undefined,
  options: GeneratorOptions,
): ScaledComponent[] {
  if (cap === undefined) return [...prescription];

  const goals = options.primaryGoals ?? [];
  const isDroppable = (entry: ScaledComponent): boolean =>
    entry.modification !== "REMOVED" &&
    entry.component.type !== "RECOVERY" &&
    entry.component.priority > 1;

  let current = [...prescription];
  const totalMinutes = (): number =>
    current
      .filter((entry) => entry.modification !== "REMOVED")
      .reduce((sum, entry) => sum + estimatedMinutesOf(entry), 0);

  while (totalMinutes() > cap) {
    const victim = current
      .filter(isDroppable)
      .sort((a, b) => {
        const aGoal = goals.includes(a.component.type) || a.component.priority === 1;
        const bGoal = goals.includes(b.component.type) || b.component.priority === 1;
        if (aGoal !== bGoal) return aGoal ? 1 : -1; // non-goal first
        if (a.component.priority !== b.component.priority) {
          return b.component.priority - a.component.priority; // lower priority first
        }
        return estimatedMinutesOf(b) - estimatedMinutesOf(a); // longer first
      })[0];
    if (victim === undefined) break; // only primaries/recovery remain — accept overflow
    current = current.map((entry) =>
      entry.component.id === victim.component.id
        ? removed(victim.component, "Removed: session cap for today's recovery.")
        : entry,
    );
  }
  return current;
}
