/**
 * VIKAI — Share the workout as a document (Phase 9.14).
 *
 * Renders the day's Game Plan into a single self-contained HTML document:
 * branded header (date, season/week, focus, intensity), a progress line,
 * one card per block with status badges and full exercise detail (scaled
 * prescriptions exactly as the screen shows them), adjusted-out blocks in
 * their own section, and a generation footer. The recipient opens it in any
 * browser — or prints it to PDF — with no network needed.
 *
 * Pure and deterministic: no storage, no clock — the generation instant is
 * injected, and every dynamic string is entity-escaped before it reaches
 * the markup. The share-sheet wiring (file system + share dialog) lives in
 * the screen; this module only builds strings.
 */

export type WorkoutShareBlockStatus = "done" | "up-next" | "adjusted-out";

export interface WorkoutShareExercise {
  name: string;
  /** The display prescription — already scaled by the screen ("2 × 6"). */
  prescription: string;
  cue?: string;
  steps?: ReadonlyArray<string>;
}

export interface WorkoutShareBlock {
  title: string;
  status: WorkoutShareBlockStatus;
  /** One-line volume summary, e.g. "4 sets" / "3 → 2 sets" / "You did 4 sets". */
  setsLine: string;
  /** Optional note under the title (e.g. the volume-scaling line). */
  intro?: string;
  exercises: ReadonlyArray<WorkoutShareExercise>;
}

export interface WorkoutShareInput {
  /** ISO date key for the session day (also used in the file name). */
  dateKey: string;
  /** Long human date, e.g. "Friday, January 2". */
  dateLabel: string;
  /** Intensity line from the engine, e.g. "100% Full Send". */
  intensityLabel: string;
  /** Optional season/plan line, e.g. "Fall 2026 · Pre-season". */
  seasonLabel?: string;
  /** Focus goals, e.g. "Vertical jump · Speed". */
  focusLabel: string;
  blocks: ReadonlyArray<WorkoutShareBlock>;
  counts: { done: number; remaining: number; skipped: number };
}

export interface BuiltWorkoutShare {
  html: string;
  fileName: string;
}

/** HTML entity escaping — every dynamic value passes through this. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const STATUS_BADGE: Record<WorkoutShareBlockStatus, string> = {
  done: "Done ✓",
  "up-next": "Up next",
  "adjusted-out": "Adjusted out",
};

const STATUS_CLASS: Record<WorkoutShareBlockStatus, string> = {
  done: "badge badge-done",
  "up-next": "badge badge-next",
  "adjusted-out": "badge badge-out",
};

/** Styles the document once — inlined into the <head>, zero external assets. */
const STYLES = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 28px 20px 40px;
    background: #F6F7F9;
    color: #131720;
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.5;
  }
  .page { max-width: 640px; margin: 0 auto; }
  .masthead {
    background: #131720;
    color: #FFFFFF;
    border-radius: 16px;
    padding: 22px 24px;
  }
  .wordmark {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: #4ADE80;
  }
  h1 { margin: 6px 0 2px; font-size: 26px; font-weight: 900; letter-spacing: -0.01em; }
  .date { margin: 0; font-size: 14px; color: #C7CBD4; }
  .meta { margin: 14px 0 0; font-size: 13px; color: #E7E9EE; }
  .meta-chip {
    display: inline-block;
    background: rgba(255, 255, 255, 0.12);
    border-radius: 999px;
    padding: 4px 10px;
    margin: 0 6px 6px 0;
  }
  .progress { margin: 14px 2px 6px; font-size: 13px; font-weight: 700; color: #3F4756; }
  .progress-track {
    height: 6px; border-radius: 3px; background: #E2E5EB; overflow: hidden;
  }
  .progress-fill { height: 6px; border-radius: 3px; background: #16A34A; }
  .block {
    background: #FFFFFF;
    border: 1px solid #E2E5EB;
    border-radius: 14px;
    padding: 16px 18px;
    margin-top: 14px;
  }
  .block-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
  .block-title { margin: 0; font-size: 16px; font-weight: 800; }
  .sets { margin: 2px 0 0; font-size: 12px; color: #6B7280; font-weight: 600; }
  .badge {
    flex-shrink: 0;
    font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em;
    border-radius: 999px; padding: 3px 10px; white-space: nowrap;
  }
  .badge-done { background: #DCFCE7; color: #15803D; }
  .badge-next { background: #E8ECF3; color: #3F4756; }
  .badge-out { background: #F1F2F5; color: #9AA1AE; }
  .intro { margin: 8px 0 0; font-size: 12.5px; color: #3F4756; font-weight: 600; }
  .exercise { padding: 12px 0 2px; border-top: 1px solid #EEF0F4; margin-top: 12px; }
  .ex-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
  .ex-name { font-size: 14.5px; font-weight: 700; }
  .ex-rx {
    flex-shrink: 0; font-size: 12px; font-weight: 800; color: #14532D;
    background: #ECFDF3; border: 1px solid #D3F4DF; border-radius: 8px; padding: 2px 8px;
    white-space: nowrap;
  }
  .ex-cue { margin: 4px 0 0; font-size: 13px; color: #565F6E; font-style: italic; }
  .ex-steps { margin: 6px 0 0; padding-left: 20px; font-size: 13px; color: #3F4756; }
  .ex-steps li { margin-top: 2px; }
  .adjusted { border-style: dashed; background: transparent; }
  .adjusted .block-title { color: #9AA1AE; font-weight: 700; }
  .adjusted-note { margin: 6px 0 0; font-size: 12px; color: #9AA1AE; }
  .footer {
    margin-top: 22px; text-align: center; font-size: 11.5px; color: #8A93A3;
  }
  @media print {
    body { background: #FFFFFF; padding: 0 12mm; }
    .block { break-inside: avoid; border-color: #D8DCE3; }
    .masthead { border-radius: 0; }
  }
`;

function exerciseHtml(exercise: WorkoutShareExercise): string {
  const cue =
    exercise.cue !== undefined ? `<p class="ex-cue">“${escapeHtml(exercise.cue)}”</p>` : "";
  const steps =
    exercise.steps !== undefined && exercise.steps.length > 0
      ? `<ol class="ex-steps">${exercise.steps
          .map((step) => `<li>${escapeHtml(step)}</li>`)
          .join("")}</ol>`
      : "";
  return `<div class="exercise">
    <div class="ex-head"><span class="ex-name">${escapeHtml(exercise.name)}</span><span class="ex-rx">${escapeHtml(exercise.prescription)}</span></div>
    ${cue}${steps}
  </div>`;
}

function blockHtml(block: WorkoutShareBlock): string {
  const badgeClass = STATUS_CLASS[block.status];
  const badgeText = STATUS_BADGE[block.status];
  const intro =
    block.intro !== undefined ? `<p class="intro">${escapeHtml(block.intro)}</p>` : "";
  const exercises = block.exercises.map(exerciseHtml).join("\n");
  return `<section class="block">
    <div class="block-head">
      <div><h2 class="block-title">${escapeHtml(block.title)}</h2><p class="sets">${escapeHtml(block.setsLine)}</p></div>
      <span class="${badgeClass}">${badgeText}</span>
    </div>
    ${intro}
    ${exercises}
  </section>`;
}

/**
 * Renders the share document. Dynamic values are escaped; structure, badges,
 * and styling are code-owned, so the markup is safe by construction.
 */
export function buildWorkoutShareHtml(input: WorkoutShareInput, now: Date): BuiltWorkoutShare {
  const total = input.counts.done + input.counts.remaining;
  const percent = total === 0 ? 0 : Math.round((input.counts.done / total) * 100);
  const progressLine =
    total === 0
      ? "No blocks on today's plan."
      : `${input.counts.done} of ${total} blocks done (${percent}%)`;

  const seasonLine =
    input.seasonLabel !== undefined
      ? `<span class="meta-chip">${escapeHtml(input.seasonLabel)}</span>`
      : "";

  const active = input.blocks.filter((block) => block.status !== "adjusted-out");
  const adjusted = input.blocks.filter((block) => block.status === "adjusted-out");
  const adjustedSection =
    adjusted.length > 0
      ? `<section class="block adjusted">${adjusted.map(blockHtml).join("\n")}
          <p class="adjusted-note">The plan only pauses — it never pushes through a bad day.</p>
        </section>`
      : "";

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Vikai Trainer — Game Plan · ${escapeHtml(input.dateLabel)}</title>
<style>${STYLES}</style>
</head>
<body>
<div class="page">
  <header class="masthead">
    <div class="wordmark">Vikai Trainer</div>
    <h1>Game Plan</h1>
    <p class="date">${escapeHtml(input.dateLabel)}</p>
    <div class="meta">
      ${seasonLine}<span class="meta-chip">${escapeHtml(input.focusLabel)}</span><span class="meta-chip">${escapeHtml(input.intensityLabel)}</span>
    </div>
  </header>

  <p class="progress">${escapeHtml(progressLine)}</p>
  <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>

  ${active.map(blockHtml).join("\n")}
  ${adjustedSection}

  <footer class="footer">Generated by Vikai Trainer · ${escapeHtml(now.toISOString())}<br>The plan adapts to the day — everything stays on the athlete's phone.</footer>
</div>
</body>
</html>`;

  return { html, fileName: `vikai-game-plan-${input.dateKey}.html` };
}
