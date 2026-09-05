import { describe, expect, it } from "vitest";

import { evaluateAutoregulationEngine } from "../src/engine/autoregulation";
import { applyRestrictionsToBasePlan } from "../src/engine/generator";
import { deriveEngineView } from "../src/lib/engine-bridge";
import {
  ACTIVITY_TYPE_LABELS,
  formatCountdown,
  nextUpcomingEvents,
  rpeBandClass,
  validateActivityDraft,
} from "../src/lib/format";
import {
  ADULT_ATTENTION_MESSAGE,
  ENGINE_REASON_LABELS,
  ENGINE_STATUS_THEME,
} from "../src/lib/status";
import { BASE_PLAN_TITLES, DEFAULT_BASE_PLAN } from "../src/plans/basePlan";
import { DEFAULT_SEASON_CONFIG } from "../src/config/defaults";
import {
  DEFAULT_OBJECTIVE,
  type ActivityType,
  type EngineReason,
  type EngineStatus,
  type EngineInput,
  type ReadinessInput,
  type ScheduledEvent,
  type SoreArea,
} from "../src/types";

/**
 * Phase 4 — UI logic tests (FLOW 4.1–4.4).
 * All screen logic lives in pure modules (src/lib, src/plans, src/config) so
 * it is testable without a React Native runtime. Component rendering suites
 * (React Native Testing Library) are added with the Phase 6 integration
 * harness, per FLOW's phase plan.
 */

const NOW = new Date("2026-01-02T12:00:00.000Z");
const HOUR_MS = 60 * 60 * 1000;

function makeReadiness(localDate: string): ReadinessInput {
  return {
    id: "readiness-1",
    localDate,
    timezone: "UTC",
    recordedAt: "2026-01-02T08:00:00.000Z",
    sleepAnchor: "OVER_8_HRS",
    jointStatus: "NO_CONCERN",
    energyAnchor: "HIGH",
    createdAt: "2026-01-02T08:00:00.000Z",
    updatedAt: "2026-01-02T08:00:00.000Z",
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

function makeSourceState(
  overrides: Partial<Parameters<typeof deriveEngineView>[0]> = {},
): Parameters<typeof deriveEngineView>[0] {
  return {
    profile: null,
    trainingObjective: null,
    readinessInputs: [],
    activityLogs: [],
    scheduledEvents: [],
    workoutLogs: [],
    ...overrides,
  };
}

describe("deriveEngineView (dashboard/workout data source)", () => {
  it("selects today's check-in and resolves GREEN", () => {
    const view = deriveEngineView(
      makeSourceState({ readinessInputs: [makeReadiness("2026-01-02")] }),
      NOW,
    );

    expect(view.today).toBe("2026-01-02");
    expect(view.hasCheckedInToday).toBe(true);
    expect(view.result.status).toBe("GREEN");
  });

  it("blocks GREEN when only a stale check-in exists (SPEC §27)", () => {
    const view = deriveEngineView(
      makeSourceState({ readinessInputs: [makeReadiness("2025-12-31")] }),
      NOW,
    );

    expect(view.hasCheckedInToday).toBe(false);
    expect(view.result.status).toBe("CHECKIN_REQUIRED");
  });

  it("surfaces game protection through the derived result", () => {
    const view = deriveEngineView(
      makeSourceState({
        readinessInputs: [makeReadiness("2026-01-02")],
        scheduledEvents: [makeGame(6)],
      }),
      NOW,
    );

    expect(view.result.status).toBe("RED");
    expect(view.result.reasons).toContain("IMMINENT_GAME");
  });

  it("falls back to the default athlete profile when none is set", () => {
    const view = deriveEngineView(makeSourceState(), NOW);

    expect(view.input.athlete.id).toBe("default-athlete");
    expect(view.input.objective.primaryGoals).toEqual([
      "STRENGTH",
      "EXPLOSIVENESS",
      "CHANGE_OF_DIRECTION",
    ]);
  });

  it("derives the §20 strip flag for consecutive high-stress days", () => {
    const bothDays = deriveEngineView(
      makeSourceState({
        readinessInputs: [makeReadiness("2026-01-02")],
        activityLogs: [
          { id: "a", activityDate: "2026-01-01", timezone: "UTC", activityType: "TEAM_PRACTICE", createdAt: "", updatedAt: "" },
          { id: "b", activityDate: "2026-01-02", timezone: "UTC", activityType: "GAME", createdAt: "", updatedAt: "" },
        ],
      }),
      NOW,
    );

    expect(bothDays.stripOptional).toBe(true);
    expect(bothDays.result.status).toBe("GREEN"); // no other rule fires

    // With the flag on, optionals are stripped even on an otherwise GREEN day.
    const prescription = applyRestrictionsToBasePlan(
      DEFAULT_BASE_PLAN,
      bothDays.result.restrictions,
      { stripOptional: bothDays.stripOptional },
    );
    const optionals = prescription.filter((entry) => entry.component.optional);
    expect(optionals.length).toBeGreaterThan(0);
    expect(optionals.every((entry) => entry.modification === "REMOVED")).toBe(true);

    const oneDay = deriveEngineView(
      makeSourceState({
        readinessInputs: [makeReadiness("2026-01-02")],
        activityLogs: [
          { id: "b", activityDate: "2026-01-02", timezone: "UTC", activityType: "GAME", createdAt: "", updatedAt: "" },
        ],
      }),
      NOW,
    );
    expect(oneDay.stripOptional).toBe(false);
  });
});

describe("post-session feedback loop (Phase 8.2)", () => {
  function makeWorkoutLog(
    activityDate: string,
    soreAreasAfter?: readonly SoreArea[],
  ): Parameters<typeof deriveEngineView>[0]["workoutLogs"][number] {
    return {
      id: `workout-${activityDate}`,
      activityDate,
      ...(soreAreasAfter !== undefined ? { soreAreasAfter } : {}),
      createdAt: "",
      updatedAt: "",
    };
  }

  it("carries the last session's post-session soreness into today's derivation", () => {
    const view = deriveEngineView(
      makeSourceState({
        readinessInputs: [makeReadiness("2026-01-02")],
        workoutLogs: [
          makeWorkoutLog("2025-12-30", ["QUAD"]),
          makeWorkoutLog("2026-01-01", ["QUAD", "HAMSTRING"]),
        ],
      }),
      NOW,
    );

    expect(view.carriedSoreAreas).toEqual(["QUAD", "HAMSTRING"]);
    expect(view.input.readiness?.soreAreas).toEqual(["QUAD", "HAMSTRING"]);
    expect(view.result.reasons).toContain("SORENESS_FLAGGED");
    expect(view.result.restrictions.sorenessScale).toEqual({ QUAD: 0.6, HAMSTRING: 0.6 });
  });

  it("merges — never duplicates — morning flags and carried flags", () => {
    const morning = { ...makeReadiness("2026-01-02"), soreAreas: ["QUAD"] as const };

    const view = deriveEngineView(
      makeSourceState({
        readinessInputs: [morning],
        workoutLogs: [makeWorkoutLog("2026-01-01", ["QUAD", "ANKLE"])],
      }),
      NOW,
    );

    expect(view.input.readiness?.soreAreas).toEqual(["QUAD", "ANKLE"]);
    expect(view.result.restrictions.sorenessScale).toEqual({ QUAD: 0.6, ANKLE: 0.6 });
  });

  it("never carries today's own session — the day stays locked", () => {
    const view = deriveEngineView(
      makeSourceState({
        readinessInputs: [makeReadiness("2026-01-02")],
        workoutLogs: [
          makeWorkoutLog("2026-01-02", ["CALF"]), // logged today — must be ignored
          makeWorkoutLog("2026-01-01", ["QUAD"]),
        ],
      }),
      NOW,
    );

    expect(view.carriedSoreAreas).toEqual(["QUAD"]);
    expect(view.input.readiness?.soreAreas).toEqual(["QUAD"]);
  });

  it("carries nothing when the last session closed all-good", () => {
    const view = deriveEngineView(
      makeSourceState({
        readinessInputs: [makeReadiness("2026-01-02")],
        workoutLogs: [makeWorkoutLog("2026-01-01")],
      }),
      NOW,
    );

    expect(view.carriedSoreAreas).toEqual([]);
    expect(view.result.reasons).not.toContain("SORENESS_FLAGGED");
  });

  it("drops unknown persisted area ids from carried feedback", () => {
    const view = deriveEngineView(
      makeSourceState({
        readinessInputs: [makeReadiness("2026-01-02")],
        workoutLogs: [
          makeWorkoutLog("2026-01-01", ["SHIN"] as unknown as readonly SoreArea[]),
        ],
      }),
      NOW,
    );

    expect(view.carriedSoreAreas).toEqual([]);
    expect(view.result.reasons).not.toContain("SORENESS_FLAGGED");
  });
});

describe("formatCountdown", () => {
  it("formats minutes, hours, and days", () => {
    expect(formatCountdown(NOW, new Date(NOW.getTime() + 45 * 60_000))).toBe("in 45 min");
    expect(formatCountdown(NOW, new Date(NOW.getTime() + 3 * HOUR_MS + 20 * 60_000))).toBe(
      "in 3h 20m",
    );
    expect(formatCountdown(NOW, new Date(NOW.getTime() + 52 * HOUR_MS))).toBe("in 2d 4h");
  });

  it("collapses to Now for past and invalid targets", () => {
    expect(formatCountdown(NOW, new Date(NOW.getTime() - 60_000))).toBe("Now");
    expect(formatCountdown(NOW, new Date("not-a-date"))).toBe("Now");
  });
});

describe("nextUpcomingEvents", () => {
  it("filters past and unparseable events, sorts soonest-first, and limits", () => {
    const events: ScheduledEvent[] = [
      { id: "a", eventType: "GAME", startAt: new Date(NOW.getTime() + 5 * HOUR_MS).toISOString(), createdAt: "", updatedAt: "" },
      { id: "b", eventType: "TEAM_PRACTICE", startAt: new Date(NOW.getTime() + 2 * HOUR_MS).toISOString(), createdAt: "", updatedAt: "" },
      { id: "c", eventType: "SCHOOL", startAt: new Date(NOW.getTime() - HOUR_MS).toISOString(), createdAt: "", updatedAt: "" },
      { id: "d", eventType: "OTHER", startAt: "not-a-date", createdAt: "", updatedAt: "" },
    ];

    const views = nextUpcomingEvents(events, NOW, 2);

    expect(views.map((view) => view.event.id)).toEqual(["b", "a"]);
    expect(views[0]?.countdown).toBe("in 2h 0m");
  });
});

describe("validateActivityDraft (SPEC §10 ranges)", () => {
  it("accepts boundary values", () => {
    expect(validateActivityDraft(1, 1)).toBeNull();
    expect(validateActivityDraft(10, 600)).toBeNull();
    expect(validateActivityDraft(7, 90)).toBeNull();
  });

  it("rejects out-of-range effort and duration", () => {
    expect(validateActivityDraft(0, 60)).toContain("1 and 10");
    expect(validateActivityDraft(11, 60)).toContain("1 and 10");
    expect(validateActivityDraft(5.5, 60)).toContain("1 and 10");
    expect(validateActivityDraft(5, 0)).toContain("1 and 600");
    expect(validateActivityDraft(5, 601)).toContain("1 and 600");
    expect(validateActivityDraft(5, Number.parseInt("abc", 10))).toContain("1 and 600");
  });
});

describe("rpeBandClass legend", () => {
  it("maps the four visual bands (Chilling → All Out)", () => {
    expect(rpeBandClass(1)).toBe("bg-sky-500");
    expect(rpeBandClass(3)).toBe("bg-sky-500");
    expect(rpeBandClass(6)).toBe("bg-green-500");
    expect(rpeBandClass(8)).toBe("bg-yellow-500");
    expect(rpeBandClass(10)).toBe("bg-red-500");
  });
});

describe("base plan invariants (SPEC §21/§20)", () => {
  it("covers all body regions, both stress classes, and optional accessories", () => {
    const regions = new Set(DEFAULT_BASE_PLAN.map((c) => c.bodyRegion ?? "FULL"));
    expect(regions).toContain("LOWER");
    expect(regions).toContain("UPPER");
    expect(regions).toContain("FULL");
    expect(DEFAULT_BASE_PLAN.some((c) => c.optional)).toBe(true);
    expect(DEFAULT_BASE_PLAN.some((c) => c.stress === "RECOVERY")).toBe(true);
    // Plyometric family present (for restriction removals)…
    expect(DEFAULT_BASE_PLAN.some((c) => c.type === "EXPLOSIVENESS" && c.stress === "HIGH")).toBe(
      true,
    );
    // …alongside low-stress technique work that survives plyo lockouts.
    expect(DEFAULT_BASE_PLAN.some((c) => c.type === "EXPLOSIVENESS" && c.stress === "LOW")).toBe(
      true,
    );
  });

  it("has unique ids and a display title for every component", () => {
    const ids = DEFAULT_BASE_PLAN.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id in BASE_PLAN_TITLES).toBe(true);
    }
  });

  it("renders a fully stripped plan under the engine's pain override", () => {
    const input: EngineInput = {
      athlete: {
        id: "athlete-1",
        displayName: "Athlete",
        sport: "BASKETBALL",
        athleteLevel: "YOUTH",
        primaryGoals: ["STRENGTH"],
        timezone: "UTC",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      objective: DEFAULT_OBJECTIVE,
      readiness: {
        id: "readiness-pain",
        localDate: "2026-01-02",
        timezone: "UTC",
        recordedAt: "2026-01-02T08:00:00.000Z",
        sleepAnchor: "OVER_8_HRS",
        jointStatus: "PAIN_CONCERN",
        energyAnchor: "HIGH",
        createdAt: "2026-01-02T08:00:00.000Z",
        updatedAt: "2026-01-02T08:00:00.000Z",
      },
      recentActivities: [],
      upcomingEvents: [],
      now: NOW,
    };

    const result = evaluateAutoregulationEngine(input);
    const prescription = applyRestrictionsToBasePlan(DEFAULT_BASE_PLAN, result.restrictions);

    expect(result.status).toBe("RED");
    expect(prescription.every((entry) => entry.modification === "REMOVED")).toBe(true);
  });
});

describe("status presentation coverage", () => {
  it("themes every engine status", () => {
    const statuses: EngineStatus[] = [
      "CHECKIN_REQUIRED",
      "INSUFFICIENT_DATA",
      "GREEN",
      "YELLOW",
      "RED",
    ];
    for (const status of statuses) {
      expect(status in ENGINE_STATUS_THEME).toBe(true);
      expect(ENGINE_STATUS_THEME[status].label.length).toBeGreaterThan(0);
    }
  });

  it("labels every engine reason", () => {
    const reasons: EngineReason[] = [
      "CHECKIN_REQUIRED",
      "INSUFFICIENT_DATA",
      "PAIN_CONCERN",
      "IMMINENT_GAME",
      "UPCOMING_GAME",
      "HIGH_RECENT_WORKLOAD",
      "LOW_SLEEP",
      "LOW_ENERGY",
      "MULTIPLE_READINESS_CONCERNS",
      "NORMAL_READINESS",
    ];
    for (const reason of reasons) {
      expect(ENGINE_REASON_LABELS[reason].length).toBeGreaterThan(0);
    }
  });

  it("keeps the adult-attention callout non-medical", () => {
    expect(ADULT_ATTENTION_MESSAGE).not.toMatch(/injur|diagnos|rehab|medical/i);
  });

  it("labels every activity type for the selector", () => {
    const types = Object.keys(ACTIVITY_TYPE_LABELS) as ActivityType[];
    expect(types).toHaveLength(9);
  });
});

describe("§1.2 default season configuration", () => {
  it("matches the spec baseline exactly", () => {
    expect(DEFAULT_SEASON_CONFIG).toEqual({
      practicesPerWeek: 2,
      seasonStart: "2026-09-14",
      firstGame: "2026-10-15",
      schoolStartTime: "09:00",
      schoolEndTime: "15:30",
      commuteMinutes: 40,
    });
  });
});
