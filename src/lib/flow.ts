/**
 * VIKAI — Guided daily flow (live session cockpit).
 *
 * Derives the athlete's "Your Day" stepper from facts the app already knows.
 * Pure and deterministic: no storage, no clock — every input is provided
 * (AGENTS.md code quality). The order mirrors when information is worth
 * having: check in → run the 10-second tap test (its result blends with the
 * check-in, Phase 10) → log what already happened today (it shapes today's
 * volume) → complete the Game Plan. Steps unlock in order but don't gate
 * each other — logging after the session is expected too (it shapes the
 * NEXT workout). The engine still gates what each screen can do.
 */

import type { ActivityPartition } from "./activityTiming";

export type StepId = "checkin" | "cns" | "gamePlan" | "log";

export type StepState = "done" | "active" | "locked";

export interface DayStep {
  id: StepId;
  emoji: string;
  title: string;
  subtitle: string;
  route: "/checkin" | "/finger-tap" | "/workout" | "/practice-log";
  state: StepState;
}

export interface FlowInput {
  hasCheckedInToday: boolean;
  /** True when at least one finger-tap trial is logged for today (Phase 10). */
  hasTapTestToday: boolean;
  /** True when a workout log exists for today (Finish workout pressed). */
  hasWorkoutLogToday: boolean;
  /** Today's activity logs split around the workout (activityTiming). */
  activityPartition: ActivityPartition;
}

/** Derives the daily sequence: check in → tap test → log activities → plan. */
export function todaySteps(input: FlowInput): DayStep[] {
  const checkin: DayStep = {
    id: "checkin",
    emoji: "😴",
    title: "3-Tap Check-In",
    subtitle: input.hasCheckedInToday ? "Done for today ✓ — update anytime" : "Unlock your power — under 5 sec",
    route: "/checkin",
    state: input.hasCheckedInToday ? "done" : "active",
  };

  const cns: DayStep = {
    id: "cns",
    emoji: "⚡",
    title: "10-second tap test",
    subtitle: !input.hasCheckedInToday
      ? "After your check-in"
      : input.hasTapTestToday
        ? "Logged for today ✓"
        : "Tap fast for 10 sec — measure your freshness",
    route: "/finger-tap",
    state: !input.hasCheckedInToday ? "locked" : input.hasTapTestToday ? "done" : "active",
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

  return [checkin, cns, log, gamePlan];
}

/* ────────────── Phase 12 — the Home "Your next step" hero ─────────────── */

/** The one primary action Home offers, action-phrased for the moment. */
export interface HeroAction {
  /** The step the hero advances, or "complete" once the session is closed. */
  id: StepId | "complete";
  emoji: string;
  title: string;
  subtitle: string;
  route: DayStep["route"];
}

/** Action-phrased hero copy per step (single source of truth for Home's CTA). */
const HERO_COPY: Record<StepId, { emoji: string; title: string; subtitle: string }> = {
  checkin: {
    emoji: "😴",
    title: "Check in first",
    subtitle: "Three taps. Unlocks today's plan.",
  },
  cns: {
    emoji: "⚡",
    title: "Do the 10-second tap test",
    subtitle: "Tap fast for 10 seconds — measure your freshness",
  },
  log: {
    emoji: "📝",
    title: "Log your activities",
    subtitle: "What you did today shapes today's volume",
  },
  gamePlan: {
    emoji: "🏀",
    title: "Start today's session",
    subtitle: "Check off each block as you go",
  },
};

const COMPLETE_HERO: HeroAction = {
  id: "complete",
  emoji: "🎉",
  title: "Session complete",
  subtitle: "Log anything else? It shapes your next workout",
  route: "/practice-log",
};

/**
 * The hero is the FIRST step that still needs doing — so Home always offers
 * exactly one obvious action that advances the guided flow, and it hands off
 * to the success state once the session is closed. Pure and deterministic.
 */
export function nextStepFor(input: FlowInput): HeroAction {
  const active = todaySteps(input).find((step) => step.state === "active");
  if (active === undefined) return COMPLETE_HERO;
  const copy = HERO_COPY[active.id];
  return {
    id: active.id,
    emoji: copy.emoji,
    title: copy.title,
    subtitle: copy.subtitle,
    route: active.route,
  };
}
