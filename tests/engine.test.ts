import { describe, expect, it } from "vitest";

import {
  computeRecentWorkload,
  DEFAULT_ENGINE_THRESHOLDS,
  evaluateAutoregulationEngine,
  toLocalDateString,
  type EngineThresholds,
} from "../src/engine/autoregulation";
import {
  DEFAULT_OBJECTIVE,
  type ActivityLog,
  type AthleteProfile,
  type EngineInput,
  type ReadinessInput,
  type ScheduledEvent,
} from "../src/types";

/**
 * Phase 2.2 — Engine unit test suite (FLOW 2.2 / SPEC §37).
 * Covers: pain override, game protection windows, workload triggers,
 * single & multiple readiness concerns, and pure-function determinism.
 */

const NOW = new Date("2026-01-02T12:00:00.000Z");
const TZ = "UTC";
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const TODAY = "2026-01-02";
const YESTERDAY = "2026-01-01";
const DAY_BEFORE_YESTERDAY = "2025-12-31";

function makeProfile(): AthleteProfile {
  return {
    id: "athlete-1",
    displayName: "Athlete",
    sport: "BASKETBALL",
    athleteLevel: "YOUTH",
    primaryGoals: ["STRENGTH", "EXPLOSIVENESS", "CHANGE_OF_DIRECTION"],
    timezone: TZ,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

/** Perfect anchors: OVER_8_HRS (3) + NO_CONCERN (3) + HIGH (3) = score 9. */
function makeReadiness(overrides: Partial<ReadinessInput> = {}): ReadinessInput {
  return {
    id: "readiness-1",
    localDate: TODAY,
    timezone: TZ,
    recordedAt: "2026-01-02T08:00:00.000Z",
    sleepAnchor: "OVER_8_HRS",
    jointStatus: "NO_CONCERN",
    energyAnchor: "HIGH",
    createdAt: "2026-01-02T08:00:00.000Z",
    updatedAt: "2026-01-02T08:00:00.000Z",
    ...overrides,
  };
}

function makeActivity(overrides: Partial<ActivityLog> = {}): ActivityLog {
  return {
    id: "activity-1",
    activityDate: TODAY,
    timezone: TZ,
    activityType: "TEAM_PRACTICE",
    sessionRpe: 6,
    durationMinutes: 60,
    createdAt: "2026-01-02T18:00:00.000Z",
    updatedAt: "2026-01-02T18:00:00.000Z",
    ...overrides,
  };
}

function makeGame(hoursFromNow: number): ScheduledEvent {
  return {
    id: "game-1",
    eventType: "GAME",
    startAt: new Date(NOW.getTime() + hoursFromNow * HOUR_MS).toISOString(),
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

/** Clean baseline: check-in present, no activities, no upcoming events. */
function makeInput(overrides: Partial<EngineInput> = {}): EngineInput {
  return {
    athlete: makeProfile(),
    objective: DEFAULT_OBJECTIVE,
    readiness: makeReadiness(),
    recentActivities: [],
    upcomingEvents: [],
    now: NOW,
    ...overrides,
  };
}

describe("missing check-in (precedence 1)", () => {
  it("returns CHECKIN_REQUIRED with the standard baseline when no check-in exists", () => {
    const result = evaluateAutoregulationEngine(makeInput({ readiness: undefined }));

    expect(result.status).toBe("CHECKIN_REQUIRED");
    expect(result.reasons).toEqual(["CHECKIN_REQUIRED"]);
    expect(result.restrictions).toEqual({
      lowerBodyAllowed: true,
      lowerBodyScale: 1,
      upperBodyAllowed: true,
      upperBodyScale: 1,
      plyometricsAllowed: true,
      highImpactAllowed: true,
    });
    expect(result.restrictions.maxTrainingDurationMinutes).toBeUndefined();
    expect(result.requiresAdultAttention).toBe(false);
    expect(result.recoveryActions.length).toBe(1);
  });
});

describe("pain concern override (precedence 2, SPEC §16)", () => {
  it("triggers RED, locks all loading, and flags adult attention", () => {
    const result = evaluateAutoregulationEngine(
      makeInput({ readiness: makeReadiness({ jointStatus: "PAIN_CONCERN" }) }),
    );

    expect(result.status).toBe("RED");
    expect(result.reasons).toEqual(["PAIN_CONCERN"]);
    expect(result.restrictions).toEqual({
      lowerBodyAllowed: false,
      lowerBodyScale: 0,
      upperBodyAllowed: false,
      upperBodyScale: 0,
      plyometricsAllowed: false,
      highImpactAllowed: false,
    });
    expect(result.requiresAdultAttention).toBe(true);
    expect(result.recoveryActions).toEqual([
      "High-impact and training activity should be paused until the athlete has appropriate guidance.",
    ]);
  });

  it("overrides high workload, upcoming games, and low sleep (SPEC §37)", () => {
    const result = evaluateAutoregulationEngine(
      makeInput({
        readiness: makeReadiness({
          jointStatus: "PAIN_CONCERN",
          sleepAnchor: "UNDER_7_HRS",
        }),
        recentActivities: [makeActivity({ sessionRpe: 10, durationMinutes: 120 })],
        upcomingEvents: [makeGame(20)],
      }),
    );

    expect(result.status).toBe("RED");
    expect(result.reasons).toEqual(["PAIN_CONCERN"]);
    expect(result.requiresAdultAttention).toBe(true);
  });
});

describe("game protection windows (precedence 3, SPEC §17)", () => {
  it("locks fatigue-producing training when a game is < 12 hours away", () => {
    const result = evaluateAutoregulationEngine(makeInput({ upcomingEvents: [makeGame(11)] }));

    expect(result.status).toBe("RED");
    expect(result.reasons).toEqual(["IMMINENT_GAME"]);
    expect(result.restrictions.lowerBodyAllowed).toBe(false);
    expect(result.restrictions.lowerBodyScale).toBe(0);
    expect(result.restrictions.plyometricsAllowed).toBe(false);
    expect(result.restrictions.highImpactAllowed).toBe(false);
    expect(result.restrictions.upperBodyAllowed).toBe(true);
    expect(result.restrictions.upperBodyScale).toBe(0.4);
    expect(result.restrictions.maxTrainingDurationMinutes).toBe(30);
    // Game RED is schedule protection, not a safety escalation.
    expect(result.requiresAdultAttention).toBe(false);
  });

  it("allows a reduced neural-primer day at exactly the 12-hour boundary", () => {
    const result = evaluateAutoregulationEngine(makeInput({ upcomingEvents: [makeGame(12)] }));

    expect(result.status).toBe("YELLOW");
    expect(result.reasons).toEqual(["UPCOMING_GAME"]);
    expect(result.restrictions.lowerBodyAllowed).toBe(true);
    expect(result.restrictions.lowerBodyScale).toBe(0.5);
    expect(result.restrictions.plyometricsAllowed).toBe(true);
    expect(result.restrictions.highImpactAllowed).toBe(false);
    expect(result.restrictions.maxTrainingDurationMinutes).toBe(45);
  });

  it("keeps the primer window through 23 and 24 hours (inclusive)", () => {
    for (const hours of [23, 24]) {
      const result = evaluateAutoregulationEngine(
        makeInput({ upcomingEvents: [makeGame(hours)] }),
      );
      expect(result.reasons).toEqual(["UPCOMING_GAME"]);
      expect(result.status).toBe("YELLOW");
    }
  });

  it("does not force a downgrade for a game 24–36 hours out (SPEC §17 rule 3)", () => {
    const result = evaluateAutoregulationEngine(makeInput({ upcomingEvents: [makeGame(30)] }));

    expect(result.status).toBe("GREEN");
    expect(result.reasons).toEqual(["NORMAL_READINESS"]);
  });

  it("still evaluates workload normally when the game is 24–36 hours out", () => {
    const result = evaluateAutoregulationEngine(
      makeInput({
        upcomingEvents: [makeGame(30)],
        recentActivities: [makeActivity({ sessionRpe: 7, durationMinutes: 100 })],
      }),
    );

    expect(result.status).toBe("YELLOW");
    expect(result.reasons).toEqual(["HIGH_RECENT_WORKLOAD"]);
  });

  it("ignores games beyond 36 hours and non-GAME events", () => {
    const result = evaluateAutoregulationEngine(
      makeInput({
        upcomingEvents: [
          makeGame(40),
          {
            id: "practice-1",
            eventType: "TEAM_PRACTICE",
            startAt: new Date(NOW.getTime() + 2 * HOUR_MS).toISOString(),
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
    );

    expect(result.status).toBe("GREEN");
    expect(result.reasons).toEqual(["NORMAL_READINESS"]);
  });

  it("shields before any competition — other-sport games and ID sessions count as games", () => {
    for (const eventType of ["OTHER_SPORTS_GAME", "ID_SESSION"] as const) {
      const result = evaluateAutoregulationEngine(
        makeInput({
          upcomingEvents: [
            {
              id: `comp-${eventType}`,
              eventType,
              startAt: new Date(NOW.getTime() + 2 * HOUR_MS).toISOString(),
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        }),
      );

      expect(result.reasons).toEqual(["IMMINENT_GAME"]);
      expect(result.status).toBe("RED");
    }
  });

  it("keeps informational events (school, other) outside the game windows", () => {
    const result = evaluateAutoregulationEngine(
      makeInput({
        upcomingEvents: [
          {
            id: "school-1",
            eventType: "SCHOOL",
            startAt: new Date(NOW.getTime() + 2 * HOUR_MS).toISOString(),
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
          {
            id: "other-1",
            eventType: "OTHER",
            startAt: new Date(NOW.getTime() + 2 * HOUR_MS).toISOString(),
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
    );

    expect(result.status).toBe("GREEN");
    expect(result.reasons).toEqual(["NORMAL_READINESS"]);
  });
});

describe("recent workload triggers (precedence 4, RPE × Duration)", () => {
  it("does not trigger below the 700 single-session threshold", () => {
    const result = evaluateAutoregulationEngine(
      makeInput({ recentActivities: [makeActivity({ sessionRpe: 3, durationMinutes: 233 })] }),
    );

    expect(result.reasons).not.toContain("HIGH_RECENT_WORKLOAD");
    expect(result.status).toBe("GREEN");
  });

  it("triggers at exactly RPE × Duration = 700", () => {
    const result = evaluateAutoregulationEngine(
      makeInput({ recentActivities: [makeActivity({ sessionRpe: 7, durationMinutes: 100 })] }),
    );

    expect(result.status).toBe("YELLOW");
    expect(result.reasons).toEqual(["HIGH_RECENT_WORKLOAD"]);
    expect(result.restrictions.lowerBodyScale).toBe(0.6);
    expect(result.restrictions.plyometricsAllowed).toBe(false);
    expect(result.restrictions.highImpactAllowed).toBe(false);
  });

  it("triggers on cumulative 24h load reaching the configured sum", () => {
    const result = evaluateAutoregulationEngine(
      makeInput({
        recentActivities: [
          makeActivity({ id: "a", sessionRpe: 5, durationMinutes: 100 }),
          makeActivity({ id: "b", sessionRpe: 5, durationMinutes: 100 }),
        ],
      }),
    );

    expect(result.reasons).toEqual(["HIGH_RECENT_WORKLOAD"]);
  });

  it("does not trigger when loads are high individually but modest in total", () => {
    const result = evaluateAutoregulationEngine(
      makeInput({
        recentActivities: [
          makeActivity({ id: "a", sessionRpe: 6, durationMinutes: 115 }), // 690
          makeActivity({ id: "b", sessionRpe: 3, durationMinutes: 10 }), // 30
        ],
      }),
    );

    expect(result.status).toBe("GREEN");
    expect(result.reasons).toEqual(["NORMAL_READINESS"]);
  });

  it("ignores sessions outside the 24-hour date window", () => {
    const result = evaluateAutoregulationEngine(
      makeInput({
        recentActivities: [
          makeActivity({ activityDate: DAY_BEFORE_YESTERDAY, sessionRpe: 7, durationMinutes: 100 }),
        ],
      }),
    );

    expect(result.status).toBe("GREEN");
  });

  it("excludes out-of-range RPE and duration values from load math", () => {
    const result = evaluateAutoregulationEngine(
      makeInput({
        recentActivities: [
          makeActivity({ id: "a", sessionRpe: 11, durationMinutes: 100 }), // invalid RPE
          makeActivity({ id: "b", sessionRpe: 7, durationMinutes: 0 }), // invalid duration
        ],
      }),
    );

    expect(result.status).toBe("GREEN");
  });

  it("respects custom thresholds passed to the engine", () => {
    const thresholds: EngineThresholds = { ...DEFAULT_ENGINE_THRESHOLDS, highSessionLoad: 300 };
    const result = evaluateAutoregulationEngine(
      makeInput({ recentActivities: [makeActivity()] }), // default load: 6 × 60 = 360
      thresholds,
    );

    expect(result.reasons).toEqual(["HIGH_RECENT_WORKLOAD"]);
  });

  it("triggers at the boundary from the top: RPE 10 × 70 minutes = 700 (SPEC §37)", () => {
    const result = evaluateAutoregulationEngine(
      makeInput({ recentActivities: [makeActivity({ sessionRpe: 10, durationMinutes: 70 })] }),
    );

    expect(result.status).toBe("YELLOW");
    expect(result.reasons).toEqual(["HIGH_RECENT_WORKLOAD"]);
  });

  it("does not trigger just below the boundary at maximum RPE: 10 × 69 = 690", () => {
    const result = evaluateAutoregulationEngine(
      makeInput({ recentActivities: [makeActivity({ sessionRpe: 10, durationMinutes: 69 })] }),
    );

    expect(result.status).toBe("GREEN");
  });

  it("never triggers from minimum-RPE sessions alone: RPE 1 × 600 minutes = 600", () => {
    const result = evaluateAutoregulationEngine(
      makeInput({ recentActivities: [makeActivity({ sessionRpe: 1, durationMinutes: 600 })] }),
    );

    expect(result.status).toBe("GREEN");
    expect(result.reasons).toEqual(["NORMAL_READINESS"]);
  });

  it("minimum-RPE max-duration sessions reach the cumulative threshold: 2 × 600 = 1200", () => {
    const result = evaluateAutoregulationEngine(
      makeInput({
        recentActivities: [
          makeActivity({ id: "a", sessionRpe: 1, durationMinutes: 600 }),
          makeActivity({ id: "b", sessionRpe: 1, durationMinutes: 600 }),
        ],
      }),
    );

    expect(result.reasons).toEqual(["HIGH_RECENT_WORKLOAD"]);
  });
});

describe("sleep & energy anchors and readiness scoring (precedence 5–6)", () => {
  it("flags LOW_SLEEP for a single short-sleep concern", () => {
    const result = evaluateAutoregulationEngine(
      makeInput({ readiness: makeReadiness({ sleepAnchor: "UNDER_7_HRS" }) }),
    );

    expect(result.status).toBe("YELLOW");
    expect(result.reasons).toEqual(["LOW_SLEEP"]);
    expect(result.restrictions.lowerBodyScale).toBe(0.7);
    expect(result.restrictions.plyometricsAllowed).toBe(false);
    expect(result.restrictions.maxTrainingDurationMinutes).toBe(75);
  });

  it("flags LOW_ENERGY for a drained single concern", () => {
    const result = evaluateAutoregulationEngine(
      makeInput({ readiness: makeReadiness({ energyAnchor: "DRAINED" }) }),
    );

    expect(result.status).toBe("YELLOW");
    expect(result.reasons).toEqual(["LOW_ENERGY"]);
  });

  it("escalates restrictions for multiple readiness concerns", () => {
    const result = evaluateAutoregulationEngine(
      makeInput({
        readiness: makeReadiness({ sleepAnchor: "UNDER_7_HRS", energyAnchor: "DRAINED" }),
      }),
    );

    expect(result.status).toBe("YELLOW");
    expect(result.reasons).toEqual(["LOW_SLEEP", "LOW_ENERGY", "MULTIPLE_READINESS_CONCERNS"]);
    expect(result.restrictions.lowerBodyScale).toBe(0.5);
    expect(result.restrictions.upperBodyScale).toBe(0.6);
    expect(result.restrictions.plyometricsAllowed).toBe(false);
    expect(result.restrictions.maxTrainingDurationMinutes).toBe(60);
  });

  it("escalates via the arithmetic band at score 6", () => {
    const result = evaluateAutoregulationEngine(
      makeInput({
        readiness: makeReadiness({
          sleepAnchor: "SEVEN_TO_EIGHT_HRS",
          jointStatus: "MILD_STIFFNESS",
          energyAnchor: "NORMAL",
        }),
      }),
    );

    expect(result.status).toBe("YELLOW");
    expect(result.reasons).toEqual(["MULTIPLE_READINESS_CONCERNS"]);
  });

  it("stays GREEN at the score-7 boundary", () => {
    const result = evaluateAutoregulationEngine(
      makeInput({
        readiness: makeReadiness({
          sleepAnchor: "SEVEN_TO_EIGHT_HRS",
          jointStatus: "NO_CONCERN",
          energyAnchor: "NORMAL",
        }),
      }),
    );

    expect(result.status).toBe("GREEN");
    expect(result.reasons).toEqual(["NORMAL_READINESS"]);
  });

  it("keeps strong-anchor mild stiffness GREEN (score 8)", () => {
    const result = evaluateAutoregulationEngine(
      makeInput({ readiness: makeReadiness({ jointStatus: "MILD_STIFFNESS" }) }),
    );

    expect(result.status).toBe("GREEN");
  });
});

describe("pure function determinism (SPEC §36)", () => {
  it("returns identical results for identical input", () => {
    const input = makeInput({
      recentActivities: [makeActivity({ sessionRpe: 7, durationMinutes: 100 })],
      upcomingEvents: [makeGame(18)],
    });

    const first = evaluateAutoregulationEngine(input);
    const second = evaluateAutoregulationEngine(input);

    expect(first).toEqual(second);
    expect(first).not.toBe(second); // fresh result objects, no shared state
  });

  it("is unaffected by mutation of a previously returned result", () => {
    const input = makeInput({ readiness: makeReadiness({ sleepAnchor: "UNDER_7_HRS" }) });

    const first = evaluateAutoregulationEngine(input);
    first.restrictions.lowerBodyScale = 5;
    first.reasons.push("PAIN_CONCERN");

    const pristine = evaluateAutoregulationEngine(input);
    expect(pristine.restrictions.lowerBodyScale).toBe(0.7);
    expect(pristine.reasons).toEqual(["LOW_SLEEP"]);
  });

  it("does not mutate its input", () => {
    const input = makeInput({
      recentActivities: [makeActivity()],
      upcomingEvents: [makeGame(6)],
      readiness: makeReadiness(),
    });
    const snapshot = JSON.stringify(input);

    evaluateAutoregulationEngine(input);

    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

describe("computeRecentWorkload metrics (SPEC §18)", () => {
  it("aggregates valid loads across date windows and skips invalid entries", () => {
    const workload = computeRecentWorkload(
      [
        makeActivity({ id: "a", sessionRpe: 6, durationMinutes: 60 }), // 360, in 24h
        makeActivity({ id: "b", sessionRpe: 9, durationMinutes: 60 }), // 540, high intensity
        makeActivity({ id: "c", activityDate: YESTERDAY, sessionRpe: 5, durationMinutes: 100 }), // 500
        makeActivity({ id: "d", sessionRpe: 11, durationMinutes: 30 }), // invalid RPE
        makeActivity({ id: "e", sessionRpe: 5, durationMinutes: 0 }), // invalid duration
        makeActivity({
          id: "f",
          activityDate: DAY_BEFORE_YESTERDAY,
          sessionRpe: 7,
          durationMinutes: 100,
        }), // 700, 48h only
      ],
      NOW,
      TZ,
    );

    expect(workload.last24HoursLoad).toBe(1400);
    expect(workload.last48HoursLoad).toBe(2100);
    expect(workload.activityCount24Hours).toBe(5);
    expect(workload.hadHighIntensityActivity).toBe(true);
  });

  it("returns zeros for an empty activity list", () => {
    const workload = computeRecentWorkload([], NOW, TZ);

    expect(workload).toEqual({
      last24HoursLoad: 0,
      last48HoursLoad: 0,
      activityCount24Hours: 0,
      hadHighIntensityActivity: false,
    });
  });
});

describe("toLocalDateString", () => {
  it("formats a moment as its local calendar date", () => {
    expect(toLocalDateString(new Date("2026-01-02T23:30:00.000Z"), "UTC")).toBe("2026-01-02");
    expect(toLocalDateString(new Date("2026-01-02T03:00:00.000Z"), "America/New_York")).toBe(
      "2026-01-01",
    );
  });

  it("falls back to UTC for an unknown timezone", () => {
    expect(toLocalDateString(new Date("2026-01-02T00:30:00.000Z"), "Not/AZone")).toBe("2026-01-02");
  });
});
