import { describe, expect, it } from "vitest";

import { DEFAULT_SEASON_CONFIG } from "../src/config/defaults";
import {
  defaultPlanFocusLabel,
  defaultPlanForDate,
} from "../src/plans/basePlan";
import {
  DEFAULT_PRACTICE_TITLE,
  defaultPracticeEventDrafts,
} from "../src/lib/defaultSchedule";
import { weekdayOfIsoDate } from "../src/lib/recurrence";

/**
 * Phase A — the default plan is weekday-structured around three team
 * practices (Tue/Wed/Thu 6 PM): legs are saved for practice, Sunday stays
 * light, other days carry the full strength/speed template. The calendar
 * seeds the practice series exactly once (store action tested in
 * tests/store.test.ts).
 */

const TZ = "America/New_York";

describe("weekday-structured default plan", () => {
  it("pre-season splits high/low: Tue/Thu/Sat full, Mon/Wed/Fri low", () => {
    // January 2026 — before the practice season starts (2026-09-14) there
    // are no team practices, so the week runs the classic high/low split.
    for (const date of ["2026-01-06", "2026-01-08", "2026-01-10"]) {
      const plan = defaultPlanForDate(date); // Tue, Thu, Sat
      expect(plan).toHaveLength(9);
      expect(plan[0]?.id).toBe("acceleration-sprints"); // speed first
      expect(defaultPlanFocusLabel(date)).toBe("Strength + speed");
    }
    for (const date of ["2026-01-05", "2026-01-07", "2026-01-09"]) {
      const plan = defaultPlanForDate(date); // Mon, Wed, Fri
      expect(plan).toHaveLength(5);
      // No high-stress work outside the upper body on low days.
      expect(
        plan.every((block) => block.stress !== "HIGH" || block.bodyRegion === "UPPER"),
      ).toBe(true);
      expect(defaultPlanFocusLabel(date)).toBe("Skills + tempo primer");
    }
  });

  it("practice season saves the legs on practice nights (Tue, Wed, Thu)", () => {
    for (const date of ["2026-09-15", "2026-09-16", "2026-09-17"]) {
      const plan = defaultPlanForDate(date);
      expect(plan).toHaveLength(5);
      expect(plan.some((block) => block.id === "primary-upper-push")).toBe(true);
      expect(plan.some((block) => block.id === "skill-ballhandling")).toBe(true);
      expect(plan.some((block) => block.id === "mobility-recovery")).toBe(true);
      expect(defaultPlanFocusLabel(date)).toBe("Practice + upper primer");
    }
  });

  it("practice-season Friday is a post-practice strength day — no speed/plyo/COD", () => {
    const plan = defaultPlanForDate("2026-09-18"); // Friday, practice season
    expect(plan).toHaveLength(6); // full minus sprints, jumps, COD
    expect(plan.some((block) => block.id === "primary-lower-squat")).toBe(true);
    expect(
      plan.every(
        (block) =>
          !(
            block.stress === "HIGH" &&
            ["SPEED", "CHANGE_OF_DIRECTION", "DECELERATION", "EXPLOSIVENESS"].includes(block.type)
          ),
      ),
    ).toBe(true);
    expect(defaultPlanFocusLabel("2026-09-18")).toBe("Strength + tempo");
  });

  it("keeps Sunday light — skills plus recovery only", () => {
    const plan = defaultPlanForDate("2026-01-04"); // Sunday
    expect(plan.map((block) => block.id)).toEqual(["skill-ballhandling", "mobility-recovery"]);
    expect(defaultPlanFocusLabel("2026-01-04")).toBe("Recovery & skills");
  });

  it("orders speed-power work first on high days", () => {
    const ids = defaultPlanForDate("2026-01-06").map((block) => block.id);
    expect(ids.slice(0, 3)).toEqual(["acceleration-sprints", "explosive-jumps", "cod-drills"]);
  });

  it("matches the season config's practice weekdays", () => {
    expect(DEFAULT_SEASON_CONFIG.practiceWeekdays).toEqual([2, 3, 4]);
    expect(DEFAULT_SEASON_CONFIG.practiceTime).toBe("18:00");
    for (const date of ["2026-09-15", "2026-09-16", "2026-09-17"]) {
      const plan = defaultPlanForDate(date);
      expect(
        plan.every((block) => block.stress !== "HIGH" || block.bodyRegion === "UPPER"),
      ).toBe(true);
    }
  });
});

describe("default practice schedule seeding", () => {
  it("produces one 6 PM draft per Tue/Wed/Thu through the season end", () => {
    const drafts = defaultPracticeEventDrafts(TZ);

    expect(drafts.length).toBeGreaterThanOrEqual(40); // ~16.5 weeks × 3 nights
    for (const draft of drafts) {
      expect(draft.eventType).toBe("TEAM_PRACTICE");
      expect(draft.title).toBe(DEFAULT_PRACTICE_TITLE);
      const localDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(draft.startAt));
      expect([2, 3, 4]).toContain(weekdayOfIsoDate(localDate));
      const wallClock = new Intl.DateTimeFormat("en-US", {
        timeZone: TZ,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(draft.startAt));
      expect(wallClock).toBe("18:00");
      expect(localDate >= DEFAULT_SEASON_CONFIG.seasonStart).toBe(true);
      expect(localDate <= "2026-12-31").toBe(true);
    }
  });

  it("starts on the first practice night at or after the season start", () => {
    const drafts = defaultPracticeEventDrafts(TZ);
    // Season start 2026-09-14 is a Monday → first draft is Tuesday the 15th.
    const first = drafts[0];
    expect(first).toBeDefined();
    const firstDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(first?.startAt ?? ""));
    expect(firstDate).toBe("2026-09-15");
  });

  it("is deterministic", () => {
    expect(defaultPracticeEventDrafts(TZ)).toEqual(defaultPracticeEventDrafts(TZ));
  });
});
