import { describe, expect, it } from "vitest";

import { partitionActivities } from "../src/lib/activityTiming";
import {
  flowStepPosition,
  nextStepFor,
  STEP_ORDER,
  todaySteps,
  type DayStep,
  type FlowInput,
  type StepId,
} from "../src/lib/flow";

/** Derives the steps and unpacks them into named, defined references. */
function makeSteps(
  overrides: Partial<FlowInput> = {},
): { checkin: DayStep; cns: DayStep; gamePlan: DayStep; log: DayStep; order: StepId[] } {
  const steps = todaySteps({
    hasCheckedInToday: false,
    hasTapTestToday: false,
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
    cns: pick("cns"),
    gamePlan: pick("gamePlan"),
    log: pick("log"),
    order: steps.map((entry) => entry.id),
  };
}

describe("todaySteps — the guided daily sequence", () => {
  it("runs check-in → tap test → log activities → game plan", () => {
    // The tap test sits right after the check-in: its result blends with the
    // survey answers (Phase 10). Activities come BEFORE the workout in the
    // flow: they shape its volume.
    expect(makeSteps().order).toEqual(["checkin", "cns", "log", "gamePlan"]);
  });

  it("starts at step 1 with later steps locked on a fresh install", () => {
    const { checkin, cns, gamePlan, log } = makeSteps();

    expect(checkin.state).toBe("active");
    expect(cns.state).toBe("locked");
    expect(cns.subtitle).toBe("After your check-in");
    expect(gamePlan.state).toBe("locked");
    expect(gamePlan.subtitle).toBe("Unlock with your check-in");
    expect(log.state).toBe("locked");
  });

  it("unlocks the tap-test, activity, and plan steps after the check-in", () => {
    const { checkin, cns, gamePlan, log } = makeSteps({ hasCheckedInToday: true });

    expect(checkin.state).toBe("done");
    expect(checkin.subtitle).toContain("update anytime");
    expect(cns.state).toBe("active");
    expect(cns.subtitle).toBe("Tap fast for 10 sec — measure your freshness");
    expect(gamePlan.state).toBe("active");
    expect(gamePlan.subtitle).toBe("Log earlier activities first");
    expect(log.state).toBe("active");
    expect(log.subtitle).toBe("Before you train — anything on your legs today?");
  });

  it("marks the tap-test step done once today's trial is logged", () => {
    const { cns } = makeSteps({ hasCheckedInToday: true, hasTapTestToday: true });

    expect(cns.state).toBe("done");
    expect(cns.subtitle).toBe("Logged for today ✓");
    expect(cns.route).toBe("/finger-tap");
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
    const { checkin, cns, gamePlan, log } = makeSteps({
      hasCheckedInToday: true,
      hasTapTestToday: true,
      hasWorkoutLogToday: true,
      activityPartition: {
        pre: [{ activityDate: "2026-01-02", createdAt: "2026-01-02T15:00:00.000Z" }],
        post: [],
      },
    });

    expect(checkin.state).toBe("done");
    expect(cns.state).toBe("done");
    expect(gamePlan.state).toBe("done");
    expect(log.state).toBe("done");
  });

  it("always exposes the same routes so any step can be revisited", () => {
    expect(makeSteps().checkin.route).toBe("/checkin");
    expect(makeSteps().cns.route).toBe("/finger-tap");
    expect(makeSteps().gamePlan.route).toBe("/workout");
    expect(makeSteps().log.route).toBe("/practice-log");
  });
});

describe("nextStepFor — the Home 'your next step' hero (Phase 12)", () => {
  it("offers the check-in first on a fresh day", () => {
    const hero = nextStepFor({
      hasCheckedInToday: false,
      hasTapTestToday: false,
      hasWorkoutLogToday: false,
      activityPartition: { pre: [], post: [] },
    });

    expect(hero.id).toBe("checkin");
    expect(hero.title).toBe("Check in first");
    expect(hero.subtitle).toBe("Three taps. Unlocks today's plan.");
    expect(hero.route).toBe("/checkin");
  });

  it("advances to the tap test once the check-in is done", () => {
    const hero = nextStepFor({
      hasCheckedInToday: true,
      hasTapTestToday: false,
      hasWorkoutLogToday: false,
      activityPartition: { pre: [], post: [] },
    });

    expect(hero.id).toBe("cns");
    expect(hero.route).toBe("/finger-tap");
    expect(hero.title).toBe("Do the 10-second tap test");
  });

  it("offers activity logging before the session when nothing is logged yet", () => {
    const hero = nextStepFor({
      hasCheckedInToday: true,
      hasTapTestToday: true,
      hasWorkoutLogToday: false,
      activityPartition: { pre: [], post: [] },
    });

    expect(hero.id).toBe("log");
    expect(hero.route).toBe("/practice-log");
    expect(hero.title).toBe("Log your activities");
  });

  it("hands the day to the session once the earlier steps are done", () => {
    const hero = nextStepFor({
      hasCheckedInToday: true,
      hasTapTestToday: true,
      hasWorkoutLogToday: false,
      activityPartition: {
        pre: [{ activityDate: "2026-01-02", createdAt: "2026-01-02T15:00:00.000Z" }],
        post: [],
      },
    });

    expect(hero.id).toBe("gamePlan");
    expect(hero.route).toBe("/workout");
    expect(hero.title).toBe("Start today's session");
  });

  it("still asks for activity logging after a finished session (it shapes the next one)", () => {
    const hero = nextStepFor({
      hasCheckedInToday: true,
      hasTapTestToday: true,
      hasWorkoutLogToday: true,
      activityPartition: { pre: [], post: [] },
    });

    expect(hero.id).toBe("log");
    expect(hero.route).toBe("/practice-log");
  });

  it("resolves to the session-complete handoff once the whole day is done", () => {
    const hero = nextStepFor({
      hasCheckedInToday: true,
      hasTapTestToday: true,
      hasWorkoutLogToday: true,
      activityPartition: {
        pre: [{ activityDate: "2026-01-02", createdAt: "2026-01-02T15:00:00.000Z" }],
        post: [],
      },
    });

    expect(hero.id).toBe("complete");
    expect(hero.emoji).toBe("🎉");
    expect(hero.route).toBe("/practice-log");
  });
});

describe("flowStepPosition — step numbering across the guided day (Phase 12)", () => {
  it("numbers the day's steps 1..4 in the canonical order", () => {
    expect(flowStepPosition("checkin")).toEqual({ position: 1, total: 4 });
    expect(flowStepPosition("cns")).toEqual({ position: 2, total: 4 });
    expect(flowStepPosition("log")).toEqual({ position: 3, total: 4 });
    expect(flowStepPosition("gamePlan")).toEqual({ position: 4, total: 4 });
  });

  it("matches the order todaySteps actually returns — the numbering can't drift", () => {
    const steps = todaySteps({
      hasCheckedInToday: true,
      hasTapTestToday: true,
      hasWorkoutLogToday: true,
      activityPartition: { pre: [], post: [] },
    });
    expect(steps.map((step) => step.id)).toEqual([...STEP_ORDER]);
    for (const step of steps) {
      expect(flowStepPosition(step.id).position).toBe(steps.indexOf(step) + 1);
    }
  });

  it("never returns a zero position for an unknown id (defensive)", () => {
    const position = flowStepPosition("not-a-step" as StepId);
    expect(position.position).toBe(1);
    expect(position.total).toBe(4);
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
