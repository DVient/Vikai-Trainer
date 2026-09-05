/**
 * VIKAI — Engine bridge (Phase 4)
 *
 * Assembles the EngineInput for the pure autoregulation engine from local
 * store slices. This module is intentionally PURE: it imports neither React
 * Native nor the Zustand store, so it is directly unit-testable. The thin
 * `useEngineResult` hook (src/hooks) wires it to live store state.
 *
 * §27 rule implementation: only TODAY's check-in (matching the athlete's
 * local date) is passed as `readiness`; a missing or stale check-in yields
 * `readiness: undefined`, which the engine resolves to CHECKIN_REQUIRED —
 * the dashboard can therefore never show GREEN without today's check-in.
 */

import { evaluateAutoregulationEngine, toLocalDateString } from "../engine/autoregulation";
import { hasConsecutiveHighStressDays } from "../engine/generator";
import {
  DEFAULT_ATHLETE_PROFILE,
} from "../config/defaults";
import {
  DEFAULT_OBJECTIVE,
  isSoreArea,
  type ActivityLog,
  type AthleteProfile,
  type EngineInput,
  type EngineResult,
  type ReadinessInput,
  type ScheduledEvent,
  type SoreArea,
  type TrainingObjective,
  type WorkoutLog,
} from "../types";

export interface EngineSourceState {
  profile: AthleteProfile | null;
  trainingObjective: TrainingObjective | null;
  readinessInputs: readonly ReadinessInput[];
  activityLogs: readonly ActivityLog[];
  scheduledEvents: readonly ScheduledEvent[];
  /** Session records — the latest one before today carries post-session feedback. */
  workoutLogs: readonly WorkoutLog[];
}

export interface DerivedEngineView {
  input: EngineInput;
  result: EngineResult;
  /** Local calendar date (YYYY-MM-DD) used to select today's check-in. */
  today: string;
  /** True when a check-in recorded for `today` exists. */
  hasCheckedInToday: boolean;
  /** SPEC §20: consecutive high-stress days ⇒ strip all optional volume. */
  stripOptional: boolean;
  /**
   * Post-session sore areas carried in from the latest workout BEFORE today
   * (Phase 8 feedback loop). Empty when the last session closed all-good.
   */
  carriedSoreAreas: readonly SoreArea[];
}

/**
 * Phase 8 feedback loop (pure): today's derivation consumes BOTH the
 * morning's body map (check-in) and the sore areas logged when the last
 * workout before today closed — deduplicated, unknown ids dropped. The
 * athlete's own stated model: today's workout is adjusted by the inputs
 * given after the last workout and before today's workout; it never reacts
 * to anything logged mid-session.
 */
export function effectiveSoreAreas(
  checkIn: ReadinessInput | undefined,
  carried: readonly SoreArea[],
): readonly SoreArea[] {
  if (checkIn === undefined) return [];
  return [...new Set([...(checkIn.soreAreas ?? []), ...carried].filter(isSoreArea))];
}

/** Pure derivation: store slices + now ⇒ EngineInput + EngineResult. */
export function deriveEngineView(state: EngineSourceState, now: Date): DerivedEngineView {
  const athlete = state.profile ?? DEFAULT_ATHLETE_PROFILE;
  const timezone = athlete.timezone;
  const today = toLocalDateString(now, timezone);

  const todayCheckIn = state.readinessInputs.find((entry) => entry.localDate === today);

  const lastSessionBeforeToday = state.workoutLogs.reduce<WorkoutLog | undefined>(
    (latest, entry) => {
      if (entry.activityDate >= today) return latest; // today's own session never feeds back
      return latest === undefined || entry.activityDate > latest.activityDate ? entry : latest;
    },
    undefined,
  );
  const carriedSoreAreas = (lastSessionBeforeToday?.soreAreasAfter ?? []).filter(isSoreArea);
  const effective = effectiveSoreAreas(todayCheckIn, carriedSoreAreas);

  const input: EngineInput = {
    athlete,
    objective: state.trainingObjective ?? DEFAULT_OBJECTIVE,
    readiness:
      todayCheckIn === undefined
        ? undefined
        : {
            ...todayCheckIn,
            ...(effective.length > 0 ? { soreAreas: effective } : {}),
          },
    recentActivities: [...state.activityLogs],
    upcomingEvents: [...state.scheduledEvents],
    now,
  };

  return {
    input,
    result: evaluateAutoregulationEngine(input),
    today,
    hasCheckedInToday: todayCheckIn !== undefined,
    carriedSoreAreas,
    stripOptional: hasConsecutiveHighStressDays(
      state.activityLogs,
      state.scheduledEvents,
      now,
      timezone,
    ),
  };
}
