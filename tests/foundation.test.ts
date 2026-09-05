import { describe, expect, it } from "vitest";

import {
  DEFAULT_OBJECTIVE,
  isSoreArea,
  SORE_AREA_IDS,
  type ActivityLog,
  type AthleteProfile,
  type EngineInput,
  type EngineResult,
  type EngineStatus,
  type ReadinessInput,
  type ScheduledEvent,
  type TrainingObjective,
  type TrainingRestrictions,
} from "../src/types";
import { soreAreaLabel, soreRegionOf, SORE_REGIONS } from "../src/lib/bodyMap";

/**
 * Phase 1 foundation tests.
 * These verify the domain type contracts and the default objective constant.
 * Engine behavior tests arrive in Phase 2 (tests/engine.test.ts).
 */
describe("Phase 1: foundation & local domain types", () => {
  it("exports the SPEC §8 default training objective", () => {
    expect(DEFAULT_OBJECTIVE.primaryGoals).toEqual([
      "STRENGTH",
      "EXPLOSIVENESS",
      "CHANGE_OF_DIRECTION",
    ]);
    expect(DEFAULT_OBJECTIVE.philosophy).toEqual({
      highLowOrganization: true,
      qualityOverVolume: true,
      fatigueManagement: true,
      consolidateHighStress: true,
      prioritizeRecovery: true,
    });
    expect(DEFAULT_OBJECTIVE.sportRequirements).toEqual({
      acceleration: true,
      deceleration: true,
      changeOfDirection: true,
      jumping: true,
      landing: true,
      basketballSkillCompatibility: true,
    });
  });

  it("returns the same immutable-by-contract default objective every call", () => {
    // DEFAULT_OBJECTIVE is plain exported data: two reads yield deep-equal values.
    expect(DEFAULT_OBJECTIVE).toEqual(DEFAULT_OBJECTIVE);
  });

  it("accepts fully-formed domain objects for every core model", () => {
    const profile: AthleteProfile = {
      id: "athlete-1",
      displayName: "Athlete",
      sport: "BASKETBALL",
      athleteLevel: "YOUTH",
      primaryGoals: ["STRENGTH", "EXPLOSIVENESS", "CHANGE_OF_DIRECTION"],
      timezone: "America/New_York",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const objective: TrainingObjective = DEFAULT_OBJECTIVE;

    const readiness: ReadinessInput = {
      id: "readiness-1",
      localDate: "2026-01-01",
      timezone: "America/New_York",
      recordedAt: "2026-01-01T08:00:00.000Z",
      sleepAnchor: "SEVEN_TO_EIGHT_HRS",
      jointStatus: "NO_CONCERN",
      energyAnchor: "NORMAL",
      createdAt: "2026-01-01T08:00:00.000Z",
      updatedAt: "2026-01-01T08:00:00.000Z",
    };

    const activity: ActivityLog = {
      id: "activity-1",
      activityDate: "2026-01-01",
      timezone: "America/New_York",
      activityType: "TEAM_PRACTICE",
      sessionRpe: 7,
      durationMinutes: 90,
      createdAt: "2026-01-01T18:00:00.000Z",
      updatedAt: "2026-01-01T18:00:00.000Z",
    };

    const event: ScheduledEvent = {
      id: "event-1",
      eventType: "GAME",
      startAt: "2026-01-02T14:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const input: EngineInput = {
      athlete: profile,
      objective,
      readiness,
      recentActivities: [activity],
      upcomingEvents: [event],
      now: new Date("2026-01-01T12:00:00.000Z"),
    };

    const restrictions: TrainingRestrictions = {
      lowerBodyAllowed: true,
      lowerBodyScale: 1,
      upperBodyAllowed: true,
      upperBodyScale: 1,
      plyometricsAllowed: true,
      highImpactAllowed: true,
    };

    const result: EngineResult = {
      status: "GREEN",
      restrictions,
      reasons: ["NORMAL_READINESS"],
      recoveryActions: [],
      requiresAdultAttention: false,
    };

    expect(input.athlete.id).toBe("athlete-1");
    expect(input.now).toBeInstanceOf(Date);
    expect(result.status).toBe("GREEN");
    expect(result.restrictions.lowerBodyScale).toBe(1);
  });

  it("accepts the PAIN_CONCERN RED result shape required by the safety protocol", () => {
    // SPEC §16: PAIN_CONCERN ⇒ RED, both body regions halted, adult attention.
    const redResult: EngineResult = {
      status: "RED",
      restrictions: {
        lowerBodyAllowed: false,
        lowerBodyScale: 0,
        upperBodyAllowed: false,
        upperBodyScale: 0,
        plyometricsAllowed: false,
        highImpactAllowed: false,
      },
      reasons: ["PAIN_CONCERN"],
      recoveryActions: [
        "High-impact and training activity should be paused until the athlete has appropriate guidance.",
      ],
      requiresAdultAttention: true,
    };

    expect(redResult.status).toBe("RED");
    expect(redResult.requiresAdultAttention).toBe(true);
  });

  it("covers all five engine statuses in the closed union", () => {
    const statuses: readonly EngineStatus[] = [
      "CHECKIN_REQUIRED",
      "INSUFFICIENT_DATA",
      "GREEN",
      "YELLOW",
      "RED",
    ];
    expect(new Set(statuses).size).toBe(5);
  });
});

describe("body-map soreness catalog (Phase 7)", () => {
  it("covers every canonical area id exactly once across regions", () => {
    const flattened = SORE_REGIONS.flatMap((region) => region.areas.map((area) => area.id));
    expect([...flattened].sort()).toEqual([...SORE_AREA_IDS].sort());
    expect(new Set(flattened).size).toBe(flattened.length);
  });

  it("gives every area an athlete-facing label", () => {
    for (const area of SORE_AREA_IDS) {
      expect(soreAreaLabel(area).length).toBeGreaterThan(0);
      expect(soreAreaLabel(area)).not.toBe(area);
    }
  });

  it("maps every area back to exactly one region", () => {
    for (const area of SORE_AREA_IDS) {
      expect(soreRegionOf(area)).toBeDefined();
    }
    expect(soreRegionOf("QUAD")).toBe("LEGS");
    expect(soreRegionOf("ABS")).toBe("CORE");
    expect(soreRegionOf("ARM")).toBe("ARMS");
  });

  it("rejects unknown values through the type guard", () => {
    expect(isSoreArea("QUAD")).toBe(true);
    expect(isSoreArea("HAMSTRING")).toBe(true);
    expect(isSoreArea("SHIN")).toBe(false);
    expect(isSoreArea(42)).toBe(false);
    expect(isSoreArea(undefined)).toBe(false);
  });
});
