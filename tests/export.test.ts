import { describe, expect, it } from "vitest";

import { buildExport, type ExportSourceState } from "../src/lib/export";
import { DEFAULT_ATHLETE_PROFILE } from "../src/config/defaults";
import { DEFAULT_OBJECTIVE } from "../src/types";

/**
 * Phase 9.12 — the pure export builder: canonical JSON (every slice, sorted)
 * and a sectioned CSV with RFC 4180 escaping.
 */

const EMPTY_STATE: ExportSourceState = {
  profile: DEFAULT_ATHLETE_PROFILE,
  trainingObjective: DEFAULT_OBJECTIVE,
  readinessInputs: [],
  activityLogs: [],
  workoutLogs: [],
  workoutProgress: {},
  scheduledEvents: [],
  personalBests: [],
  activePlan: null,
};

function seededState(): ExportSourceState {
  return {
    ...EMPTY_STATE,
    readinessInputs: [
      {
        id: "r2",
        localDate: "2026-01-05",
        timezone: "America/New_York",
        recordedAt: "2026-01-05T13:00:00.000Z",
        sleepAnchor: "OVER_8_HRS",
        jointStatus: "NO_CONCERN",
        energyAnchor: "HIGH",
        soreAreas: ["QUAD"],
        createdAt: "2026-01-05T13:00:00.000Z",
        updatedAt: "2026-01-05T13:00:00.000Z",
      },
      {
        id: "r1",
        localDate: "2026-01-04",
        timezone: "America/New_York",
        recordedAt: "2026-01-04T13:00:00.000Z",
        sleepAnchor: "SEVEN_TO_EIGHT_HRS",
        jointStatus: "MILD_STIFFNESS",
        energyAnchor: "NORMAL",
        createdAt: "2026-01-04T13:00:00.000Z",
        updatedAt: "2026-01-04T13:00:00.000Z",
      },
    ],
    activityLogs: [
      {
        id: "a1",
        activityDate: "2026-01-04",
        timezone: "America/New_York",
        activityType: "TEAM_PRACTICE",
        sessionRpe: 7,
        durationMinutes: 90,
        notes: 'Coach said "great pace"',
        createdAt: "2026-01-04T21:00:00.000Z",
        updatedAt: "2026-01-04T21:00:00.000Z",
      },
    ],
    workoutLogs: [
      {
        id: "w1",
        activityDate: "2026-01-04",
        notes: "Full session",
        soreAreasAfter: ["ANKLE", "CALF"],
        createdAt: "2026-01-04T20:00:00.000Z",
        updatedAt: "2026-01-04T20:00:00.000Z",
      },
    ],
    workoutProgress: {
      "2026-01-04": {
        "primary-upper-push": { componentId: "primary-upper-push", sets: 3, completedAt: "2026-01-04T19:00:00.000Z" },
        "accessory-core": { componentId: "accessory-core", sets: 2, completedAt: "2026-01-04T19:30:00.000Z" },
      },
    },
    scheduledEvents: [
      {
        id: "e1",
        eventType: "GAME",
        startAt: "2026-01-10T18:00:00.000Z",
        title: "League game",
        createdAt: "2026-01-02T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ],
    personalBests: [
      { id: "pb1", drillId: "lane-agility", value: 12.4, recordedAt: "2026-01-04T20:30:00.000Z", activityDate: "2026-01-04" },
    ],
    activePlan: null,
  };
}

describe("buildExport — JSON artifact", () => {
  it("includes every slice with the schema marker and injected instant", () => {
    const { json } = buildExport(seededState(), new Date("2026-01-06T15:00:00.000Z"));
    const parsed = JSON.parse(json) as Record<string, unknown>;

    expect(parsed.schema).toBe("vikai-export/1");
    expect(parsed.exportedAt).toBe("2026-01-06T15:00:00.000Z");
    for (const key of [
      "profile",
      "trainingObjective",
      "readinessInputs",
      "activityLogs",
      "workoutLogs",
      "workoutProgress",
      "scheduledEvents",
      "personalBests",
      "activePlan",
    ]) {
      expect(key in parsed).toBe(true);
    }
    const checkIns = parsed.readinessInputs as ReadonlyArray<{ localDate: string }>;
    expect(checkIns.map((entry) => entry.localDate)).toEqual(["2026-01-04", "2026-01-05"]);
  });

  it("empty store still exports a valid complete document", () => {
    const { json } = buildExport(EMPTY_STATE, new Date("2026-01-06T15:00:00.000Z"));
    const parsed = JSON.parse(json) as Record<string, unknown[]>;
    expect(parsed.readinessInputs).toEqual([]);
    expect(parsed.activityLogs).toEqual([]);
  });
});

describe("buildExport — CSV artifact", () => {
  it("renders one section per table with headers and sorted rows", () => {
    const { csv } = buildExport(seededState(), new Date("2026-01-06T15:00:00.000Z"));
    const lines = csv.split("\r\n");

    expect(lines[0]).toBe("Vikai Trainer data export");
    expect(csv).toContain("# CHECK-INS");
    expect(csv).toContain("# ACTIVITIES");
    expect(csv).toContain("# SESSIONS");
    expect(csv).toContain("# BLOCKS DONE");
    expect(csv).toContain("# EVENTS");
    expect(csv).toContain("# BENCHMARKS");

    // Check-ins sorted by date: Jan 4 row precedes Jan 5.
    expect(csv.indexOf("2026-01-04,SEVEN_TO_EIGHT_HRS")).toBeLessThan(
      csv.indexOf("2026-01-05,OVER_8_HRS"),
    );
    // Sore-area lists join with the pipe separator (session notes included).
    expect(csv).toContain("2026-01-04,Full session,ANKLE|CALF,2026-01-04T20:00:00.000Z");
    // Blocks-done rows carry date, component, sets.
    expect(csv).toContain("2026-01-04,primary-upper-push,3");
    // Activity load is the effort×minutes workload number.
    expect(csv).toContain("TEAM_PRACTICE,7,90,630");
  });

  it("escapes quotes, commas, and newlines per RFC 4180", () => {
    const { csv } = buildExport(seededState(), new Date("2026-01-06T15:00:00.000Z"));
    // The note with double quotes must be wrapped and doubled.
    expect(csv).toContain('"Coach said ""great pace"""');
  });

  it("empty store renders headers only", () => {
    const { csv } = buildExport(EMPTY_STATE, new Date("2026-01-06T15:00:00.000Z"));
    expect(csv).toContain("# CHECK-INS\r\ndate,sleep,joints,energy,soreAreas,painLocation,painDescription,recordedAt");
    expect(csv).toContain("# ACTIVITIES\r\ndate,type,effortOf10,minutes,load,notes,createdAt");
  });

  it("is deterministic for identical input", () => {
    const now = new Date("2026-01-06T15:00:00.000Z");
    expect(buildExport(seededState(), now)).toEqual(buildExport(seededState(), now));
  });
});
