import { describe, expect, it } from "vitest";

import { todaySteps, type DayStep, type FlowInput, type StepId } from "../src/lib/flow";

const TODAY = "2026-01-02";

/** Derives the steps and unpacks them into named, defined references. */
function makeSteps(
  overrides: Partial<FlowInput> = {},
): { checkin: DayStep; gamePlan: DayStep; log: DayStep } {
  const steps = todaySteps({
    hasCheckedInToday: false,
    gamePlanViewedOn: undefined,
    hasWorkoutLogToday: false,
    today: TODAY,
    ...overrides,
  });
  const pick = (id: StepId): DayStep => {
    const found = steps.find((entry) => entry.id === id);
    if (!found) throw new Error(`missing step: ${id}`);
    return found;
  };
  return { checkin: pick("checkin"), gamePlan: pick("gamePlan"), log: pick("log") };
}

describe("todaySteps — the guided daily sequence", () => {
  it("starts at step 1 with later steps locked on a fresh install", () => {
    const { checkin, gamePlan, log } = makeSteps();

    expect(checkin.state).toBe("active");
    expect(gamePlan.state).toBe("locked");
    expect(gamePlan.subtitle).toBe("Unlock with your check-in");
    expect(log.state).toBe("locked");
  });

  it("advances to the Game Plan after the check-in", () => {
    const { checkin, gamePlan, log } = makeSteps({ hasCheckedInToday: true });

    expect(checkin.state).toBe("done");
    expect(gamePlan.state).toBe("active");
    expect(log.state).toBe("locked");
  });

  it("moves to the log step once the Game Plan was opened today", () => {
    const { checkin, gamePlan, log } = makeSteps({
      hasCheckedInToday: true,
      gamePlanViewedOn: TODAY,
    });

    expect(checkin.state).toBe("done");
    expect(gamePlan.state).toBe("done");
    expect(gamePlan.subtitle).toBe("Reviewed ✓");
    expect(log.state).toBe("active");
  });

  it("completes the loop when a workout log exists for today", () => {
    const { checkin, gamePlan, log } = makeSteps({
      hasCheckedInToday: true,
      gamePlanViewedOn: TODAY,
      hasWorkoutLogToday: true,
    });

    expect(checkin.state).toBe("done");
    expect(gamePlan.state).toBe("done");
    expect(log.state).toBe("done");
    expect(log.subtitle).toBe("Logged ✓");
  });

  it("ignores a stale Game Plan view from a previous day", () => {
    const { gamePlan } = makeSteps({
      hasCheckedInToday: true,
      gamePlanViewedOn: "2026-01-01",
    });

    expect(gamePlan.state).toBe("active");
  });

  it("never lets a Game Plan view count without today's check-in", () => {
    const { gamePlan, log } = makeSteps({
      hasCheckedInToday: false,
      gamePlanViewedOn: TODAY,
    });

    expect(gamePlan.state).toBe("locked");
    expect(log.state).toBe("locked");
  });

  it("counts the workout log as loop completion even without a recorded view", () => {
    const { gamePlan, log } = makeSteps({
      hasCheckedInToday: true,
      hasWorkoutLogToday: true,
    });

    expect(gamePlan.state).toBe("done");
    expect(log.state).toBe("done");
  });

  it("always exposes the same routes so any step can be revisited", () => {
    expect(makeSteps().checkin.route).toBe("/checkin");
    expect(makeSteps().gamePlan.route).toBe("/workout");
    expect(makeSteps().log.route).toBe("/practice-log");
  });
});
