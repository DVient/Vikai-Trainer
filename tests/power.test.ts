import { describe, expect, it } from "vitest";

/**
 * Design refresh — power gauge / streak helpers (pure presentation math).
 */

import { checkInStreak, powerBanner, powerLevel } from "../src/lib/power";
import { evaluateAutoregulationEngine } from "../src/engine/autoregulation";
import { DEFAULT_ATHLETE_PROFILE, } from "../src/config/defaults";
import { DEFAULT_OBJECTIVE, type EngineResult, type ReadinessInput } from "../src/types";

const NOW = new Date("2026-01-02T12:00:00.000Z");
const TZ = DEFAULT_ATHLETE_PROFILE.timezone;

function makeReadiness(localDate: string): ReadinessInput {
  return {
    id: `r-${localDate}`,
    localDate,
    timezone: TZ,
    recordedAt: "2026-01-02T08:00:00.000Z",
    createdAt: "2026-01-02T08:00:00.000Z",
    updatedAt: "2026-01-02T08:00:00.000Z",
    sleepAnchor: "OVER_8_HRS",
    jointStatus: "NO_CONCERN",
    energyAnchor: "HIGH",
  };
}

function resultFor(readiness?: ReadinessInput): EngineResult {
  return evaluateAutoregulationEngine({
    athlete: DEFAULT_ATHLETE_PROFILE,
    objective: DEFAULT_OBJECTIVE,
    readiness,
    recentActivities: [],
    upcomingEvents: [],
    now: NOW,
  });
}

describe("powerLevel — engine status → battery", () => {
  it("is empty with a charge prompt when no check-in exists (§27)", () => {
    const power = powerLevel(resultFor(undefined));
    expect(power.percent).toBeNull();
    expect(power.tone).toBe("neutral");
    expect(power.label).toBe("Tap to charge");
  });

  it("is 100% Full Send on GREEN", () => {
    const power = powerLevel(resultFor(makeReadiness("2026-01-02")));
    expect(power).toEqual({ percent: 100, tone: "green", label: "Full Send" });
  });

  it("mirrors the tightest region scale as Power Save on YELLOW", () => {
    const result = resultFor(makeReadiness("2026-01-02"));
    // Force a YELLOW template shape: 0.6 lower / 0.8 upper (workload day).
    const power = powerLevel({
      ...result,
      status: "YELLOW",
      reasons: ["HIGH_RECENT_WORKLOAD"],
      restrictions: { ...result.restrictions, lowerBodyScale: 0.6, upperBodyScale: 0.8 },
    });
    expect(power.percent).toBe(60);
    expect(power.tone).toBe("yellow");
    expect(power.label).toBe("Power Save");
  });

  it("is 0% Shielded on RED (pain concern drives the engine)", () => {
    const pain: ReadinessInput = {
      ...makeReadiness("2026-01-02"),
      jointStatus: "PAIN_CONCERN",
      painLocation: "Right knee",
    };
    const power = powerLevel(resultFor(pain));
    expect(power).toEqual({ percent: 0, tone: "red", label: "Shielded" });
  });
});

describe("powerBanner — Game Plan multiplier copy", () => {
  it("formats the full-send / power-save / shielded lines", () => {
    expect(powerBanner({ percent: 100, tone: "green", label: "Full Send" })).toBe(
      "100% Full Send 🔥",
    );
    expect(powerBanner({ percent: 60, tone: "yellow", label: "Power Save" })).toBe(
      "60% Power Save 🌙",
    );
    expect(powerBanner({ percent: 0, tone: "red", label: "Shielded" })).toBe(
      "0% Shielded 🛡️",
    );
    expect(powerBanner({ percent: null, tone: "neutral", label: "Tap to charge" })).toBe(
      "Tap to charge ⚡",
    );
  });
});

describe("checkInStreak — gamified habit counter", () => {
  it("counts consecutive days ending today", () => {
    const streak = checkInStreak(
      [makeReadiness("2025-12-30"), makeReadiness("2025-12-31"), makeReadiness("2026-01-01"), makeReadiness("2026-01-02")],
      "2026-01-02",
    );
    expect(streak).toBe(4);
  });

  it("survives the day when today's check-in is still pending", () => {
    const streak = checkInStreak(
      [makeReadiness("2025-12-31"), makeReadiness("2026-01-01")],
      "2026-01-02",
    );
    expect(streak).toBe(2);
  });

  it("breaks at the first gap", () => {
    const streak = checkInStreak(
      [makeReadiness("2025-12-29"), makeReadiness("2025-12-31"), makeReadiness("2026-01-01"), makeReadiness("2026-01-02")],
      "2026-01-02",
    );
    expect(streak).toBe(3);
  });

  it("is zero with no history", () => {
    expect(checkInStreak([], "2026-01-02")).toBe(0);
  });

  it("steps correctly across month boundaries", () => {
    const streak = checkInStreak(
      [makeReadiness("2025-12-30"), makeReadiness("2025-12-31"), makeReadiness("2026-01-01")],
      "2026-01-01",
    );
    expect(streak).toBe(3);
  });
});
