/**
 * VIKAI — Plan Builder (pure plan-domain functions).
 *
 * Composes a personalized base plan from a persona (or raw goals), a time
 * period, and the athlete's logged history — then derives each day's plan
 * from the built plan's progression.
 *
 * DETERMINISM CONTRACT: build output is a pure function of
 * (persona/goals, periodWeeks, startDate, history). Same inputs rebuild the
 * identical plan (idempotent); any changed input reshuffles the output.
 * The exercise-rotation seed is derived from the plan identity so
 * back-to-back plans with the same persona and weeks still differ in
 * exercise mix — among EQUIVALENT variants of the same movement pattern,
 * so intent never changes.
 *
 * ARCHITECTURE (AGENTS.md): this module NEVER computes restrictions — the
 * engine stays restriction-only, and the generator maps restrictions onto
 * whatever base plan exists (default or built).
 */

import type {
  BuiltPlan,
  PersonaId,
  PlanStatus,
  TrainingComponent,
  TrainingGoal,
} from "../types";
import { BLOCK_LIBRARY, type BlockKind, type ExerciseVariantTag, libraryBlockById } from "./library";
import { personaById } from "./personas";

export const MIN_PERIOD_WEEKS = 4;
export const MAX_PERIOD_WEEKS = 12;

export interface PlanHistorySnapshot {
  /** Workout logs in the last 28 days — the adherence signal. */
  workoutsLast28d: number;
  /** Mean daily activity load (sessionRpe × duration) over 7 days; null when no logs. */
  avgDailyLoad7d: number | null;
}

export interface PlanBuilderInput {
  id: string;
  personaId?: PersonaId;
  /** Advanced path: explicit goals override the persona's preset. */
  primaryGoals?: TrainingGoal[];
  periodWeeks: number;
  startDate: string;
  history: PlanHistorySnapshot;
}

/** Volume floor/ceiling for the history-calibrated starting scale. */
const START_SCALE_FLOOR = 0.7;
const START_SCALE_CEIL = 1.0;
const ADHERENCE_TARGET_WORKOUTS = 12;
const HEAVY_DAILY_LOAD = 800;
const HEAVY_LOAD_PENALTY = 0.1;

/** Weekly progression: +8% accumulation ×3, deload every 4th, taper last. */
const RAMP = [1.0, 1.08, 1.16] as const;
const DELOAD_SCALE = 0.6;
const TAPER_SCALE = 0.7;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Whole days between two YYYY-MM-DD keys (pure string-date math). */
export function daysBetweenDates(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.round((end - start) / 86_400_000);
}

/** Week index of a date within the plan (0-based; ≥ periodWeeks after the end). */
export function weekIndexOf(plan: Pick<BuiltPlan, "startDate" | "periodWeeks">, localDate: string): number {
  return Math.floor(daysBetweenDates(plan.startDate, localDate) / 7);
}

/**
 * History-calibrated starting scale: adherence raises it toward 1.0, a
 * heavy recent week lowers it, no history starts conservative (0.75).
 */
export function startScaleFor(history: PlanHistorySnapshot): number {
  const adherence = Math.min(1, history.workoutsLast28d / ADHERENCE_TARGET_WORKOUTS);
  let scale = 0.75 + 0.25 * adherence;
  if (history.avgDailyLoad7d !== null && history.avgDailyLoad7d >= HEAVY_DAILY_LOAD) {
    scale -= HEAVY_LOAD_PENALTY;
  }
  return clamp(scale, START_SCALE_FLOOR, START_SCALE_CEIL);
}

interface ScoredBlock {
  componentId: string;
  score: number;
}

/**
 * Selection scoring: goal-matching dominates, skills get persona priority,
 * a lower-body bias nudges movement-region emphasis. Rank breaks ties so
 * the catalog's ordering stays stable.
 */
function scoreBlocks(goals: readonly TrainingGoal[], persona: { regionBias: "LOWER" | "BALANCED"; skillPriority: boolean }): ScoredBlock[] {
  return BLOCK_LIBRARY.map((block) => {
    let score = 0;
    if (goals.includes(block.component.type)) score += 100;
    if (persona.skillPriority && block.kind === "SKILL") score += 90;
    if (persona.regionBias === "LOWER" && block.component.bodyRegion === "LOWER") score += 10;
    score += Math.max(0, 15 - block.rank);
    return { componentId: block.component.id, score };
  });
}

/**
 * Builds a plan. Selection: goal-matching blocks first, supporting blocks
 * fill, exactly one RECOVERY block always kept, skills weighted by the
 * persona; 8–9 blocks total. Priorities are reassigned 1..n with
 * goal-matches first so the generator's goal-tier logic protects them.
 */
export function buildPlan(input: PlanBuilderInput): BuiltPlan {
  const periodWeeks = Math.round(
    clamp(input.periodWeeks, MIN_PERIOD_WEEKS, MAX_PERIOD_WEEKS),
  );
  const persona = input.personaId !== undefined ? personaById(input.personaId) : undefined;
  const goals = [...(input.primaryGoals ?? persona?.primaryGoals ?? ["STRENGTH"])];
  const bias = persona?.regionBias ?? "BALANCED";
  const skillPriority = persona?.skillPriority ?? false;

  const scored = scoreBlocks(goals, { regionBias: bias, skillPriority }).sort(
    (a, b) => b.score - a.score,
  );

  const selectedIds: string[] = [];
  let recoveryTaken = false;
  let skillCount = 0;
  for (const { componentId } of scored) {
    const block = libraryBlockById(componentId);
    if (block === undefined) continue;
    // Exactly one recovery block per plan.
    if (block.kind === "RECOVERY") {
      if (recoveryTaken) continue;
      recoveryTaken = true;
    }
    // At most two skill blocks; skills-first personas still get one first.
    if (block.kind === "SKILL") {
      if (skillCount >= 2) continue;
      skillCount += 1;
    }
    selectedIds.push(componentId);
    if (selectedIds.length >= 9) break;
  }
  // Guarantee a recovery block even if the cut excluded it.
  if (!recoveryTaken) {
    const recovery = BLOCK_LIBRARY.find((block) => block.kind === "RECOVERY");
    if (recovery !== undefined) selectedIds.push(recovery.component.id);
  }

  const startScale = startScaleFor(input.history);
  const components: TrainingComponent[] = selectedIds.map((componentId, index) => {
    const block = libraryBlockById(componentId);
    if (block === undefined) throw new Error(`Unknown block: ${componentId}`);
    const base = block.component;
    const scaledVolume = Math.max(
      base.minimumVolume ?? 1,
      Math.round(base.baseVolume * startScale),
    );
    return {
      ...base,
      // Priority 1..n: goal-matched blocks were selected first, so
      // selection order IS the protection order.
      priority: index + 1,
      baseVolume: scaledVolume,
    };
  });

  return {
    id: input.id,
    startDate: input.startDate,
    periodWeeks,
    primaryGoals: goals,
    personaId: input.personaId,
    components,
    startScale,
  };
}

/** Weekly volume scale for a week index (0-based) within a period. */
export function weekScaleFor(weekIndex: number, periodWeeks: number): number {
  if (weekIndex >= periodWeeks) return TAPER_SCALE; // hold at the taper after the end
  if (weekIndex === periodWeeks - 1) return TAPER_SCALE;
  const position = weekIndex % 4;
  return position === 3 ? DELOAD_SCALE : (RAMP[position] ?? 1.0);
}

/**
 * The day's base plan from a built plan: the week's progression applied to
 * the stored template. Pure — call per day; the generator then maps
 * restrictions onto this exactly as it does for the default plan.
 */
export function activePlanForDay(
  plan: BuiltPlan,
  localDate: string,
): TrainingComponent[] {
  const weekIndex = weekIndexOf(plan, localDate);
  const scale = weekScaleFor(weekIndex, plan.periodWeeks);
  return plan.components.map((component) => ({
    ...component,
    baseVolume: Math.max(component.minimumVolume ?? 1, Math.round(component.baseVolume * scale)),
  }));
}

/** Where the plan is in its life, from date + period alone. */
export function planStatus(
  plan: Pick<BuiltPlan, "startDate" | "periodWeeks">,
  localDate: string,
): PlanStatus {
  const weekIndex = weekIndexOf(plan, localDate);
  if (weekIndex >= plan.periodWeeks) return "ended";
  if (weekIndex === plan.periodWeeks - 1) return "final-week";
  return "active";
}

/** Athlete-facing phase label for today within the plan (pure). */
export function planPhaseLabel(
  plan: Pick<BuiltPlan, "startDate" | "periodWeeks">,
  localDate: string,
): string {
  const weekIndex = weekIndexOf(plan, localDate);
  if (weekIndex >= plan.periodWeeks) return "Complete";
  if (weekIndex === plan.periodWeeks - 1) return "Taper week";
  if (weekIndex % 4 === 3) return "Deload week";
  return "Building";
}

/**
 * Exercise-rotation variant for ONE block of a plan on a date: a stable
 * seed from the plan identity (persona or goals + start date), the week
 * index, and the block id. Same plan/day ⇒ same variant everywhere;
 * a new plan (new start date or persona) walks every block's equivalent
 * variants differently.
 */
export function blockVariant(
  plan: Pick<BuiltPlan, "personaId" | "primaryGoals" | "startDate" | "periodWeeks">,
  localDate: string,
  componentId: string,
): ExerciseVariantTag {
  const identity = plan.personaId ?? plan.primaryGoals.join(",");
  const seedText = `${identity}|${plan.startDate}|${weekIndexOf(plan, localDate)}|${componentId}`;
  let hash = 0;
  for (let i = 0; i < seedText.length; i += 1) {
    hash = (hash * 31 + seedText.charCodeAt(i)) % 997;
  }
  return hash % 2 === 0 ? "A" : "B";
}

/** Kinds present in a plan — used by the My Plan summary. */
export function planBlockKinds(plan: BuiltPlan): BlockKind[] {
  const kinds = plan.components
    .map((component) => libraryBlockById(component.id)?.kind)
    .filter((kind): kind is BlockKind => kind !== undefined);
  return [...new Set(kinds)];
}
