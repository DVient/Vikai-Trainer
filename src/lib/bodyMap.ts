/**
 * VIKAI — Body-map soreness catalog (Phase 7.1).
 *
 * Display data for the stepped check-in body map: regions first, then the
 * areas inside each region. Pure and static — no storage, no clocks. The
 * canonical id list and type guard live in src/types (the engine imports
 * those; this module is UI-facing presentation data only).
 *
 * UX decision (builder/expert review): the app leads the discussion. One
 * tap = "everything feels good"; detail is only pulled out of the athlete
 * where a region is flagged, and the granularity is coarse enough for a
 * teen who answers "my leg hurts" — the map does the being-specific for him.
 */

import type { SoreArea, SoreRegion } from "../types";

/** One tappable sore-area chip inside a region step. */
export interface SoreAreaOption {
  id: SoreArea;
  label: string;
  emoji: string;
}

/** One tappable region card in the body map's first step. */
export interface SoreRegionOption {
  id: SoreRegion;
  label: string;
  emoji: string;
  /** Areas revealed when this region is flagged (second step). */
  areas: readonly SoreAreaOption[];
}

export const SORE_REGIONS: readonly SoreRegionOption[] = [
  {
    id: "LEGS",
    label: "Legs",
    emoji: "🦵",
    areas: [
      { id: "FOOT", label: "Foot", emoji: "🦶" },
      { id: "ANKLE", label: "Ankle", emoji: "🦶" },
      { id: "KNEE", label: "Knee", emoji: "🦴" },
      { id: "QUAD", label: "Quad", emoji: "🦵" },
      { id: "HAMSTRING", label: "Hammy", emoji: "🦿" },
      { id: "CALF", label: "Calf", emoji: "🦵" },
    ],
  },
  {
    id: "CORE",
    label: "Core",
    emoji: "🧍",
    areas: [{ id: "ABS", label: "Abs", emoji: "🔥" }],
  },
  {
    id: "ARMS",
    label: "Arms",
    emoji: "💪",
    areas: [
      { id: "SHOULDER", label: "Shoulder", emoji: "🙆" },
      { id: "ARM", label: "Arm", emoji: "💪" },
    ],
  },
];

/** Flattened area options, in catalog order (LEGS → CORE → ARMS). */
export const SORE_AREA_OPTIONS: readonly SoreAreaOption[] = SORE_REGIONS.flatMap(
  (region) => region.areas,
);

const AREA_LABELS: ReadonlyMap<SoreArea, string> = new Map(
  SORE_AREA_OPTIONS.map((option) => [option.id, option.label]),
);

/** Athlete-facing label for a sore area ("Quad", "Hammy", …). */
export function soreAreaLabel(area: SoreArea): string {
  return AREA_LABELS.get(area) ?? area;
}

/** The region a sore area belongs to (catalog order wins; unique by data). */
export function soreRegionOf(area: SoreArea): SoreRegion | undefined {
  return SORE_REGIONS.find((region) => region.areas.some((option) => option.id === area))?.id;
}
