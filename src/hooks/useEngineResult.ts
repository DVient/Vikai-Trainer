/**
 * VIKAI — Live engine hook (Phase 4)
 *
 * Thin React binding over the pure `deriveEngineView` bridge. Screens stay
 * declarative: they consume `result` and re-render automatically whenever
 * any store slice changes (SPEC §27/§30 real-time reactivity).
 *
 * The engine input uses the render-time clock; the engine itself remains
 * pure (now is injected, never read inside src/engine — AGENTS.md).
 */

import { useAppStore } from "../stores/useAppStore";
import { deriveEngineView } from "../lib/engine-bridge";

export function useEngineResult() {
  const profile = useAppStore((state) => state.profile);
  const trainingObjective = useAppStore((state) => state.trainingObjective);
  const readinessInputs = useAppStore((state) => state.readinessInputs);
  const activityLogs = useAppStore((state) => state.activityLogs);
  const scheduledEvents = useAppStore((state) => state.scheduledEvents);

  const now = new Date();

  return deriveEngineView(
    { profile, trainingObjective, readinessInputs, activityLogs, scheduledEvents },
    now,
  );
}
