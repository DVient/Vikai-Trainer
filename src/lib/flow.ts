/**
 * VIKAI — Guided daily flow (design iteration).
 *
 * Derives the athlete's "Your Day" stepper from facts the app already knows.
 * Pure and deterministic: no storage, no clock — every input is provided
 * (AGENTS.md code quality). The stepper only re-orders existing navigation;
 * the engine still gates what each screen can do.
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
  /** Local date (YYYY-MM-DD) the Game Plan was last opened, if any. */
  gamePlanViewedOn: string | undefined;
  hasWorkoutLogToday: boolean;
  today: string;
}

/** Derives the three-step daily sequence: check in → game plan → log it. */
export function todaySteps(input: FlowInput): DayStep[] {
  const gamePlanViewedToday = input.gamePlanViewedOn === input.today && input.hasCheckedInToday;

  const checkin: DayStep = {
    id: "checkin",
    emoji: "😴",
    title: "3-Tap Check-In",
    subtitle: input.hasCheckedInToday ? "Done for today ✓" : "Unlock your power — under 5 sec",
    route: "/checkin",
    state: input.hasCheckedInToday ? "done" : "active",
  };

  const gamePlan: DayStep = {
    id: "gamePlan",
    emoji: "🏀",
    title: "Today's Game Plan",
    subtitle: !input.hasCheckedInToday
      ? "Unlock with your check-in"
      : gamePlanViewedToday
        ? "Reviewed ✓"
        : "Your scaled plan is ready",
    route: "/workout",
    state: !input.hasCheckedInToday
      ? "locked"
      : gamePlanViewedToday || input.hasWorkoutLogToday
        ? "done"
        : "active",
  };

  const log: DayStep = {
    id: "log",
    emoji: "📝",
    title: "Log your session",
    subtitle: input.hasWorkoutLogToday
      ? "Logged ✓"
      : gamePlanViewedToday
        ? "Took under a minute"
        : "After your session",
    route: "/practice-log",
    state: input.hasWorkoutLogToday ? "done" : gamePlanViewedToday ? "active" : "locked",
  };

  return [checkin, gamePlan, log];
}
