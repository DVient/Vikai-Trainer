import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Phase 6.2 — Final spec audit (FLOW 6.2), enforced as automated tests:
 *   1. No medical terminology in any user-facing source (AGENTS.md safety
 *      non-goals / SPEC §6.2). Comments are stripped first so guardrail
 *      documentation never false-positives.
 *   2. Non-destructive notification behavior: the bulk
 *      cancelAllScheduledNotificationsAsync() never appears in src/ — only
 *      identifier-targeted cancellation does (AGENTS.md / SPEC §35).
 *   3. Touch targets ≥ 48×48px: every size token used by app/ screens and
 *      src/components meets the minimum (Tailwind h-12 = 48px).
 *   4. Responsive layout guard: no fixed pixel widths wider than a small
 *      phone viewport (physical-device checks remain a manual checklist).
 */

const UI_ROOTS = ["app", "src"] as const;
/** User-visible copy roots for the jargon scan (import lines stripped). */
const COPY_ROOTS = ["app", "src/components", "src/lib", "src/services"] as const;

const MEDICAL_TERM = /\b(injur\w*|diagnos\w*|rehab\w*|medical|clinic\w*|patholog\w*|prescrib\w*|treatment|symptom\w*|chronic|disease|inflammat\w*|tendon\w*|ligament\w*|dysfunction\w*|therap\w*|acute)\b/i;

/** Brand spec: technical jargon never reaches the athlete-facing UI. */
const UI_JARGON = /\b(autoregulation|physiological|regimen)\b/i;

function listFilesRecursively(root: string): string[] {
  const entries: string[] = [];
  for (const name of readdirSync(root)) {
    const full = join(root, name);
    if (statSync(full).isDirectory()) {
      entries.push(...listFilesRecursively(full));
    } else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".d.ts")) {
      entries.push(full);
    }
  }
  return entries;
}

/** Removes block + line comments so documentation never trips the scans. */
function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:"'])\/\/[^\n]*/gm, "$1");
}

function uiSourceFiles(): string[] {
  return UI_ROOTS.flatMap((root) => listFilesRecursively(root)).sort();
}

describe("§6.2 audit: no medical terminology in user-facing source", () => {
  it("finds zero banned clinical terms across app/ and src/", () => {
    const offenders: string[] = [];
    for (const file of uiSourceFiles()) {
      const match = stripComments(readFileSync(file, "utf8")).match(MEDICAL_TERM);
      if (match) offenders.push(`${file}: "${match[0]}"`);
    }
    expect(offenders).toEqual([]);
  });

  it("keeps the pain-handling copy non-medical by design", () => {
    const status = stripComments(readFileSync(join("src", "lib", "status.ts"), "utf8"));
    expect(status).toContain("An adult should check in with the athlete");
  });
});

describe("§6.2 audit: no technical jargon in UI copy", () => {
  it("uses youth-relatable language instead of engine terminology", () => {
    const offenders: string[] = [];
    for (const root of COPY_ROOTS) {
      for (const file of listFilesRecursively(root)) {
        const withoutImports = stripComments(readFileSync(file, "utf8"))
          .split("\n")
          .filter((line) => !/^\s*(import|export)\b/.test(line))
          .join("\n");
        const match = withoutImports.match(UI_JARGON);
        if (match) offenders.push(`${file}: "${match[0]}"`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("brands the workout view and readiness in youth language", () => {
    const workout = readFileSync(join("app", "workout.tsx"), "utf8");
    expect(workout).toContain("Today's Game Plan");
    expect(workout).toContain("Full Send");
    const gauge = readFileSync(join("src", "components", "PowerGauge.tsx"), "utf8");
    expect(gauge).toContain("Ready State");
  });
});

describe("§6.2 audit: non-destructive notifications", () => {
  it("never references cancelAllScheduledNotificationsAsync in src/", () => {
    const offenders = listFilesRecursively("src").filter((file) =>
      stripComments(readFileSync(file, "utf8")).includes("cancelAllScheduledNotificationsAsync"),
    );
    expect(offenders).toEqual([]);
  });

  it("uses identifier-targeted cancellation in the notifications service", () => {
    const service = stripComments(
      readFileSync(join("src", "services", "notifications.ts"), "utf8"),
    );
    expect(service).toContain("cancelScheduledNotificationAsync");
  });
});

describe("§6.2 audit: accessible touch targets (≥48×48px)", () => {
  it("uses no height token below 48px in screens and components", () => {
    const offenders: string[] = [];
    for (const file of uiSourceFiles()) {
      const code = stripComments(readFileSync(file, "utf8"));
      for (const match of code.matchAll(/\b(?:min-h|h)-(\d+)\b/g)) {
        const units = Number(match[1]);
        if (units < 12) offenders.push(`${file}: ${match[0]} (${units * 4}px)`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("uses no bracketed pixel height below 48px", () => {
    const offenders: string[] = [];
    for (const file of uiSourceFiles()) {
      const code = stripComments(readFileSync(file, "utf8"));
      for (const match of code.matchAll(/\b(?:min-h|h)-\[(\d+)px\]/g)) {
        const px = Number(match[1]);
        if (px < 48) offenders.push(`${file}: ${match[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps the known interactive minimums in place", () => {
    expect(readFileSync(join("src", "components", "OptionCard.tsx"), "utf8")).toContain(
      "min-h-[64px]",
    );
    expect(readFileSync(join("app", "practice-log.tsx"), "utf8")).toContain("min-w-[48px]");
    expect(readFileSync(join("app", "index.tsx"), "utf8")).toContain("min-h-[72px]");
    expect(readFileSync(join("app", "checkin.tsx"), "utf8")).toContain("h-14");
  });
});

describe("§6.2 audit: responsive layout guards", () => {
  it("has no fixed pixel width wider than a small phone viewport", () => {
    const offenders: string[] = [];
    for (const file of uiSourceFiles()) {
      const code = stripComments(readFileSync(file, "utf8"));
      for (const match of code.matchAll(/\bw-\[(\d+)px\]/g)) {
        const px = Number(match[1]);
        if (px > 320) offenders.push(`${file}: ${match[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("prefers percentage/fraction widths for multi-column rows", () => {
    expect(readFileSync(join("app", "practice-log.tsx"), "utf8")).toContain("w-[31%]");
  });
});
