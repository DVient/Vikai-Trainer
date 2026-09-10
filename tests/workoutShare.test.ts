import { describe, expect, it } from "vitest";

import {
  buildWorkoutShareHtml,
  escapeHtml,
  type WorkoutShareInput,
} from "../src/lib/workoutShare";

/**
 * Phase 9.14 — the shareable Game Plan document. The builder is pure, so
 * these tests pin the exact document structure a coach or parent receives:
 * branded header with the day's context, per-block status badges, scaled
 * prescriptions verbatim, adjusted-out blocks in their own section, and
 * HTML-escaped dynamic values (exercise names and titles are data, never
 * markup).
 */

const NOW = new Date("2026-01-02T16:20:00.000Z");

function makeInput(overrides: Partial<WorkoutShareInput> = {}): WorkoutShareInput {
  return {
    dateKey: "2026-01-02",
    dateLabel: "Friday, January 2",
    intensityLabel: "100% Full Send",
    seasonLabel: "Fall 2026 · Pre-season",
    focusLabel: "Vertical jump · Speed",
    blocks: [
      {
        title: "Squat pattern strength",
        status: "done",
        setsLine: "You did 4 sets",
        exercises: [
          {
            name: "Goblet Front Squat",
            prescription: "3 × 5",
            cue: "Elbows tucked, knees track over the toes.",
            steps: ["Set the stance", "Sit straight down", "Drive straight up"],
          },
        ],
      },
      {
        title: "Sprint work",
        status: "up-next",
        setsLine: "3 → 2 sets",
        intro: "Volume scaled — do 2 sets of each exercise; keep the weight.",
        exercises: [
          {
            name: "Flying 10m Sprints",
            prescription: "2 × 6",
            cue: "Build up, then hit top speed through the zone.",
          },
        ],
      },
      {
        title: "Core stability",
        status: "adjusted-out",
        setsLine: "Not part of today's plan",
        exercises: [],
      },
    ],
    counts: { done: 1, remaining: 1, skipped: 1 },
    ...overrides,
  };
}

describe("workout share document (Phase 9.14)", () => {
  it("renders the branded header with the day's context", () => {
    const { html } = buildWorkoutShareHtml(makeInput(), NOW);

    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain("Vikai Trainer");
    expect(html).toContain("Game Plan");
    expect(html).toContain("Friday, January 2");
    expect(html).toContain("Fall 2026 · Pre-season");
    expect(html).toContain("Vertical jump · Speed");
    expect(html).toContain("100% Full Send");
  });

  it("summarizes progress from the block counts", () => {
    const { html } = buildWorkoutShareHtml(
      makeInput({ counts: { done: 2, remaining: 2, skipped: 0 } }),
      NOW,
    );

    expect(html).toContain("2 of 4 blocks done (50%)");
    expect(html).toContain("width:50%");
  });

  it("renders every active block with badges, cues, and numbered steps", () => {
    const { html } = buildWorkoutShareHtml(makeInput(), NOW);

    expect(html).toContain("Squat pattern strength");
    expect(html).toContain("Done ✓");
    expect(html).toContain("You did 4 sets");
    expect(html).toContain("Goblet Front Squat");
    expect(html).toContain("3 × 5");
    expect(html).toContain("Elbows tucked, knees track over the toes.");
    expect(html).toContain("<ol");
    expect(html).toContain("<li>Drive straight up</li>");

    expect(html).toContain("Sprint work");
    expect(html).toContain("Up next");
    expect(html).toContain("Volume scaled — do 2 sets of each exercise; keep the weight.");
  });

  it("shows the display prescription verbatim — the screen already scaled it", () => {
    const { html } = buildWorkoutShareHtml(makeInput(), NOW);

    expect(html).toContain("2 × 6");
  });

  it("groups adjusted-out blocks away from the live work", () => {
    const { html } = buildWorkoutShareHtml(makeInput(), NOW);

    expect(html).toContain("Adjusted out");
    expect(html).toContain("Core stability");
    expect(html).toContain("The plan only pauses — it never pushes through a bad day.");
  });

  it("escapes every dynamic value — a hostile exercise name stays inert text", () => {
    const { html } = buildWorkoutShareHtml(
      makeInput({
        blocks: [
          {
            title: 'Evil <script>alert("x")</script> block',
            status: "up-next",
            setsLine: "3 sets",
            exercises: [
              {
                name: "Exercise <img src=x onerror=alert(1)>",
                prescription: "3 × 8 & 'quotes'",
                cue: `Say "hips back" & stay tall`,
              },
            ],
          },
        ],
      }),
      NOW,
    );

    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img");
    expect(html).toContain("3 × 8 &amp; &#39;quotes&#39;");
    expect(html).toContain("Say &quot;hips back&quot; &amp; stay tall");
  });

  it("names the file after the session day and stamps the generation instant", () => {
    const { fileName, html } = buildWorkoutShareHtml(makeInput(), NOW);

    expect(fileName).toBe("vikai-game-plan-2026-01-02.html");
    expect(html).toContain("Generated by Vikai Trainer · 2026-01-02T16:20:00.000Z");
  });

  it("handles an empty day without progress math going weird", () => {
    const { html } = buildWorkoutShareHtml(
      makeInput({ blocks: [], counts: { done: 0, remaining: 0, skipped: 0 } }),
      NOW,
    );

    // The apostrophe is entity-escaped (renders identically in a browser).
    expect(html).toContain("No blocks on today&#39;s plan.");
    expect(html).toContain("width:0%");
  });
});

describe("escapeHtml", () => {
  it("escapes all five markup-significant characters", () => {
    expect(escapeHtml(`a & b < c > d " e ' f`)).toBe(
      "a &amp; b &lt; c &gt; d &quot; e &#39; f",
    );
  });
});
