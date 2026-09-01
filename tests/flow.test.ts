import { describe, expect, it } from "vitest";

import { partitionActivities } from "../src/lib/activityTiming";
import { todaySteps, type DayStep, type FlowInput, type StepId } from "../src/lib/flow";

/** Derives the steps and unpacks them into named, defined references. */
function makeSteps(
  overrides: Partial<FlowInput> = {},
): { checkin: DayStep; gamePlan: DayStep; log: DayStep; order: StepId[] } {
  const steps = todaySteps({
    hasCheckedInToday: false,
    hasWorkoutLogToday: false,
    activityPartition: { pre: [], post: [] },
    ...overrides,
  });
  const pick = (id: StepId): DayStep => {
    const found = steps.find((entry) => entry.id === id);
    if (!found) throw new Error(`missing step: ${id}`);
    return found;
  };
  return {
    checkin: pick("checkin"),
    gamePlan: pick("gamePlan"),
    log: pick("log"),
    order: steps.map((entry) => entry.id),
  };
}

describe("todaySteps — the guided daily sequence", () => {
  it("runs check-in → log activities → game plan", () => {
    // Activities come BEFORE the workout in the flow: they shape its volume.
    expect(makeSteps().order).toEqual(["checkin", "log", "gamePlan"]);
  });

  it("starts at step 1 with later steps locked on a fresh install", () => {
    const { checkin, gamePlan, log } = makeSteps();

    expect(checkin.state).toBe("active");
    expect(gamePlan.state).toBe("locked");
    expect(gamePlan.subtitle).toBe("Unlock with your check-in");
    expect(log.state).toBe("locked");
  });

  it("unlocks the activity and plan steps after the check-in", () => {
    const { checkin, gamePlan, log } = makeSteps({ hasCheckedInToday: true });

    expect(checkin.state).toBe("done");
    expect(checkin.subtitle).toContain("update anytime");
    expect(gamePlan.state).toBe("active");
    expect(gamePlan.subtitle).toBe("Log earlier activities first");
    expect(log.state).toBe("active");
    expect(log.subtitle).toBe("Before you train — anything on your legs today?");
  });

  it("completes the log step with a pre-workout activity and updates the plan nudge", () => {
    const { gamePlan, log } = makeSteps({
      hasCheckedInToday: true,
      activityPartition: { pre: [{ activityDate: "2026-01-02", createdAt: "2026-01-02T15:00:00.000Z" }], post: [] },
    });

    expect(log.state).toBe("done");
    expect(log.subtitle).toBe("Logged before training ✓ — it shaped today's volume");
    expect(gamePlan.state).toBe("active");
    expect(gamePlan.subtitle).toBe("Check off sets as you go");
  });

  it("marks post-workout logs as shaping the next workout", () => {
    const { gamePlan, log } = makeSteps({
      hasCheckedInToday: true,
      hasWorkoutLogToday: true,
      activityPartition: { pre: [], post: [{ activityDate: "2026-01-02", createdAt: "2026-01-02T21:00:00.000Z" }] },
    });

    expect(log.state).toBe("done");
    expect(log.subtitle).toBe("After today's session ✓ — shapes your next workout");
    expect(gamePlan.state).toBe("done");
  });

  it("completes the whole loop when everything is done", () => {
    const { checkin, gamePlan, log } = makeSteps({
      hasCheckedInToday: true,
      hasWorkoutLogToday: true,
      activityPartition: {
        pre: [{ activityDate: "2026-01-02", createdAt: "2026-01-02T15:00:00.000Z" }],
        post: [],
      },
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

describe("partitionActivities — pre vs post workout attribution", () => {
  const day = "2026-01-02";
  const logs = [
    { activityDate: day, createdAt: "2026-01-02T14:00:00.000Z" }, // pre
    { activityDate: day, createdAt: "2026-01-02T16:30:00.000Z" }, // post (workout at 16:00)
    { activityDate: day, createdAt: "2026-01-02T12:00:00.000Z" }, // pre
  ];
  const workoutLogs = [{ activityDate: day, createdAt: "2026-01-02T16:00:00.000Z" }];

  it("splits around the workout completion instant", () => {
    const { pre, post } = partitionActivities(logs, workoutLogs, day);
    expect(pre).toHaveLength(2);
    expect(post).toHaveLength(1);
    expect(post[0]?.createdAt).toBe("2026-01-02T16:30:00.000Z");
  });

  it("treats everything as pre-workout before the workout finishes", () => {
    const { pre, post } = partitionActivities(logs, [], day);
    expect(pre).toHaveLength(3);
    expect(post).toHaveLength(0);
  });

  it("ignores other days' logs and missing timestamps", () => {
    const withEdgeCases = [
      ...logs,
      { activityDate: "2026-01-03", createdAt: "2026-01-03T09:00:00.000Z" },
      { activityDate: day }, // no timestamp — can't be attributed → pre
    ];
    const { pre, post } = partitionActivities(withEdgeCases, workoutLogs, day);
    expect(pre).toHaveLength(3);
    expect(post).toHaveLength(1);
  });

  it("prefers the earliest workout log of the day as the boundary", () => {
    const doubleLogged = [
      { activityDate: day, createdAt: "2026-01-02T16:00:00.000Z" },
      { activityDate: day, createdAt: "2026-01-02T18:00:00.000Z" },
    ];
    const { post } = partitionActivities(
      [{ activityDate: day, createdAt: "2026-01-02T16:30:00.000Z" }],
      doubleLogged,
      day,
    );
    // The 16:30 log came after the FIRST completion → post-workout.
    expect(post).toHaveLength(1);
  });

  it("attributes late-evening logs across the UTC midnight boundary as post-workout", () => {
    // Local date 2026-01-02 in an Americas timezone: the 11:30 PM activity
    // and 3:00 PM workout are the same LOCAL day, but the 11:30 PM instant
    // lands on the NEXT UTC date. Instant comparison must win.
    const lateEvening = [
      { activityDate: day, createdAt: "2026-01-03T04:30:00.000Z" }, // 11:30 PM local
      { activityDate: day, createdAt: "2026-01-02T19:00:00.000Z" }, // 2:00 PM local
    ];
    const eveningWorkout = [{ activityDate: day, createdAt: "2026-01-02T20:00:00.000Z" }]; // 3:00 PM

    const { pre, post } = partitionActivities(lateEvening, eveningWorkout, day);
    expect(pre).toHaveLength(1);
    expect(pre[0]?.createdAt).toBe("2026-01-02T19:00:00.000Z");
    expect(post).toHaveLength(1);
    expect(post[0]?.createdAt).toBe("2026-01-03T04:30:00.000Z");
  });
});
