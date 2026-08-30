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
