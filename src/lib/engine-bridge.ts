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
import {
  DEFAULT_ATHLETE_PROFILE,
} from "../config/defaults";
import {
  DEFAULT_OBJECTIVE,
  type ActivityLog,
  type AthleteProfile,
  type EngineInput,
  type EngineResult,
  type ReadinessInput,
  type ScheduledEvent,
  type TrainingObjective,
} from "../types";

export interface EngineSourceState {
  profile: AthleteProfile | null;
  trainingObjective: TrainingObjective | null;
  readinessInputs: readonly ReadinessInput[];
  activityLogs: readonly ActivityLog[];
  scheduledEvents: readonly ScheduledEvent[];
}

export interface DerivedEngineView {
  input: EngineInput;
  result: EngineResult;
  /** Local calendar date (YYYY-MM-DD) used to select today's check-in. */
  today: string;
  /** True when a check-in recorded for `today` exists. */
  hasCheckedInToday: boolean;
}

/** Pure derivation: store slices + now ⇒ EngineInput + EngineResult. */
export function deriveEngineView(state: EngineSourceState, now: Date): DerivedEngineView {
  const athlete = state.profile ?? DEFAULT_ATHLETE_PROFILE;
  const timezone = athlete.timezone;
  const today = toLocalDateString(now, timezone);

  const todayCheckIn = state.readinessInputs.find((entry) => entry.localDate === today);

  const input: EngineInput = {
    athlete,
    objective: state.trainingObjective ?? DEFAULT_OBJECTIVE,
    readiness: todayCheckIn,
    recentActivities: [...state.activityLogs],
    upcomingEvents: [...state.scheduledEvents],
    now,
  };

  return {
    input,
    result: evaluateAutoregulationEngine(input),
    today,
    hasCheckedInToday: todayCheckIn !== undefined,
  };
}
