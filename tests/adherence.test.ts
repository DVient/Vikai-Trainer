import { describe, expect, it } from "vitest";

import {
  adherenceSamplesFor,
  computePerformanceScales,
  DEFAULT_ADHERENCE_OPTIONS,
  performanceScales,
  PERFORMANCE_EXEMPT_GOALS,
} from "../src/plans/adherence";
import type { BuiltPlan, CompletedComponent, WorkoutLog } from "../src/types";

/**
 * Phase 8.3 — performance-based loading tests: the objective gap between
 * planned and completed blocks prices the NEXT session; today's own session
 * never reprices today; skill/technique and top-speed goals are exempt.
 */

const TODAY = "2026-01-08";

function makeLog(activityDate: string): WorkoutLog {
  return { id: `log-${activityDate}`, activityDate, createdAt: "", updatedAt: "" };
}

function done(componentId: string): CompletedComponent {
  return { componentId, sets: 3, completedAt: "" };
}

/** Minimal 4-week strength-led plan: 3 strength + 1 explosiveness + 1 speed. */
function makePlan(): BuiltPlan {
  return {
    id: "plan-1",
    startDate: "2026-01-01",
    periodWeeks: 4,
    primaryGoals: ["STRENGTH"],
    startScale: 1,
    components: [
      { id: "strength-a", type: "STRENGTH", stress: "HIGH", priority: 1, baseVolume: 4, optional: false },
      { id: "strength-b", type: "STRENGTH", stress: "HIGH", priority: 2, baseVolume: 3, optional: false },
      { id: "strength-c", type: "STRENGTH", stress: "HIGH", priority: 3, baseVolume: 3, optional: false },
      { id: "jumps", type: "EXPLOSIVENESS", stress: "HIGH", priority: 2, baseVolume: 4, optional: false },
      { id: "sprints", type: "SPEED", stress: "HIGH", priority: 2, baseVolume: 3, optional: false },
    ],
  };
}

describe("adherenceSamplesFor", () => {
  it("aggregates planned vs completed blocks per goal across the window", () => {
    const progress = {
      "2026-01-06": { "strength-a": done("strength-a"), "strength-b": done("strength-b"), jumps: done("jumps"), sprints: done("sprints") },
      "2026-01-04": { "strength-a": done("strength-a"), jumps: done("jumps") },
    };
    const samples = adherenceSamplesFor(makePlan(), [makeLog("2026-01-06"), makeLog("2026-01-04")], progress, TODAY);

    const byGoal = new Map(samples.map((sample) => [sample.goal, sample]));
    // 3 sessions... two logs, 3 strength blocks per session: planned 6, completed 3.
    expect(byGoal.get("STRENGTH")).toEqual({ goal: "STRENGTH", plannedBlocks: 6, completedBlocks: 3 });
    expect(byGoal.get("EXPLOSIVENESS")).toEqual({ goal: "EXPLOSIVENESS", plannedBlocks: 2, completedBlocks: 2 });
    expect(byGoal.get("SPEED")).toEqual({ goal: "SPEED", plannedBlocks: 2, completedBlocks: 1 });
  });

  it("excludes today's own session — the day stays locked", () => {
    const progress = { [TODAY]: { "strength-a": done("strength-a") } };
    const samples = adherenceSamplesFor(makePlan(), [makeLog(TODAY)], progress, TODAY);

    expect(samples).toEqual([]);
  });

  it("respects the lookback window on both ends", () => {
    const samples = adherenceSamplesFor(
      makePlan(),
      [makeLog("2025-12-31"), makeLog("2026-01-01"), makeLog("2026-01-07"), makeLog(TODAY)],
      {},
      TODAY,
    );

    const strength = samples.find((sample) => sample.goal === "STRENGTH");
    // 2026-01-01 and 2026-01-07 are inside the 7-day window; 2025-12-31 is not.
    expect(strength?.plannedBlocks).toBe(6);
  });

  it("falls back to the default template when no plan is active", () => {
    const progress = { "2026-01-06": { "primary-lower-squat": done("primary-lower-squat"), "skill-ballhandling": done("skill-ballhandling") } };
    const samples = adherenceSamplesFor(null, [makeLog("2026-01-06")], progress, TODAY);

    const byGoal = new Map(samples.map((sample) => [sample.goal, sample]));
    expect(byGoal.get("STRENGTH")?.plannedBlocks).toBe(4); // 4 strength blocks, recovery excluded
    expect(byGoal.get("STRENGTH")?.completedBlocks).toBe(1);
    // Skills are typed EXPLOSIVENESS in the library — the exempt goal absorbs them.
    expect(byGoal.get("EXPLOSIVENESS")).toEqual({ goal: "EXPLOSIVENESS", plannedBlocks: 2, completedBlocks: 1 });
  });
});

describe("performanceScales", () => {
  it("scales under-completed eligible goals for the next session", () => {
    const scales = performanceScales([
      { goal: "STRENGTH", plannedBlocks: 6, completedBlocks: 2 }, // ratio 0.33
      { goal: "CHANGE_OF_DIRECTION", plannedBlocks: 4, completedBlocks: 4 }, // 1.0
    ]);

    expect(scales).toEqual({ STRENGTH: DEFAULT_ADHERENCE_OPTIONS.scale });
  });

  it("never scales exempt goals regardless of completion", () => {
    const scales = performanceScales([
      { goal: "EXPLOSIVENESS", plannedBlocks: 6, completedBlocks: 0 },
      { goal: "SPEED", plannedBlocks: 6, completedBlocks: 0 },
      { goal: "RECOVERY", plannedBlocks: 6, completedBlocks: 0 },
    ]);

    expect(scales).toEqual({});
    expect(PERFORMANCE_EXEMPT_GOALS).toContain("EXPLOSIVENESS");
    expect(PERFORMANCE_EXEMPT_GOALS).toContain("SPEED");
    expect(PERFORMANCE_EXEMPT_GOALS).toContain("RECOVERY");
  });

  it("needs the minimum block count before judging a goal", () => {
    const scales = performanceScales([{ goal: "STRENGTH", plannedBlocks: 2, completedBlocks: 0 }]);

    expect(scales).toEqual({});
  });

  it("is deterministic", () => {
    const samples = [
      { goal: "STRENGTH" as const, plannedBlocks: 6, completedBlocks: 2 },
      { goal: "ACCELERATION" as const, plannedBlocks: 3, completedBlocks: 3 },
    ];

    expect(performanceScales(samples)).toEqual(performanceScales(samples));
  });
});

describe("computePerformanceScales (screen convenience)", () => {
  it("derives next-session scales straight from store slices", () => {
    const progress = {
      "2026-01-06": { jumps: done("jumps"), sprints: done("sprints") },
      "2026-01-04": { jumps: done("jumps"), sprints: done("sprints") },
    };

    const scales = computePerformanceScales(
      makePlan(),
      [makeLog("2026-01-06"), makeLog("2026-01-04")],
      progress,
      TODAY,
    );

    // Strength: 0/6 completed → 0.8. Speed/explosiveness: full and exempt.
    expect(scales).toEqual({ STRENGTH: 0.8 });
  });
});
