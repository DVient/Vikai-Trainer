/**
 * VIKAI — Finger-tap freshness model (Phase 10)
 *
 * Scientific basis (SPECIFICATIONS §11.2): the 10-second maximal finger-tap
 * trial is the classic behavioral readout of central motor drive (the
 * Halstead–Reitan tradition: fixed 10-second trials, downstrokes counted,
 * best trial as the criterion measure). In a 10-second, low-force task the
 * rate ceiling is set by central drive rather than by the muscle, so a drop
 * below the athlete's OWN recent capability is a training-domain freshness
 * signal — never a diagnosis (AGENTS.md safety non-goals).
 *
 * Measurement rules implemented here (all pure, all threshold-driven):
 * - A trial is VALID when its press count sits inside the plausible envelope
 *   for 10 seconds of human tapping (2–12 taps/second at the default bounds).
 * - The DAILY SCORE is the best valid trial of that local date: maximal-
 *   performance tests use the best trial as the criterion measure, so
 *   motivation and attention noise lands in the weaker trials while central
 *   drive still shows in the best effort.
 * - The BASELINE is the median of the top-3 daily scores in a rolling window
 *   (default 14 days), requiring a minimum number of distinct days (default
 *   3). Median-of-top-3 is robust: one fluke day cannot raise the bar, one
 *   bad day cannot lower it, and the top of the distribution represents the
 *   athlete's capable, fresh self — the correct comparator for "how far
 *   below capable am I today".
 * - The TIER compares today's best against that baseline: inside the
 *   day-to-day noise band everything is FRESH; beyond it the decline is
 *   meaningful (MODERATE) or strong (SIGNIFICANT). Band edges follow the
 *   ≥5% / ≥10% decrement conventions used in jump-based athlete monitoring,
 *   where tap rate's typical day-to-day variability is ~3–5%.
 *
 * Absolute counts are never interpreted — only the within-athlete ratio.
 * Purity: no storage, no clocks; `today` and all data are injected
 * (AGENTS.md code quality). Imports: types only.
 */

import type { FingerTapTrial } from "../types";

/**
 * Threshold knobs for the finger-tap freshness model (SPEC §18: stored as
 * configurable parameters, never hardcoded into the logic).
 */
export interface FingerTapThresholds {
  /** today/baseline at or above this ⇒ FRESH (inside day-to-day noise). */
  cnsModerateRatio: number;
  /** today/baseline below this ⇒ SIGNIFICANT; between the two ⇒ MODERATE. */
  cnsSignificantRatio: number;
  /** Rolling baseline window length in days. */
  cnsBaselineWindowDays: number;
  /** Distinct valid days required before a baseline exists. */
  cnsMinBaselineDays: number;
  /** Trial validity envelope for a 10-second trial (press count). */
  cnsMinTaps: number;
  cnsMaxTaps: number;
  /** Trials an athlete may log per day (the best one counts). */
  cnsMaxTrialsPerDay: number;
}

export const DEFAULT_FINGER_TAP_THRESHOLDS: FingerTapThresholds = {
  cnsModerateRatio: 0.95,
  cnsSignificantRatio: 0.85,
  cnsBaselineWindowDays: 14,
  cnsMinBaselineDays: 3,
  cnsMinTaps: 20,
  cnsMaxTaps: 120,
  cnsMaxTrialsPerDay: 3,
};

/** Today's freshness classification against the personal baseline. */
export type FingerTapTier =
  | "NOT_TESTED" // no valid trial today
  | "NO_BASELINE" // tested today, not enough history yet
  | "FRESH" // at or above the noise band
  | "MODERATE" // meaningful decline (gray zone)
  | "SIGNIFICANT"; // strong decline (beyond noise + motivation)

export interface FingerTapReading {
  tier: FingerTapTier;
  /** Median-of-top-3 baseline (undefined until enough valid days exist). */
  baseline?: number;
  /** Best valid trial today (undefined when nothing valid was logged). */
  todayBest?: number;
  /** todayBest / baseline (undefined without a baseline). */
  ratio?: number;
}

/** Local-date (YYYY-MM-DD) arithmetic, UTC-safe and deterministic. */
export function localDateMinusDays(localDate: string, days: number): string {
  const [year, month, day] = localDate.split("-").map(Number);
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return localDate;
  }
  const shifted = new Date(Date.UTC(year, month - 1, day) - days * 86_400_000);
  if (Number.isNaN(shifted.getTime())) return localDate;
  return shifted.toISOString().slice(0, 10);
}

/** True when the tap count is plausible for a 10-second trial. Pure. */
export function isValidTapCount(
  tapCount: number,
  thresholds: FingerTapThresholds = DEFAULT_FINGER_TAP_THRESHOLDS,
): boolean {
  return (
    Number.isFinite(tapCount) &&
    Number.isInteger(tapCount) &&
    tapCount >= thresholds.cnsMinTaps &&
    tapCount <= thresholds.cnsMaxTaps
  );
}

/** Best valid trial count for one local date, or undefined when none. */
export function bestTapCountForDate(
  trials: readonly FingerTapTrial[],
  localDate: string,
  thresholds: FingerTapThresholds = DEFAULT_FINGER_TAP_THRESHOLDS,
): number | undefined {
  let best: number | undefined;
  for (const trial of trials) {
    if (trial.localDate !== localDate) continue;
    if (!isValidTapCount(trial.tapCount, thresholds)) continue;
    if (best === undefined || trial.tapCount > best) best = trial.tapCount;
  }
  return best;
}

/**
 * Rolling baseline: median of the top-3 daily bests strictly BEFORE `today`
 * within the window, or undefined until `cnsMinBaselineDays` distinct valid
 * days exist. Invalid trials never contribute; today is always excluded
 * (today's own run must never become its own comparison point).
 */
export function fingerTapBaseline(
  trials: readonly FingerTapTrial[],
  today: string,
  thresholds: FingerTapThresholds = DEFAULT_FINGER_TAP_THRESHOLDS,
): number | undefined {
  const windowStart = localDateMinusDays(today, thresholds.cnsBaselineWindowDays);
  const bestByDay = new Map<string, number>();
  for (const trial of trials) {
    if (trial.localDate >= today || trial.localDate < windowStart) continue;
    if (!isValidTapCount(trial.tapCount, thresholds)) continue;
    const current = bestByDay.get(trial.localDate);
    if (current === undefined || trial.tapCount > current) {
      bestByDay.set(trial.localDate, trial.tapCount);
    }
  }
  if (bestByDay.size < thresholds.cnsMinBaselineDays) return undefined;
  const top3 = [...bestByDay.values()].sort((a, b) => b - a).slice(0, 3);
  top3.sort((a, b) => a - b);
  return top3[Math.floor(top3.length / 2)];
}

/** Distinct local dates with at least one valid trial inside the window. */
export function baselineDaysSoFar(
  trials: readonly FingerTapTrial[],
  today: string,
  thresholds: FingerTapThresholds = DEFAULT_FINGER_TAP_THRESHOLDS,
): number {
  const windowStart = localDateMinusDays(today, thresholds.cnsBaselineWindowDays);
  const days = new Set<string>();
  for (const trial of trials) {
    if (trial.localDate >= today || trial.localDate < windowStart) continue;
    if (!isValidTapCount(trial.tapCount, thresholds)) continue;
    days.add(trial.localDate);
  }
  return days.size;
}

/** Trials already logged today, any validity — the UI's per-day pacing guard. */
export function trialsLoggedToday(
  trials: readonly FingerTapTrial[],
  today: string,
): number {
  return trials.filter((trial) => trial.localDate === today).length;
}

/**
 * Full classification for `today`: tier + the numbers the UI displays.
 * Deterministic and pure — identical input ⇒ identical reading.
 */
export function classifyTapTier(
  trials: readonly FingerTapTrial[],
  today: string,
  thresholds: FingerTapThresholds = DEFAULT_FINGER_TAP_THRESHOLDS,
): FingerTapReading {
  const todayBest = bestTapCountForDate(trials, today, thresholds);
  if (todayBest === undefined) return { tier: "NOT_TESTED" };
  const baseline = fingerTapBaseline(trials, today, thresholds);
  if (baseline === undefined || baseline <= 0) return { tier: "NO_BASELINE", todayBest };
  const ratio = todayBest / baseline;
  if (ratio >= thresholds.cnsModerateRatio) return { tier: "FRESH", baseline, todayBest, ratio };
  if (ratio >= thresholds.cnsSignificantRatio) {
    return { tier: "MODERATE", baseline, todayBest, ratio };
  }
  return { tier: "SIGNIFICANT", baseline, todayBest, ratio };
}
