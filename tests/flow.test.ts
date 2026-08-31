import { describe, expect, it } from "vitest";

import { todaySteps, type DayStep, type FlowInput, type StepId } from "../src/lib/flow";

/** Derives the steps and unpacks them into named, defined references. */
function makeSteps(
  overrides: Partial<FlowInput> = {},
): { checkin: DayStep; gamePlan: DayStep; log: DayStep } {
  const steps = todaySteps({
    hasCheckedInToday: false,
    hasWorkoutLogToday: false,
    hasLoggedActivityToday: false,
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

  it("unlocks the plan and activity steps after the check-in", () => {
    const { checkin, gamePlan, log } = makeSteps({ hasCheckedInToday: true });

    expect(checkin.state).toBe("done");
    expect(checkin.subtitle).toContain("update anytime");
    expect(gamePlan.state).toBe("active");
    expect(log.state).toBe("active");
  });

  it("completes the plan step when the workout was finished", () => {
    const { gamePlan, log } = makeSteps({
      hasCheckedInToday: true,
      hasWorkoutLogToday: true,
    });

    expect(gamePlan.state).toBe("done");
    expect(gamePlan.subtitle).toBe("Session complete ✓");
  });

  it("lets a mid-session activity log complete the log step first", () => {
    const { gamePlan, log } = makeSteps({
      hasCheckedInToday: true,
      hasLoggedActivityToday: true,
    });

    // Logging before finishing is expected — steps don't gate each other.
    expect(log.state).toBe("done");
    expect(log.subtitle).toBe("Practices & games logged ✓");
    expect(gamePlan.state).toBe("active");
  });

  it("completes the whole loop when everything is done", () => {
    const { checkin, gamePlan, log } = makeSteps({
      hasCheckedInToday: true,
      hasWorkoutLogToday: true,
      hasLoggedActivityToday: true,
    });

    expect(checkin.state).toBe("done");
    expect(gamePlan.state).toBe("done");
    expect(log.state).toBe("done");
  });

  it("always exposes the same routes so any step can be revisited", () => {
    expect(makeSteps().checkin.route).toBe("/checkin");
    expect(makeSteps().gamePlan.route).toBe("/workout");
    expect(makeSteps().log.route).toBe("/practice-log");
  });
});
