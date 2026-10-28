/**
 * VIKAI — Curated season training programs (Phase 11).
 *
 * The hardcoded regimen becomes the FIRST of several curated, code-owned
 * season programs the athlete can pick on the My Plan screen:
 *
 * 1. `early-season-speed-power` — the existing Fall 2026 regimen (basePlan +
 *    fall2026 detail overlay), unchanged in content, now named and
 *    selectable. It stays the DEFAULT so existing installs render exactly
 *    what they always have.
 * 2. `in-season-game-day` — the fatigue-managed season week: skill + shooting
 *    sessions Monday/Wednesday/Thursday mornings before school (the court
 *    blocks ARE that standing session's content), team practices Tue/Wed/Thu
 *    with legs saved and upper-only micro-lifting, one consolidated HIGH-CNS
 *    power day (Monday), a near-rest Friday before Saturday games, and a
 *    full-reset Sunday.
 *
 * ARCHITECTURE (AGENTS.md): this module NEVER computes restrictions — the
 * engine produces TrainingRestrictions and the generator maps them onto
 * whatever plan exists. Everything here is pure plan-domain data and pure
 * selectors (no storage, no clocks).
 */

import type {
  ActivityLog,
  BuiltPlan,
  ScheduledEvent,
  TrainingComponent,
  TrainingGoal,
} from "../types";
import {
  FALL_2026_PHASES,
  FALL_COMPONENT_DETAILS,
  resolveDetailEntry,
  weekdayOf,
  type ComponentDetail,
  type SeasonPhase,
} from "./fall2026";
import {
  DEFAULT_BASE_PLAN,
  defaultPlanFocusLabel,
  defaultPlanForDate,
} from "./basePlan";
import { activePlanForDay } from "./planBuilder";
import { sessionTypesForDate, shapeForScheduledEvents } from "./weekStructure";

export interface TrainingProgram {
  id: string;
  emoji: string;
  label: string;
  /** Athlete-facing description: what it trains and when to use it. */
  blurb: string;
  /** One line on the training principles it leans on (like personas.basis). */
  basis: string;
  primaryGoals: TrainingGoal[];
  /** The program's union catalog of blocks (its day templates select from these). */
  components: readonly TrainingComponent[];
  /**
   * Weekday-keyed day templates (0 Sun … 6 Sat) for template-shaped programs.
   * Each list is the day's blocks in AUTHORED session order — the court →
   * weight-room flow is deliberate and is never re-sorted. Role-shaped
   * programs (the default) leave this undefined and use the shared
   * week-structure roles instead.
   */
  dayTemplates?: Readonly<Record<number, readonly string[]>>;
  /**
   * Weekdays whose skill blocks ARE the athlete's standing skill + shooting
   * session (the in-season program's before-school court slot). On these days
   * a scheduled or logged skill session does NOT strip the court block — the
   * block is that session's plan. On any other weekday a skill session makes
   * the plan's own skill blocks step aside (no duplicate volume).
   */
  skillSlotWeekdays?: ReadonlyArray<number>;
  /** Weekday-keyed focus labels for the calendar's "Planned:" rows. */
  dayFocusLabels?: Readonly<Record<number, string>>;
  /** Weekday-keyed AM/PM structure line shown on the session screen's day card. */
  dayNotes?: Readonly<Record<number, string>>;
  phases: ReadonlyArray<SeasonPhase>;
  details: ReadonlyArray<ComponentDetail>;
  /** Informational fuel targets shown on the program card (non-clinical). */
  fuelNote?: string;
}

/* ─────────────────── Program 1 — the existing regimen ─────────────────── */

const EARLY_SEASON_SPEED_POWER: TrainingProgram = {
  id: "early-season-speed-power",
  emoji: "⚡",
  label: "Speed, Power & Explosiveness",
  blurb:
    "The early-season conditioning build: first-step speed, jumping power, and full-body strength on a high/low week that saves your legs for practice.",
  basis:
    "Charlie Francis high/low sequencing — speed and power on fresh days, extensive tempo in between, legs saved on practice nights.",
  primaryGoals: ["STRENGTH", "EXPLOSIVENESS", "CHANGE_OF_DIRECTION"],
  components: DEFAULT_BASE_PLAN,
  phases: FALL_2026_PHASES,
  details: FALL_COMPONENT_DETAILS,
};

/* ─────────────── Program 2 — the in-season game-day week ──────────────── */

/**
 * The in-season catalog. Existing component ids so block titles, the
 * generator's region/sore mapping, and the adherence exemptions all work
 * unchanged. Volumes are the in-season doses (smaller than the default
 * template's); cod-drills / accessory-core / explosive-upper-power are
 * intentionally absent — games and practices carry change of direction, and
 * Wednesday's court block carries the med-ball power dose.
 */
const IN_SEASON_COMPONENTS: readonly TrainingComponent[] = [
  {
    id: "skill-ballhandling",
    type: "EXPLOSIVENESS",
    stress: "LOW",
    priority: 4,
    baseVolume: 3,
    optional: false,
    bodyRegion: "FULL",
    estimatedMinutes: 22,
  },
  {
    id: "acceleration-sprints",
    type: "SPEED",
    stress: "HIGH",
    priority: 2,
    baseVolume: 3,
    minimumVolume: 1,
    optional: false,
    bodyRegion: "FULL",
    estimatedMinutes: 6,
    muscleGroups: ["QUAD", "HAMSTRING", "CALF", "ANKLE", "FOOT"],
  },
  {
    id: "explosive-jumps",
    type: "EXPLOSIVENESS",
    stress: "HIGH",
    priority: 2,
    baseVolume: 2,
    minimumVolume: 1,
    optional: false,
    bodyRegion: "LOWER",
    estimatedMinutes: 5,
    muscleGroups: ["QUAD", "CALF", "ANKLE"],
  },
  {
    id: "primary-lower-squat",
    type: "STRENGTH",
    stress: "HIGH",
    priority: 1,
    baseVolume: 3,
    minimumVolume: 2,
    optional: false,
    bodyRegion: "LOWER",
    estimatedMinutes: 10,
    muscleGroups: ["QUAD"],
  },
  {
    id: "primary-upper-push",
    type: "STRENGTH",
    stress: "HIGH",
    priority: 1,
    baseVolume: 3,
    minimumVolume: 2,
    optional: false,
    bodyRegion: "UPPER",
    estimatedMinutes: 10,
    muscleGroups: ["ARM", "SHOULDER"],
  },
  {
    id: "accessory-upper",
    type: "STRENGTH",
    stress: "LOW",
    priority: 5,
    baseVolume: 2,
    optional: false,
    bodyRegion: "UPPER",
    estimatedMinutes: 8,
    muscleGroups: ["ARM", "SHOULDER"],
  },
  {
    id: "mobility-recovery",
    type: "RECOVERY",
    stress: "RECOVERY",
    priority: 6,
    baseVolume: 1,
    optional: false,
    bodyRegion: "FULL",
    estimatedMinutes: 15,
  },
];

const IN_SEASON_PHASES: ReadonlyArray<SeasonPhase> = [
  {
    id: "game-season",
    label: "Game season",
    startsOn: "2026-10-15",
    endsOn: "2026-11-30",
    focus:
      "Games on Saturdays. Keep the pop, trim the volume, and arrive fresh — one hard morning, easy evenings.",
    note: "Skill + shooting sessions run Monday, Wednesday & Thursday mornings before school. Legs are saved for the Tue/Wed/Thu practices.",
  },
  {
    id: "tryout-approach",
    label: "Tryout approach",
    startsOn: "2026-12-01",
    endsOn: "2026-12-31",
    focus:
      "Sharpen while shedding fatigue — the tryout-week countdown lives in the note.",
    note:
      "Tryout countdown (days out): 14–7 — cut lifting volume by half and shooting volume by about 40%, keep every rep at max speed. 5 — 20-minute skill primer only, no lifting. 3 — 15-minute neural primer: 3 short sprints, 15 swish-only spot-ups, 10 pressure free throws, plus evening holds. 2 — mobility and visualization only. 1 — full shutdown, early night. Tryout day — arrive fresh, fast carbs about 2 hours before. Principles: be the loudest communicator in the gym; land on two feet in traffic; take efficient 1-dribble pull-ups instead of wasting dribbles.",
  },
];

/**
 * The in-season week, authored in session order. Monday/Wednesday/Thursday
 * lead with the court block — that is the athlete's before-school skill +
 * shooting session (skillSlotWeekdays), so a scheduled or logged session
 * never strips it. Tuesday keeps no court work (the suggested plan rests the
 * morning); Friday offloads completely before Saturday games.
 */
const IN_SEASON_DAY_TEMPLATES: Readonly<Record<number, readonly string[]>> = {
  0: ["mobility-recovery"],
  1: [
    "skill-ballhandling",
    "acceleration-sprints",
    "explosive-jumps",
    "primary-lower-squat",
    "primary-upper-push",
    "mobility-recovery",
  ],
  2: ["primary-upper-push", "mobility-recovery"],
  3: ["skill-ballhandling", "mobility-recovery"],
  4: ["skill-ballhandling", "accessory-upper", "mobility-recovery"],
  5: ["mobility-recovery"],
  6: ["skill-ballhandling", "mobility-recovery"],
};

const IN_SEASON_FOCUS_LABELS: Readonly<Record<number, string>> = {
  0: "Recovery & film",
  1: "Skill AM + power + tempo",
  2: "Practice + upper primer",
  3: "Skill AM + practice + holds",
  4: "Skill AM + practice",
  5: "Recovery & prime",
  6: "Game day — perform",
};

const IN_SEASON_DAY_NOTES: Readonly<Record<number, string>> = {
  0: "Full reset — mobility, film, early night.",
  1: "Morning before school: skill + shooting session on the court, then the weight room. PM: tempo + holds.",
  2: "REST this morning. Light bench primer before practice — legs are saved for the evening.",
  3: "Morning session stays zero-impact (sore-knee care). Practice in the evening; holds + foam roll after.",
  4: "Morning skill + shooting session, then a light upper lift before practice.",
  5: "Offload day — loosen up, hold, and get to bed early.",
  6: "Game day — perform.",
};

/* Shared technique step lists for the in-season program. */
const ST = {
  differentialForm: [
    "Start under the rim and shoot in short sets of makes.",
    "Change the foot base every rep: narrow, wide, left foot forward, right foot forward.",
    "No two reps identical — the variety is what transfers to games.",
  ],
  decelCatch: [
    "Drive two hard dribbles toward the wing or elbow.",
    "Plant on two feet aggressively — chest over the knees, quiet feet.",
    "Come up into the shot off varying jump heights: full, three-quarters, and nearly no jump.",
  ],
  separationPullUps: [
    "Attack the defender's hip with one punch-drag or step-back dribble.",
    "Create the pocket of space and rise straight into the jumper.",
    "Alternate releases: high-arc one rep, flat-arc the next.",
  ],
  paintStops: [
    "Drive hard into the paint like a help defender is waiting.",
    "Stop on two feet — stride stop or jump stop — and absorb the contact.",
    "Finish with floaters: one-foot, two-foot, high off the glass, and swish-only sets.",
  ],
  differentialFreeThrows: [
    "Vary the routine each rep: bounce pace, breath count, stance width.",
    "Reset fully between reps — this is pressure practice, not volume.",
    "String three makes together before you move on.",
  ],
  bandBursts: [
    "Set up with a partner or anchor holding a heavy band at your waist.",
    "Lean into the tension and explode into two maximum-intensity steps — the first step owns the floor.",
    "Take the full rest (about a minute): every rep is max quality or it doesn't count.",
  ],
  depthJump: [
    "Stand on a 6–12 inch box, then step off and hit the floor briefly.",
    "Explode straight up into a maximum-height vertical the instant you land.",
    "Land soft, reset fully, and step down off the box — never jump down.",
  ],
  trapBar: [
    "Set up inside the frame, grip the handles at hip width, spine long.",
    "Drive the floor away — hips and shoulders rise together.",
    "Move the bar fast on the way up; set it down under control and reset your breath.",
  ],
  dbBench: [
    "Lie back with dumbbells over the chest, wrists stacked over the elbows.",
    "Lower both bells under control until the elbows reach chest level.",
    "Press up explosively — the speed is the point; lock out without shrugging.",
  ],
  tempo: [
    "Run 100 meters at a relaxed 60–65% effort — a pace you could talk at.",
    "Walk back to the start as the rest.",
    "Stay loose: relaxed jaw and hands are what build speed, not tension.",
  ],
  wallSit: [
    "Slide down a wall until the knees sit at 90 degrees.",
    "Keep the whole back on the wall and breathe steadily.",
    "Hold the time — the burn is the point.",
  ],
  primerBench: [
    "Use a light weight — this is a nervous-system primer before practice.",
    "Three crisp sets of five, moving the bells fast.",
    "Done in minutes — save every ounce of energy for practice.",
  ],
  loosenUp: [
    "Easy dynamic work: leg swings, hip openers, ankle rocks.",
    "A few slow bodyweight squats to wake the legs up.",
    "Finish feeling loose — practice provides the work today.",
  ],
  seatedChestPass: [
    "Sit on the floor with the legs out comfortably, med ball at the chest.",
    "Snap the ball into the wall with straight arms.",
    "Catch and repeat — fast hands, seated so the knees do nothing.",
  ],
  pocketDip: [
    "Catch and shoot from a low dip, a waist dip, and a high chest catch.",
    "Keep the jump minimal — this is touch and repeatability, not height.",
    "Count makes out loud; same smooth release every time.",
  ],
  constraintShooting: [
    "Shoot from five spots around the arc.",
    "Alternate reps: non-dominant eye closed, then wide vision.",
    "Alternate wide and narrow bases — each constraint teaches something different.",
  ],
  scanPasses: [
    "Face a wall with two marked targets.",
    "Rapid chest and bounce passes while calling the targets out loud.",
    "Eyes drive the hands — scan first, pass second.",
  ],
  cognitiveFreeThrows: [
    "Start counting down aloud: 50, 47, 44…",
    "Keep the shooting routine smooth while the brain works.",
    "The distraction builds focus that holds up in games.",
  ],
  distanceLadder: [
    "Jump randomly between 4 feet, 10 feet, 16 feet, and the 3-point line.",
    "No two consecutive shots from the same spot.",
    "Same smooth shot at every distance — legs to fingers.",
  ],
  oneDribblePullUps: [
    "One hard dribble sideways or back to create the pocket of space.",
    "Explode into the jumper before the defender recovers.",
    "Alternate quick-release and high-arc finishes.",
  ],
  stepBackFootwork: [
    "Chain step-backs and side-steps out of the drive.",
    "Land with different base widths to force hip stabilization.",
    "Every make starts from clean, balanced footwork.",
  ],
  pressureFreeThrows: [
    "Do a short movement burst first so the heart rate is up.",
    "Step to the line and shoot with a settled routine.",
    "On a miss, add a 5-second stretch before the next ball.",
  ],
  dbRow: [
    "One hand and one knee on a bench, back flat.",
    "Pull the bell to the hip, driving the elbow back.",
    "Fast and crisp — a primer, not a grind; lower under control.",
  ],
  foamRoll: [
    "Foam roll the quads and calves for about a minute each.",
    "Pause and breathe on the tightest spots — never roll sharp.",
    "Finish feeling loose and ready for tomorrow.",
  ],
  lightMobility: [
    "Easy dynamic work — leg swings, hip openers, ankle rocks.",
    "Nothing heavy the day before a game.",
    "Finish with a few easy shots to picture tomorrow's looks.",
  ],
  gameWarmUp: [
    "Raise the pulse with easy movement, then dynamic stretches.",
    "Activate: a few pogos, squats, and short accelerations.",
    "Finish with a handful of game-speed shots from tonight's spots.",
  ],
  recoveryFlow: [
    "Foam roll the quads and calves for about a minute each.",
    "Move through a slow full-body stretch flow, breathing into every position.",
    "Finish feeling loose, not exhausted.",
  ],
  filmReview: [
    "Watch the weekend's game or practice film.",
    "Note two things that worked — keep doing them.",
    "Pick one thing to fix and picture the corrected rep in your head.",
  ],
} as const;

/**
 * The in-season exercise detail: every (weekday, componentId) pair in the
 * day templates resolves, with plan-wide fallbacks beneath. Video links are
 * only attached where the existing curated DEMO library has a confident,
 * specific match — steps are the guaranteed offline layer everywhere.
 */
const IN_SEASON_DETAILS: ReadonlyArray<ComponentDetail> = [
  /* ── Monday — skill (the before-school session) + power day ── */
  {
    componentId: "skill-ballhandling",
    weekdays: [1],
    note: "This is your before-school skill + shooting session — the court block IS the session.",
    exercises: [
      { name: "Differential Form Warm-Up", prescription: "12 makes", cue: "Vary the base every rep — narrow, wide, staggered.", steps: ST.differentialForm, videoUrl: "https://www.youtube.com/watch?v=8JkyBpL0sNY" },
      { name: "Deceleration → Catch & Shoot", prescription: "5 min", cue: "Hard drive, aggressive 2-foot plant, then rise.", steps: ST.decelCatch, videoUrl: "https://www.youtube.com/watch?v=8JkyBpL0sNY" },
      { name: "Separation Pull-Ups", prescription: "8 makes", cue: "One dribble to create space; alternate high and flat arcs.", steps: ST.separationPullUps, videoUrl: "https://www.youtube.com/watch?v=8JkyBpL0sNY" },
      { name: "Paint Stops & Floaters", prescription: "8 makes", cue: "Land on two feet to absorb contact, then finish soft.", steps: ST.paintStops, videoUrl: "https://www.youtube.com/watch?v=8JkyBpL0sNY" },
      { name: "Differential Free Throws", prescription: "10 throws", cue: "Three makes in a row; never the same routine twice.", steps: ST.differentialFreeThrows, videoUrl: "https://www.youtube.com/watch?v=8JkyBpL0sNY" },
    ],
  },
  {
    componentId: "acceleration-sprints",
    weekdays: [1],
    exercises: [
      { name: "Band-Resisted First-Step Bursts", prescription: "3 × 2 per side", cue: "Two max steps against the band; drive off the big toe.", steps: ST.bandBursts, videoUrl: "https://www.youtube.com/watch?v=0E5wK8dbj4k" },
    ],
  },
  {
    componentId: "explosive-jumps",
    weekdays: [1],
    exercises: [
      { name: "Low-Box Depth Jump to Vertical", prescription: "2 × 2", cue: "Off the box, instant vertical — minimal ground time.", steps: ST.depthJump, videoUrl: "https://www.youtube.com/watch?v=52r2wDfnC3o" },
    ],
  },
  {
    componentId: "primary-lower-squat",
    weekdays: [1],
    exercises: [
      { name: "Trap Bar Deadlift", prescription: "3 × 3", cue: "Heavy but fast: controlled down, explosive up.", steps: ST.trapBar, videoUrl: "https://www.youtube.com/watch?v=op9kVnSso6Q" },
    ],
  },
  {
    componentId: "primary-upper-push",
    weekdays: [1],
    exercises: [
      { name: "Dumbbell Bench Press", prescription: "3 × 5", cue: "Explosive off the chest; tight, fast path.", steps: ST.dbBench, videoUrl: "https://www.youtube.com/watch?v=VmB1G1K7v94" },
    ],
  },
  {
    componentId: "mobility-recovery",
    weekdays: [1],
    note: "PM: the tempo flushes the day; the holds look after the knees.",
    exercises: [
      { name: "Extensive Grass Tempo", prescription: "8 × 100m at 60–65%", cue: "Relaxed breathing, walk-back rest.", steps: ST.tempo },
      { name: "Wall-Sit Isometric Holds", prescription: "3 × 45s", cue: "Eases sore knees, builds lasting strength.", steps: ST.wallSit, videoUrl: "https://www.youtube.com/watch?v=-M4-G8p8fmc" },
    ],
  },

  /* ── Tuesday — practice prep ── */
  {
    componentId: "primary-upper-push",
    weekdays: [2],
    note: "Pre-practice micro-lift — prime, don't drain.",
    exercises: [
      { name: "Pre-Practice Micro-Lift: Dumbbell Bench Press", prescription: "3 × 5 (light, fast)", cue: "Light weight, maximum bar speed.", steps: ST.primerBench, videoUrl: "https://www.youtube.com/watch?v=VmB1G1K7v94" },
    ],
  },
  {
    componentId: "mobility-recovery",
    weekdays: [2],
    exercises: [
      { name: "Pre-Practice Loosen-Up", prescription: "5 min", cue: "Get warm, not tired.", steps: ST.loosenUp },
    ],
  },

  /* ── Wednesday — zero-impact skill + practice ── */
  {
    componentId: "skill-ballhandling",
    weekdays: [3],
    note: "Zero-impact morning: the knees get a break while the touch and vision work.",
    exercises: [
      { name: "Seated Med Ball Chest Passes", prescription: "3 × 4", cue: "Zero knee strain — explosive upper-body push.", steps: ST.seatedChestPass },
      { name: "Variable Pocket-Dip & Shoot", prescription: "12 makes", cue: "Vary where the ball dips before the shot.", steps: ST.pocketDip, videoUrl: "https://www.youtube.com/watch?v=8JkyBpL0sNY" },
      { name: "Constraint Catch-and-Shoot", prescription: "30 shots", cue: "Alternate the constraints: one eye, wide vision, wide base.", steps: ST.constraintShooting, videoUrl: "https://www.youtube.com/watch?v=8JkyBpL0sNY" },
      { name: "Visual Scan Wall Passes", prescription: "3 × 20 sec", cue: "Pass while calling out what you see.", steps: ST.scanPasses },
      { name: "Cognitive Free Throws", prescription: "10 throws", cue: "Count down aloud from 50 by 3s while you shoot.", steps: ST.cognitiveFreeThrows, videoUrl: "https://www.youtube.com/watch?v=8JkyBpL0sNY" },
    ],
  },
  {
    componentId: "mobility-recovery",
    weekdays: [3],
    note: "Evening reset after practice — low-load holds, then roll out.",
    exercises: [
      { name: "Evening Wall-Sit Holds", prescription: "3 × 45s", cue: "Low-load holds after practice — easy on the knees.", steps: ST.wallSit, videoUrl: "https://www.youtube.com/watch?v=-M4-G8p8fmc" },
      { name: "Quad & Calf Foam Roll", prescription: "5 min", cue: "Slow rolls, breathe through the tight spots.", steps: ST.foamRoll, videoUrl: "https://www.youtube.com/watch?v=4BOTvaRaDjI" },
    ],
  },

  /* ── Thursday — skill + upper primer + practice ── */
  {
    componentId: "skill-ballhandling",
    weekdays: [4],
    note: "Morning skill + shooting session — separation and footwork quality.",
    exercises: [
      { name: "Unpredictable Distance Ladder", prescription: "12 makes", cue: "No two shots from the same spot in a row.", steps: ST.distanceLadder, videoUrl: "https://www.youtube.com/watch?v=8JkyBpL0sNY" },
      { name: "1-Dribble Separation Pull-Ups", prescription: "8 makes", cue: "One hard dribble to create space, then explode up.", steps: ST.oneDribblePullUps, videoUrl: "https://www.youtube.com/watch?v=8JkyBpL0sNY" },
      { name: "Step-Back & Counter Footwork", prescription: "8 makes", cue: "Vary the base width on every landing.", steps: ST.stepBackFootwork, videoUrl: "https://www.youtube.com/watch?v=8JkyBpL0sNY" },
      { name: "Pressure Free Throws", prescription: "10 throws", cue: "Shoot with the heart rate up.", steps: ST.pressureFreeThrows, videoUrl: "https://www.youtube.com/watch?v=8JkyBpL0sNY" },
    ],
  },
  {
    componentId: "accessory-upper",
    weekdays: [4],
    note: "Pre-practice micro-lift — upper body only, legs are saved for practice.",
    exercises: [
      { name: "Pre-Practice Micro-Lift: Single-Arm Dumbbell Row", prescription: "2 × 5 per side", cue: "Strict torso, fast pull to the hip.", steps: ST.dbRow },
    ],
  },
  {
    componentId: "mobility-recovery",
    weekdays: [4],
    exercises: [
      { name: "Pre-Practice Loosen-Up", prescription: "5 min", cue: "Get warm, not tired.", steps: ST.loosenUp },
    ],
  },

  /* ── Friday — offload ── */
  {
    componentId: "mobility-recovery",
    weekdays: [5],
    note: "Complete offload before the game — loosen, hold, sleep early.",
    exercises: [
      { name: "Light Dynamic Mobility", prescription: "15 min", cue: "Nothing heavy the day before a game.", steps: ST.lightMobility },
      { name: "Wall-Sit Isometric Holds", prescription: "3 × 45s", cue: "Unwind the week; early night.", steps: ST.wallSit, videoUrl: "https://www.youtube.com/watch?v=-M4-G8p8fmc" },
    ],
  },

  /* ── Saturday — game day ── */
  {
    componentId: "skill-ballhandling",
    weekdays: [6],
    note: "Game day — perform: scan the floor, create space with clean pull-ups, land on two feet in the paint.",
    exercises: [],
  },
  {
    componentId: "mobility-recovery",
    weekdays: [6],
    exercises: [
      { name: "Game-Day Warm-Up Flow", prescription: "15 min", cue: "Raise, activate, and get bouncy before tip.", steps: ST.gameWarmUp },
    ],
  },

  /* ── Sunday — reset ── */
  {
    componentId: "mobility-recovery",
    weekdays: [0],
    note: "Full reset: flush the weekend, watch the film, sleep long.",
    exercises: [
      { name: "Full-Body Recovery Flow", prescription: "20 min", cue: "Slow, breathing into every position.", steps: ST.recoveryFlow, videoUrl: "https://www.youtube.com/watch?v=4BOTvaRaDjI" },
      { name: "Film Review", prescription: "20 min", cue: "Two things to keep, one to fix from the game.", steps: ST.filmReview },
    ],
  },

  /* ── Plan-wide fallbacks (never a blank day) ── */
  {
    componentId: "skill-ballhandling",
    note: "The before-school skill + shooting session.",
    exercises: [
      { name: "Differential Form Warm-Up", prescription: "12 makes", cue: "Vary the base every rep.", steps: ST.differentialForm, videoUrl: "https://www.youtube.com/watch?v=8JkyBpL0sNY" },
      { name: "Separation Pull-Ups", prescription: "8 makes", cue: "One dribble to create space.", steps: ST.separationPullUps, videoUrl: "https://www.youtube.com/watch?v=8JkyBpL0sNY" },
    ],
  },
  {
    componentId: "acceleration-sprints",
    exercises: [
      { name: "Band-Resisted First-Step Bursts", prescription: "3 × 2 per side", cue: "Two max steps against the band.", steps: ST.bandBursts, videoUrl: "https://www.youtube.com/watch?v=0E5wK8dbj4k" },
    ],
  },
  {
    componentId: "explosive-jumps",
    exercises: [
      { name: "Low-Box Depth Jump to Vertical", prescription: "2 × 2", cue: "Off the box, instant vertical.", steps: ST.depthJump, videoUrl: "https://www.youtube.com/watch?v=52r2wDfnC3o" },
    ],
  },
  {
    componentId: "primary-lower-squat",
    exercises: [
      { name: "Trap Bar Deadlift", prescription: "3 × 3", cue: "Heavy but fast.", steps: ST.trapBar, videoUrl: "https://www.youtube.com/watch?v=op9kVnSso6Q" },
    ],
  },
  {
    componentId: "primary-upper-push",
    exercises: [
      { name: "Dumbbell Bench Press", prescription: "3 × 5", cue: "Explosive off the chest.", steps: ST.dbBench, videoUrl: "https://www.youtube.com/watch?v=VmB1G1K7v94" },
    ],
  },
  {
    componentId: "accessory-upper",
    exercises: [
      { name: "Single-Arm Dumbbell Row", prescription: "2 × 5 per side", cue: "Strict torso, fast pull to the hip.", steps: ST.dbRow },
    ],
  },
  {
    componentId: "mobility-recovery",
    exercises: [
      { name: "Light Dynamic Mobility", prescription: "15 min", cue: "Loosen up — nothing heavy.", steps: ST.lightMobility },
      { name: "Wall-Sit Isometric Holds", prescription: "3 × 45s", cue: "Eases sore knees, builds lasting strength.", steps: ST.wallSit, videoUrl: "https://www.youtube.com/watch?v=-M4-G8p8fmc" },
    ],
  },
];

const IN_SEASON_GAME_DAY: TrainingProgram = {
  id: "in-season-game-day",
  emoji: "🏀",
  label: "In-Season Game Day",
  blurb:
    "Built for the season: skill + shooting sessions Monday/Wednesday/Thursday mornings before school, legs saved on practice nights, one hard power day, a near-rest Friday, and a full Sunday reset.",
  basis:
    "High/low CNS sequencing (one consolidated hard day), short rate-of-force micro-lifting, differential shooting for game transfer, and zero lower-body lifting on practice nights.",
  primaryGoals: ["ACCELERATION", "EXPLOSIVENESS", "STRENGTH"],
  components: IN_SEASON_COMPONENTS,
  dayTemplates: IN_SEASON_DAY_TEMPLATES,
  skillSlotWeekdays: [1, 3, 4],
  dayFocusLabels: IN_SEASON_FOCUS_LABELS,
  dayNotes: IN_SEASON_DAY_NOTES,
  phases: IN_SEASON_PHASES,
  details: IN_SEASON_DETAILS,
  fuelNote:
    "Fuel targets for a 140 lb frame: about 3,100–3,300 kcal/day · protein 140–150 g · carbs 400 g+ (rice, oats, potatoes, pasta, bananas). Refuel with carbs + protein after practices and games.",
};

/* ─────────────────────────── The registry ─────────────────────────────── */

/**
 * All curated programs, in selection order. The FIRST entry is the default
 * (null `activeProgramId` resolves here), preserving today's behavior for
 * existing installs.
 */
export const TRAINING_PROGRAMS: ReadonlyArray<TrainingProgram> = [
  EARLY_SEASON_SPEED_POWER,
  IN_SEASON_GAME_DAY,
];

/** The program a null/unknown selection resolves to (the existing regimen). */
export const DEFAULT_PROGRAM: TrainingProgram = TRAINING_PROGRAMS[0] ?? EARLY_SEASON_SPEED_POWER;

/** Resolves a stored program id; null/unknown ⇒ the default program. */
export function programById(id: string | null | undefined): TrainingProgram {
  if (id === null || id === undefined) return DEFAULT_PROGRAM;
  return TRAINING_PROGRAMS.find((program) => program.id === id) ?? DEFAULT_PROGRAM;
}

/* ─────────────────────────── Pure selectors ───────────────────────────── */

/** The day's base components for a program (authored order for templates). */
export function programPlanForDate(
  program: TrainingProgram,
  localDate: string,
): readonly TrainingComponent[] {
  if (program.dayTemplates === undefined) return defaultPlanForDate(localDate);
  const ids = program.dayTemplates[weekdayOf(localDate)] ?? [];
  return ids.flatMap((id) => {
    const component = program.components.find((entry) => entry.id === id);
    return component !== undefined ? [component] : [];
  });
}

/** The day's one-line focus label (calendar "Planned:" rows). */
export function programFocusLabel(program: TrainingProgram, localDate: string): string {
  if (program.dayFocusLabels === undefined) return defaultPlanFocusLabel(localDate);
  return program.dayFocusLabels[weekdayOf(localDate)] ?? "Training day";
}

/** The program's active phase for a local date, or undefined outside the window. */
export function programPhaseFor(program: TrainingProgram, localDate: string): SeasonPhase | undefined {
  return program.phases.find((phase) => phase.startsOn <= localDate && localDate <= phase.endsOn);
}

/** The program's exercise detail for a component on a date (weekday → phase → default). */
export function programExerciseDetail(
  program: TrainingProgram,
  componentId: string,
  localDate: string,
): ComponentDetail | undefined {
  return resolveDetailEntry(
    program.details,
    componentId,
    programPhaseFor(program, localDate),
    weekdayOf(localDate),
  );
}

/** Everything `resolveDayPlan` needs to shape a day around the real schedule. */
export interface DayPlanContext {
  scheduledEvents: readonly ScheduledEvent[];
  activityLogs: readonly ActivityLog[];
  timezone: string;
}

/**
 * The day's effective plan, the single entry point every screen uses:
 * a built plan wins when one is active; otherwise the selected program —
 * then the schedule shapes the result (dynamic practice protection and
 * skill-session yielding; slot weekdays keep their court block).
 * Pure and deterministic.
 */
export function resolveDayPlan(
  programId: string | null | undefined,
  activePlan: BuiltPlan | null,
  localDate: string,
  context: DayPlanContext,
): readonly TrainingComponent[] {
  const builtPlanShaped = activePlan !== null;
  const program = programById(programId);
  const base =
    activePlan !== null ? activePlanForDay(activePlan, localDate) : programPlanForDate(program, localDate);
  const sessionTypes = sessionTypesForDate(
    context.scheduledEvents,
    context.activityLogs,
    localDate,
    context.timezone,
  );
  const slotWeekday = program.skillSlotWeekdays?.includes(weekdayOf(localDate)) ?? false;
  return shapeForScheduledEvents(base, sessionTypes, builtPlanShaped ? false : slotWeekday);
}
