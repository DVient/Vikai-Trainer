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
  type FingerTapTrial,
  type ReadinessInput,
  type ScheduledEvent,
} from "../src/types";

/**
 * Phase 2.2 — Engine unit test suite (FLOW 2.2 / SPEC §37).
 * Covers: pain override, game protection windows, workload triggers,
 * single & multiple readiness concerns, pure-function determinism, and the
 * Phase 10 finger-tap × survey fusion (SPEC §11.2) with its recalibrated
 * workload defaults (750 / 1100) and tightened arithmetic band (≤ 5).
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

/** Phase 10 — a 10-second tap trial on a given local date. */
function makeTapTrial(localDate: string, tapCount: number, id?: string): FingerTapTrial {
  return {
    id: id ?? `tap-${localDate}-${tapCount}`,
    localDate,
    timezone: TZ,
    recordedAt: `${localDate}T12:00:00.000Z`,
    tapCount,
  };
}

/** Three prior days at 80 taps each ⇒ baseline = median-of-top-3 = 80. */
function makeBaselineTrials(tapsPerDay = 80): FingerTapTrial[] {
  return [
    makeTapTrial("2025-12-30", tapsPerDay),
    makeTapTrial("2025-12-31", tapsPerDay),
    makeTapTrial("2026-01-01", tapsPerDay),
  ];
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

  it("still prices carried soreness when no check-in exists (Phase 9.7)", () => {
    const result = evaluateAutoregulationEngine(
      makeInput({ readiness: undefined, carriedSoreAreas: ["QUAD"] }),
    );

    // Status semantics untouched (§27): no GREEN without a check-in — but
    // the restrictions stop ignoring the athlete's last-known soreness.
    expect(result.status).toBe("CHECKIN_REQUIRED");
    expect(result.reasons).toEqual(["CHECKIN_REQUIRED", "SORENESS_FLAGGED"]);
    expect(result.restrictions.sorenessScale).toEqual({ QUAD: 0.6 });
    expect(result.restrictions.lowerBodyAllowed).toBe(true);
    expect(result.restrictions.lowerBodyScale).toBe(1);
    expect(result.restrictions.plyometricsAllowed).toBe(true);
  });

  it("unions the morning map with the carried map for the soreness rule", () => {
    const result = evaluateAutoregulationEngine(
      makeInput({
        readiness: makeReadiness({ soreAreas: ["QUAD"] }),
        carriedSoreAreas: ["QUAD", "ANKLE"],
      }),
    );

    // Soreness-only day: status stays GREEN (Phase 9.8); the union prices
    // every flagged area.
    expect(result.status).toBe("GREEN");
    expect(result.reasons).toContain("SORENESS_FLAGGED");
    expect(result.restrictions.sorenessScale).toEqual({ QUAD: 0.6, ANKLE: 0.6 });
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
        recentActivities: [makeActivity({ sessionRpe: 7, durationMinutes: 110 })], // 770
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
  it("does not trigger below the 750 single-session threshold (Phase 10 recalibration)", () => {
    const result = evaluateAutoregulationEngine(
      makeInput({ recentActivities: [makeActivity({ sessionRpe: 10, durationMinutes: 74 })] }),
    );

    expect(result.reasons).not.toContain("HIGH_RECENT_WORKLOAD");
    expect(result.status).toBe("GREEN");
  });

  it("triggers at exactly RPE × Duration = 750 (a typical 90-min RPE-8 practice no longer fires)", () => {
    const result = evaluateAutoregulationEngine(
      makeInput({ recentActivities: [makeActivity({ sessionRpe: 10, durationMinutes: 75 })] }),
    );

    expect(result.status).toBe("YELLOW");
    expect(result.reasons).toEqual(["HIGH_RECENT_WORKLOAD"]);
    expect(result.restrictions.lowerBodyScale).toBe(0.6);
    expect(result.restrictions.plyometricsAllowed).toBe(false);
    expect(result.restrictions.highImpactAllowed).toBe(false);
  });

  it("keeps a typical 90-minute RPE-8 practice (720) GREEN", () => {
    const result = evaluateAutoregulationEngine(
      makeInput({ recentActivities: [makeActivity({ sessionRpe: 8, durationMinutes: 90 })] }),
    );

    expect(result.status).toBe("GREEN");
    expect(result.reasons).toEqual(["NORMAL_READINESS"]);
  });

  it("triggers on cumulative 24h load reaching the configured sum (550 + 550 = 1100)", () => {
    const result = evaluateAutoregulationEngine(
      makeInput({
        recentActivities: [
          makeActivity({ id: "a", sessionRpe: 5, durationMinutes: 110 }), // 550
          makeActivity({ id: "b", sessionRpe: 5, durationMinutes: 110 }), // 550
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
          makeActivity({ id: "b", sessionRpe: 3, durationMinutes: 10 }), // 30 → 720 total
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

  it("triggers at the boundary from the top: RPE 10 × 75 minutes = 750 (SPEC §37)", () => {
    const result = evaluateAutoregulationEngine(
      makeInput({ recentActivities: [makeActivity({ sessionRpe: 10, durationMinutes: 75 })] }),
    );

    expect(result.status).toBe("YELLOW");
    expect(result.reasons).toEqual(["HIGH_RECENT_WORKLOAD"]);
  });

  it("does not trigger just below the boundary at maximum RPE: 10 × 74 = 740", () => {
    const result = evaluateAutoregulationEngine(
      makeInput({ recentActivities: [makeActivity({ sessionRpe: 10, durationMinutes: 74 })] }),
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

  it("stays GREEN at score 6 (Phase 10: never reduced on soft anchors alone)", () => {
    const result = evaluateAutoregulationEngine(
      makeInput({
        readiness: makeReadiness({
          sleepAnchor: "SEVEN_TO_EIGHT_HRS",
          jointStatus: "MILD_STIFFNESS",
          energyAnchor: "NORMAL",
        }),
      }),
    );

    expect(result.status).toBe("GREEN");
    expect(result.reasons).toEqual(["NORMAL_READINESS"]);
  });

  it("re-arms the arithmetic band when a custom threshold raises the limit", () => {
    const thresholds: EngineThresholds = {
      ...DEFAULT_ENGINE_THRESHOLDS,
      readinessScoreYellowMax: 6,
    };
    const result = evaluateAutoregulationEngine(
      makeInput({
        readiness: makeReadiness({
          sleepAnchor: "SEVEN_TO_EIGHT_HRS",
          jointStatus: "MILD_STIFFNESS",
          energyAnchor: "NORMAL",
        }),
      }),
      thresholds,
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

describe("body-map soreness (Phase 7, status-neutral Phase 9.8)", () => {
  it("emits targeted soreness scales without touching the day status", () => {
    const result = evaluateAutoregulationEngine(
      makeInput({ readiness: makeReadiness({ soreAreas: ["QUAD", "CALF"] }) }),
    );

    // Phase 9.8: one flagged area never recolors the whole day — the blocks
    // that work it scale down; the day itself stays GREEN.
    expect(result.status).toBe("GREEN");
    expect(result.reasons).toContain("SORENESS_FLAGGED");
    expect(result.requiresAdultAttention).toBe(false);
    expect(result.restrictions.lowerBodyAllowed).toBe(true);
    expect(result.restrictions.upperBodyAllowed).toBe(true);
    expect(result.restrictions.plyometricsAllowed).toBe(true);
    expect(result.restrictions.lowerBodyScale).toBe(1);
    expect(result.restrictions.upperBodyScale).toBe(1);
    expect(result.restrictions.sorenessScale).toEqual({ QUAD: 0.6, CALF: 0.6 });
  });

  it("keeps GREEN semantics when nothing is flagged", () => {
    const result = evaluateAutoregulationEngine(makeInput({ readiness: makeReadiness() }));

    expect(result.status).toBe("GREEN");
    expect(result.restrictions.sorenessScale).toBeUndefined();
  });

  it("never fires on its own when no sore areas were saved", () => {
    const withEmpty = evaluateAutoregulationEngine(
      makeInput({ readiness: makeReadiness({ soreAreas: [] }) }),
    );
    expect(withEmpty.reasons).not.toContain("SORENESS_FLAGGED");
  });

  it("drops unknown persisted area ids and deduplicates", () => {
    const result = evaluateAutoregulationEngine(
      makeInput({
        readiness: makeReadiness({
          // Deliberately untrusted input: junk ids + duplicates.
          soreAreas: ["QUAD", "NOT_AN_AREA", "QUAD"] as unknown as ReadinessInput["soreAreas"],
        }),
      }),
    );

    expect(result.restrictions.sorenessScale).toEqual({ QUAD: 0.6 });
  });

  it("composes with other rules by taking the minimum soreness scale", () => {
    // Low sleep fires a stricter global template; soreness only narrows areas.
    const result = evaluateAutoregulationEngine(
      makeInput({ readiness: makeReadiness({ sleepAnchor: "UNDER_7_HRS", soreAreas: ["ARM"] }) }),
    );

    expect(result.reasons).toEqual(["LOW_SLEEP", "SORENESS_FLAGGED"]);
    expect(result.status).toBe("YELLOW");
    expect(result.restrictions.lowerBodyScale).toBe(0.7);
    expect(result.restrictions.sorenessScale).toEqual({ ARM: 0.6 });
  });

  it("pain concern still overrides everything — soreness never softens §16", () => {
    const result = evaluateAutoregulationEngine(
      makeInput({ readiness: makeReadiness({ jointStatus: "PAIN_CONCERN", soreAreas: ["QUAD"] }) }),
    );

    expect(result.status).toBe("RED");
    expect(result.reasons).toEqual(["PAIN_CONCERN"]);
    expect(result.requiresAdultAttention).toBe(true);
    expect(result.restrictions.lowerBodyAllowed).toBe(false);
    expect(result.restrictions.upperBodyAllowed).toBe(false);
  });

  it("respects a custom soreAreaScale threshold — and stays status-neutral", () => {
    const thresholds = { ...DEFAULT_ENGINE_THRESHOLDS, soreAreaScale: 0.5 };
    const result = evaluateAutoregulationEngine(
      makeInput({ readiness: makeReadiness({ soreAreas: ["ABS"] }) }),
      thresholds,
    );

    expect(result.status).toBe("GREEN");
    expect(result.restrictions.sorenessScale).toEqual({ ABS: 0.5 });
  });

  it("is deterministic for identical inputs", () => {
    const input = makeInput({ readiness: makeReadiness({ soreAreas: ["HAMSTRING", "FOOT"] }) });
    const first = evaluateAutoregulationEngine(input);
    const second = evaluateAutoregulationEngine(input);

    expect(second).toEqual(first);
  });
});

describe("finger-tap × survey fusion (Phase 10, SPEC §11.2)", () => {
  it("SIGNIFICANT + clean survey ⇒ solid reduction (0.7 / 0.8, cap 60)", () => {
    // 67/80 = 0.8375 < 0.85 ⇒ SIGNIFICANT; check-in is perfect ⇒ clean.
    const result = evaluateAutoregulationEngine(
      makeInput({
        fingerTapTrials: [...makeBaselineTrials(), makeTapTrial(TODAY, 67)],
      }),
    );

    expect(result.status).toBe("YELLOW");
    expect(result.reasons).toEqual(["CNS_FATIGUE_FLAGGED"]);
    expect(result.restrictions).toMatchObject({
      lowerBodyAllowed: true,
      lowerBodyScale: 0.7,
      upperBodyAllowed: true,
      upperBodyScale: 0.8,
      plyometricsAllowed: false,
      highImpactAllowed: false,
      maxTrainingDurationMinutes: 60,
    });
  });

  it("SIGNIFICANT + flagged survey ⇒ strongest reduction (0.6 / 0.7, cap 45)", () => {
    const result = evaluateAutoregulationEngine(
      makeInput({
        readiness: makeReadiness({ sleepAnchor: "UNDER_7_HRS" }),
        fingerTapTrials: [...makeBaselineTrials(), makeTapTrial(TODAY, 67)],
      }),
    );

    expect(result.status).toBe("YELLOW");
    expect(result.reasons).toEqual(["CNS_FATIGUE_FLAGGED", "LOW_SLEEP"]);
    expect(result.restrictions).toMatchObject({
      lowerBodyScale: 0.6, // min(0.6 tap, 0.7 sleep)
      upperBodyScale: 0.7, // min(0.7 tap, 0.8 sleep)
      plyometricsAllowed: false,
      highImpactAllowed: false,
      maxTrainingDurationMinutes: 45, // min(45 tap, 75 sleep)
    });
  });

  it("MODERATE + clean survey ⇒ light trim (0.8 / 0.85, cap 75)", () => {
    // 75/80 = 0.9375 ⇒ MODERATE.
    const result = evaluateAutoregulationEngine(
      makeInput({
        fingerTapTrials: [...makeBaselineTrials(), makeTapTrial(TODAY, 75)],
      }),
    );

    expect(result.status).toBe("YELLOW");
    expect(result.reasons).toEqual(["CNS_FATIGUE_FLAGGED"]);
    expect(result.restrictions).toMatchObject({
      lowerBodyScale: 0.8,
      upperBodyScale: 0.85,
      plyometricsAllowed: false,
      highImpactAllowed: false,
      maxTrainingDurationMinutes: 75,
    });
  });

  it("MODERATE + flagged survey ⇒ strong-lite (0.65 / 0.75, cap 60)", () => {
    const result = evaluateAutoregulationEngine(
      makeInput({
        readiness: makeReadiness({ energyAnchor: "DRAINED" }),
        fingerTapTrials: [...makeBaselineTrials(), makeTapTrial(TODAY, 75)],
      }),
    );

    expect(result.status).toBe("YELLOW");
    expect(result.reasons).toEqual(["CNS_FATIGUE_FLAGGED", "LOW_ENERGY"]);
    expect(result.restrictions).toMatchObject({
      lowerBodyScale: 0.65, // min(0.65 tap, 0.7 energy)
      upperBodyScale: 0.75,
      maxTrainingDurationMinutes: 60,
    });
  });

  it("FRESH ⇒ no tap rule: the day keeps its survey-driven outcome untouched", () => {
    // 76/80 = 0.95 ⇒ FRESH (inside the noise band).
    const result = evaluateAutoregulationEngine(
      makeInput({
        fingerTapTrials: [...makeBaselineTrials(), makeTapTrial(TODAY, 76)],
      }),
    );

    expect(result.status).toBe("GREEN");
    expect(result.reasons).toEqual(["NORMAL_READINESS"]);
  });

  it("NO_BASELINE ⇒ no tap rule until enough distinct days exist", () => {
    const result = evaluateAutoregulationEngine(
      makeInput({
        fingerTapTrials: [
          makeTapTrial("2025-12-31", 80),
          makeTapTrial("2026-01-01", 80),
          makeTapTrial(TODAY, 40),
        ],
      }),
    );

    expect(result.status).toBe("GREEN");
    expect(result.reasons).toEqual(["NORMAL_READINESS"]);
  });

  it("NOT_TESTED ⇒ no tap rule", () => {
    const result = evaluateAutoregulationEngine(
      makeInput({ fingerTapTrials: makeBaselineTrials() }),
    );

    expect(result.status).toBe("GREEN");
    expect(result.reasons).toEqual(["NORMAL_READINESS"]);
  });

  it("never softens a survey-driven reduction — tap only adds protection", () => {
    // Low sleep alone: 0.7 / 0.8, cap 75. A FRESH tap day must not change it.
    const withoutTap = evaluateAutoregulationEngine(
      makeInput({ readiness: makeReadiness({ sleepAnchor: "UNDER_7_HRS" }) }),
    );
    const withFreshTap = evaluateAutoregulationEngine(
      makeInput({
        readiness: makeReadiness({ sleepAnchor: "UNDER_7_HRS" }),
        fingerTapTrials: [...makeBaselineTrials(), makeTapTrial(TODAY, 80)],
      }),
    );

    expect(withFreshTap.reasons).toEqual(["LOW_SLEEP"]);
    expect(withFreshTap.restrictions).toEqual(withoutTap.restrictions);
  });

  it("uses the best valid trial of the day and ignores implausible counts", () => {
    const result = evaluateAutoregulationEngine(
      makeInput({
        fingerTapTrials: [
          ...makeBaselineTrials(),
          makeTapTrial(TODAY, 5), // invalid: below the 20-tap envelope
          makeTapTrial(TODAY, 60), // valid
          makeTapTrial(TODAY, 75), // valid, best ⇒ MODERATE
        ],
      }),
    );

    expect(result.reasons).toEqual(["CNS_FATIGUE_FLAGGED"]);
    expect(result.restrictions.lowerBodyScale).toBe(0.8);
  });

  it("sits between workload and sleep/energy in reason precedence", () => {
    const result = evaluateAutoregulationEngine(
      makeInput({
        readiness: makeReadiness({ sleepAnchor: "UNDER_7_HRS" }),
        recentActivities: [makeActivity({ sessionRpe: 10, durationMinutes: 80 })], // 800
        fingerTapTrials: [...makeBaselineTrials(), makeTapTrial(TODAY, 67)],
      }),
    );

    expect(result.reasons).toEqual([
      "HIGH_RECENT_WORKLOAD",
      "CNS_FATIGUE_FLAGGED",
      "LOW_SLEEP",
    ]);
    // Merge keeps the most protective combination (workload 0.6/0.8/cap60
    // ∧ tap 0.6/0.7/cap45 ∧ sleep 0.7/0.8/cap75).
    expect(result.restrictions).toMatchObject({
      lowerBodyScale: 0.6,
      upperBodyScale: 0.7,
      maxTrainingDurationMinutes: 45,
    });
  });

  it("prices an objective tap signal even without a check-in (status stays CHECKIN_REQUIRED)", () => {
    const result = evaluateAutoregulationEngine(
      makeInput({
        readiness: undefined,
        fingerTapTrials: [...makeBaselineTrials(), makeTapTrial(TODAY, 67)],
      }),
    );

    expect(result.status).toBe("CHECKIN_REQUIRED");
    expect(result.reasons).toEqual(["CHECKIN_REQUIRED", "CNS_FATIGUE_FLAGGED"]);
    expect(result.restrictions).toMatchObject({
      plyometricsAllowed: false,
      highImpactAllowed: false,
      maxTrainingDurationMinutes: 60,
    });
    expect(result.recoveryActions).toHaveLength(2);
  });
});

describe("carried-soreness carry window (Phase 10)", () => {
  it("still prices a carried map inside the 2-day window", () => {
    const result = evaluateAutoregulationEngine(
      makeInput({
        carriedSoreAreas: ["QUAD"],
        carriedSoreAreasFrom: "2026-01-01", // yesterday
      }),
    );

    expect(result.reasons).toContain("SORENESS_FLAGGED");
    expect(result.restrictions.sorenessScale).toEqual({ QUAD: 0.6 });
  });

  it("expires a carried map older than the window (stale feedback stops pricing)", () => {
    // Window start = today − 2 = 2025-12-31; a map from 2025-12-30 is out.
    const result = evaluateAutoregulationEngine(
      makeInput({
        carriedSoreAreas: ["QUAD"],
        carriedSoreAreasFrom: "2025-12-30",
      }),
    );

    expect(result.reasons).toEqual(["NORMAL_READINESS"]);
    expect(result.restrictions.sorenessScale).toBeUndefined();
  });

  it("honors a custom carry-window length", () => {
    const thresholds: EngineThresholds = {
      ...DEFAULT_ENGINE_THRESHOLDS,
      carriedSorenessCarryDays: 5,
    };
    const result = evaluateAutoregulationEngine(
      makeInput({
        carriedSoreAreas: ["QUAD"],
        carriedSoreAreasFrom: "2025-12-30", // 3 days back — inside a 5-day window
      }),
      thresholds,
    );

    expect(result.restrictions.sorenessScale).toEqual({ QUAD: 0.6 });
  });
});
