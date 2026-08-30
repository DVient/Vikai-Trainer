/**
 * VIKAI — Default configuration (SPEC §1.2, §7)
 *
 * The system initializes with a default baseline profile. User, parent,
 * coach, or administrative configuration inputs may override any value via
 * the store (SPEC §1.2). Fields from §1.2 without an AthleteProfile slot
 * (season dates, school times, commute) are configuration concerns for later
 * phases and are intentionally not modeled here.
 */

import type { AthleteProfile } from "../types";

export const DEFAULT_ATHLETE_PROFILE: AthleteProfile = {
  id: "default-athlete",
  displayName: "Athlete",
  sport: "BASKETBALL",
  athleteLevel: "YOUTH",
  heightInches: 72,
  weightLbs: 140,
  primaryGoals: ["STRENGTH", "EXPLOSIVENESS", "CHANGE_OF_DIRECTION"],
  timezone: "America/New_York",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

/**
 * §1.2 real-world constraint defaults that have no AthleteProfile slot.
 * `seasonStart`/`firstGame` are the §24 training-phase boundary dates and
 * feed season-phase selection when that extension is built.
 */
export interface AthleteSeasonConfig {
  practicesPerWeek: number;
  /** Local calendar dates, YYYY-MM-DD (SPEC §1.2 / §24). */
  seasonStart: string;
  firstGame: string;
  /** 24h "HH:mm" local times (SPEC §1.2). */
  schoolStartTime: string;
  schoolEndTime: string;
  commuteMinutes: number;
}

export const DEFAULT_SEASON_CONFIG: AthleteSeasonConfig = {
  practicesPerWeek: 2,
  seasonStart: "2026-09-14",
  firstGame: "2026-10-15",
  schoolStartTime: "09:00",
  schoolEndTime: "15:30",
  commuteMinutes: 40,
};
