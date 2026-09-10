/**
 * VIKAI — Live session view (live session cockpit).
 *
 * Splits the day's prescription into what the athlete already checked off
 * (frozen at check-off time), what remains (carrying the CURRENT scaled
 * volume — re-derived by the engine after every new log), and what the
 * engine adjusted out. Pure: no storage, no clock.
 */

import type { ScaledComponent } from "../engine/generator";
import type { CompletedComponent } from "../types";

export type SessionRowState = "done" | "remaining" | "skipped";

/**
 * Rewrites an exercise prescription's leading set count by the block's
 * scaling ratio ("3 × 6" at ratio 0.5 → "2 × 6") — the same proportional
 * cut the engine applies to time estimates. Only the leading "N ×" is
 * touched: reps, ranges ("6–8"), per-side/per-leg qualifiers, distances
 * ("× 15m", "× 100m at 60–65%"), and durations ("× 45 sec") survive
 * verbatim. Ratio ≥ 1 (KEPT rows) and strings without a leading count pass
 * through untouched — the authored prescription is the truth on full days.
 * Pure and deterministic.
 */
export function scalePrescriptionSets(prescription: string, ratio: number): string {
  if (ratio >= 1) return prescription;
  const match = /^(\d+)\s*×/.exec(prescription);
  if (match === null) return prescription;
  const authoredSets = Number(match[1]);
  if (!Number.isFinite(authoredSets) || authoredSets <= 0) return prescription;
  const scaled = Math.max(1, Math.round(authoredSets * ratio));
  if (scaled === authoredSets) return prescription;
  return prescription.replace(/^(\d+)/, String(scaled));
}

export interface SessionRow {
  componentId: string;
  modification: ScaledComponent["modification"];
  /** For remaining rows: current scaled target. For done rows: frozen sets. */
  sets: number;
  baseSets: number;
  state: SessionRowState;
  completedAt?: string;
}

export interface SessionView {
  /** Remaining first (base plan order), then done, then skipped. */
  rows: SessionRow[];
  remainingCount: number;
  doneCount: number;
  skippedCount: number;
  /** True when the athlete can finish: nothing left to check off. */
  finishable: boolean;
}

/**
 * Builds the checkable session view. Completed components keep credit for
 * what they actually did even if the engine would now scale or remove them;
 * engine-removed components that were never done are "skipped" and never
 * block finishing.
 */
export function buildSessionView(
  prescription: readonly ScaledComponent[],
  progress: Readonly<Record<string, CompletedComponent>>,
): SessionView {
  const remaining: SessionRow[] = [];
  const done: SessionRow[] = [];
  const skipped: SessionRow[] = [];

  for (const entry of prescription) {
    const completed = progress[entry.component.id];
    if (completed !== undefined) {
      done.push({
        componentId: entry.component.id,
        modification: entry.modification,
        sets: completed.sets,
        baseSets: entry.component.baseVolume,
        state: "done",
        completedAt: completed.completedAt,
      });
    } else if (entry.modification === "REMOVED") {
      skipped.push({
        componentId: entry.component.id,
        modification: entry.modification,
        sets: 0,
        baseSets: entry.component.baseVolume,
        state: "skipped",
      });
    } else {
      remaining.push({
        componentId: entry.component.id,
        modification: entry.modification,
        sets: entry.scaledVolume,
        baseSets: entry.component.baseVolume,
        state: "remaining",
      });
    }
  }

  return {
    rows: [...remaining, ...done, ...skipped],
    remainingCount: remaining.length,
    doneCount: done.length,
    skippedCount: skipped.length,
    finishable: remaining.length === 0,
  };
}
