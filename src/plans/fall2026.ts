/**
 * VIKAI — Fall 2026 Training Plan (exercise detail library).
 *
 * Pure data + lookups encoding the athlete's September–December 2026 plan:
 * three season phases, weekday-structured day templates, and per-exercise
 * technique steps with curated demo-video links.
 *
 * ARCHITECTURE (AGENTS.md): this module NEVER decides what an athlete does —
 * the engine computes restrictions and the generator scales the base plan.
 * This is a detail overlay: given a base-plan component and a date, it
 * returns the exercises, prescriptions, cues, and guidance that block is
 * made of today.
 */

/* ───────────────────────────── Season phases ──────────────────────────── */

export interface SeasonPhase {
  id: string;
  label: string;
  /** Inclusive local-date bounds, YYYY-MM-DD (string-comparable). */
  startsOn: string;
  endsOn: string;
  focus: string;
  note?: string;
}

export const FALL_2026_PHASES: ReadonlyArray<SeasonPhase> = [
  {
    id: "pre-season",
    label: "Pre-season baseline",
    startsOn: "2026-08-24",
    endsOn: "2026-09-07",
    focus:
      "Build lasting strength, clean two-foot footwork, and a full fuel tank before school ball starts.",
  },
  {
    id: "in-season",
    label: "Team practice integration",
    startsOn: "2026-09-08",
    endsOn: "2026-10-14",
    focus:
      "School plus Tuesday, Wednesday & Thursday team practices. Legs are saved for practice — lifting on those days stays up top.",
    note: "Practice nights: Tuesday, Wednesday & Thursday.",
  },
  {
    id: "competition",
    label: "Game competition",
    startsOn: "2026-10-15",
    endsOn: "2026-12-31",
    focus:
      "Games on Saturdays. Keep the intensity, trim the extra volume, and arrive fresh.",
    note:
      "Tryout week protocol: 7 days out — gym volume way down; 3 days out — sprints and game shots only; 1 day out — full rest.",
  },
];

/** The active Fall 2026 phase for a local date, or undefined outside the window. */
export function seasonPhaseFor(localDate: string): SeasonPhase | undefined {
  return FALL_2026_PHASES.find((phase) => phase.startsOn <= localDate && localDate <= phase.endsOn);
}

/** 0 = Sunday … 6 = Saturday, computed purely from a YYYY-MM-DD key. */
export function weekdayOf(localDate: string): number {
  const parts = localDate.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1)).getUTCDay();
}

/* ─────────────────────── Exercise detail entries ──────────────────────── */

export interface ExerciseDetail {
  name: string;
  /** e.g. "3 × 5 (heavy, explosive up)". */
  prescription: string;
  /** One-line technique cue, plain language. */
  cue?: string;
  /**
   * Phase 9.10 — numbered technique steps (setup → execution → key point).
   * The offline guidance layer: every exercise carries steps, so the app
   * teaches the movement with no network at all.
   */
  steps?: ReadonlyArray<string>;
  /**
   * A curated, SPECIFIC demonstration video (youtube.com/watch?v=…).
   * Online-only supplement — the UI labels it "Needs internet". Search-page
   * links are banned (guardrail test enforces it).
   */
  videoUrl?: string;
}

export interface ComponentDetail {
  componentId: string;
  /** Matches a phase id; undefined = applies in every phase. */
  phaseId?: string;
  /** Weekday numbers (0 Sun … 6 Sat); undefined = every day. */
  weekdays?: ReadonlyArray<number>;
  exercises: ReadonlyArray<ExerciseDetail>;
  note?: string;
}

/**
 * CURATED DRAFT — open each link once and confirm it plays the intended
 * demonstration from an appropriate channel before release; swapping a
 * video is a one-string edit here. Search-page links are forbidden: these
 * must be specific videos, and they are an ONLINE-ONLY supplement to the
 * offline `steps` layer.
 */
const DEMO = {
  trapBarDeadlift: "https://www.youtube.com/watch?v=op9kVnSso6Q",
  gobletFrontSquat: "https://www.youtube.com/watch?v=ultWZbUMPL8",
  dumbbellRdl: "https://www.youtube.com/watch?v=op9kVnSso6Q",
  calfRaise: "https://www.youtube.com/watch?v=-M4-G8p8fmc",
  dumbbellBench: "https://www.youtube.com/watch?v=VmB1G1K7v94",
  overheadPress: "https://www.youtube.com/watch?v=2yjwXTZQDDI",
  pullUp: "https://www.youtube.com/watch?v=eGo4IYlbE5g",
  invertedRow: "https://www.youtube.com/watch?v=tgBwKqL1DxM",
  pallofPress: "https://www.youtube.com/watch?v=GsomsThUxMo",
  cableCoreRotation: "https://www.youtube.com/watch?v=GsomsThUxMo",
  boxJump: "https://www.youtube.com/watch?v=52r2wDfnC3o",
  sprintMechanics: "https://www.youtube.com/watch?v=0E5wK8dbj4k",
  proAgility: "https://www.youtube.com/watch?v=IxSgtRHjVVU",
  cutting: "https://www.youtube.com/watch?v=IxSgtRHjVVU",
  ballHandling: "https://www.youtube.com/watch?v=8JkyBpL0sNY",
  shooting: "https://www.youtube.com/watch?v=8JkyBpL0sNY",
  copenhagenPlank: "https://www.youtube.com/watch?v=IWTLtPQG2UE",
  wallSit: "https://www.youtube.com/watch?v=-M4-G8p8fmc",
  mobilityFlow: "https://www.youtube.com/watch?v=4BOTvaRaDjI",
} as const;

/** Shared step lists — the same lift teaches the same way in every phase. */
const STEPS = {
  trapBarDeadlift: [
    "Set up inside the frame, grip the handles at hip width, spine long.",
    "Drive the floor away — hips and shoulders rise together, bar glued to the legs.",
    "Finish standing tall, then set it down under control and reset your breath.",
  ],
  gobletFrontSquat: [
    "Hold one dumbbell vertically at the chest, elbows tucked underneath it.",
    "Sit straight down between the feet — chest tall, knees tracking the toes.",
    "Drive up through the whole foot without letting the elbows drift.",
  ],
  dumbbellRdl: [
    "Stand tall with dumbbells at the sides, knees softly bent.",
    "Push the hips back and slide the weights down the legs until the hamstrings load.",
    "Drive the hips forward to stand — the back stays flat the entire way.",
  ],
  calfRaise: [
    "Stand on one foot on a step, heel off the edge, hand on a wall for balance.",
    "Press up onto the ball of the foot as high as possible and pause a beat.",
    "Lower slowly until the calf stretches — that control is the rep.",
  ],
  dumbbellBench: [
    "Lie back with dumbbells over the chest, feet planted, wrists stacked over elbows.",
    "Lower both bells under control until the elbows reach chest level.",
    "Press up and slightly together — lock out without shrugging.",
  ],
  overheadPress: [
    "Stand tall, dumbbells at shoulder height, palms facing forward.",
    "Brace the abs and glutes, then press both bells until they frame the ears.",
    "Lower under control back to the shoulders — no leaning back.",
  ],
  pullUp: [
    "Hang from the bar with an overhand grip, hands just outside the shoulders.",
    "Pull the chest toward the bar — lead with the elbows, no swinging.",
    "Lower to full extension under control; reset the grip each rep.",
  ],
  invertedRow: [
    "Set a bar at hip height and hang underneath it with straight arms, body rigid.",
    "Pull the chest to the bar, squeezing the shoulder blades together.",
    "Lower under control — no sagging hips anywhere in the rep.",
  ],
  pallofPress: [
    "Stand perpendicular to the cable and hold the handle at the chest.",
    "Step out to create tension, then press the handle straight out and hold.",
    "Fight the pull toward the anchor; bring it back to the chest under control.",
  ],
  cableCoreRotation: [
    "Stand side-on to the cable with arms locked out in front.",
    "Rotate away from the anchor, pivoting the back foot — arms stay straight.",
    "Resist the twist on the way back — the core does the work, not the arms.",
  ],
  boxJump: [
    "Face a low box, feet hip-width, arms behind the body.",
    "Swing the arms and jump, landing softly on the box with quiet feet.",
    "Stand tall, then STEP down — never jump down; reset between reps.",
  ],
  sprintStart: [
    "Set up facing the direction of the run, weight ready to explode forward.",
    "Drive out low for 15 meters — big push, aggressive first steps.",
    "Walk back and take the full rest — every rep is max quality or it doesn't count.",
  ],
  flying10: [
    "Build up to a jog over 20 meters, then hit top speed through the 10-meter zone.",
    "Stay relaxed at max speed — loose jaw, calm face, quick feet.",
    "Full walk-back recovery between reps.",
  ],
  ankling: [
    "Walk on the balls of the feet with stiff ankles, toes pointed forward.",
    "Snap the foot down fast under the hips — small, quick contacts.",
    "10 meters, then walk back and reset.",
  ],
  proAgility: [
    "Straddle the middle line in a low athletic stance.",
    "Turn and sprint 5 meters, touch the line, sprint 10 meters the other way.",
    "Touch, then sprint 5 meters back through the middle — hips low on every turn.",
  ],
  cutting: [
    "Sprint 10 meters, then plant the outside foot to cut 90 degrees.",
    "Drop the hips and keep the chest over the knee on the plant.",
    "Accelerate out of the cut — no wasted steps.",
  ],
  punchDrag: [
    "Dribble at game speed toward the cone or defender.",
    "Punch the ball out wide and drag it back with the same hand.",
    "Rise into a pull-up jumper with the feet already squared.",
  ],
  twoFootFinishes: [
    "Attack the paint at game speed.",
    "Stop on two feet inside the lane — balance comes before the finish.",
    "Finish high off the glass and land soft on both feet.",
  ],
  scanningDribbling: [
    "Dribble hard in place with the eyes UP the whole time.",
    "Call out what you see — fingers, colors, coach's cues — while handling.",
    "Switch hands and dribble heights every 30 seconds.",
  ],
  spotUpShooting: [
    "Start behind the mid-range mark with the feet ready to catch.",
    "One-two footwork into a smooth shot — same groove every time.",
    "Chase the rebound and sprint to a new spot; keep counting makes.",
  ],
  copenhagenPlank: [
    "Set up in a side plank with the top foot on a bench, elbow under the shoulder.",
    "Lift the hips into one straight line and hold.",
    "Drop the bottom knee to the floor for an easier entry if the groin needs it.",
  ],
  wallSit: [
    "Slide down a wall until the knees sit at 90 degrees.",
    "Keep the whole back on the wall and breathe steadily.",
    "Hold 45 seconds — the burn is the point.",
  ],
  mobilityFlow: [
    "Foam roll the quads and calves for about a minute each.",
    "Move through a slow full-body stretch flow, breathing into every position.",
    "Finish feeling loose, not exhausted.",
  ],
  freeThrows: [
    "Same routine every time — same breath, same dip, same release.",
    "Hold the follow-through and watch the ball all the way in.",
    "Track the makes out loud; build the pressure habit gently.",
  ],
  tempo: [
    "Run 100 meters at a relaxed 60–65% effort — a pace you could talk at.",
    "Walk back to the start as the rest.",
    "Stay loose: relaxed jaw and hands are what build speed, not tension.",
  ],
  lightMobility: [
    "Easy dynamic work — leg swings, hip openers, ankle rocks.",
    "Nothing heavy the day before a game.",
    "Finish with a few easy shots to picture tomorrow's looks.",
  ],
} as const;

/**
 * The plan's exercises mapped onto the base-plan components. Specificity:
 * weekday entries win over phase entries, which win over defaults.
 */
export const FALL_COMPONENT_DETAILS: ReadonlyArray<ComponentDetail> = [
  /* ── Lower-body strength engine ── */
  {
    componentId: "primary-lower-squat",
    phaseId: "pre-season",
    weekdays: [1, 3, 5],
    note: "Low-energy day — tempo runs and skill work only. Legs stay fresh.",
    exercises: [],
  },
  {
    componentId: "primary-lower-squat",
    phaseId: "pre-season",
    weekdays: [2],
    exercises: [
      { name: "Trap Bar Deadlift", prescription: "3 × 5", cue: "High handles, flat back, stand up fast.", steps: STEPS.trapBarDeadlift, videoUrl: DEMO.trapBarDeadlift },
    ],
  },
  {
    componentId: "primary-lower-squat",
    phaseId: "pre-season",
    weekdays: [4],
    exercises: [
      { name: "Goblet Front Squat", prescription: "3 × 5", cue: "Elbows tucked, knees track over the toes.", steps: STEPS.gobletFrontSquat, videoUrl: DEMO.gobletFrontSquat },
    ],
  },
  {
    componentId: "primary-lower-squat",
    phaseId: "in-season",
    weekdays: [6],
    note: "Saturday is your primary strength day — you're 36+ hours clear of practice.",
    exercises: [
      { name: "Trap Bar Deadlift", prescription: "3 × 5", cue: "Heavy, explosive up.", steps: STEPS.trapBarDeadlift, videoUrl: DEMO.trapBarDeadlift },
      { name: "Goblet Front Squat", prescription: "3 × 5", cue: "Sit straight down, drive straight up.", steps: STEPS.gobletFrontSquat, videoUrl: DEMO.gobletFrontSquat },
      { name: "Dumbbell RDL", prescription: "3 × 8", cue: "Push the hips back, flat back.", steps: STEPS.dumbbellRdl, videoUrl: DEMO.dumbbellRdl },
      { name: "Single-Leg Calf Raises", prescription: "3 × 10 per leg", cue: "High on the toes, slow on the way down.", steps: STEPS.calfRaise, videoUrl: DEMO.calfRaise },
    ],
  },
  {
    componentId: "primary-lower-squat",
    phaseId: "in-season",
    weekdays: [2, 3, 4],
    note: "Practice night — zero lower-body lifting. Legs are saved for practice.",
    exercises: [],
  },
  {
    componentId: "primary-lower-squat",
    phaseId: "competition",
    weekdays: [2, 3],
    note: "Micro-lifting before practice — keep the weight, cut the sets.",
    exercises: [
      { name: "Trap Bar Deadlift", prescription: "2 × 4", cue: "Keep the weight, cut the sets.", steps: STEPS.trapBarDeadlift, videoUrl: DEMO.trapBarDeadlift },
    ],
  },
  {
    componentId: "primary-lower-squat",
    phaseId: "competition",
    weekdays: [4],
    note: "Micro-lifting before practice — keep the weight, cut the sets.",
    exercises: [
      { name: "Goblet Front Squat", prescription: "2 × 4", cue: "Sit straight down, drive straight up.", steps: STEPS.gobletFrontSquat, videoUrl: DEMO.gobletFrontSquat },
    ],
  },
  {
    componentId: "primary-lower-squat",
    phaseId: "competition",
    weekdays: [1, 3, 5],
    note: "Low-energy day — tempo, care work, and film. No heavy lifting.",
    exercises: [],
  },
  {
    componentId: "primary-lower-squat",
    phaseId: "competition",
    weekdays: [6],
    note: "Game day — perform: scanning, space-creation pull-ups, two-foot finishes.",
    exercises: [],
  },
  {
    componentId: "primary-lower-squat",
    exercises: [
      { name: "Trap Bar Deadlift", prescription: "3 × 5", cue: "High handles, flat back, stand up fast.", steps: STEPS.trapBarDeadlift, videoUrl: DEMO.trapBarDeadlift },
      { name: "Goblet Front Squat", prescription: "3 × 5", cue: "Elbows tucked, knees track over the toes.", steps: STEPS.gobletFrontSquat, videoUrl: DEMO.gobletFrontSquat },
      { name: "Dumbbell RDL", prescription: "3 × 8", cue: "Push the hips back, flat back.", steps: STEPS.dumbbellRdl, videoUrl: DEMO.dumbbellRdl },
    ],
  },

  /* ── Upper-body push ── */
  {
    componentId: "primary-upper-push",
    phaseId: "pre-season",
    weekdays: [2],
    exercises: [
      { name: "Dumbbell Bench Press", prescription: "3 × 6–8", cue: "Wrists over elbows, control the way down.", steps: STEPS.dumbbellBench, videoUrl: DEMO.dumbbellBench },
    ],
  },
  {
    componentId: "primary-upper-push",
    phaseId: "pre-season",
    weekdays: [4],
    exercises: [
      { name: "Overhead DB Press", prescription: "3 × 6–8", cue: "Brace the ribs — no lean-back.", steps: STEPS.overheadPress, videoUrl: DEMO.overheadPress },
    ],
  },
  {
    componentId: "primary-upper-push",
    phaseId: "in-season",
    weekdays: [2, 3],
    note: "Pre-practice priming — 30 minutes max, no leg work.",
    exercises: [
      { name: "Dumbbell Bench Press", prescription: "3 × 6", cue: "Wrists over elbows, control the way down.", steps: STEPS.dumbbellBench, videoUrl: DEMO.dumbbellBench },
    ],
  },
  {
    componentId: "primary-upper-push",
    phaseId: "in-season",
    weekdays: [4],
    exercises: [
      { name: "Overhead DB Press", prescription: "3 × 6", cue: "Brace the ribs — no lean-back.", steps: STEPS.overheadPress, videoUrl: DEMO.overheadPress },
    ],
  },
  {
    componentId: "primary-upper-push",
    phaseId: "in-season",
    weekdays: [6],
    exercises: [
      {
        name: "Weighted Push-ups",
        prescription: "3 × 8",
        cue: "One straight line from head to heel.",
        steps: [
          "Hands just outside the shoulders, body rigid — plate on the upper back or a partner's hand.",
          "Lower the chest to just above the floor, elbows at about 45 degrees.",
          "Press the floor away to a full lockout — no hip sag anywhere in the rep.",
        ],
      },
    ],
  },
  {
    componentId: "primary-upper-push",
    phaseId: "competition",
    weekdays: [2, 3],
    exercises: [
      { name: "Dumbbell Bench Press", prescription: "2 × 5", cue: "Keep the weight, cut the sets.", steps: STEPS.dumbbellBench, videoUrl: DEMO.dumbbellBench },
    ],
  },
  {
    componentId: "primary-upper-push",
    phaseId: "competition",
    weekdays: [4],
    exercises: [
      { name: "Overhead DB Press", prescription: "2 × 5", cue: "Keep the weight, cut the sets.", steps: STEPS.overheadPress, videoUrl: DEMO.overheadPress },
    ],
  },
  {
    componentId: "primary-upper-push",
    phaseId: "competition",
    weekdays: [6],
    note: "Game day — perform: scanning, space-creation pull-ups, two-foot finishes.",
    exercises: [],
  },
  {
    componentId: "primary-upper-push",
    exercises: [
      { name: "Dumbbell Bench Press", prescription: "3 × 6–8", cue: "Wrists over elbows, control the way down.", steps: STEPS.dumbbellBench, videoUrl: DEMO.dumbbellBench },
      { name: "Overhead DB Press", prescription: "3 × 6–8", cue: "Brace the ribs — no lean-back.", steps: STEPS.overheadPress, videoUrl: DEMO.overheadPress },
    ],
  },

  /* ── Upper accessory / pulling ── */
  {
    componentId: "accessory-upper",
    phaseId: "pre-season",
    weekdays: [2],
    exercises: [
      { name: "Inverted Rows", prescription: "3 × 8", cue: "Body rigid, chest to the bar.", steps: STEPS.invertedRow, videoUrl: DEMO.invertedRow },
    ],
  },
  {
    componentId: "accessory-upper",
    phaseId: "pre-season",
    weekdays: [4],
    exercises: [
      {
        name: "Chest-Supported Row",
        prescription: "3 × 8",
        cue: "Chest glued to the bench.",
        steps: [
          "Lie chest-down on an incline bench with a dumbbell in each hand.",
          "Row both bells to the ribs, elbows driving back and down.",
          "Squeeze at the top, then lower slowly — the chest never leaves the bench.",
        ],
        videoUrl: DEMO.invertedRow,
      },
    ],
  },
  {
    componentId: "accessory-upper",
    phaseId: "pre-season",
    weekdays: [6],
    exercises: [
      { name: "Pull-ups", prescription: "3 × 6–8", cue: "Chest to the bar, no swinging.", steps: STEPS.pullUp, videoUrl: DEMO.pullUp },
    ],
  },
  {
    componentId: "accessory-upper",
    phaseId: "in-season",
    weekdays: [2, 3, 4],
    exercises: [
      { name: "Pull-ups", prescription: "3 × 5", cue: "Chest to the bar, no swinging.", steps: STEPS.pullUp, videoUrl: DEMO.pullUp },
    ],
  },
  {
    componentId: "accessory-upper",
    phaseId: "in-season",
    weekdays: [6],
    exercises: [
      { name: "Pull-ups", prescription: "3 × 6–8", cue: "Chest to the bar, no swinging.", steps: STEPS.pullUp, videoUrl: DEMO.pullUp },
    ],
  },
  {
    componentId: "accessory-upper",
    phaseId: "competition",
    note: "Tryout taper — retain the weight, cut the sets.",
    exercises: [
      { name: "Inverted Rows", prescription: "2 × 5", cue: "Body rigid, chest to the bar.", steps: STEPS.invertedRow, videoUrl: DEMO.invertedRow },
      { name: "Pull-ups", prescription: "2 × 5", cue: "Chest to the bar, no swinging.", steps: STEPS.pullUp, videoUrl: DEMO.pullUp },
    ],
  },
  {
    componentId: "accessory-upper",
    exercises: [
      { name: "Inverted Rows", prescription: "3 × 8", cue: "Body rigid, chest to the bar.", steps: STEPS.invertedRow, videoUrl: DEMO.invertedRow },
      { name: "Pull-ups", prescription: "3 × 6–8", cue: "Chest to the bar, no swinging.", steps: STEPS.pullUp, videoUrl: DEMO.pullUp },
    ],
  },

  /* ── Core / anti-rotation ── */
  {
    componentId: "accessory-core",
    phaseId: "in-season",
    weekdays: [2, 3, 4],
    exercises: [
      { name: "Cable Core Rotations", prescription: "3 × 8", cue: "The core rotates — the arms stay locked out.", steps: STEPS.cableCoreRotation, videoUrl: DEMO.cableCoreRotation },
    ],
  },
  {
    componentId: "accessory-core",
    exercises: [
      { name: "Pallof Press", prescription: "3 × 10 per side", cue: "Resist the twist — ribs down, steady breath.", steps: STEPS.pallofPress, videoUrl: DEMO.pallofPress },
    ],
  },

  /* ── Explosiveness ── */
  {
    componentId: "explosive-jumps",
    phaseId: "pre-season",
    weekdays: [1, 2, 3, 5, 6],
    note: "No jumping today — jumps live on the high-energy day.",
    exercises: [],
  },
  {
    componentId: "explosive-jumps",
    phaseId: "pre-season",
    weekdays: [4],
    exercises: [
      { name: "Box Jumps", prescription: "3 × 3", cue: "Quiet, soft landings every rep.", steps: STEPS.boxJump, videoUrl: DEMO.boxJump },
    ],
  },
  {
    componentId: "explosive-jumps",
    phaseId: "competition",
    weekdays: [6],
    note: "Game day — perform. Jumping lives earlier in the week, on fresh legs.",
    exercises: [],
  },
  {
    componentId: "explosive-jumps",
    exercises: [
      { name: "Box Jumps", prescription: "3 × 3", cue: "Land soft and quiet.", steps: STEPS.boxJump, videoUrl: DEMO.boxJump },
    ],
  },

  /* ── Acceleration / max speed ── */
  {
    componentId: "acceleration-sprints",
    phaseId: "pre-season",
    weekdays: [1, 3, 5],
    note: "Low-energy day — tempo and skill work only. Speed lives on fresh days.",
    exercises: [],
  },
  {
    componentId: "acceleration-sprints",
    phaseId: "pre-season",
    weekdays: [2],
    exercises: [
      { name: "Push-up Sprint Starts", prescription: "4 × 15m", cue: "Explode off the ground, full 2-minute rest.", steps: STEPS.sprintStart, videoUrl: DEMO.sprintMechanics },
    ],
  },
  {
    componentId: "acceleration-sprints",
    phaseId: "pre-season",
    weekdays: [6],
    exercises: [
      { name: "Ankling Drills", prescription: "2 × 10m", cue: "Stiff ankles, bouncy contacts.", steps: STEPS.ankling, videoUrl: DEMO.sprintMechanics },
      { name: "Flying 10m Sprints", prescription: "3 reps", cue: "Build up, then hit top speed through the zone.", steps: STEPS.flying10, videoUrl: DEMO.sprintMechanics },
    ],
  },
  {
    componentId: "acceleration-sprints",
    phaseId: "in-season",
    weekdays: [6],
    exercises: [
      { name: "Ankling Drills", prescription: "2 × 10m (warm-up)", cue: "Stiff ankles, bouncy contacts.", steps: STEPS.ankling, videoUrl: DEMO.sprintMechanics },
      { name: "15m Acceleration Starts", prescription: "4 reps", cue: "Full 2-minute rest between reps.", steps: STEPS.sprintStart, videoUrl: DEMO.sprintMechanics },
    ],
  },
  {
    componentId: "acceleration-sprints",
    exercises: [
      { name: "15m Acceleration Starts", prescription: "4 reps", cue: "Full rest between reps — quality over quantity.", steps: STEPS.sprintStart, videoUrl: DEMO.sprintMechanics },
    ],
  },

  /* ── Change of direction ── */
  {
    componentId: "cod-drills",
    phaseId: "pre-season",
    weekdays: [1, 3, 5],
    note: "Low-energy day — cutting lives on the high-energy days.",
    exercises: [],
  },
  {
    componentId: "cod-drills",
    phaseId: "pre-season",
    weekdays: [4],
    exercises: [
      { name: "90-Degree Cutting", prescription: "4 × 10m", cue: "Sprint → plant → accelerate. No wasted steps.", steps: STEPS.cutting, videoUrl: DEMO.cutting },
    ],
  },
  {
    componentId: "cod-drills",
    phaseId: "in-season",
    weekdays: [6],
    exercises: [
      { name: "Pro Agility (5-10-5) Shuttle", prescription: "3 reps", cue: "Low hips, sharp plants at each line.", steps: STEPS.proAgility, videoUrl: DEMO.proAgility },
    ],
  },
  {
    componentId: "cod-drills",
    phaseId: "competition",
    weekdays: [6],
    note: "Game day — the shuttle is the game. Warm up, compete, recover.",
    exercises: [],
  },
  {
    componentId: "cod-drills",
    exercises: [
      { name: "Pro Agility (5-10-5) Shuttle", prescription: "3 reps", cue: "Sharp plants, low center of gravity.", steps: STEPS.proAgility, videoUrl: DEMO.proAgility },
    ],
  },

  /* ── Basketball skill work ── */
  {
    componentId: "skill-ballhandling",
    phaseId: "pre-season",
    weekdays: [2],
    exercises: [
      { name: "Punch-Drag into Pull-Up", prescription: "4 × 4", cue: "Wide punch stop, then rise.", steps: STEPS.punchDrag, videoUrl: DEMO.ballHandling },
      { name: "Two-Foot Paint Finishes", prescription: "20 makes", cue: "Stride stop or jump stop — land on two feet.", steps: STEPS.twoFootFinishes, videoUrl: DEMO.ballHandling },
    ],
  },
  {
    componentId: "skill-ballhandling",
    phaseId: "pre-season",
    weekdays: [4],
    exercises: [
      {
        name: "Step-Backs & Side-Steps",
        prescription: "24 makes",
        cue: "Read the defender's hips, then create the pocket.",
        steps: [
          "Dribble at an imaginary defender with a live, low dribble.",
          "Step back or side-step out of the drive to create your pocket of space.",
          "Come into the shot with the feet already ready — 24 total makes.",
        ],
        videoUrl: DEMO.ballHandling,
      },
    ],
  },
  {
    componentId: "skill-ballhandling",
    phaseId: "pre-season",
    weekdays: [1, 3],
    exercises: [
      { name: "Stationary Scanning Dribbling", prescription: "10–15 min", cue: "Head up the whole time — call out what you see.", steps: STEPS.scanningDribbling, videoUrl: DEMO.ballHandling },
      { name: "Spot-Up Mid-Range", prescription: "100 makes", cue: "Smooth footwork groove, 12–15 feet.", steps: STEPS.spotUpShooting, videoUrl: DEMO.shooting },
    ],
  },
  {
    componentId: "skill-ballhandling",
    phaseId: "in-season",
    weekdays: [6],
    note: "Saturday advanced guard block — your most important skill window.",
    exercises: [
      { name: "Off-Dribble Pull-Ups", prescription: "30 makes", cue: "Punch-drag, step-backs, side-steps vs a live contest.", steps: STEPS.punchDrag, videoUrl: DEMO.ballHandling },
      { name: "Two-Foot Paint Finishes", prescription: "20 makes", cue: "Stride-stop and jump-stop through contact.", steps: STEPS.twoFootFinishes, videoUrl: DEMO.ballHandling },
      {
        name: "Pick-and-Roll Reads",
        prescription: "Live 2v2 / 3v3",
        cue: "Call out the coverage before you receive.",
        steps: [
          "Come off the ball screen at game speed.",
          "Read the coverage before you receive — call it out loud.",
          "Make the play: pull-up, throwback, or pocket pass.",
        ],
        videoUrl: DEMO.ballHandling,
      },
    ],
  },
  {
    componentId: "skill-ballhandling",
    phaseId: "competition",
    weekdays: [5],
    exercises: [
      { name: "Game Primer Shooting", prescription: "30 spot-up shots", cue: "Light legs, picture tomorrow's looks.", steps: STEPS.spotUpShooting, videoUrl: DEMO.shooting },
    ],
  },
  {
    componentId: "skill-ballhandling",
    phaseId: "competition",
    weekdays: [6],
    note: "Game day — perform: scanning, space-creation pull-ups, and two-foot finishes.",
    exercises: [],
  },
  {
    componentId: "skill-ballhandling",
    exercises: [
      { name: "Punch-Drag into Pull-Up", prescription: "4 × 4", cue: "Wide punch stop, then rise.", steps: STEPS.punchDrag, videoUrl: DEMO.ballHandling },
      { name: "Stationary Scanning Dribbling", prescription: "10 min", cue: "Head up — call out visual cues.", steps: STEPS.scanningDribbling, videoUrl: DEMO.ballHandling },
      { name: "Spot-Up Mid-Range", prescription: "50–100 makes", cue: "Same groove every shot.", steps: STEPS.spotUpShooting, videoUrl: DEMO.shooting },
    ],
  },

  /* ── Mobility & recovery ── */
  {
    componentId: "mobility-recovery",
    phaseId: "pre-season",
    weekdays: [1, 3],
    exercises: [
      { name: "Extensive Grass Tempo", prescription: "10 × 100m at 60–65%", cue: "Relaxed breathing, walk-back rest.", steps: STEPS.tempo },
    ],
  },
  {
    componentId: "mobility-recovery",
    phaseId: "in-season",
    weekdays: [1, 5],
    note: "Flush the weekend and the practice-week stress.",
    exercises: [
      { name: "Extensive Grass Tempo", prescription: "10 × 100m at 60–65%", cue: "Relaxed breathing, walk-back rest.", steps: STEPS.tempo },
      { name: "Wall-Sit Isometric Holds", prescription: "3 × 45s", cue: "Eases sore knees, builds lasting strength.", steps: STEPS.wallSit, videoUrl: DEMO.wallSit },
      { name: "Copenhagen Planks", prescription: "3 × 20s per side", cue: "Groin strength for defensive slides.", steps: STEPS.copenhagenPlank, videoUrl: DEMO.copenhagenPlank },
    ],
  },
  {
    componentId: "mobility-recovery",
    phaseId: "competition",
    weekdays: [5],
    note: "Game primer: light mobility, 30 shots, early sleep.",
    exercises: [
      { name: "Light Dynamic Mobility", prescription: "20 min", cue: "Loosen up — nothing heavy the day before a game.", steps: STEPS.lightMobility },
    ],
  },
  {
    componentId: "mobility-recovery",
    exercises: [
      { name: "Full-Body Mobility Flow", prescription: "20 min", cue: "Foam roll quads and calves, easy stretches.", steps: STEPS.mobilityFlow, videoUrl: DEMO.mobilityFlow },
      { name: "Free Throws", prescription: "50 makes", cue: "Same routine, every shot.", steps: STEPS.freeThrows, videoUrl: DEMO.shooting },
    ],
  },
];

/**
 * Resolves today's exercise detail for a base-plan component: the most
 * specific entry wins (weekday match → phase match → default).
 */
export function exerciseDetailsFor(componentId: string, localDate: string): ComponentDetail | undefined {
  const phase = seasonPhaseFor(localDate);
  const weekday = weekdayOf(localDate);

  const matches = FALL_COMPONENT_DETAILS.filter(
    (entry) =>
      entry.componentId === componentId &&
      (entry.phaseId === undefined || entry.phaseId === phase?.id) &&
      (entry.weekdays === undefined || entry.weekdays.includes(weekday)),
  );

  const withWeekday = matches.find((entry) => entry.weekdays !== undefined);
  const withPhase = matches.find((entry) => entry.weekdays === undefined && entry.phaseId !== undefined);
  const fallback = matches.find((entry) => entry.weekdays === undefined && entry.phaseId === undefined);
  const chosen = withWeekday ?? withPhase ?? fallback;

  return chosen;
}
