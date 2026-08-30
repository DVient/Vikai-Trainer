import { describe, expect, it } from "vitest";

import { evaluateAutoregulationEngine } from "../src/engine/autoregulation";
import {
  applyRestrictionsToBasePlan,
  scaleSets,
  type ScaledComponent,
} from "../src/engine/generator";
import {
  DEFAULT_OBJECTIVE,
  type AthleteProfile,
  type EngineInput,
  type ReadinessInput,
  type TrainingComponent,
  type TrainingRestrictions,
} from "../src/types";

/**
 * Phase 3.1 — Volume scaling & drill trimming tests (SPEC §22–§23).
 * The generator is pure: fixtures are plain data, no engine/state imports
 * except one cross-check that the engine's PAIN output strips a full plan.
 */

function makeComponent(overrides: Partial<TrainingComponent> = {}): TrainingComponent {
  return {
    id: "comp-1",
    type: "STRENGTH",
    stress: "HIGH",
    priority: 1,
    baseVolume: 4,
    optional: false,
    bodyRegion: "LOWER",
    ...overrides,
  };
}

const BASELINE: TrainingRestrictions = {
  lowerBodyAllowed: true,
  lowerBodyScale: 1,
  upperBodyAllowed: true,
  upperBodyScale: 1,
  plyometricsAllowed: true,
  highImpactAllowed: true,
};

function makeRestrictions(overrides: Partial<TrainingRestrictions> = {}): TrainingRestrictions {
  return { ...BASELINE, ...overrides };
}

function modificationsOf(prescription: readonly ScaledComponent[]): string[] {
  return prescription.map((entry) => entry.modification);
}

describe("scaleSets (SPEC §23 verbatim)", () => {
  it("rounds half-up and never drops below one set", () => {
    expect(scaleSets(4, 0.5)).toBe(2);
    expect(scaleSets(3, 0.5)).toBe(2); // round(1.5) = 2
    expect(scaleSets(5, 0.5)).toBe(3); // round(2.5) = 3 (half-up)
    expect(scaleSets(1, 0.2)).toBe(1); // floor of one set
    expect(scaleSets(3, 0)).toBe(1);
    expect(scaleSets(3, 1)).toBe(3);
  });
});

describe("baseline passthrough", () => {
  it("keeps every component untouched when no restriction applies", () => {
    const plan = [
      makeComponent({ id: "a", baseVolume: 4 }),
      makeComponent({ id: "b", baseVolume: 3, bodyRegion: "UPPER", optional: true }),
      makeComponent({ id: "c", baseVolume: 5, bodyRegion: "FULL" }),
    ];

    const prescription = applyRestrictionsToBasePlan(plan, BASELINE);

    expect(modificationsOf(prescription)).toEqual(["KEPT", "KEPT", "KEPT"]);
    expect(prescription.map((entry) => entry.scaledVolume)).toEqual([4, 3, 5]);
    expect(prescription.every((entry) => entry.modificationReason === undefined)).toBe(true);
  });
});

describe("hard removals (safety before volume math, SPEC §23 step 6)", () => {
  it("removes plyometric work when plyometrics are disallowed", () => {
    const plan = [makeComponent({ id: "jumps", type: "EXPLOSIVENESS", stress: "HIGH" })];

    const prescription = applyRestrictionsToBasePlan(
      plan,
      makeRestrictions({ plyometricsAllowed: false }),
    );

    expect(modificationsOf(prescription)).toEqual(["REMOVED"]);
    expect(prescription[0]?.scaledVolume).toBe(0);
    expect(prescription[0]?.modificationReason).toContain("Removed");
  });

  it("removes high-impact sprint/COD work when high impact is disallowed", () => {
    const plan = [
      makeComponent({ id: "sprints", type: "SPEED", stress: "HIGH" }),
      makeComponent({ id: "cod", type: "CHANGE_OF_DIRECTION", stress: "HIGH" }),
    ];

    const prescription = applyRestrictionsToBasePlan(
      plan,
      makeRestrictions({ highImpactAllowed: false }),
    );

    expect(modificationsOf(prescription)).toEqual(["REMOVED", "REMOVED"]);
  });

  it("keeps low-stress explosive technique work when only plyos are disallowed", () => {
    const plan = [
      makeComponent({ id: "speed", type: "SPEED", stress: "HIGH" }),
      makeComponent({ id: "technique", type: "EXPLOSIVENESS", stress: "LOW" }),
    ];

    const prescription = applyRestrictionsToBasePlan(
      plan,
      makeRestrictions({ plyometricsAllowed: false, highImpactAllowed: true }),
    );

    expect(modificationsOf(prescription)).toEqual(["KEPT", "KEPT"]);
  });

  it("removes blocked body regions and keeps the allowed one", () => {
    const plan = [
      makeComponent({ id: "lower", bodyRegion: "LOWER" }),
      makeComponent({ id: "upper", bodyRegion: "UPPER" }),
      makeComponent({ id: "full", bodyRegion: "FULL" }),
    ];

    const prescription = applyRestrictionsToBasePlan(
      plan,
      makeRestrictions({ lowerBodyAllowed: false, lowerBodyScale: 0 }),
    );

    const byId = new Map(prescription.map((entry) => [entry.component.id, entry.modification]));
    expect(byId.get("lower")).toBe("REMOVED");
    expect(byId.get("full")).toBe("REMOVED");
    expect(byId.get("upper")).toBe("KEPT");
  });

  it("strips an entire plan when the engine's pain override locks everything", () => {
    const now = new Date("2026-01-02T12:00:00.000Z");
    const athlete: AthleteProfile = {
      id: "athlete-1",
      displayName: "Athlete",
      sport: "BASKETBALL",
      athleteLevel: "YOUTH",
      primaryGoals: ["STRENGTH"],
      timezone: "UTC",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const readiness: ReadinessInput = {
      id: "readiness-1",
      localDate: "2026-01-02",
      timezone: "UTC",
      recordedAt: "2026-01-02T08:00:00.000Z",
      sleepAnchor: "OVER_8_HRS",
      jointStatus: "PAIN_CONCERN",
      energyAnchor: "HIGH",
      createdAt: "2026-01-02T08:00:00.000Z",
      updatedAt: "2026-01-02T08:00:00.000Z",
    };
    const input: EngineInput = {
      athlete,
      objective: DEFAULT_OBJECTIVE,
      readiness,
      recentActivities: [],
      upcomingEvents: [],
      now,
    };

    const prescription = applyRestrictionsToBasePlan(
      [
        makeComponent({ id: "a" }),
        makeComponent({ id: "b", bodyRegion: "UPPER" }),
        makeComponent({ id: "c", type: "EXPLOSIVENESS" }),
      ],
      evaluateAutoregulationEngine(input).restrictions,
    );

    expect(modificationsOf(prescription)).toEqual(["REMOVED", "REMOVED", "REMOVED"]);
  });
});

describe("volume scaling by body region", () => {
  it("scales each region with its own scale and FULL with the stricter one", () => {
    const plan = [
      makeComponent({ id: "lower", bodyRegion: "LOWER", baseVolume: 4 }),
      makeComponent({ id: "upper", bodyRegion: "UPPER", baseVolume: 4 }),
      makeComponent({ id: "full", bodyRegion: "FULL", baseVolume: 4 }),
    ];

    const prescription = applyRestrictionsToBasePlan(
      plan,
      makeRestrictions({ lowerBodyScale: 0.5, upperBodyScale: 1 }),
    );

    const byId = new Map(prescription.map((entry) => [entry.component.id, entry]));
    expect(byId.get("lower")?.scaledVolume).toBe(2);
    expect(byId.get("upper")?.scaledVolume).toBe(4);
    expect(byId.get("full")?.scaledVolume).toBe(2); // min(0.5, 1)
    expect(byId.get("lower")?.modification).toBe("REDUCED");
    expect(byId.get("upper")?.modification).toBe("KEPT");
  });

  it("preserves one set on scaled primaries and honors minimumVolume floors", () => {
    const plan = [
      makeComponent({ id: "primary", baseVolume: 1 }),
      makeComponent({ id: "floored", baseVolume: 4, minimumVolume: 2 }),
    ];

    const prescription = applyRestrictionsToBasePlan(
      plan,
      makeRestrictions({ lowerBodyScale: 0.25 }),
    );

    const byId = new Map(prescription.map((entry) => [entry.component.id, entry]));
    // round(1 × 0.25) = 0 → floor of one set keeps execution quality (§23 step 5).
    expect(byId.get("primary")?.scaledVolume).toBe(1);
    expect(byId.get("primary")?.modification).toBe("KEPT");
    // round(4 × 0.25) = 1 → clamped to the plan's floor of 2.
    expect(byId.get("floored")?.scaledVolume).toBe(2);
    expect(byId.get("floored")?.modification).toBe("REDUCED");
  });
});

describe("optional accessory stripping (SPEC §23 step 1)", () => {
  it("strips optional accessories in reduced regions before scaling sets", () => {
    const plan = [
      makeComponent({ id: "optional", optional: true, baseVolume: 3 }),
      makeComponent({ id: "primary", optional: false, baseVolume: 4 }),
    ];

    const prescription = applyRestrictionsToBasePlan(
      plan,
      makeRestrictions({ lowerBodyScale: 0.5 }),
    );

    const byId = new Map(prescription.map((entry) => [entry.component.id, entry]));
    expect(byId.get("optional")?.modification).toBe("REMOVED");
    expect(byId.get("optional")?.modificationReason).toContain("optional");
    expect(byId.get("primary")?.modification).toBe("REDUCED");
  });

  it("keeps optional accessories when their region is not reduced", () => {
    const plan = [
      makeComponent({ id: "optLower", optional: true, bodyRegion: "LOWER" }),
      makeComponent({ id: "optUpper", optional: true, bodyRegion: "UPPER" }),
    ];

    const prescription = applyRestrictionsToBasePlan(
      plan,
      makeRestrictions({ lowerBodyScale: 0.5, upperBodyScale: 1 }),
    );

    const byId = new Map(prescription.map((entry) => [entry.component.id, entry.modification]));
    expect(byId.get("optLower")).toBe("REMOVED");
    expect(byId.get("optUpper")).toBe("KEPT");
  });
});

describe("pure function determinism", () => {
  it("returns identical prescriptions for identical input", () => {
    const plan = [
      makeComponent({ id: "a" }),
      makeComponent({ id: "b", type: "EXPLOSIVENESS", optional: true }),
    ];
    const restrictions = makeRestrictions({ lowerBodyScale: 0.5, plyometricsAllowed: false });

    const first = applyRestrictionsToBasePlan(plan, restrictions);
    const second = applyRestrictionsToBasePlan(plan, restrictions);

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
  });
});
