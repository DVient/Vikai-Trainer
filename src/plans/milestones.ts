/**
 * VIKAI — Benchmark drill catalog (Plan Builder milestones).
 *
 * Curated from established field-test protocols. Pairing rule: a drill
 * enters the catalog only if its construct maps to a persona's primary
 * capacity, it is feasible solo with ball/hoop/wall/phone, it is
 * youth-safe (no maximal external loads), and it is sensitive to training
 * within 4–12 weeks with low noise. Personas REFERENCE drills by id —
 * the pairing is data, inspectable, and drills are shared across personas.
 *
 * Pure data + one pure lookup; no storage, no clock.
 */

import type { MilestoneDrill, PersonalBest, TrainingGoal } from "../types";

export const MILESTONE_DRILLS: ReadonlyArray<MilestoneDrill> = [
  {
    id: "jump-touch",
    label: "Standing jump touch",
    goal: "EXPLOSIVENESS",
    unit: "cm",
    higherIsBetter: true,
    protocol:
      "Mark your standing reach (feet flat, one arm up). Jump-touch 3 times against a wall. Best touch minus standing reach = your score.",
    basis: "Vertical jump is the standard field proxy for lower-body explosive power.",
  },
  {
    id: "standing-long-jump",
    label: "Standing long jump",
    goal: "EXPLOSIVENESS",
    unit: "cm",
    higherIsBetter: true,
    protocol: "Feet behind the line, swing the arms, jump and stick the landing. Measure heel to line. Best of 3.",
    basis: "Horizontal power test — elastic strength that pairs with vertical jump work.",
  },
  {
    id: "pushup-max",
    label: "Push-up max",
    goal: "STRENGTH",
    unit: "reps",
    higherIsBetter: true,
    protocol:
      "Body in one line, chest to a fist-height target, no pausing at the bottom longer than one breath. Count clean reps to failure of form.",
    basis: "Self-administered upper-body strength-endurance test — no external loads needed.",
  },
  {
    id: "sprint-20yd",
    label: "20-yard sprint",
    goal: "SPEED",
    unit: "seconds",
    higherIsBetter: false,
    protocol: "Two cones 20 yards apart. Timer starts on your first movement. Best of 3 with full walking recovery.",
    basis: "Short-sprint time is the most direct speed field test; 20 yd matches basketball court length.",
  },
  {
    id: "pro-agility-5105",
    label: "5-10-5 pro agility",
    goal: "ACCELERATION",
    unit: "seconds",
    higherIsBetter: false,
    protocol:
      "Middle cone, sprint 5 yd right, touch, 10 yd left, touch, 5 yd back through the middle. Best of 2 each direction.",
    basis: "The combine-standard test of acceleration plus one change of direction.",
  },
  {
    id: "lane-agility",
    label: "Lane agility run",
    goal: "CHANGE_OF_DIRECTION",
    unit: "seconds",
    higherIsBetter: false,
    protocol:
      "Use the lane: baseline → free-throw line → back → defensive slide to the far edge of the lane → back → finish. Best of 2.",
    basis: "The NBA-combine lane agility drill blends sprinting and sliding in a basketball footprint.",
  },
  {
    id: "closeout-contest",
    label: "Closeout & contest reps",
    goal: "CHANGE_OF_DIRECTION",
    unit: "count",
    higherIsBetter: true,
    protocol: "Start under the rim, sprint to the wing cone, chop your feet and touch the cone with your hand, backpedal back. Count clean reps in 30 seconds.",
    basis: "Defensive closeout volume reflects repeatable direction-change quality under fatigue.",
  },
  {
    id: "figure8-dribble",
    label: "Figure-8 dribble time",
    goal: "EXPLOSIVENESS",
    unit: "seconds",
    higherIsBetter: false,
    protocol: "Two cones 3 feet apart, one full figure-8 around both. Ball stays low, eyes up. Time 2 clean laps; best of 3.",
    basis: "The classic controlled ball-handling speed test — tight-space control.",
  },
  {
    id: "fullcourt-dribble",
    label: "Full-court dribble vs clock",
    goal: "EXPLOSIVENESS",
    unit: "seconds",
    higherIsBetter: false,
    protocol: "Dribble baseline to baseline at game speed with a change of direction at half court. Dribble must stay alive. Best of 3.",
    basis: "Open-floor handling at speed — control plus sprint quality combined.",
  },
  {
    id: "spot-shooting-25",
    label: "Spot shooting (makes of 25)",
    goal: "EXPLOSIVENESS",
    unit: "count",
    higherIsBetter: true,
    protocol: "5 spots at your range, 5 attempts each, catch-and-shoot. Count total makes of 25. Log the same spots every test.",
    basis: "Counting makes of a fixed 25 gives a stable accuracy number a percentage on tiny samples can't.",
  },
  {
    id: "freethrow-25",
    label: "Free throws (of 25)",
    goal: "EXPLOSIVENESS",
    unit: "count",
    higherIsBetter: true,
    protocol: "Shoot 5 sets of 5 with the same routine every time. Count total makes of 25.",
    basis: "Routine-based free-throw sets measure repeatable accuracy under the same conditions each test.",
  },
  {
    id: "layups-minute",
    label: "Layups in 1 minute",
    goal: "EXPLOSIVENESS",
    unit: "count",
    higherIsBetter: true,
    protocol: "Start at the wing. Make a right-handed layup, rebound, make a left-handed layup. Count makes in 60 seconds.",
    basis: "Two-foot finishing speed with both hands — the core finishing capacity at game pace.",
  },
  {
    id: "passcut-sequence",
    label: "Pass-and-cut sequence",
    goal: "EXPLOSIVENESS",
    unit: "count",
    higherIsBetter: true,
    protocol: "Against a wall or partner: pass, cut hard to a spot, catch on two feet, pivot, scan, repeat. Count clean sequences in 60 seconds (no travels).",
    basis: "Decision-and-move chaining — passing quality coupled with footwork under a clock.",
  },
];

export function milestoneDrillById(drillId: string): MilestoneDrill | undefined {
  return MILESTONE_DRILLS.find((drill) => drill.id === drillId);
}

/** Drills whose construct matches any of the given training goals. */
export function drillsForGoals(goals: readonly TrainingGoal[]): MilestoneDrill[] {
  return MILESTONE_DRILLS.filter((drill) => goals.includes(drill.goal));
}

/**
 * Current best per drill: the attempt that beats all others for that drill
 * (highest for higher-is-better, lowest for timed drills). Attempts are
 * kept in full history; this lookup only picks the best per drill.
 */
export function currentBests(
  personalBests: readonly PersonalBest[],
): Record<string, PersonalBest> {
  const best: Record<string, PersonalBest> = {};
  for (const attempt of personalBests) {
    const drill = milestoneDrillById(attempt.drillId);
    const incumbent = best[attempt.drillId];
    if (incumbent === undefined) {
      best[attempt.drillId] = attempt;
      continue;
    }
    const better =
      drill?.higherIsBetter === false
        ? attempt.value < incumbent.value
        : attempt.value > incumbent.value;
    if (better) best[attempt.drillId] = attempt;
  }
  return best;
}
