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
