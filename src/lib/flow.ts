/**
 * VIKAI — Guided daily flow (live session cockpit).
 *
 * Derives the athlete's "Your Day" stepper from facts the app already knows.
 * Pure and deterministic: no storage, no clock — every input is provided
 * (AGENTS.md code quality). The order mirrors when information is worth
 * having: check in → log what already happened today (it shapes today's
 * volume) → complete the Game Plan. Steps unlock in order but don't gate
 * each other — logging after the session is expected too (it shapes the
 * NEXT workout). The engine still gates what each screen can do.
 */

import type { ActivityPartition } from "./activityTiming";

export type StepId = "checkin" | "gamePlan" | "log";

export type StepState = "done" | "active" | "locked";

export interface DayStep {
  id: StepId;
  emoji: string;
  title: string;
  subtitle: string;
  route: "/checkin" | "/workout" | "/practice-log";
  state: StepState;
}

export interface FlowInput {
  hasCheckedInToday: boolean;
  /** True when a workout log exists for today (Finish workout pressed). */
  hasWorkoutLogToday: boolean;
  /** Today's activity logs split around the workout (activityTiming). */
  activityPartition: ActivityPartition;
}

/** Derives the daily sequence: check in → log activities → complete plan. */
export function todaySteps(input: FlowInput): DayStep[] {
  const checkin: DayStep = {
    id: "checkin",
    emoji: "😴",
    title: "3-Tap Check-In",
    subtitle: input.hasCheckedInToday ? "Done for today ✓ — update anytime" : "Unlock your power — under 5 sec",
    route: "/checkin",
    state: input.hasCheckedInToday ? "done" : "active",
  };

  const hasPre = input.activityPartition.pre.length > 0;
  const hasPost = input.activityPartition.post.length > 0;
  const hasAny = hasPre || hasPost;

  const log: DayStep = {
    id: "log",
    emoji: "📝",
    title: "Log your activities",
    subtitle: !input.hasCheckedInToday
      ? "After your check-in"
      : hasPre
        ? "Logged before training ✓ — it shaped today's volume"
        : hasPost
          ? "After today's session ✓ — shapes your next workout"
          : "Before you train — anything on your legs today?",
    route: "/practice-log",
    state: !input.hasCheckedInToday
      ? "locked"
      : hasAny
        ? "done"
        : "active",
  };

  const gamePlan: DayStep = {
    id: "gamePlan",
    emoji: "🏀",
    title: "Complete your Game Plan",
    subtitle: !input.hasCheckedInToday
      ? "Unlock with your check-in"
      : input.hasWorkoutLogToday
        ? "Session complete ✓"
        : hasPre
          ? "Check off sets as you go"
          : "Log earlier activities first",
    route: "/workout",
    state: !input.hasCheckedInToday
      ? "locked"
      : input.hasWorkoutLogToday
        ? "done"
        : "active",
  };

  return [checkin, log, gamePlan];
}
