/**
 * VIKAI — Guided daily flow (live session cockpit).
 *
 * Derives the athlete's "Your Day" stepper from facts the app already knows.
 * Pure and deterministic: no storage, no clock — every input is provided
 * (AGENTS.md code quality). Steps unlock in order but don't gate each other:
 * logging an activity mid-session is expected and completes step 3 before
 * step 2. The engine still gates what each screen can do.
 */

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
  /** True when any activity was logged with today's date. */
  hasLoggedActivityToday: boolean;
}

/** Derives the three-step daily sequence: check in → complete plan → log it. */
export function todaySteps(input: FlowInput): DayStep[] {
  const checkin: DayStep = {
    id: "checkin",
    emoji: "😴",
    title: "3-Tap Check-In",
    subtitle: input.hasCheckedInToday ? "Done for today ✓ — update anytime" : "Unlock your power — under 5 sec",
    route: "/checkin",
    state: input.hasCheckedInToday ? "done" : "active",
  };

  const gamePlan: DayStep = {
    id: "gamePlan",
    emoji: "🏀",
    title: "Complete your Game Plan",
    subtitle: !input.hasCheckedInToday
      ? "Unlock with your check-in"
      : input.hasWorkoutLogToday
        ? "Session complete ✓"
        : "Check off sets as you go",
    route: "/workout",
    state: !input.hasCheckedInToday
      ? "locked"
      : input.hasWorkoutLogToday
        ? "done"
        : "active",
  };

  const log: DayStep = {
    id: "log",
    emoji: "📝",
    title: "Log your activities",
    subtitle: !input.hasCheckedInToday
      ? "After your check-in"
      : input.hasLoggedActivityToday
        ? "Practices & games logged ✓"
        : "Even on workout days",
    route: "/practice-log",
    state: !input.hasCheckedInToday
      ? "locked"
      : input.hasLoggedActivityToday
        ? "done"
        : "active",
  };

  return [checkin, gamePlan, log];
}
