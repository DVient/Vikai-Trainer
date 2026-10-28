import { describe, expect, it } from "vitest";

import { defaultPlanFocusLabel, defaultPlanForDate } from "../src/plans/basePlan";
import { exerciseDetailsFor, weekdayOf } from "../src/plans/fall2026";
import {
  DEFAULT_PROGRAM,
  programById,
  programExerciseDetail,
  programFocusLabel,
  programPhaseFor,
  programPlanForDate,
  resolveDayPlan,
  TRAINING_PROGRAMS,
} from "../src/plans/programs";
import { sessionTypesForDate, shapeForScheduledEvents } from "../src/plans/weekStructure";
import { libraryBlockById } from "../src/plans/library";
import type { ActivityLog, BuiltPlan, ScheduledEvent, TrainingComponent } from "../src/types";

/**
 * Phase 11 — curated season programs: the hardcoded regimen becomes the
 * default entry of a selectable registry, and the new in-season game-day
 * program runs the athlete's real week (skill + shooting sessions
 * Mon/Wed/Thu mornings before school, team practices Tue/Wed/Thu, Saturday
 * games). Also covers the schedule-aware day shaping: sessions (scheduled
 * or logged) protect the legs and step the plan's skill blocks aside.
 */

/** Banned-words scan mirroring the spec audit's clinical-term pattern. */
const MEDICAL_TERM = /\b(injur\w*|diagnos\w*|rehab\w*|medical|clinic\w*|patholog\w*|prescrib\w*|treatment|symptom\w*|chronic|disease|inflammat\w*|tendon\w*|ligament\w*|dysfunction\w*|therap\w*|acute)\b/i;

const EMPTY_CONTEXT = {
  scheduledEvents: [] as ScheduledEvent[],
  activityLogs: [] as ActivityLog[],
  timezone: "America/New_York",
};

describe("program registry", () => {
  it("keeps unique ids and puts the existing regimen first (the default)", () => {
    const ids = TRAINING_PROGRAMS.map((program) => program.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(DEFAULT_PROGRAM).toBe(TRAINING_PROGRAMS[0]);
    expect(DEFAULT_PROGRAM.id).toBe("early-season-speed-power");
  });

  it("resolves null and unknown ids to the default program", () => {
    expect(programById(null)).toBe(DEFAULT_PROGRAM);
    expect(programById(undefined)).toBe(DEFAULT_PROGRAM);
    expect(programById("nope")).toBe(DEFAULT_PROGRAM);
    expect(programById("in-season-game-day").id).toBe("in-season-game-day");
  });
});

describe("program 1 — the existing regimen, unchanged", () => {
  const program = programById("early-season-speed-power");

  it("matches the default plan, focus label, and details for every probed date", () => {
    const dates = [
      "2026-08-24", "2026-09-08", "2026-09-14", "2026-10-15",
      "2026-10-27", "2026-11-03", "2026-12-31", "2026-03-04",
    ];
    for (const date of dates) {
      expect(programPlanForDate(program, date)).toEqual(defaultPlanForDate(date));
      expect(programFocusLabel(program, date)).toBe(defaultPlanFocusLabel(date));
      for (const component of defaultPlanForDate(date)) {
        expect(programExerciseDetail(program, component.id, date)).toEqual(
          exerciseDetailsFor(component.id, date),
        );
      }
    }
  });

  it("resolves a detail for every default-plan component on every weekday", () => {
    // One probe per weekday inside the competition phase (Oct 25 = Sunday).
    const probes = [
      "2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28",
      "2026-10-29", "2026-10-30", "2026-10-31",
    ];
    for (const localDate of probes) {
      for (const component of defaultPlanForDate(localDate)) {
        const detail = programExerciseDetail(program, component.id, localDate);
        expect(detail, `${component.id} on ${localDate}`).toBeDefined();
        expect((detail?.exercises.length ?? 0) > 0 || detail?.note !== undefined).toBe(true);
      }
    }
  });
});

describe("program 2 — in-season game-day structure", () => {
  const program = programById("in-season-game-day");

  it("defines a template for all seven weekdays with valid, duplicate-free ids", () => {
    const templates = program.dayTemplates;
    expect(templates).toBeDefined();
    for (let weekday = 0; weekday <= 6; weekday += 1) {
      const ids = templates?.[weekday];
      expect(ids, `weekday ${weekday}`).toBeDefined();
      expect(new Set(ids).size).toBe(ids?.length);
      for (const id of ids ?? []) {
        expect(
          program.components.some((component) => component.id === id),
          `${id} on weekday ${weekday}`,
        ).toBe(true);
      }
    }
  });

  it("renders template days in authored order with the court block first on skill days", () => {
    const monday = programPlanForDate(program, "2026-10-26").map((component) => component.id);
    expect(monday[0]).toBe("skill-ballhandling");
    expect(monday).toEqual([
      "skill-ballhandling",
      "acceleration-sprints",
      "explosive-jumps",
      "primary-lower-squat",
      "primary-upper-push",
      "mobility-recovery",
    ]);
    const tuesday = programPlanForDate(program, "2026-10-27").map((component) => component.id);
    expect(tuesday).toEqual(["primary-upper-push", "mobility-recovery"]);
  });

  it("resolves a content-bearing detail for every (weekday, component) pair", () => {
    for (let weekday = 0; weekday <= 6; weekday += 1) {
      const probes = [
        "2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04",
        "2026-11-05", "2026-11-06", "2026-11-07",
      ];
      const localDate = probes[weekday] as string;
      for (const component of programPlanForDate(program, localDate)) {
        const detail = programExerciseDetail(program, component.id, localDate);
        expect(detail, `${component.id} on ${localDate}`).toBeDefined();
        expect((detail?.exercises.length ?? 0) > 0 || detail?.note !== undefined).toBe(true);
        for (const exercise of detail?.exercises ?? []) {
          expect(exercise.name.trim()).not.toBe("");
          expect(exercise.prescription.trim()).not.toBe("");
          expect(exercise.steps?.length ?? 0).toBeGreaterThanOrEqual(2);
          if (exercise.videoUrl !== undefined) {
            expect(exercise.videoUrl.startsWith("https://www.youtube.com/watch?v=")).toBe(true);
            expect(exercise.videoUrl).not.toContain("results?search_query");
          }
        }
      }
    }
  });

  it("enforces the legs-saved rule: no HIGH lower/full-body work on practice nights", () => {
    for (const weekday of [2, 3, 4]) {
      const probes: Record<number, string> = {
        2: "2026-11-03", 3: "2026-11-04", 4: "2026-11-05",
      };
      for (const component of programPlanForDate(program, probes[weekday] as string)) {
        expect(
          component.stress === "HIGH" &&
            (component.bodyRegion === "LOWER" || component.bodyRegion === "FULL"),
          `${component.id} on weekday ${weekday}`,
        ).toBe(false);
      }
    }
  });

  it("keeps Friday a genuine offload day — no high speed/plyo/COD work", () => {
    for (const component of programPlanForDate(program, "2026-11-06")) {
      const speedPower = ["SPEED", "EXPLOSIVENESS", "CHANGE_OF_DIRECTION", "DECELERATION"];
      expect(component.stress === "HIGH" && speedPower.includes(component.type)).toBe(false);
    }
  });

  it("consolidates the week's vertical RFD and first-step power on Monday", () => {
    const monday = programPlanForDate(program, "2026-11-02").map((component) => component.id);
    expect(monday).toContain("explosive-jumps");
    expect(monday).toContain("acceleration-sprints");
    expect(monday).toContain("primary-lower-squat");
    expect(monday).toContain("primary-upper-push");
  });

  it("declares Mon/Wed/Thu as skill-slot weekdays (the before-school sessions)", () => {
    expect(program.skillSlotWeekdays).toEqual([1, 3, 4]);
  });

  it("resolves its phases at their boundaries", () => {
    expect(programPhaseFor(program, "2026-10-14")).toBeUndefined();
    expect(programPhaseFor(program, "2026-10-15")?.id).toBe("game-season");
    expect(programPhaseFor(program, "2026-11-30")?.id).toBe("game-season");
    expect(programPhaseFor(program, "2026-12-01")?.id).toBe("tryout-approach");
    expect(programPhaseFor(program, "2026-12-31")?.id).toBe("tryout-approach");
  });

  it("keeps every detail, note, and phase line free of banned clinical language", () => {
    const text = JSON.stringify(program);
    expect(text.match(MEDICAL_TERM)).toBeNull();
  });
});

describe("schedule-aware day shaping", () => {
  const inSeason = programById("in-season-game-day");
  const TZ = "America/New_York";

  const eventOn = (date: string, time = "22:00"): ScheduledEvent => ({
    id: `event-${date}-${time}`,
    eventType: "SKILL_SESSION",
    // 10 PM UTC = 6 PM ET on the same local date.
    startAt: `${date}T${time}:00.000Z`,
    createdAt: "",
    updatedAt: "",
  });

  const logged = (date: string, type: ActivityLog["activityType"]): ActivityLog => ({
    id: `log-${date}-${type}`,
    activityDate: date,
    timezone: TZ,
    activityType: type,
    createdAt: "",
    updatedAt: "",
  });

  it("collects the session types in effect from events and logged activities", () => {
    const types = sessionTypesForDate(
      [eventOn("2026-10-26"), { ...eventOn("2026-10-27"), eventType: "TEAM_PRACTICE" }],
      [logged("2026-10-26", "SKILL_WORK")],
      "2026-10-26",
      TZ,
    );
    expect(types).toContain("SKILL_SESSION");
    expect(types).not.toContain("TEAM_PRACTICE");
  });

  it("strips the plan's skill blocks on a non-slot day with a skill session", () => {
    // Tuesday under program 1 (competition phase): upper + skills + accessories.
    const base = defaultPlanForDate("2026-10-27");
    expect(base.some((component) => component.id === "skill-ballhandling")).toBe(true);
    const shaped = shapeForScheduledEvents(base, ["SKILL_SESSION"], false);
    expect(shaped.some((component) => component.id === "skill-ballhandling")).toBe(false);
    expect(shaped.some((component) => component.id === "primary-upper-push")).toBe(true);
  });

  it("keeps the court block on program 2's skill-slot days — it IS the session", () => {
    const base = programPlanForDate(inSeason, "2026-10-26"); // Monday
    expect(base.some((component) => component.id === "skill-ballhandling")).toBe(true);
    const shaped = shapeForScheduledEvents(base, ["SKILL_SESSION"], true);
    expect(shaped.some((component) => component.id === "skill-ballhandling")).toBe(true);
  });

  it("also keeps the court block when the morning session was already logged", () => {
    const shaped = resolveDayPlan("in-season-game-day", null, "2026-10-28", {
      scheduledEvents: [],
      activityLogs: [logged("2026-10-28", "SKILL_WORK")], // Wednesday, logged at 7:30 AM
      timezone: TZ,
    });
    expect(shaped.some((component) => component.id === "skill-ballhandling")).toBe(true);
  });

  it("applies the legs-saved rule dynamically when a practice lands off-template", () => {
    // A Monday practice in the in-season program: lower-body power work yields.
    const shaped = resolveDayPlan("in-season-game-day", null, "2026-10-26", {
      scheduledEvents: [{ ...eventOn("2026-10-26"), eventType: "TEAM_PRACTICE" }],
      activityLogs: [],
      timezone: TZ,
    });
    const ids = shaped.map((component) => component.id);
    expect(ids).not.toContain("explosive-jumps");
    expect(ids).not.toContain("primary-lower-squat");
    expect(ids).not.toContain("acceleration-sprints");
    expect(ids).toContain("primary-upper-push"); // upper work survives
    expect(ids).toContain("skill-ballhandling"); // slot day keeps the court block
  });

  it("does nothing when the day has no sessions", () => {
    const base = programPlanForDate(inSeason, "2026-10-27");
    expect(resolveDayPlan("in-season-game-day", null, "2026-10-27", EMPTY_CONTEXT)).toEqual(base);
  });

  it("shapes built plans the same way — their skill blocks yield to sessions", () => {
    const plan: BuiltPlan = {
      id: "plan-1",
      startDate: "2026-01-05",
      periodWeeks: 4,
      primaryGoals: ["STRENGTH"],
      startScale: 1,
      components: [
        { id: "skill-ballhandling", type: "EXPLOSIVENESS", stress: "LOW", priority: 4, baseVolume: 3, optional: false },
        { id: "primary-upper-push", type: "STRENGTH", stress: "HIGH", priority: 1, baseVolume: 4, optional: false },
      ],
    };
    // Monday, Jan 5 2026 — a pre-season low day; the skill block survives the
    // role shaping but yields to a scheduled skill session (built plans have
    // no slot declaration).
    const withoutSession = resolveDayPlan(null, plan, "2026-01-05", EMPTY_CONTEXT);
    expect(withoutSession.some((component) => component.id === "skill-ballhandling")).toBe(true);

    const withSession = resolveDayPlan(null, plan, "2026-01-05", {
      scheduledEvents: [eventOn("2026-01-05", "12:00")], // 7 AM ET, before school
      activityLogs: [],
      timezone: TZ,
    });
    expect(withSession.some((component) => component.id === "skill-ballhandling")).toBe(false);
    expect(withSession.some((component) => component.id === "primary-upper-push")).toBe(true);
  });
});

describe("shared specificity ranking (resolveDetailEntry through programs)", () => {
  it("prefers weekday-matched entries over phase and default entries", () => {
    const program = programById("in-season-game-day");
    const mondayDetail = programExerciseDetail(program, "skill-ballhandling", "2026-11-02");
    const defaultDetail = programExerciseDetail(program, "skill-ballhandling", "2026-11-10");
    // Tuesday is not in the skill templates, so the plan-wide fallback serves.
    expect(mondayDetail?.exercises.length ?? 0).toBeGreaterThan(
      defaultDetail?.exercises.length ?? 0,
    );
  });

  it("labels every skill block through the library (titles resolve)", () => {
    for (const program of TRAINING_PROGRAMS) {
      for (const component of program.components) {
        const block = libraryBlockById(component.id);
        if (block !== undefined && block.kind === "SKILL") {
          expect(block.title.length).toBeGreaterThan(0);
        }
      }
    }
  });
});
