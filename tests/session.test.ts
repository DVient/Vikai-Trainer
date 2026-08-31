import { describe, expect, it } from "vitest";

import { buildSessionView } from "../src/lib/session";
import type { ScaledComponent } from "../src/engine/generator";
import type { TrainingComponent } from "../src/types";

function component(id: string): TrainingComponent {
  return {
    id,
    type: "STRENGTH",
    stress: "HIGH",
    priority: 1,
    baseVolume: 4,
    minimumVolume: 1,
    optional: false,
  };
}

function scaled(
  id: string,
  modification: "KEPT" | "REDUCED" | "REMOVED",
  scaledVolume: number,
): ScaledComponent {
  return { component: component(id), modification, scaledVolume };
}

describe("buildSessionView — the checkable workout", () => {
  it("splits remaining, done, and engine-skipped rows", () => {
    const view = buildSessionView(
      [
        scaled("a", "KEPT", 4),
        scaled("b", "REDUCED", 2),
        scaled("c", "REMOVED", 0),
      ],
      { b: { componentId: "b", sets: 2, completedAt: "2026-01-02T15:00:00.000Z" } },
    );

    expect(view.remainingCount).toBe(1);
    expect(view.doneCount).toBe(1);
    expect(view.skippedCount).toBe(1);
    expect(view.finishable).toBe(false);
    expect(view.rows.map((row) => row.componentId)).toEqual(["a", "b", "c"]);
    expect(view.rows[1]).toMatchObject({ state: "done", sets: 2 });
  });

  it("orders remaining first, then done, then skipped", () => {
    const view = buildSessionView(
      [scaled("a", "KEPT", 3), scaled("b", "KEPT", 3), scaled("c", "REMOVED", 0)],
      { a: { componentId: "a", sets: 3, completedAt: "x" } },
    );

    expect(view.rows.map((row) => row.state)).toEqual(["remaining", "done", "skipped"]);
  });

  it("keeps completed sets frozen even after the engine rescales or removes it", () => {
    // 'a' was completed at 4 sets; engine later drops it to REDUCED 2.
    const view = buildSessionView(
      [scaled("a", "REDUCED", 2), scaled("b", "KEPT", 3)],
      { a: { componentId: "a", sets: 4, completedAt: "x" } },
    );

    expect(view.rows.find((row) => row.componentId === "a")).toMatchObject({
      state: "done",
      sets: 4,
    });
    // Remaining rows always carry the current scaled volume.
    expect(view.rows.find((row) => row.componentId === "b")).toMatchObject({
      state: "remaining",
      sets: 3,
    });
  });

  it("is finishable when only skipped components remain", () => {
    const view = buildSessionView(
      [scaled("a", "REMOVED", 0), scaled("b", "REMOVED", 0)],
      {},
    );

    expect(view.finishable).toBe(true);
    expect(view.remainingCount).toBe(0);
  });

  it("is finishable only when every non-removed component is checked off", () => {
    const full = [scaled("a", "KEPT", 3), scaled("b", "KEPT", 2)];
    expect(buildSessionView(full, {}).finishable).toBe(false);
    expect(
      buildSessionView(full, { a: { componentId: "a", sets: 3, completedAt: "x" } })
        .finishable,
    ).toBe(false);
    expect(
      buildSessionView(full, {
        a: { componentId: "a", sets: 3, completedAt: "x" },
        b: { componentId: "b", sets: 2, completedAt: "y" },
      }).finishable,
    ).toBe(true);
  });

  it("handles an empty prescription and empty progress", () => {
    const view = buildSessionView([], {});

    expect(view.rows).toEqual([]);
    expect(view.finishable).toBe(true);
  });

  it("stays stable when the engine re-derives after the workout finished", () => {
    // The whole session was completed at the original prescription...
    const progress: Record<string, { componentId: string; sets: number; completedAt: string }> = {
      a: { componentId: "a", sets: 4, completedAt: "x" },
      b: { componentId: "b", sets: 4, completedAt: "y" },
    };
    const before = buildSessionView([scaled("a", "KEPT", 4), scaled("b", "KEPT", 4)], progress);

    // ...then an evening activity re-derives harsher restrictions. The
    // finished session is frozen: done rows keep credit, nothing re-opens.
    const after = buildSessionView(
      [scaled("a", "REDUCED", 2), scaled("b", "REMOVED", 0)],
      progress,
    );

    expect(before.remainingCount).toBe(0);
    expect(after.remainingCount).toBe(0);
    expect(after.rows.find((row) => row.componentId === "a")).toMatchObject({
      state: "done",
      sets: 4,
    });
    expect(after.rows.find((row) => row.componentId === "b")).toMatchObject({
      state: "done",
      sets: 4,
    });
  });
});
