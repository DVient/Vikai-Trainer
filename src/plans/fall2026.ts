/**
 * VIKAI — Fall 2026 Training Plan (exercise detail library).
 *
 * Pure data + lookups encoding the athlete's September–December 2026 plan:
 * three season phases, weekday-structured day templates, and per-exercise
 * video links from the plan's Video Reference Directory.
 *
 * ARCHITECTURE (AGENTS.md): this module NEVER decides what an athlete does —
 * the engine computes restrictions and the generator scales the base plan.
 * This is a detail overlay: given a base-plan component and a date, it
 * returns the exercises, prescriptions, cues, and video links that block is
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
      "School plus Tuesday/Thursday team practices. Legs are saved for practice — lifting on those days stays up top.",
    note: "Practice nights: Tuesday & Thursday.",
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
  /** Direct link from the plan's video directory, when one exists. */
  videoUrl?: string;
  /** Fallback: builds a YouTube search URL at lookup time. */
  videoQuery?: string;
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

const VIDEO = {
  trapBarDeadlift: "https://www.youtube.com/results?search_query=trap+bar+deadlift+form+cues",
  pallofPress: "https://www.youtube.com/results?search_query=pallof+press+form",
  pushUpSprintStart: "https://www.youtube.com/results?search_query=push+up+sprint+start+technique",
  flying10m: "https://www.youtube.com/results?search_query=flying+10m+sprint+drill",
  dumbbellRdl: "https://www.youtube.com/results?search_query=dumbbell+romanian+deadlift+form",
  ankling: "https://www.youtube.com/results?search_query=ankling+drills+for+sprinting",
  proAgility: "https://www.youtube.com/results?search_query=pro+agility+5-10-5+shuttle+technique",
  punchDrag: "https://www.youtube.com/results?search_query=punch+drag+space+creation+basketball",
  twoFootFinishes:
    "https://www.youtube.com/results?search_query=stride+stop+vs+jump+stop+basketball+footwork",
  copenhagenPlank: "https://www.youtube.com/results?search_query=copenhagen+plank+progression",
  spanishSquat:
    "https://www.youtube.com/results?search_query=spanish+squat+isometric+hold+technique",
  extensiveTempo:
    "https://www.youtube.com/results?search_query=charlie+francis+extensive+tempo+running",
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
      { name: "Trap Bar Deadlift", prescription: "3 × 5", cue: "High handles, flat back, stand up fast.", videoUrl: VIDEO.trapBarDeadlift },
    ],
  },
  {
    componentId: "primary-lower-squat",
    phaseId: "pre-season",
    weekdays: [4],
    exercises: [
      { name: "Goblet Front Squat", prescription: "3 × 5", cue: "Elbows tucked, knees track over toes.", videoQuery: "goblet front squat form" },
    ],
  },
  {
    componentId: "primary-lower-squat",
    phaseId: "in-season",
    weekdays: [6],
    note: "Saturday is your primary strength day — you're 36+ hours clear of practice.",
    exercises: [
      { name: "Trap Bar Deadlift", prescription: "3 × 5", cue: "Heavy, explosive up.", videoUrl: VIDEO.trapBarDeadlift },
      { name: "Goblet Front Squat", prescription: "3 × 5", videoQuery: "goblet front squat form" },
      { name: "Dumbbell RDL", prescription: "3 × 8", cue: "Push the hips back, flat back.", videoUrl: VIDEO.dumbbellRdl },
      { name: "Single-Leg Calf Raises", prescription: "3 × 10 per leg", videoQuery: "single leg calf raise form" },
    ],
  },
  {
    componentId: "primary-lower-squat",
    phaseId: "in-season",
    weekdays: [2, 4],
    note: "Practice night — zero lower-body lifting. Legs are saved for practice.",
    exercises: [],
  },
  {
    componentId: "primary-lower-squat",
    phaseId: "competition",
    weekdays: [2],
    note: "Micro-lifting before practice — keep the weight, cut the sets.",
    exercises: [
      { name: "Trap Bar Deadlift", prescription: "2 × 4", videoUrl: VIDEO.trapBarDeadlift },
    ],
  },
  {
    componentId: "primary-lower-squat",
    phaseId: "competition",
    weekdays: [4],
    note: "Micro-lifting before practice — keep the weight, cut the sets.",
    exercises: [
      { name: "Goblet Front Squat", prescription: "2 × 4", videoQuery: "goblet front squat form" },
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
      { name: "Trap Bar Deadlift", prescription: "3 × 5", videoUrl: VIDEO.trapBarDeadlift },
      { name: "Goblet Front Squat", prescription: "3 × 5", videoQuery: "goblet front squat form" },
      { name: "Dumbbell RDL", prescription: "3 × 8", videoUrl: VIDEO.dumbbellRdl },
    ],
  },

  /* ── Upper-body push ── */
  {
    componentId: "primary-upper-push",
    phaseId: "pre-season",
    weekdays: [2],
    exercises: [{ name: "Dumbbell Bench Press", prescription: "3 × 6–8", videoQuery: "dumbbell bench press form" }],
  },
  {
    componentId: "primary-upper-push",
    phaseId: "pre-season",
    weekdays: [4],
    exercises: [{ name: "Overhead DB Press", prescription: "3 × 6–8", videoQuery: "overhead dumbbell press form" }],
  },
  {
    componentId: "primary-upper-push",
    phaseId: "in-season",
    weekdays: [2],
    note: "Pre-practice priming — 30 minutes max, no leg work.",
    exercises: [{ name: "Dumbbell Bench Press", prescription: "3 × 6", videoQuery: "dumbbell bench press form" }],
  },
  {
    componentId: "primary-upper-push",
    phaseId: "in-season",
    weekdays: [4],
    exercises: [{ name: "Overhead DB Press", prescription: "3 × 6", videoQuery: "overhead dumbbell press form" }],
  },
  {
    componentId: "primary-upper-push",
    phaseId: "in-season",
    weekdays: [6],
    exercises: [{ name: "Weighted Push-ups", prescription: "3 × 8", videoQuery: "weighted push up form" }],
  },
  {
    componentId: "primary-upper-push",
    phaseId: "competition",
    weekdays: [2],
    exercises: [{ name: "Dumbbell Bench Press", prescription: "2 × 5", videoQuery: "dumbbell bench press form" }],
  },
  {
    componentId: "primary-upper-push",
    phaseId: "competition",
    weekdays: [4],
    exercises: [{ name: "Overhead DB Press", prescription: "2 × 5", videoQuery: "overhead dumbbell press form" }],
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
      { name: "Dumbbell Bench Press", prescription: "3 × 6–8", videoQuery: "dumbbell bench press form" },
      { name: "Overhead DB Press", prescription: "3 × 6–8", videoQuery: "overhead dumbbell press form" },
    ],
  },

  /* ── Upper accessory / pulling ── */
  {
    componentId: "accessory-upper",
    phaseId: "pre-season",
    weekdays: [2],
    exercises: [{ name: "Inverted Rows", prescription: "3 × 8", videoQuery: "inverted row form" }],
  },
  {
    componentId: "accessory-upper",
    phaseId: "pre-season",
    weekdays: [4],
    exercises: [{ name: "Chest-Supported Row", prescription: "3 × 8", videoQuery: "chest supported row form" }],
  },
  {
    componentId: "accessory-upper",
    phaseId: "pre-season",
    weekdays: [6],
    exercises: [{ name: "Pull-ups", prescription: "3 × 6–8", videoQuery: "pull up form" }],
  },
  {
    componentId: "accessory-upper",
    phaseId: "in-season",
    weekdays: [2, 4],
    exercises: [{ name: "Pull-ups", prescription: "3 × 5", videoQuery: "pull up form" }],
  },
  {
    componentId: "accessory-upper",
    phaseId: "in-season",
    weekdays: [6],
    exercises: [{ name: "Pull-ups", prescription: "3 × 6–8", videoQuery: "pull up form" }],
  },
  {
    componentId: "accessory-upper",
    phaseId: "competition",
    note: "Tryout taper — retain the weight, cut the sets.",
    exercises: [
      { name: "Inverted Rows", prescription: "2 × 5", videoQuery: "inverted row form" },
      { name: "Pull-ups", prescription: "2 × 5", videoQuery: "pull up form" },
    ],
  },
  {
    componentId: "accessory-upper",
    exercises: [
      { name: "Inverted Rows", prescription: "3 × 8", videoQuery: "inverted row form" },
      { name: "Pull-ups", prescription: "3 × 6–8", videoQuery: "pull up form" },
    ],
  },

  /* ── Core / anti-rotation ── */
  {
    componentId: "accessory-core",
    phaseId: "in-season",
    weekdays: [4],
    exercises: [{ name: "Cable Core Rotations", prescription: "3 × 8", videoQuery: "cable core rotation exercise" }],
  },
  {
    componentId: "accessory-core",
    exercises: [
      { name: "Pallof Press", prescription: "3 × 10 per side", cue: "Resist the twist — ribs down, steady breath.", videoUrl: VIDEO.pallofPress },
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
    exercises: [{ name: "Box Jumps", prescription: "3 × 3", cue: "Quiet, soft landings every rep.", videoQuery: "box jump soft landing technique" }],
  },
  {
    componentId: "explosive-jumps",
    exercises: [
      { name: "Box Jumps", prescription: "3 × 3", cue: "Land soft and quiet.", videoQuery: "box jump soft landing technique" },
    ],
  },

  /* ── Acceleration / max speed ── */
  {
    componentId: "acceleration-sprints",
    phaseId: "pre-season",
    weekdays: [2],
    exercises: [
      { name: "Push-up Sprint Starts", prescription: "4 × 15m", cue: "Explode off the ground, full 2-minute rest.", videoUrl: VIDEO.pushUpSprintStart },
    ],
  },
  {
    componentId: "acceleration-sprints",
    phaseId: "pre-season",
    weekdays: [6],
    exercises: [
      { name: "Ankling Drills", prescription: "2 × 10m", cue: "Stiff ankles, bouncy contacts.", videoUrl: VIDEO.ankling },
      { name: "Flying 10m Sprints", prescription: "3 reps", cue: "Build up, then hit top speed through the zone.", videoUrl: VIDEO.flying10m },
    ],
  },
  {
    componentId: "acceleration-sprints",
    phaseId: "in-season",
    weekdays: [6],
    exercises: [
      { name: "Ankling Drills", prescription: "2 × 10m (warm-up)", videoUrl: VIDEO.ankling },
      { name: "15m Acceleration Starts", prescription: "4 reps", cue: "Full 2-minute rest between reps.", videoUrl: VIDEO.pushUpSprintStart },
    ],
  },
  {
    componentId: "acceleration-sprints",
    exercises: [
      { name: "15m Acceleration Starts", prescription: "4 reps", cue: "Full rest between reps — quality over quantity.", videoUrl: VIDEO.pushUpSprintStart },
    ],
  },

  /* ── Change of direction ── */
  {
    componentId: "cod-drills",
    phaseId: "pre-season",
    weekdays: [4],
    exercises: [
      { name: "90-Degree Cutting", prescription: "4 × 10m", cue: "Sprint → plant → accelerate. No wasted steps.", videoQuery: "90 degree cutting basketball drill" },
    ],
  },
  {
    componentId: "cod-drills",
    phaseId: "in-season",
    weekdays: [6],
    exercises: [
      { name: "Pro Agility (5-10-5) Shuttle", prescription: "3 reps", cue: "Low hips, sharp plants at each line.", videoUrl: VIDEO.proAgility },
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
      { name: "Pro Agility (5-10-5) Shuttle", prescription: "3 reps", cue: "Sharp plants, low center of gravity.", videoUrl: VIDEO.proAgility },
    ],
  },

  /* ── Basketball skill work ── */
  {
    componentId: "skill-ballhandling",
    phaseId: "pre-season",
    weekdays: [2],
    exercises: [
      { name: "Punch-Drag into Pull-Up", prescription: "4 × 4", cue: "Wide punch stop, then rise.", videoUrl: VIDEO.punchDrag },
      { name: "Two-Foot Paint Finishes", prescription: "20 makes", cue: "Stride stop or jump stop — land on two feet.", videoUrl: VIDEO.twoFootFinishes },
    ],
  },
  {
    componentId: "skill-ballhandling",
    phaseId: "pre-season",
    weekdays: [4],
    exercises: [
      { name: "Step-Backs & Side-Steps", prescription: "24 makes", cue: "Read the defender's hips, then create the pocket." },
    ],
  },
  {
    componentId: "skill-ballhandling",
    phaseId: "pre-season",
    weekdays: [1, 3],
    exercises: [
      { name: "Stationary Scanning Dribbling", prescription: "10–15 min", cue: "Head up the whole time — call out what you see." },
      { name: "Spot-Up Mid-Range", prescription: "100 makes", cue: "Smooth footwork groove, 12–15 feet." },
    ],
  },
  {
    componentId: "skill-ballhandling",
    phaseId: "in-season",
    weekdays: [6],
    note: "Saturday advanced guard block — your most important skill window.",
    exercises: [
      { name: "Off-Dribble Pull-Ups", prescription: "30 makes", cue: "Punch-drag, step-backs, side-steps vs a live contest.", videoUrl: VIDEO.punchDrag },
      { name: "Two-Foot Paint Finishes", prescription: "20 makes", cue: "Stride-stop and jump-stop through contact.", videoUrl: VIDEO.twoFootFinishes },
      { name: "Pick-and-Roll Reads", prescription: "Live 2v2 / 3v3", cue: "Call out the coverage before you receive." },
    ],
  },
  {
    componentId: "skill-ballhandling",
    phaseId: "competition",
    weekdays: [5],
    exercises: [
      { name: "Game Primer Shooting", prescription: "30 spot-up shots", cue: "Light legs, picture tomorrow's looks." },
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
      { name: "Punch-Drag into Pull-Up", prescription: "4 × 4", videoUrl: VIDEO.punchDrag },
      { name: "Stationary Scanning Dribbling", prescription: "10 min", cue: "Head up — call out visual cues." },
      { name: "Spot-Up Mid-Range", prescription: "50–100 makes" },
    ],
  },

  /* ── Mobility & recovery ── */
  {
    componentId: "mobility-recovery",
    phaseId: "pre-season",
    weekdays: [1, 3],
    exercises: [
      { name: "Extensive Grass Tempo", prescription: "10 × 100m at 60–65%", cue: "Relaxed breathing, walk-back rest.", videoUrl: VIDEO.extensiveTempo },
    ],
  },
  {
    componentId: "mobility-recovery",
    phaseId: "in-season",
    weekdays: [1, 3],
    exercises: [
      { name: "Extensive Grass Tempo", prescription: "10 × 100m at 60–65%", cue: "Flush the weekend / practice stress.", videoUrl: VIDEO.extensiveTempo },
      { name: "Wall-Sit Isometric Holds", prescription: "3 × 45s", cue: "Eases sore knees, builds lasting strength.", videoUrl: VIDEO.spanishSquat },
      { name: "Copenhagen Planks", prescription: "3 × 20s per side", cue: "Groin strength for defensive slides.", videoUrl: VIDEO.copenhagenPlank },
    ],
  },
  {
    componentId: "mobility-recovery",
    phaseId: "competition",
    weekdays: [5],
    note: "Game primer: light mobility, 30 shots, early sleep.",
    exercises: [
      { name: "Light Dynamic Mobility", prescription: "20 min", cue: "Loosen up — nothing heavy the day before a game." },
    ],
  },
  {
    componentId: "mobility-recovery",
    exercises: [
      { name: "Full-Body Mobility Flow", prescription: "20 min", cue: "Foam roll quads and calves, easy stretches." },
      { name: "Free Throws", prescription: "50 makes" },
    ],
  },
];

/** Builds the YouTube search URL for an exercise without a direct link. */
export function videoSearchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

/**
 * Resolves today's exercise detail for a base-plan component: the most
 * specific entry wins (weekday match → phase match → default), with video
 * URLs resolved from direct links or search queries.
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

  if (!chosen) return undefined;
  return {
    ...chosen,
    exercises: chosen.exercises.map((exercise) => ({
      ...exercise,
      videoUrl:
        exercise.videoUrl ??
        (exercise.videoQuery !== undefined ? videoSearchUrl(exercise.videoQuery) : undefined),
    })),
  };
}
