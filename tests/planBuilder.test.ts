import { describe, expect, it } from "vitest";

import {
  activePlanForDay,
  blockVariant,
  buildPlan,
  daysBetweenDates,
  planStatus,
  startScaleFor,
  weekIndexOf,
  weekScaleFor,
  type PlanBuilderInput,
} from "../src/plans/planBuilder";
import { libraryBlockById } from "../src/plans/library";
import { MILESTONE_DRILLS, currentBests, drillsForGoals } from "../src/plans/milestones";
import { PERSONAS, personaById } from "../src/plans/personas";
import type { PersonalBest } from "../src/types";

const NO_HISTORY = { workoutsLast28d: 0, avgDailyLoad7d: null };

function makeInput(overrides: Partial<PlanBuilderInput> = {}): PlanBuilderInput {
  return {
    id: "plan-test",
    personaId: "JUMP_HIGHER",
    periodWeeks: 8,
    startDate: "2026-09-01",
    history: NO_HISTORY,
    ...overrides,
  };
}

describe("buildPlan — persona-driven selection", () => {
  it("selects goal-matching blocks and reassigns priorities goal-first", () => {
    const plan = buildPlan(makeInput());

    // Jump higher = EXPLOSIVENESS + STRENGTH, lower bias: the jump block
    // and a strength primary lead; recovery is always present.
    const types = plan.components.map((component) => component.type);
    expect(types).toContain("EXPLOSIVENESS");
    expect(types).toContain("STRENGTH");
    expect(types).toContain("RECOVERY");
    // Priorities reassigned 1..n with goal-matches first.
    expect(plan.components[0]?.type).not.toBe("RECOVERY");
    const priorities = plan.components.map((component) => component.priority);
    expect(priorities).toEqual(priorities.map((_, index) => index + 1));
  });

  it("keeps exactly one recovery block and at most two skill blocks", () => {
    for (const persona of PERSONAS) {
      const plan = buildPlan(makeInput({ personaId: persona.id }));
      const kinds = plan.components.map((component) => libraryBlockById(component.id)?.kind);
      expect(kinds.filter((kind) => kind === "RECOVERY")).toHaveLength(1);
      expect(kinds.filter((kind) => kind === "SKILL").length).toBeLessThanOrEqual(2);
      expect(kinds).toContain("RECOVERY");
    }
  });

  it("skills-first personas put a skill block at priority 1", () => {
    const plan = buildPlan(makeInput({ personaId: "CATCH_SHOOT" }));
    const first = plan.components[0];
    expect(libraryBlockById(first?.id ?? "")?.kind).toBe("SKILL");
  });

  it("explicit goals override the persona preset", () => {
    const plan = buildPlan(
      makeInput({ personaId: "JUMP_HIGHER", primaryGoals: ["SPEED"] }),
    );
    expect(plan.primaryGoals).toEqual(["SPEED"]);
    // SPEED blocks rank in; the lower-bias hint from the persona remains
    // but goal dominance decides the head of the plan.
    expect(plan.components[0]?.type).toBe("SPEED");
  });

  it("different personas produce different plans", () => {
    const jump = buildPlan(makeInput({ personaId: "JUMP_HIGHER" }));
    const handles = buildPlan(makeInput({ personaId: "HANDLES_PRESSURE" }));
    expect(jump.components.map((c) => c.id)).not.toEqual(handles.components.map((c) => c.id));
  });
});

describe("buildPlan — history calibration", () => {
  it("starts conservative with no history (0.75) and scales block volumes", () => {
    const plan = buildPlan(makeInput());
    expect(plan.startScale).toBeCloseTo(0.75, 5);
    const squat = plan.components.find((component) => component.id === "primary-lower-squat");
    expect(squat?.baseVolume).toBe(3); // round(4 × 0.75)
  });

  it("dense adherence raises the start to the ceiling", () => {
    const scale = startScaleFor({ workoutsLast28d: 12, avgDailyLoad7d: 300 });
    expect(scale).toBe(1.0);
  });

  it("a heavy recent week penalizes the start but respects the floor", () => {
    const penalized = startScaleFor({ workoutsLast28d: 12, avgDailyLoad7d: 900 });
    expect(penalized).toBeCloseTo(0.9, 5);
    const floored = startScaleFor({ workoutsLast28d: 0, avgDailyLoad7d: 2000 });
    expect(floored).toBe(0.7);
  });

  it("history changes volumes without changing selection order", () => {
    const fresh = buildPlan(makeInput());
    const veteran = buildPlan(makeInput({ history: { workoutsLast28d: 16, avgDailyLoad7d: 300 } }));
    expect(veteran.startScale).toBeGreaterThan(fresh.startScale);
    expect(veteran.components.map((c) => c.id)).toEqual(fresh.components.map((c) => c.id));
    expect(veteran.components[0]?.baseVolume).toBeGreaterThanOrEqual(fresh.components[0]?.baseVolume ?? 0);
  });
});

describe("progression — activePlanForDay", () => {
  const plan = buildPlan(makeInput({ periodWeeks: 8, startDate: "2026-09-01" }));

  it("ramps +8% for three weeks, deloads every 4th, tapers the final week", () => {
    expect(weekScaleFor(0, 8)).toBe(1.0);
    expect(weekScaleFor(1, 8)).toBeCloseTo(1.08, 5);
    expect(weekScaleFor(2, 8)).toBeCloseTo(1.16, 5);
    expect(weekScaleFor(3, 8)).toBe(0.6); // deload
    expect(weekScaleFor(7, 8)).toBe(0.7); // taper
  });

  it("holds the taper after the period ends", () => {
    expect(weekScaleFor(8, 8)).toBe(0.7);
    expect(weekScaleFor(20, 8)).toBe(0.7);
  });

  it("applies the week scale to every block, respecting minimum volumes", () => {
    const week2 = activePlanForDay(plan, "2026-09-08"); // week 1 → 1.08
    const base = plan.components[0];
    expect(week2[0]?.baseVolume).toBe(
      Math.max(base?.minimumVolume ?? 1, Math.round((base?.baseVolume ?? 0) * 1.08)),
    );
  });

  it("deload week actually reduces volume below week 1", () => {
    const week1 = activePlanForDay(plan, "2026-09-01");
    const week4 = activePlanForDay(plan, "2026-09-22"); // week 3 → deload
    const first = plan.components[0];
    const expected = Math.max(first?.minimumVolume ?? 1, Math.round((first?.baseVolume ?? 0) * 0.6));
    expect(week4[0]?.baseVolume).toBe(expected);
    if (expected < (week1[0]?.baseVolume ?? 0)) {
      expect(week4[0]?.baseVolume).toBeLessThan(week1[0]?.baseVolume ?? 0);
    }
  });
});

describe("planStatus + date math", () => {
  const plan = buildPlan(makeInput({ periodWeeks: 8, startDate: "2026-09-01" }));

  it("computes week indexes from the start date", () => {
    expect(weekIndexOf(plan, "2026-09-01")).toBe(0);
    expect(weekIndexOf(plan, "2026-09-07")).toBe(0);
    expect(weekIndexOf(plan, "2026-09-08")).toBe(1);
    expect(daysBetweenDates("2026-09-01", "2026-09-08")).toBe(7);
  });

  it("walks active → final-week → ended", () => {
    expect(planStatus(plan, "2026-09-04")).toBe("active");
    expect(planStatus(plan, "2026-10-20")).toBe("final-week"); // week 7
    expect(planStatus(plan, "2026-10-27")).toBe("ended"); // week 8 boundary
  });
});

describe("exercise rotation — plans stay unique", () => {
  it("the same plan on the same day rotates every block consistently", () => {
    const plan = buildPlan(makeInput());
    const first = plan.components.map((component) => blockVariant(plan, "2026-09-03", component.id));
    expect(first).toEqual(
      plan.components.map((component) => blockVariant(plan, "2026-09-03", component.id)),
    );
  });

  it("a different start date walks blocks through different variants", () => {
    const september = buildPlan(makeInput({ startDate: "2026-09-01" }));
    const october = buildPlan(makeInput({ startDate: "2026-10-01" }));
    // Week 1 of each plan (each plan's own day 3): with per-block seeds,
    // the two plans' variant vectors diverge on most blocks.
    const septemberVariants = september.components.map((component) =>
      blockVariant(september, "2026-09-03", component.id),
    );
    const octoberVariants = october.components.map((component) =>
      blockVariant(october, "2026-10-03", component.id),
    );
    const differing = septemberVariants.filter(
      (variant, index) => variant !== octoberVariants[index],
    ).length;
    expect(differing).toBeGreaterThan(0);
  });

  it("the variant advances across weeks", () => {
    const plan = buildPlan(makeInput({ startDate: "2026-09-01" }));
    const weeks = [0, 1, 2, 3, 4, 5].map((week) => {
      const day = `2026-${week < 4 ? "09" : "10"}-${String(1 + (week % 4) * 7 + (week >= 4 ? 1 : 0)).padStart(2, "0")}`;
      return blockVariant(plan, day, "primary-lower-squat");
    });
    expect(new Set(weeks).size).toBeGreaterThan(1);
  });
});

describe("milestone catalog + pairing", () => {
  it("every persona's drill ids exist in the catalog", () => {
    for (const persona of PERSONAS) {
      for (const drillId of persona.benchmarkDrillIds) {
        expect(MILESTONE_DRILLS.some((drill) => drill.id === drillId)).toBe(true);
      }
    }
  });

  it("resolves drills for a plan's goals", () => {
    const drills = drillsForGoals(["EXPLOSIVENESS"]);
    expect(drills.length).toBeGreaterThanOrEqual(5);
  });

  it("picks the best attempt per drill, respecting direction", () => {
    const attempts: PersonalBest[] = [
      { id: "a", drillId: "jump-touch", value: 40, recordedAt: "2026-09-01T10:00:00.000Z", activityDate: "2026-09-01" },
      { id: "b", drillId: "jump-touch", value: 46, recordedAt: "2026-09-20T10:00:00.000Z", activityDate: "2026-09-20" },
      { id: "c", drillId: "sprint-20yd", value: 3.2, recordedAt: "2026-09-01T10:00:00.000Z", activityDate: "2026-09-01" },
      { id: "d", drillId: "sprint-20yd", value: 3.0, recordedAt: "2026-09-20T10:00:00.000Z", activityDate: "2026-09-20" },
    ];
    const best = currentBests(attempts);
    expect(best["jump-touch"]?.id).toBe("b"); // higher is better
    expect(best["sprint-20yd"]?.id).toBe("d"); // lower is better
  });

  it("persona lookups resolve", () => {
    expect(personaById("JUMP_HIGHER")?.label).toBe("Jump higher");
    expect(personaById("ALL_ROUND")?.skillPriority).toBe(false);
  });
});
