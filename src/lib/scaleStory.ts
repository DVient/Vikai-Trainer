/**
 * VIKAI — Scale story (Phase 10.6): turns the generator's descriptive scale
 * decomposition into one athlete-facing line.
 *
 * Today's plan is priced by composing independent channels: the GLOBAL
 * readiness dial (tap test, workload, sleep/energy, games — one whole-day
 * level) and LOCAL pricing (the athlete's own sore-area body map, plus the
 * completion pattern). Where two or more channels act on the same block they
 * MULTIPLY — this module is what makes that visible instead of silent.
 *
 * Pure presentation math: no storage, no clock, no engine imports beyond
 * types. Youth language only (spec-audited); never a medical word.
 */

import type { ScaleFactors } from "../engine/generator";
import type { TrainingRestrictions } from "../types";
import { soreAreaLabel } from "./bodyMap";

/**
 * True when any whole-day lever is active: a region scaled below full,
 * plyometrics or high-impact work locked, or a session duration cap. On such
 * a day, sore-area blocks are priced ON TOP of the lighter plan — copy that
 * says "everything else runs as planned" would be false.
 */
export function isGloballyDialed(restrictions: TrainingRestrictions): boolean {
  return (
    restrictions.lowerBodyScale < 1 ||
    restrictions.upperBodyScale < 1 ||
    restrictions.plyometricsAllowed === false ||
    restrictions.highImpactAllowed === false ||
    restrictions.maxTrainingDurationMinutes !== undefined
  );
}

/** ×0.70 → "×0.7"; ×0.85 → "×0.85"; ×0.48 → "×0.48" (trailing zeros trimmed). */
function factorText(value: number): string {
  return `×${value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}`;
}

/**
 * The composed story for one block — only when TWO OR MORE channels acted
 * (single-channel days keep the existing reason lines). One plain string so
 * text queries and screen readers see a single sentence.
 */
export function scaleStoryLine(
  factors: ScaleFactors,
  scaledSets?: number,
): string | undefined {
  const parts: string[] = [];
  if (factors.region < 1) parts.push(`Today's readiness ${factorText(factors.region)}`);
  if (factors.sorenessScale !== undefined && factors.sorenessScale < 1) {
    const areas = (factors.sorenessAreas ?? []).map(soreAreaLabel).join(" & ");
    parts.push(`sore ${areas} ${factorText(factors.sorenessScale)}`);
  }
  if (factors.performanceScale !== undefined && factors.performanceScale < 1) {
    parts.push(`your recent completion ${factorText(factors.performanceScale)}`);
  }
  if (parts.length < 2) return undefined;

  const instruction =
    scaledSets !== undefined
      ? ` — do ${scaledSets} ${scaledSets === 1 ? "set" : "sets"} of each exercise; keep the weight.`
      : ".";
  return `${parts.join(" · ")}${instruction}`;
}
