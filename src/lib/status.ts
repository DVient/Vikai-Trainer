/**
 * VIKAI — Engine status presentation (Phase 4)
 *
 * Visual + copy configuration for engine statuses and reasons. Pure data and
 * functions: no React Native imports, no engine imports, no medical
 * terminology anywhere (AGENTS.md safety non-goals / SPEC §6.2 audit).
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
    label: "Check-in required",
    description: "Complete today's check-in to unlock your training status.",
    containerClass: "bg-slate-200",
    headingClass: "text-slate-900",
    chipClass: "bg-slate-300",
    chipTextClass: "text-slate-800",
  },
  INSUFFICIENT_DATA: {
    label: "Limited data",
    description: "There is not enough data yet to size up today's readiness.",
    containerClass: "bg-slate-200",
    headingClass: "text-slate-900",
    chipClass: "bg-slate-300",
    chipTextClass: "text-slate-800",
  },
  GREEN: {
    label: "Ready to go",
    description: "Cleared for quality training today.",
    containerClass: "bg-emerald-100",
    headingClass: "text-emerald-900",
    chipClass: "bg-emerald-200",
    chipTextClass: "text-emerald-900",
  },
  YELLOW: {
    label: "Take it easy",
    description: "Reduced training is recommended today.",
    containerClass: "bg-amber-100",
    headingClass: "text-amber-900",
    chipClass: "bg-amber-200",
    chipTextClass: "text-amber-900",
  },
  RED: {
    label: "Training paused",
    description: "Focus on rest and recovery today.",
    containerClass: "bg-red-100",
    headingClass: "text-red-900",
    chipClass: "bg-red-200",
    chipTextClass: "text-red-900",
  },
};

export const ENGINE_REASON_LABELS: Record<EngineReason, string> = {
  CHECKIN_REQUIRED: "No check-in yet",
  INSUFFICIENT_DATA: "Limited data",
  PAIN_CONCERN: "Pain reported",
  IMMINENT_GAME: "Game coming up",
  UPCOMING_GAME: "Game within 24h",
  HIGH_RECENT_WORKLOAD: "High recent load",
  LOW_SLEEP: "Short sleep",
  LOW_ENERGY: "Low energy",
  MULTIPLE_READINESS_CONCERNS: "Multiple concerns",
  NORMAL_READINESS: "Normal readiness",
};

/** Non-medical callout shown when the engine flags requiresAdultAttention. */
export const ADULT_ATTENTION_MESSAGE =
  "An adult should check in with the athlete before any training today.";
