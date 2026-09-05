/**
 * VIKAI — Performance-based loading (Phase 8.3).
 *
 * Darren's point: the athlete gives 100% on drills and speed but opts for
 * comfort on strength/conditioning — so load adjusts based on PERFORMANCE,
 * not on more self-report (nothing new to game). This module measures the
 * objective gap between planned blocks and actually-checked-off blocks per
 * training goal over the recent window, and derives next-session scales.
 *
 * Layer placement: plans-domain data shaping (it resolves each session's
 * plan via activePlanForDay). The ENGINE never sees adherence data — it
 * stays a pure physio/restriction calculator (AGENTS.md decoupling); the
 * Workout Generator consumes the scales as a mapping option, exactly like
 * `primaryGoals` and `stripOptional`.
 *
 * Exemptions (by design): skill/technique work and top-speed/power
 * (EXPLOSIVENESS, SPEED — the categories he attacks) plus RECOVERY are
 * never performance-scaled. STRENGTH, CHANGE_OF_DIRECTION, ACCELERATION
 * and DECELERATION are eligible.
 */

import type { BuiltPlan, CompletedComponent, TrainingComponent, TrainingGoal, WorkoutLog } from "../types";
import { activePlanForDay } from "./planBuilder";
import { DEFAULT_BASE_PLAN } from "./basePlan";

/** One window's plan-vs-completion record, aggregated per training goal. */
export interface AdherenceSample {
  goal: TrainingGoal;
  /** Planned blocks of this goal across the window's sessions. */
  plannedBlocks: number;
  /** Of those, blocks actually checked off. */
  completedBlocks: number;
}

export interface AdherenceOptions {
  /** A goal needs at least this many planned blocks in the window to judge. */
  minBlocks: number;
  /** Below this completion ratio a goal counts as under-completed. */
  underRatio: number;
  /** Scale applied to under-completed, non-exempt goals next session. */
  scale: number;
}

export const DEFAULT_ADHERENCE_OPTIONS: AdherenceOptions = {
  minBlocks: 3,
  underRatio: 0.75,
  scale: 0.8,
};

/** Goals never performance-scaled: technique, top speed/power, recovery. */
export const PERFORMANCE_EXEMPT_GOALS: readonly TrainingGoal[] = [
  "EXPLOSIVENESS",
  "SPEED",
  "RECOVERY",
];

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local-date (YYYY-MM-DD) arithmetic, UTC-safe and deterministic. */
function localDateMinusDays(localDate: string, days: number): string {
  const [year, month, day] = localDate.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) return localDate;
  return new Date(Date.UTC(year, month - 1, day) - days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Aggregates plan-vs-completion samples for every session strictly BEFORE
 * `todayLocalDate` within the lookback window. Today's own (possibly
 * partial) session is deliberately excluded — it must never reprice the
 * day it belongs to. Recovery blocks are excluded from both sides.
 */
export function adherenceSamplesFor(
  plan: BuiltPlan | null,
  workoutLogs: readonly WorkoutLog[],
  workoutProgress: Readonly<Record<string, Record<string, CompletedComponent>>>,
  todayLocalDate: string,
  lookbackDays = 7,
): AdherenceSample[] {
  const windowStart = localDateMinusDays(todayLocalDate, lookbackDays);

  const sessionDates = [
    ...new Set(workoutLogs.map((entry) => entry.activityDate)),
  ]
    .filter((date) => date >= windowStart && date < todayLocalDate)
    .sort();

  const totals = new Map<TrainingGoal, { planned: number; completed: number }>();
  for (const date of sessionDates) {
    const components: readonly TrainingComponent[] =
      plan !== null ? activePlanForDay(plan, date) : DEFAULT_BASE_PLAN;
    const dayProgress = workoutProgress[date] ?? {};
    for (const component of components) {
      if (component.type === "RECOVERY") continue;
      const entry = totals.get(component.type) ?? { planned: 0, completed: 0 };
      entry.planned += 1;
      if (dayProgress[component.id] !== undefined) entry.completed += 1;
      totals.set(component.type, entry);
    }
  }

  return [...totals.entries()].map(([goal, totalsForGoal]) => ({
    goal,
    plannedBlocks: totalsForGoal.planned,
    completedBlocks: totalsForGoal.completed,
  }));
}

/**
 * Under-completed, non-exempt goals map to the next-session scale; goals
 * with enough data and healthy completion stay absent (1.0). Pure.
 */
export function performanceScales(
  samples: readonly AdherenceSample[],
  options: AdherenceOptions = DEFAULT_ADHERENCE_OPTIONS,
): Partial<Record<TrainingGoal, number>> {
  const scales: Partial<Record<TrainingGoal, number>> = {};
  for (const sample of samples) {
    if (PERFORMANCE_EXEMPT_GOALS.includes(sample.goal)) continue;
    if (sample.plannedBlocks < options.minBlocks) continue;
    if (sample.completedBlocks / sample.plannedBlocks < options.underRatio) {
      scales[sample.goal] = options.scale;
    }
  }
  return scales;
}

/** One-call convenience for screens: store slices ⇒ generator option. */
export function computePerformanceScales(
  plan: BuiltPlan | null,
  workoutLogs: readonly WorkoutLog[],
  workoutProgress: Readonly<Record<string, Record<string, CompletedComponent>>>,
  todayLocalDate: string,
  options: AdherenceOptions = DEFAULT_ADHERENCE_OPTIONS,
): Partial<Record<TrainingGoal, number>> {
  return performanceScales(
    adherenceSamplesFor(plan, workoutLogs, workoutProgress, todayLocalDate),
    options,
  );
}
