/**
 * VIKAI — Week structure (high/low scheduling skeleton).
 *
 * Pure functions that give EVERY plan — the built-in default and any
 * athlete-built plan — the same Charlie-Francis-style weekly skeleton:
 * speed/power on fresh days, legs saved on practice nights, a genuinely
 * low recovery day, and an extensive-tempo low day instead of a second
 * high day. The engine stays restriction-only (AGENTS.md): this module
 * shapes which base blocks a DAY contains and in what order they render —
 * the generator then maps restrictions onto whatever survives.
 *
 * Roles:
 * - recovery      — Sunday: low-stress skill + recovery work only.
 * - practice      — practice nights (Tue/Wed/Thu, on/after seasonStart):
 *                   no high-stress lower/full-body blocks — legs are saved
 *                   for the 6 PM practice.
 * - post-practice — Friday in the practice season: the day after three
 *                   straight practices — strength and tempo stay, speed/
 *                   plyo/COD do not (speed lives on fresh days).
 * - low           — pre-season low days (Mon/Wed/Fri before seasonStart):
 *                   same leg discipline as practice nights; speed/plyo/
 *                   COD live on the Tue/Thu/Sat high days.
 * - full          — high days: the complete template, speed first.
 */

import { DEFAULT_SEASON_CONFIG } from "../config/defaults";
import { weekdayOf } from "./fall2026";
import type { TrainingComponent } from "../types";

export type DayRole = "recovery" | "practice" | "post-practice" | "low" | "full";

/** Block types whose HIGH-stress expression is speed/power work. */
const SPEED_POWER_TYPES: ReadonlySet<string> = new Set([
  "SPEED",
  "CHANGE_OF_DIRECTION",
  "DECELERATION",
  "EXPLOSIVENESS",
]);

/**
 * The day's scheduling role from its local date alone (pure; string-date
 * comparison against the season start). Before the practice season begins
 * there are no team practices — pre-season weeks run the classic high/low
 * split (Mon/Wed/Fri low, Tue/Thu/Sat high) so the built-in overlays'
 * designed weeks render as intended.
 */
export function dayRoleFor(localDate: string): DayRole {
  const weekday = weekdayOf(localDate);
  if (weekday === 0) return "recovery";

  if (localDate >= DEFAULT_SEASON_CONFIG.seasonStart) {
    if (DEFAULT_SEASON_CONFIG.practiceWeekdays.includes(weekday)) return "practice";
    if (weekday === 5) return "post-practice";
    return "full";
  }

  return weekday === 1 || weekday === 3 || weekday === 5 ? "low" : "full";
}

/**
 * Which of a plan's blocks a given role keeps. Filters are attribute-based
 * (stress/bodyRegion/type) so ANY plan — default or built — shapes the same
 * way, and the athlete's own block selections inherit the skeleton.
 */
export function componentsForRole(
  role: DayRole,
  components: readonly TrainingComponent[],
): readonly TrainingComponent[] {
  switch (role) {
    case "full":
      return components;
    case "recovery":
      // Skill touch-up + recovery flow; easy accessory lifting stays off
      // the rest day.
      return components.filter(
        (component) =>
          component.stress === "RECOVERY" ||
          (component.stress === "LOW" && component.type !== "STRENGTH"),
      );
    case "practice":
    case "low":
      // Legs are saved: no high-stress lower/full-body loading.
      return components.filter(
        (component) =>
          !(
            component.stress === "HIGH" &&
            (component.bodyRegion === "LOWER" || component.bodyRegion === "FULL")
          ),
      );
    case "post-practice":
      // Freshness rule: no speed/plyo/COD the day after the practice block.
      return components.filter(
        (component) => !(component.stress === "HIGH" && SPEED_POWER_TYPES.has(component.type)),
      );
  }
}

/** Display-order class: speed/power first, then other high work, then low, then recovery. */
function orderClass(component: TrainingComponent): number {
  if (component.stress === "HIGH" && SPEED_POWER_TYPES.has(component.type)) return 0;
  if (component.stress === "HIGH") return 1;
  if (component.stress === "RECOVERY") return 3;
  return 2;
}

/**
 * Session ordering: speed/power work renders first — the athlete is
 * freshest at the top of the session. Stable sort; protection order is
 * `priority` and is untouched.
 */
export function sessionOrder(
  components: readonly TrainingComponent[],
): readonly TrainingComponent[] {
  return [...components].sort((a, b) => orderClass(a) - orderClass(b));
}
