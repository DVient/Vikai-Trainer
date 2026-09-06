import { describe, expect, it } from "vitest";

import { DEFAULT_BASE_PLAN } from "../src/plans/basePlan";
import { BLOCK_LIBRARY } from "../src/plans/library";
import {
  exerciseDetailsFor,
  FALL_COMPONENT_DETAILS,
  FALL_2026_PHASES,
  seasonPhaseFor,
  weekdayOf,
} from "../src/plans/fall2026";

/** Banned-words scan mirroring the spec audit's medical-term pattern. */
const MEDICAL_TERM = /\b(injur\w*|diagnos\w*|rehab\w*|medical|clinic\w*|patholog\w*|prescrib\w*|treatment|symptom\w*|chronic|disease|inflammat\w*|tendon\w*|ligament\w*|dysfunction\w*|therap\w*|acute)\b/i;

/** A date inside the given phase whose weekday matches (0 Sun … 6 Sat). */
function dateInPhase(phaseId: string | undefined, weekday: number): string {
  if (phaseId === undefined) return "2026-03-04"; // outside the Fall window
  const phase = FALL_2026_PHASES.find((entry) => entry.id === phaseId);
  if (!phase) throw new Error(`unknown phase ${phaseId}`);
  const start = new Date(`${phase.startsOn}T00:00:00.000Z`);
  for (let offset = 0; offset < 60; offset += 1) {
    const candidate = new Date(start.getTime() + offset * 24 * 60 * 60 * 1000);
    if (candidate.getUTCDay() === weekday) return candidate.toISOString().slice(0, 10);
  }
  throw new Error(`no matching weekday in phase ${phaseId}`);
}

describe("season phases (Fall 2026 window)", () => {
  it("resolves the exact phase boundaries from the document", () => {
    expect(seasonPhaseFor("2026-08-23")).toBeUndefined();
    expect(seasonPhaseFor("2026-08-24")?.id).toBe("pre-season");
    expect(seasonPhaseFor("2026-09-07")?.id).toBe("pre-season");
    expect(seasonPhaseFor("2026-09-08")?.id).toBe("in-season");
    expect(seasonPhaseFor("2026-10-14")?.id).toBe("in-season");
    expect(seasonPhaseFor("2026-10-15")?.id).toBe("competition");
    expect(seasonPhaseFor("2026-12-31")?.id).toBe("competition");
    expect(seasonPhaseFor("2027-01-01")).toBeUndefined();
  });

  it("computes weekdays purely from the date key", () => {
    expect(weekdayOf("2026-09-08")).toBe(2); // Tuesday
    expect(weekdayOf("2026-09-12")).toBe(6); // Saturday
    expect(weekdayOf("2026-09-13")).toBe(0); // Sunday
  });
});

describe("exercise detail lookup", () => {
  it("resolves detail for every component on every day of every phase", () => {
    for (const phaseId of [undefined, "pre-season", "in-season", "competition"]) {
      for (let weekday = 0; weekday <= 6; weekday += 1) {
        const localDate = dateInPhase(phaseId, weekday);
        for (const component of DEFAULT_BASE_PLAN) {
          const detail = exerciseDetailsFor(component.id, localDate);
          expect(detail).toBeDefined();
          const hasContent =
            (detail?.exercises.length ?? 0) > 0 || detail?.note !== undefined;
          expect(hasContent).toBe(true);
          for (const exercise of detail?.exercises ?? []) {
            expect(exercise.name.trim()).not.toBe("");
            expect(exercise.prescription.trim()).not.toBe("");
            // Phase 9.10 — the offline steps layer is guaranteed everywhere.
            expect(exercise.steps?.length ?? 0).toBeGreaterThanOrEqual(2);
            if (exercise.videoUrl !== undefined) {
              expect(exercise.videoUrl.startsWith("https://www.youtube.com/")).toBe(true);
            }
          }
        }
      }
    }
  });

  it("follows the document's practice-night rule in the in-season phase", () => {
    // Tuesday, Sept 8 2026 — team practice night: no lower-body lifting.
    const tuesday = exerciseDetailsFor("primary-lower-squat", "2026-09-08");
    expect(tuesday?.exercises).toEqual([]);
    expect(tuesday?.note).toContain("Practice night");

    // Saturday, Sept 12 2026 — the primary strength day returns.
    const saturday = exerciseDetailsFor("primary-lower-squat", "2026-09-12");
    expect(saturday?.exercises.map((exercise) => exercise.name)).toContain("Trap Bar Deadlift");
    expect(saturday?.exercises.map((exercise) => exercise.name)).toContain("Dumbbell RDL");
  });

  it("drops jumping on low-energy days in the pre-season phase", () => {
    expect(exerciseDetailsFor("explosive-jumps", "2026-08-31")?.exercises).toEqual([]);
    // Thursday, Sept 3 2026 — box jump day.
    expect(
      exerciseDetailsFor("explosive-jumps", "2026-09-03")?.exercises[0]?.name,
    ).toBe("Box Jumps");
  });

  it("trims strength to micro-lifting during the competition phase", () => {
    const tuesday = exerciseDetailsFor("primary-lower-squat", "2026-11-03");
    expect(tuesday?.exercises[0]?.prescription).toBe("2 × 4");
  });

  it("resolves skill work with curated demo videos (online-only supplement)", () => {
    const detail = exerciseDetailsFor("skill-ballhandling", "2026-09-12");
    // In-season Saturday block: the skill exercises carry curated watch URLs.
    const pullUps = detail?.exercises.find((exercise) => exercise.name.includes("Off-Dribble"));
    expect(pullUps?.videoUrl?.startsWith("https://www.youtube.com/watch?v=")).toBe(true);
    const finishes = detail?.exercises.find((exercise) => exercise.name.includes("Two-Foot"));
    expect(finishes?.videoUrl?.startsWith("https://www.youtube.com/watch?v=")).toBe(true);
  });

  it("still resolves default detail outside the Fall 2026 window", () => {
    const detail = exerciseDetailsFor("primary-lower-squat", "2026-03-04");
    expect(detail?.exercises.length).toBeGreaterThanOrEqual(1);
  });

  it("bans search-page links — every seeded video is a specific watch URL", () => {
    for (const entry of FALL_COMPONENT_DETAILS) {
      for (const exercise of entry.exercises) {
        if (exercise.videoUrl !== undefined) {
          expect(exercise.videoUrl.startsWith("https://www.youtube.com/watch?v=")).toBe(true);
          expect(exercise.videoUrl).not.toContain("results?search_query");
        }
      }
    }
  });

  it("keeps all detail copy free of banned clinical language", () => {
    for (const entry of FALL_COMPONENT_DETAILS) {
      const text = JSON.stringify(entry);
      const match = text.match(MEDICAL_TERM);
      expect(match).toBeNull();
    }
  });
});

describe("phase 9.10 — offline technique steps in the block library", () => {
  it("gives every library exercise offline steps (the guaranteed layer)", () => {
    for (const block of BLOCK_LIBRARY) {
      for (const variant of [...block.pool.A, ...block.pool.B, ...block.pool.staple]) {
        expect(variant.steps.length, `${block.component.id}: ${variant.name}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("never ships a search-page link in the library", () => {
    for (const block of BLOCK_LIBRARY) {
      for (const variant of [...block.pool.A, ...block.pool.B, ...block.pool.staple]) {
        if (variant.videoUrl !== undefined) {
          expect(variant.videoUrl.startsWith("https://www.youtube.com/watch?v=")).toBe(true);
          expect(variant.videoUrl).not.toContain("results?search_query");
        }
      }
    }
  });

  it("keeps the library copy free of banned clinical language", () => {
    const text = JSON.stringify(BLOCK_LIBRARY);
    expect(text.match(MEDICAL_TERM)).toBeNull();
  });
});
