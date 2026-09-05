import { describe, expect, it } from "vitest";

import { evaluateAutoregulationEngine } from "../src/engine/autoregulation";
import {
  applyRestrictionsToBasePlan,
  hasConsecutiveHighStressDays,
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

/** Single-entry prescriptions: guards noUncheckedIndexedAccess at the edge. */
function firstOf(prescription: readonly ScaledComponent[]): ScaledComponent {
  const entry = prescription[0];
  if (entry === undefined) throw new Error("expected a prescription entry");
  return entry;
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

  it("lets allowed plyometrics survive the high-impact rule (SPEC §17 primer)", () => {
    // Primer day: the engine allows reduced plyometrics but bans high-impact
    // conditioning. Jump mechanics survive REDUCED; sprints are removed.
    const plan = [
      makeComponent({ id: "jumps", type: "EXPLOSIVENESS", stress: "HIGH", baseVolume: 4 }),
      makeComponent({ id: "sprints", type: "SPEED", stress: "HIGH", baseVolume: 3 }),
    ];

    const prescription = applyRestrictionsToBasePlan(
      plan,
      makeRestrictions({
        lowerBodyScale: 0.5,
        plyometricsAllowed: true,
        highImpactAllowed: false,
      }),
    );

    expect(prescription.find((entry) => entry.component.id === "jumps")).toMatchObject({
      modification: "REDUCED",
      scaledVolume: 2,
    });
    expect(prescription.find((entry) => entry.component.id === "sprints")?.modification).toBe(
      "REMOVED",
    );
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

describe("§20 consecutive high-stress days", () => {
  const NOW = new Date("2026-01-02T12:00:00.000Z");

  it("detects overlap from logged activities on today and yesterday", () => {
    expect(
      hasConsecutiveHighStressDays(
        [
          { id: "a", activityDate: "2026-01-01", timezone: "UTC", activityType: "TEAM_PRACTICE", createdAt: "", updatedAt: "" },
          { id: "b", activityDate: "2026-01-02", timezone: "UTC", activityType: "GAME", createdAt: "", updatedAt: "" },
        ],
        [],
        NOW,
        "UTC",
      ),
    ).toBe(true);
  });

  it("detects overlap from a scheduled game plus a logged practice", () => {
    expect(
      hasConsecutiveHighStressDays(
        [{ id: "a", activityDate: "2026-01-01", timezone: "UTC", activityType: "TEAM_PRACTICE", createdAt: "", updatedAt: "" }],
        [{ id: "g", eventType: "GAME", startAt: new Date(NOW.getTime() + 4 * 60 * 60 * 1000).toISOString(), createdAt: "", updatedAt: "" }],
        NOW,
        "UTC",
      ),
    ).toBe(true);
  });

  it("does not fire for a single high-stress day or low-stress days", () => {
    expect(
      hasConsecutiveHighStressDays(
        [
          { id: "a", activityDate: "2026-01-01", timezone: "UTC", activityType: "SKILL_WORK", createdAt: "", updatedAt: "" },
          { id: "b", activityDate: "2026-01-02", timezone: "UTC", activityType: "GAME", createdAt: "", updatedAt: "" },
        ],
        [],
        NOW,
        "UTC",
      ),
    ).toBe(false);
  });

  it("counts camps, strength/skill sessions, and other-sport games as high-stress commitments", () => {
    for (const eventType of [
      "BASKETBALL_CAMP",
      "STRENGTH_SESSION",
      "SKILL_SESSION",
      "OTHER_SPORTS_GAME",
      "ID_SESSION",
    ] as const) {
      expect(
        hasConsecutiveHighStressDays(
          [{ id: "a", activityDate: "2026-01-01", timezone: "UTC", activityType: "TEAM_PRACTICE", createdAt: "", updatedAt: "" }],
          [
            {
              id: `e-${eventType}`,
              eventType,
              startAt: new Date(NOW.getTime() + 4 * 60 * 60 * 1000).toISOString(),
              createdAt: "",
              updatedAt: "",
            },
          ],
          NOW,
          "UTC",
        ),
      ).toBe(true);
    }
  });

  it("keeps school and other events out of the high-stress rule", () => {
    expect(
      hasConsecutiveHighStressDays(
        [{ id: "a", activityDate: "2026-01-01", timezone: "UTC", activityType: "TEAM_PRACTICE", createdAt: "", updatedAt: "" }],
        [
          {
            id: "e-school",
            eventType: "SCHOOL",
            startAt: new Date(NOW.getTime() + 4 * 60 * 60 * 1000).toISOString(),
            createdAt: "",
            updatedAt: "",
          },
        ],
        NOW,
        "UTC",
      ),
    ).toBe(false);
  });

  it("strips ALL optional volume when stripOptional is set, even at scale 1.0", () => {
    const plan = [
      makeComponent({ id: "primary", optional: false }),
      makeComponent({ id: "optional", optional: true, bodyRegion: "UPPER" }),
    ];

    const prescription = applyRestrictionsToBasePlan(plan, BASELINE, { stripOptional: true });

    const byId = new Map(prescription.map((entry) => [entry.component.id, entry]));
    expect(byId.get("primary")?.modification).toBe("KEPT");
    expect(byId.get("optional")?.modification).toBe("REMOVED");
    expect(byId.get("optional")?.modificationReason).toContain("back-to-back high-stress");
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

describe("goal-aware volume redistribution", () => {
  const goalPlan = [
    makeComponent({ id: "squat", type: "STRENGTH", priority: 1, baseVolume: 4 }),
    makeComponent({ id: "sprints", type: "SPEED", priority: 2, baseVolume: 3 }),
    makeComponent({ id: "cod", type: "CHANGE_OF_DIRECTION", priority: 3, baseVolume: 3 }),
  ];

  it("cuts non-goal secondaries deeper before goal-primary blocks", () => {
    // Lower scale 0.6 with a STRENGTH-first objective: squat keeps the plain
    // region scale (4 × 0.6 → 2); sprints (non-goal) take the extra 0.5×
    // (3 × 0.3 → 1); COD is a goal → plain scale (3 × 0.6 → 2).
    const prescription = applyRestrictionsToBasePlan(goalPlan, makeRestrictions({ lowerBodyScale: 0.6 }), {
      primaryGoals: ["STRENGTH", "CHANGE_OF_DIRECTION"],
    });

    const byId = new Map(prescription.map((entry) => [entry.component.id, entry]));
    expect(byId.get("squat")).toMatchObject({ modification: "REDUCED", scaledVolume: 2 });
    expect(byId.get("cod")).toMatchObject({ modification: "REDUCED", scaledVolume: 2 });
    expect(byId.get("sprints")).toMatchObject({ modification: "REDUCED", scaledVolume: 1 });
  });

  it("never increases volume anywhere versus uniform scaling", () => {
    const uniform = applyRestrictionsToBasePlan(goalPlan, makeRestrictions({ lowerBodyScale: 0.6 }));
    const goalAware = applyRestrictionsToBasePlan(goalPlan, makeRestrictions({ lowerBodyScale: 0.6 }), {
      primaryGoals: ["STRENGTH"],
    });
    for (const [index, entry] of goalAware.entries()) {
      expect(entry.scaledVolume).toBeLessThanOrEqual(uniform[index]?.scaledVolume ?? 0);
    }
  });

  it("flips protection when the objective names different goals", () => {
    // SPEED-first athlete: sprints keep the region scale, the squat takes
    // the priority-1 pass plus goal treatment — protection is objective-driven.
    const prescription = applyRestrictionsToBasePlan(goalPlan, makeRestrictions({ lowerBodyScale: 0.6 }), {
      primaryGoals: ["SPEED"],
    });

    const byId = new Map(prescription.map((entry) => [entry.component.id, entry]));
    expect(byId.get("sprints")).toMatchObject({ scaledVolume: 2 });
    expect(byId.get("cod")?.scaledVolume).toBeLessThan(
      applyRestrictionsToBasePlan(goalPlan, makeRestrictions({ lowerBodyScale: 0.6 })).find(
        (entry) => entry.component.id === "cod",
      )?.scaledVolume ?? 0,
    );
    // Priority-1 primaries are always protected regardless of goal overlap.
    expect(byId.get("squat")).toMatchObject({ scaledVolume: 2 });
  });

  it("keeps uniform scaling when no goals are provided (backward compatible)", () => {
    const prescription = applyRestrictionsToBasePlan(goalPlan, makeRestrictions({ lowerBodyScale: 0.6 }));
    const byId = new Map(prescription.map((entry) => [entry.component.id, entry]));
    expect(byId.get("squat")?.scaledVolume).toBe(2);
    expect(byId.get("sprints")?.scaledVolume).toBe(2);
  });
});

describe("duration cap enforcement (maxTrainingDurationMinutes)", () => {
  const cappedPlan = [
    makeComponent({ id: "primary", priority: 1, baseVolume: 4, estimatedMinutes: 16 }),
    makeComponent({ id: "secondary", type: "SPEED", priority: 2, baseVolume: 3, estimatedMinutes: 9 }),
    makeComponent({
      id: "extra",
      type: "SPEED",
      priority: 3,
      baseVolume: 3,
      estimatedMinutes: 9,
    }),
    makeComponent({ id: "recovery", type: "RECOVERY", priority: 6, baseVolume: 1, estimatedMinutes: 5 }),
  ];

  it("drops the least goal-relevant components until the plan fits the cap", () => {
    // Full plan: 16 + 9 + 9 + 5 = 39 min. Cap 30 → the priority-3 non-goal
    // component goes first: 30 ≤ 30 ✓ (asserted fully in the next test).
    const prescription = applyRestrictionsToBasePlan(
      cappedPlan,
      { ...makeRestrictions(), maxTrainingDurationMinutes: 30 },
      { primaryGoals: ["STRENGTH"] },
    );
    expect(prescription.find((entry) => entry.component.id === "extra")?.modification).toBe(
      "REMOVED",
    );
  });

  it("enforces the cap through the restrictions field", () => {
    const restrictions = makeRestrictions();
    const restrictionsWithCap: TrainingRestrictions = { ...restrictions, maxTrainingDurationMinutes: 30 };
    const prescription = applyRestrictionsToBasePlan(
      cappedPlan,
      restrictionsWithCap,
      { primaryGoals: ["STRENGTH"] },
    );

    const byId = new Map(prescription.map((entry) => [entry.component.id, entry]));
    expect(byId.get("extra")?.modification).toBe("REMOVED");
    expect(byId.get("extra")?.modificationReason).toContain("session cap");
    expect(byId.get("secondary")?.modification).toBe("KEPT");
    expect(byId.get("primary")?.modification).toBe("KEPT");
    expect(byId.get("recovery")?.modification).toBe("KEPT");
  });

  it("never drops priority-1 primaries or recovery work", () => {
    const tightPlan = [
      makeComponent({ id: "primary", priority: 1, baseVolume: 4, estimatedMinutes: 40 }),
      makeComponent({ id: "recovery", type: "RECOVERY", priority: 6, baseVolume: 1, estimatedMinutes: 5 }),
    ];
    const restrictionsWithCap: TrainingRestrictions = {
      ...makeRestrictions(),
      maxTrainingDurationMinutes: 10,
    };

    const prescription = applyRestrictionsToBasePlan(tightPlan, restrictionsWithCap);

    // Nothing droppable remains — overflow is accepted, nothing removed.
    expect(modificationsOf(prescription)).toEqual(["KEPT", "KEPT"]);
  });
});

describe("targeted soreness mapping (Phase 7)", () => {
  const soreRestrictions = makeRestrictions({
    sorenessScale: { QUAD: 0.6, CALF: 0.6 },
  });

  it("sits a block out entirely when every area it targets is sore", () => {
    const plan = [
      makeComponent({ id: "squat", baseVolume: 4, muscleGroups: ["QUAD"] }),
      makeComponent({ id: "calf-ankle", baseVolume: 3, muscleGroups: ["CALF", "ANKLE", "FOOT"] }),
    ];

    const prescription = applyRestrictionsToBasePlan(plan, soreRestrictions);

    const squat = prescription.find((entry) => entry.component.id === "squat");
    const calfAnkle = prescription.find((entry) => entry.component.id === "calf-ankle");
    // QUAD is sore and the only tag → sit-out.
    expect(squat?.modification).toBe("REMOVED");
    expect(squat?.modificationReason).toBe(
      "Removed: Quad is sore — this block sits out today.",
    );
    // CALF is sore but ANKLE/FOOT are not → partial overlap survives.
    expect(calfAnkle?.modification).toBe("REDUCED");
    expect(calfAnkle?.scaledVolume).toBe(2); // round(3 × 0.6) = 2
    expect(calfAnkle?.modificationReason).toContain("Calf is sore");
  });

  it("leaves untagged components untouched (skills and recovery are exempt)", () => {
    const plan = [
      makeComponent({ id: "skill-drill", type: "EXPLOSIVENESS", stress: "LOW", baseVolume: 3, bodyRegion: "FULL" }),
      makeComponent({ id: "recovery-flow", type: "RECOVERY", stress: "RECOVERY", priority: 6, baseVolume: 1, bodyRegion: "FULL" }),
    ];

    const prescription = applyRestrictionsToBasePlan(plan, soreRestrictions);

    expect(modificationsOf(prescription)).toEqual(["KEPT", "KEPT"]);
  });

  it("exempts components when no flagged area overlaps their tags", () => {
    const plan = [
      makeComponent({ id: "upper-push", baseVolume: 4, bodyRegion: "UPPER", muscleGroups: ["ARM", "SHOULDER"] }),
    ];

    const prescription = applyRestrictionsToBasePlan(plan, soreRestrictions);

    expect(modificationsOf(prescription)).toEqual(["KEPT"]);
  });

  it("composes region scale and soreness scale (worst wins per block)", () => {
    const plan = [
      makeComponent({ id: "leg-block", baseVolume: 4, bodyRegion: "LOWER", muscleGroups: ["HAMSTRING", "QUAD"] }),
    ];
    const restrictions = makeRestrictions({
      lowerBodyScale: 0.7,
      sorenessScale: { QUAD: 0.6 },
    });

    const prescription = applyRestrictionsToBasePlan(plan, restrictions);

    const entry = firstOf(prescription);
    expect(entry.modification).toBe("REDUCED");
    // 0.7 (region) × 0.6 (partial soreness) = 0.42 → round(4 × 0.42) = 2.
    expect(entry.scaledVolume).toBe(2);
    expect(entry.modificationReason).toContain("Quad is sore");
  });

  it("takes the sorest overlapping area when several overlap", () => {
    const plan = [
      makeComponent({ id: "sprint", baseVolume: 4, bodyRegion: "FULL", muscleGroups: ["QUAD", "HAMSTRING", "ANKLE"] }),
    ];
    const restrictions = makeRestrictions({
      sorenessScale: { QUAD: 0.6, ANKLE: 0.8 },
    });

    const prescription = applyRestrictionsToBasePlan(plan, restrictions);

    // Sorest overlap 0.6; HAMSTRING is healthy so the block is scaled, not removed.
    expect(firstOf(prescription).modification).toBe("REDUCED");
    expect(firstOf(prescription).scaledVolume).toBe(2); // round(4 × 0.6) = 2
  });

  it("keeps a surviving sore block at its minimum volume", () => {
    const plan = [
      makeComponent({ id: "protected", baseVolume: 4, minimumVolume: 3, muscleGroups: ["QUAD", "HAMSTRING"] }),
    ];
    const restrictions = makeRestrictions({
      // Partial overlap (only QUAD sore) scales; both the region cut and the
      // soreness scale apply, and minimumVolume still holds.
      lowerBodyScale: 0.7,
      sorenessScale: { QUAD: 0.6 },
    });

    const prescription = applyRestrictionsToBasePlan(plan, restrictions);

    // round(4 × 0.42) = 2 → minimumVolume 3 wins.
    expect(firstOf(prescription).scaledVolume).toBe(3);
  });

  it("strips optional accessories on a partial soreness scale like any reduced day", () => {
    const plan = [
      makeComponent({ id: "optional-ankle", baseVolume: 3, optional: true, muscleGroups: ["CALF", "ANKLE"] }),
    ];

    const prescription = applyRestrictionsToBasePlan(plan, soreRestrictions);

    // CALF sore (partial overlap) scales below 1 → optional accessory is
    // stripped by the §23 step-1 rule that protects recovery.
    expect(firstOf(prescription).modification).toBe("REMOVED");
    expect(firstOf(prescription).modificationReason).toContain("optional accessory");
  });
});
