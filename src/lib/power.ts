/**
 * VIKAI — Power level & streak helpers (design refresh).
 *
 * Pure presentation math: translates the engine's restriction output into the
 * gamified "battery / power" language the UI shows. No React Native, no
 * storage, no clock — `today` is injected (AGENTS.md purity rules).
 */

import type { EngineResult } from "../types";

export type PowerTone = "green" | "yellow" | "red" | "neutral";

export interface PowerView {
  /** 0–100, or null when the athlete has not checked in today. */
  percent: number | null;
  tone: PowerTone;
  /** Youth-facing intensity label, e.g. "Full Send" / "Power Save". */
  label: string;
}

/**
 * Daily readiness as a battery: the tightest body-region scale IS the
 * multiplier the workout engine applies, so the gauge always matches the
 * real generated volume.
 */
export function powerLevel(result: EngineResult): PowerView {
  switch (result.status) {
    case "GREEN":
      return { percent: 100, tone: "green", label: "Full Send" };
    case "YELLOW": {
      const scale = Math.min(
        result.restrictions.lowerBodyScale,
        result.restrictions.upperBodyScale,
      );
      const percent = Math.round(scale * 100);
      return { percent, tone: "yellow", label: "Power Save" };
    }
    case "RED":
      return { percent: 0, tone: "red", label: "Shielded" };
    default:
      // CHECKIN_REQUIRED / INSUFFICIENT_DATA — nothing to show yet.
      return { percent: null, tone: "neutral", label: "Tap to charge" };
  }
}

/** Consecutive check-in days ending today (or yesterday, when today's check-in
 * is still pending — the streak survives the day until it ends).
 */
export function checkInStreak(
  readinessInputs: ReadonlyArray<{ localDate: string }>,
  today: string,
): number {
  const checked = new Set(readinessInputs.map((entry) => entry.localDate));
  const DAY_MS = 24 * 60 * 60 * 1000;

  const dayFrom = (dateString: string, offsetDays: number): string => {
    const [year, month, day] = dateString.split("-").map(Number);
    if (year === undefined || month === undefined || day === undefined) return "";
    const base = Date.UTC(year, month - 1, day);
    const shifted = new Date(base - offsetDays * DAY_MS);
    return shifted.toISOString().slice(0, 10);
  };

  let offset = checked.has(today) ? 0 : 1;
  let streak = 0;
  for (;;) {
    const day = dayFrom(today, offset);
    if (day === "" || !checked.has(day)) break;
    streak += 1;
    offset += 1;
  }
  return streak;
}
