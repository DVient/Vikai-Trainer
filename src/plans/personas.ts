/**
 * VIKAI — Plan Builder personas.
 *
 * Personas are curated PRESETS over the same deterministic builder — they
 * make evidence-backed emphasis reachable in one tap. Each persona encodes:
 * the primary goals it protects, an optional movement-region bias, whether
 * skill blocks take priority, suggested weeks, and the benchmark drills
 * that measure its progress.
 *
 * Copy rule (§6.2 audits): descriptions stay in training language — no
 * clinical terms, no engine jargon, no overclaiming.
 */

import type { PersonaId, TrainingGoal } from "../types";

export type RegionBias = "LOWER" | "BALANCED";

export interface PersonaPreset {
  id: PersonaId;
  emoji: string;
  label: string;
  /** One-line teen-facing description of what the persona trains toward. */
  blurb: string;
  /** One line on the training principles it leans on. */
  basis: string;
  primaryGoals: TrainingGoal[];
  regionBias: RegionBias;
  /** Skill blocks take priority-1 treatment and extra volume. */
  skillPriority: boolean;
  suggestedWeeks: number;
  benchmarkDrillIds: readonly string[];
}

export const PERSONAS: ReadonlyArray<PersonaPreset> = [
  {
    id: "JUMP_HIGHER",
    emoji: "🚀",
    label: "Jump higher",
    blurb: "Spring off two feet — jump mechanics plus the leg strength that powers them.",
    basis: "Plyometric and resistance training together consistently improve vertical jump.",
    primaryGoals: ["EXPLOSIVENESS", "STRENGTH"],
    regionBias: "LOWER",
    skillPriority: false,
    suggestedWeeks: 8,
    benchmarkDrillIds: ["jump-touch", "standing-long-jump"],
  },
  {
    id: "GET_STRONGER",
    emoji: "💪",
    label: "Get stronger",
    blurb: "Build a stronger frame all over — technique first, load when you earn it.",
    basis: "Progressive resistance training, technique-first, is well supported for youth strength.",
    primaryGoals: ["STRENGTH"],
    regionBias: "BALANCED",
    skillPriority: false,
    suggestedWeeks: 8,
    benchmarkDrillIds: ["pushup-max"],
  },
  {
    id: "FASTER_FIRST_STEP",
    emoji: "⚡",
    label: "Faster first step",
    blurb: "Win the first three steps — acceleration mechanics and explosive pushes.",
    basis: "Short-sprint and acceleration training improves early-race speed.",
    primaryGoals: ["ACCELERATION", "SPEED"],
    regionBias: "LOWER",
    skillPriority: false,
    suggestedWeeks: 6,
    benchmarkDrillIds: ["sprint-20yd", "pro-agility-5105"],
  },
  {
    id: "TWO_WAY_ENGINE",
    emoji: "🛡️",
    label: "Two-way engine",
    blurb: "Cut, slide, and stop on a dime — the movement base of two-way defense.",
    basis: "Planned direction-change and braking drills train defensive movement quality.",
    primaryGoals: ["CHANGE_OF_DIRECTION", "DECELERATION"],
    regionBias: "LOWER",
    skillPriority: false,
    suggestedWeeks: 6,
    benchmarkDrillIds: ["lane-agility", "closeout-contest"],
  },
  {
    id: "ALL_ROUND",
    emoji: "🏀",
    label: "All-round athlete",
    blurb: "The balanced build — a bit of everything, exactly like the season demands.",
    basis: "A broad base supports every capacity a young multi-tool athlete needs.",
    primaryGoals: ["STRENGTH", "EXPLOSIVENESS", "CHANGE_OF_DIRECTION"],
    regionBias: "BALANCED",
    skillPriority: false,
    suggestedWeeks: 8,
    benchmarkDrillIds: ["jump-touch", "lane-agility"],
  },
  {
    id: "HANDLES_PRESSURE",
    emoji: "🏀",
    label: "Handles under pressure",
    blurb: "Ball on a string — high-frequency handling reps, always fresh, always with eyes up.",
    basis: "Variable, randomized practice beats blocked repetition for skill retention.",
    primaryGoals: ["EXPLOSIVENESS"],
    regionBias: "BALANCED",
    skillPriority: true,
    suggestedWeeks: 6,
    benchmarkDrillIds: ["figure8-dribble", "fullcourt-dribble"],
  },
  {
    id: "CATCH_SHOOT",
    emoji: "🎯",
    label: "Catch & shoot",
    blurb: "Same shot, every spot — distributed shooting volume with legs underneath it.",
    basis: "Variable and distributed practice demonstrably improves shooting retention.",
    primaryGoals: ["EXPLOSIVENESS", "STRENGTH"],
    regionBias: "LOWER",
    skillPriority: true,
    suggestedWeeks: 8,
    benchmarkDrillIds: ["spot-shooting-25", "freethrow-25"],
  },
  {
    id: "FINISHING_RIM",
    emoji: "🛣️",
    label: "Finishing at the rim",
    blurb: "Every angle, both hands — finishing packages on a jump-capable base.",
    basis: "Variable-solution finishing practice transfers; jump capacity underwrites it.",
    primaryGoals: ["EXPLOSIVENESS", "STRENGTH"],
    regionBias: "LOWER",
    skillPriority: true,
    suggestedWeeks: 6,
    benchmarkDrillIds: ["layups-minute"],
  },
  {
    id: "COURT_VISION",
    emoji: "👁️",
    label: "Court vision",
    blurb: "See it before it happens — passing and reads in decision-rich practice.",
    basis: "Perception–action coupling: representative, decision-rich practice transfers to games.",
    primaryGoals: ["EXPLOSIVENESS", "CHANGE_OF_DIRECTION"],
    regionBias: "BALANCED",
    skillPriority: true,
    suggestedWeeks: 6,
    benchmarkDrillIds: ["passcut-sequence"],
  },
];

export function personaById(id: PersonaId): PersonaPreset | undefined {
  return PERSONAS.find((persona) => persona.id === id);
}
