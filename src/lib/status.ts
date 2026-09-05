/**
 * VIKAI — Engine status presentation (design refresh: dark mode, GO/MODULATE/
 * SHIELD color logic).
 *
 * Visual + copy configuration for engine statuses and reasons. Pure data and
 * functions: no React Native imports, no engine imports, no medical
 * terminology anywhere (AGENTS.md safety non-goals / SPEC §6.2 audit).
 *
 * Palette contract (brand spec): base #0F172A (slate-900), GO #22C55E
 * (green-500), MODULATE #EAB308 (yellow-500), SHIELD #EF4444 (red-500).
 */

import type { EngineReason, EngineStatus } from "../types";

export interface EngineStatusTheme {
  label: string;
  description: string;
  containerClass: string;
  headingClass: string;
  chipClass: string;
  chipTextClass: string;
}

export const ENGINE_STATUS_THEME: Record<EngineStatus, EngineStatusTheme> = {
  CHECKIN_REQUIRED: {
    label: "Tap to charge ⚡",
    description: "3 taps unlock your Ready State for today.",
    containerClass: "bg-slate-800 border border-slate-700",
    headingClass: "text-slate-100",
    chipClass: "bg-slate-700",
    chipTextClass: "text-slate-200",
  },
  INSUFFICIENT_DATA: {
    label: "Charging up…",
    description: "Not enough data yet to size up your Ready State.",
    containerClass: "bg-slate-800 border border-slate-700",
    headingClass: "text-slate-100",
    chipClass: "bg-slate-700",
    chipTextClass: "text-slate-200",
  },
  GREEN: {
    label: "GO 🟢",
    description: "Ready State locked — cleared for quality training.",
    containerClass: "bg-green-500/15 border border-green-500/40",
    headingClass: "text-green-400",
    chipClass: "bg-green-500/20",
    chipTextClass: "text-green-300",
  },
  YELLOW: {
    label: "MODULATE 🟡",
    description: "Good day to dial the volume down.",
    containerClass: "bg-yellow-500/15 border border-yellow-500/40",
    headingClass: "text-yellow-400",
    chipClass: "bg-yellow-500/20",
    chipTextClass: "text-yellow-300",
  },
  RED: {
    label: "SHIELD 🔴",
    description: "Focus on rest and recovery today.",
    containerClass: "bg-red-500/15 border border-red-500/40",
    headingClass: "text-red-400",
    chipClass: "bg-red-500/20",
    chipTextClass: "text-red-300",
  },
};

export const ENGINE_REASON_LABELS: Record<EngineReason, string> = {
  CHECKIN_REQUIRED: "No check-in yet",
  INSUFFICIENT_DATA: "Limited data",
  PAIN_CONCERN: "Pain reported",
  IMMINENT_GAME: "Game coming up",
  UPCOMING_GAME: "Game within 24h",
  HIGH_RECENT_WORKLOAD: "Big recent workload",
  LOW_SLEEP: "Short sleep",
  LOW_ENERGY: "Low battery",
  MULTIPLE_READINESS_CONCERNS: "Running low",
  SORENESS_FLAGGED: "Sore spots flagged",
  NORMAL_READINESS: "All systems go",
};

/** Non-medical callout shown when the engine flags requiresAdultAttention. */
export const ADULT_ATTENTION_MESSAGE =
  "An adult should check in with the athlete before any training today.";
