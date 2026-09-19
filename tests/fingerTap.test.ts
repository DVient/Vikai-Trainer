import { describe, expect, it } from "vitest";

import {
  DEFAULT_FINGER_TAP_THRESHOLDS,
  baselineDaysSoFar,
  bestTapCountForDate,
  classifyTapTier,
  fingerTapBaseline,
  isValidTapCount,
  localDateMinusDays,
  trialsLoggedToday,
  type FingerTapThresholds,
} from "../src/engine/fingerTap";
import type { FingerTapTrial } from "../src/types";

/**
 * Phase 10 — finger-tap freshness model unit tests (SPEC §11.2).
 * The model is within-subject only: absolute counts are never interpreted,
 * the daily score is the best valid trial, and the baseline is the robust
 * median of the top-3 daily bests strictly before today.
 */

const TODAY = "2026-01-02";

function trial(localDate: string, tapCount: number, id?: string): FingerTapTrial {
  return {
    id: id ?? `tap-${localDate}-${tapCount}`,
    localDate,
    timezone: "UTC",
    recordedAt: `${localDate}T12:00:00.000Z`,
    tapCount,
  };
}

describe("localDateMinusDays", () => {
  it("crosses month and year boundaries without drift", () => {
    expect(localDateMinusDays("2026-01-02", 2)).toBe("2025-12-31");
    expect(localDateMinusDays("2026-03-01", 1)).toBe("2026-02-28");
    expect(localDateMinusDays("2026-01-01", 365)).toBe("2025-01-01");
  });

  it("returns the input unchanged when it is not a parseable date", () => {
    expect(localDateMinusDays("not-a-date", 3)).toBe("not-a-date");
  });
});

describe("isValidTapCount", () => {
  it("accepts the plausible 10-second envelope (20–120 taps)", () => {
    expect(isValidTapCount(20)).toBe(true);
    expect(isValidTapCount(80)).toBe(true);
    expect(isValidTapCount(120)).toBe(true);
  });

  it("rejects counts outside the envelope, non-integers, and non-finite values", () => {
    expect(isValidTapCount(19)).toBe(false);
    expect(isValidTapCount(121)).toBe(false);
    expect(isValidTapCount(80.5)).toBe(false);
    expect(isValidTapCount(Number.NaN)).toBe(false);
    expect(isValidTapCount(Number.POSITIVE_INFINITY)).toBe(false);
  });

  it("honors custom envelopes", () => {
    const thresholds: FingerTapThresholds = {
      ...DEFAULT_FINGER_TAP_THRESHOLDS,
      cnsMinTaps: 10,
      cnsMaxTaps: 200,
    };
    expect(isValidTapCount(15, thresholds)).toBe(true);
    expect(isValidTapCount(150, thresholds)).toBe(true);
  });
});

describe("bestTapCountForDate", () => {
  it("returns the best valid trial for the date", () => {
    const trials = [trial(TODAY, 60), trial(TODAY, 75), trial(TODAY, 70)];
    expect(bestTapCountForDate(trials, TODAY)).toBe(75);
  });

  it("ignores invalid trials and other dates", () => {
    const trials = [
      trial("2026-01-01", 90),
      trial(TODAY, 5), // implausible
      trial(TODAY, 200), // implausible
      trial(TODAY, 45),
    ];
    expect(bestTapCountForDate(trials, TODAY)).toBe(45);
  });

  it("returns undefined when the date has no valid trial", () => {
    expect(bestTapCountForDate([trial(TODAY, 3)], TODAY)).toBeUndefined();
    expect(bestTapCountForDate([], TODAY)).toBeUndefined();
  });
});

describe("fingerTapBaseline", () => {
  it("is the median of the top-3 daily bests before today", () => {
    const trials = [
      trial("2025-12-28", 70),
      trial("2025-12-30", 80),
      trial("2025-12-31", 90),
      trial("2026-01-01", 100), // fluke day — top-3 caps its influence
      trial(TODAY, 60), // today never feeds its own baseline
    ];
    // Top-3 daily bests: 100, 90, 80 → median 90.
    expect(fingerTapBaseline(trials, TODAY)).toBe(90);
  });

  it("stays robust when the best day is a fluke and the worst a bad day", () => {
    const trials = [
      trial("2025-12-28", 100), // fluke
      trial("2025-12-30", 78),
      trial("2025-12-31", 80),
      trial("2026-01-01", 40), // bad day — cannot lower the bar
    ];
    // Top-3: 100, 80, 78 → median 80.
    expect(fingerTapBaseline(trials, TODAY)).toBe(80);
  });

  it("requires the configured number of distinct valid days", () => {
    const twoDays = [trial("2026-01-01", 80), trial("2025-12-31", 80)];
    expect(fingerTapBaseline(twoDays, TODAY)).toBeUndefined();

    const threeDays = [...twoDays, trial("2025-12-30", 80)];
    expect(fingerTapBaseline(threeDays, TODAY)).toBe(80);
  });

  it("excludes days outside the rolling window and invalid trials", () => {
    const trials = [
      trial("2025-12-10", 120), // outside the 14-day window
      trial("2025-12-25", 200), // inside the window but invalid
      trial("2025-12-28", 80),
      trial("2026-01-01", 80),
      trial("2025-12-30", 80),
    ];
    expect(fingerTapBaseline(trials, TODAY)).toBe(80);
  });

  it("uses the best trial per day when several trials share a date", () => {
    const trials = [
      trial("2025-12-30", 60),
      trial("2025-12-30", 82), // that day's best
      trial("2025-12-31", 80),
      trial("2026-01-01", 80),
    ];
    // Top-3: 82, 80, 80 → median 80.
    expect(fingerTapBaseline(trials, TODAY)).toBe(80);
  });
});

describe("baselineDaysSoFar and trialsLoggedToday", () => {
  it("counts distinct valid days inside the window, excluding today", () => {
    const trials = [
      trial("2025-12-30", 80),
      trial("2025-12-31", 30), // invalid — the day does not count
      trial("2025-12-31", 80), // same day, valid
      trial("2026-01-01", 80),
      trial(TODAY, 80), // today is excluded
    ];
    expect(baselineDaysSoFar(trials, TODAY)).toBe(3);
  });

  it("counts every logged trial today regardless of validity", () => {
    const trials = [trial(TODAY, 15), trial(TODAY, 60), trial("2026-01-01", 80)];
    expect(trialsLoggedToday(trials, TODAY)).toBe(2);
  });
});

describe("classifyTapTier", () => {
  it("returns NOT_TESTED without a valid trial today", () => {
    expect(classifyTapTier([], TODAY)).toEqual({ tier: "NOT_TESTED" });
    expect(classifyTapTier([trial(TODAY, 10)], TODAY)).toEqual({ tier: "NOT_TESTED" });
  });

  it("returns NO_BASELINE until enough distinct days exist", () => {
    const reading = classifyTapTier([trial("2026-01-01", 80), trial(TODAY, 75)], TODAY);
    expect(reading.tier).toBe("NO_BASELINE");
    expect(reading.todayBest).toBe(75);
    expect(reading.baseline).toBeUndefined();
  });

  it("returns FRESH at or above the 0.95 ratio (band edge inclusive)", () => {
    const trials = [
      trial("2025-12-30", 80),
      trial("2025-12-31", 80),
      trial("2026-01-01", 80),
      trial(TODAY, 76), // 0.95
    ];
    expect(classifyTapTier(trials, TODAY)).toEqual({
      tier: "FRESH",
      baseline: 80,
      todayBest: 76,
      ratio: 0.95,
    });
  });

  it("returns MODERATE between the band edges", () => {
    const trials = [
      trial("2025-12-30", 80),
      trial("2025-12-31", 80),
      trial("2026-01-01", 80),
      trial(TODAY, 75), // 0.9375
    ];
    expect(classifyTapTier(trials, TODAY).tier).toBe("MODERATE");
  });

  it("returns MODERATE at the 0.85 significant edge (inclusive)", () => {
    const trials = [
      trial("2025-12-30", 80),
      trial("2025-12-31", 80),
      trial("2026-01-01", 80),
      trial(TODAY, 68), // 0.85
    ];
    expect(classifyTapTier(trials, TODAY).tier).toBe("MODERATE");
  });

  it("returns SIGNIFICANT below the 0.85 edge", () => {
    const trials = [
      trial("2025-12-30", 80),
      trial("2025-12-31", 80),
      trial("2026-01-01", 80),
      trial(TODAY, 67), // 0.8375
    ];
    const reading = classifyTapTier(trials, TODAY);
    expect(reading.tier).toBe("SIGNIFICANT");
    expect(reading.ratio).toBeCloseTo(0.8375, 10);
  });

  it("honors custom tier ratios", () => {
    const thresholds: FingerTapThresholds = {
      ...DEFAULT_FINGER_TAP_THRESHOLDS,
      cnsModerateRatio: 0.9,
      cnsSignificantRatio: 0.8,
    };
    const trials = [
      trial("2025-12-30", 80),
      trial("2025-12-31", 80),
      trial("2026-01-01", 80),
      trial(TODAY, 74), // 0.925 — FRESH under custom edges
    ];
    expect(classifyTapTier(trials, TODAY, thresholds).tier).toBe("FRESH");
  });

  it("is deterministic for identical inputs", () => {
    const trials = [
      trial("2025-12-30", 80),
      trial("2025-12-31", 80),
      trial("2026-01-01", 80),
      trial(TODAY, 75),
    ];
    expect(classifyTapTier(trials, TODAY)).toEqual(classifyTapTier(trials, TODAY));
  });
});
