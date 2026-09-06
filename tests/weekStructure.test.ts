import { describe, expect, it } from "vitest";

import { DEFAULT_BASE_PLAN } from "../src/plans/basePlan";
import {
  componentsForRole,
  dayRoleFor,
  sessionOrder,
} from "../src/plans/weekStructure";

/**
 * Phase 9.9 — the shared high/low week skeleton (Charlie Francis-style):
 * one role map drives both the default plan and any athlete-built plan.
 * Probe dates span pre-season (January 2026), the practice season, and the
 * competition phase (fall 2026).
 */

describe("dayRoleFor — the week skeleton", () => {
  it("pre-season: Mon/Wed/Fri low, Tue/Thu/Sat high, Sunday recovery", () => {
    expect(dayRoleFor("2026-01-04")).toBe("recovery"); // Sun
    expect(dayRoleFor("2026-01-05")).toBe("low"); // Mon
    expect(dayRoleFor("2026-01-06")).toBe("full"); // Tue
    expect(dayRoleFor("2026-01-07")).toBe("low"); // Wed
    expect(dayRoleFor("2026-01-08")).toBe("full"); // Thu
    expect(dayRoleFor("2026-01-09")).toBe("low"); // Fri
    expect(dayRoleFor("2026-01-10")).toBe("full"); // Sat
  });

  it("practice season: Tue/Wed/Thu practice, Friday post-practice", () => {
    expect(dayRoleFor("2026-09-14")).toBe("full"); // Mon (season start)
    expect(dayRoleFor("2026-09-15")).toBe("practice");
    expect(dayRoleFor("2026-09-16")).toBe("practice");
    expect(dayRoleFor("2026-09-17")).toBe("practice");
    expect(dayRoleFor("2026-09-18")).toBe("post-practice"); // Fri
    expect(dayRoleFor("2026-09-19")).toBe("full"); // Sat
    expect(dayRoleFor("2026-09-20")).toBe("recovery");
  });

  it("competition phase keeps the same skeleton (Sat = game day = full role)", () => {
    expect(dayRoleFor("2026-10-17")).toBe("full"); // Saturday
    expect(dayRoleFor("2026-10-16")).toBe("post-practice"); // Friday
  });
});

describe("componentsForRole — attribute-based shaping", () => {
  const all = DEFAULT_BASE_PLAN;

  it("recovery keeps only skill + recovery blocks", () => {
    const ids = componentsForRole("recovery", all).map((c) => c.id);
    expect(ids).toEqual(["skill-ballhandling", "mobility-recovery"]);
  });

  it("practice/low drop every high-stress lower/full-body block", () => {
    for (const role of ["practice", "low"] as const) {
      const kept = componentsForRole(role, all);
      expect(kept.map((c) => c.id)).toEqual([
        "primary-upper-push",
        "skill-ballhandling",
        "accessory-upper",
        "accessory-core",
        "mobility-recovery",
      ]);
    }
  });

  it("post-practice keeps strength but drops the speed/plyo/COD stack", () => {
    const ids = componentsForRole("post-practice", all).map((c) => c.id);
    expect(ids).toEqual([
      "primary-lower-squat",
      "primary-upper-push",
      "skill-ballhandling",
      "accessory-upper",
      "accessory-core",
      "mobility-recovery",
    ]);
  });

  it("full keeps everything", () => {
    expect(componentsForRole("full", all)).toHaveLength(all.length);
  });
});

describe("sessionOrder — speed/power renders first", () => {
  it("orders speed-power, other high, low, then recovery — stably", () => {
    const ordered = sessionOrder(DEFAULT_BASE_PLAN);
    expect(ordered.map((c) => c.id)).toEqual([
      "acceleration-sprints", // speed-power first
      "explosive-jumps",
      "cod-drills",
      "primary-lower-squat", // other high
      "primary-upper-push",
      "skill-ballhandling", // low
      "accessory-upper",
      "accessory-core",
      "mobility-recovery", // recovery last
    ]);
  });

  it("does not mutate or reorder an already-ordered list", () => {
    const ordered = sessionOrder(DEFAULT_BASE_PLAN);
    expect(sessionOrder(ordered).map((c) => c.id)).toEqual(ordered.map((c) => c.id));
  });
});
