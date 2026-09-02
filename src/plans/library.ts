/**
 * VIKAI — Plan Builder block library.
 *
 * The catalog of training blocks the plan builder composes plans from, plus
 * each block's exercise pool (equivalent variants of the same movement
 * pattern — rotation changes WHICH equivalent exercise loads the pattern,
 * never the intent).
 *
 * ARCHITECTURE (AGENTS.md): this module NEVER computes restrictions. The
 * engine computes TrainingRestrictions; the generator maps them onto
 * whatever base plan exists (default or built). This library is the content
 * the builder selects from — plan-domain data, pure and static.
 */

import type { TrainingComponent } from "../types";

export type BlockKind = "PHYSICAL" | "SKILL" | "RECOVERY";
export type ExerciseVariantTag = "A" | "B";

export interface ExerciseVariant {
  name: string;
  /** e.g. "3 × 5 (heavy, explosive up)". */
  prescription: string;
  cue?: string;
  videoQuery: string;
}

export interface LibraryBlock {
  component: TrainingComponent;
  /** Athlete-facing block title (BASE_PLAN_TITLES covers the default 9). */
  title: string;
  kind: BlockKind;
  /** Selection hint used by the builder's ranking (higher = more central). */
  rank: number;
  pool: {
    A: ExerciseVariant[];
    B: ExerciseVariant[];
    /** Runs every cycle regardless of rotation. */
    staple: ExerciseVariant[];
  };
}

const c = (block: Omit<TrainingComponent, "optional"> & { optional?: boolean }): TrainingComponent => ({
  optional: false,
  ...block,
});

/**
 * The full block catalog. The default plan's 9 components are included
 * (same ids, same metadata) so a built plan can reuse them; new blocks
 * extend the menu. Exercise pools pair two equivalent variants per block
 * plus a staple that runs every cycle.
 */
export const BLOCK_LIBRARY: ReadonlyArray<LibraryBlock> = [
  {
    component: c({ id: "primary-lower-squat", type: "STRENGTH", stress: "HIGH", priority: 1, baseVolume: 4, minimumVolume: 2, bodyRegion: "LOWER", estimatedMinutes: 16 }),
    title: "Squat pattern strength",
    kind: "PHYSICAL",
    rank: 1,
    pool: {
      A: [{ name: "Goblet Front Squat", prescription: "3 × 5", cue: "Elbows tucked, knees track over toes.", videoQuery: "goblet front squat form" }],
      B: [{ name: "Split Squat", prescription: "3 × 6 per leg", cue: "Front shin vertical, drive through the floor.", videoQuery: "split squat form" }],
      staple: [{ name: "Single-Leg Calf Raises", prescription: "3 × 10 per leg", videoQuery: "single leg calf raise form" }],
    },
  },
  {
    component: c({ id: "primary-lower-hinge", type: "STRENGTH", stress: "HIGH", priority: 1, baseVolume: 4, minimumVolume: 2, bodyRegion: "LOWER", estimatedMinutes: 16 }),
    title: "Hip hinge strength",
    kind: "PHYSICAL",
    rank: 2,
    pool: {
      A: [{ name: "Dumbbell Romanian Deadlift", prescription: "3 × 8", cue: "Push the hips back, flat back.", videoQuery: "dumbbell romanian deadlift form" }],
      B: [{ name: "Glute Bridge", prescription: "3 × 10", cue: "Squeeze at the top, ribs down.", videoQuery: "glute bridge form" }],
      staple: [{ name: "Wall Hip Hinge Drill", prescription: "2 × 8", cue: "Nose to the wall, hips back.", videoQuery: "hip hinge drill" }],
    },
  },
  {
    component: c({ id: "lower-split-squat", type: "STRENGTH", stress: "HIGH", priority: 2, baseVolume: 3, minimumVolume: 2, bodyRegion: "LOWER", estimatedMinutes: 12 }),
    title: "Single-leg strength",
    kind: "PHYSICAL",
    rank: 6,
    pool: {
      A: [{ name: "Alternating Split Squat", prescription: "3 × 6 per leg", cue: "Torso tall, back knee kisses the floor.", videoQuery: "alternating split squat" }],
      B: [{ name: "Lateral Lunge", prescription: "3 × 6 per side", cue: "Sit into the working hip, other leg straight.", videoQuery: "lateral lunge form" }],
      staple: [{ name: "Wall Sit", prescription: "2 × 30 sec", videoQuery: "wall sit hold" }],
    },
  },
  {
    component: c({ id: "lower-calf-ankle", type: "STRENGTH", stress: "HIGH", priority: 4, baseVolume: 3, minimumVolume: 2, bodyRegion: "LOWER", estimatedMinutes: 8 }),
    title: "Calf & ankle complex",
    kind: "PHYSICAL",
    rank: 9,
    pool: {
      A: [{ name: "Single-Leg Calf Raises", prescription: "3 × 12 per leg", cue: "Slow down, quick up.", videoQuery: "single leg calf raise form" }],
      B: [{ name: "Pogo Hops (low)", prescription: "3 × 15", cue: "Stiff ankles, bounce off the floor.", videoQuery: "pogo hops ankle stiffness" }],
      staple: [{ name: "Ankle Circles & Tib Raises", prescription: "2 × 10", videoQuery: "tibialis raises" }],
    },
  },
  {
    component: c({ id: "primary-upper-push", type: "STRENGTH", stress: "HIGH", priority: 1, baseVolume: 4, minimumVolume: 2, bodyRegion: "UPPER", estimatedMinutes: 16 }),
    title: "Upper push strength",
    kind: "PHYSICAL",
    rank: 3,
    pool: {
      A: [{ name: "Push-Up", prescription: "3 × 8-12", cue: "Body in one line, chest to fists.", videoQuery: "push up form" }],
      B: [{ name: "Dumbbell Floor Press", prescription: "3 × 8", cue: "Elbows at 45°, control the way down.", videoQuery: "dumbbell floor press" }],
      staple: [{ name: "Explosive Push-Up (low)", prescription: "2 × 5", cue: "Fast up, soft catch.", videoQuery: "explosive push up" }],
    },
  },
  {
    component: c({ id: "primary-upper-pull", type: "STRENGTH", stress: "HIGH", priority: 1, baseVolume: 4, minimumVolume: 2, bodyRegion: "UPPER", estimatedMinutes: 14 }),
    title: "Upper pull strength",
    kind: "PHYSICAL",
    rank: 4,
    pool: {
      A: [{ name: "Backpack Row", prescription: "3 × 10 per arm", cue: "Pull to the hip, shoulder blade back.", videoQuery: "one arm dumbbell row form" }],
      B: [{ name: "Towel Iso Row", prescription: "3 × 20 sec", cue: "Squeeze hard, breathe steady.", videoQuery: "towel row isometric" }],
      staple: [{ name: "Prone Y-Raise", prescription: "2 × 10", videoQuery: "prone y raise" }],
    },
  },
  {
    component: c({ id: "accessory-upper", type: "STRENGTH", stress: "LOW", priority: 5, baseVolume: 3, optional: true, bodyRegion: "UPPER", estimatedMinutes: 10 }),
    title: "Upper accessory",
    kind: "PHYSICAL",
    rank: 12,
    pool: {
      A: [{ name: "Push-Up Plus", prescription: "2 × 10", cue: "Push the floor away at the top.", videoQuery: "push up plus scapula" }],
      B: [{ name: "Doorway Row", prescription: "2 × 12", videoQuery: "doorway row" }],
      staple: [{ name: "Arm Circles", prescription: "2 × 10 each way", videoQuery: "arm circles warmup" }],
    },
  },
  {
    component: c({ id: "accessory-core", type: "STRENGTH", stress: "LOW", priority: 5, baseVolume: 2, optional: true, bodyRegion: "FULL", estimatedMinutes: 6 }),
    title: "Core strength",
    kind: "PHYSICAL",
    rank: 11,
    pool: {
      A: [{ name: "Front Plank", prescription: "3 × 30 sec", cue: "Ribs down, squeeze glutes.", videoQuery: "front plank form" }],
      B: [{ name: "Side Plank", prescription: "3 × 20 sec per side", videoQuery: "side plank form" }],
      staple: [{ name: "Dead Bug", prescription: "2 × 8 per side", cue: "Low back stays glued down.", videoQuery: "dead bug exercise" }],
    },
  },
  {
    component: c({ id: "explosive-jumps", type: "EXPLOSIVENESS", stress: "HIGH", priority: 2, baseVolume: 4, minimumVolume: 2, bodyRegion: "LOWER", estimatedMinutes: 10 }),
    title: "Jump mechanics",
    kind: "PHYSICAL",
    rank: 5,
    pool: {
      A: [{ name: "Pogo Hops", prescription: "4 × 10", cue: "Stiff ankles, minimal ground time.", videoQuery: "pogo hops ankle stiffness" }],
      B: [{ name: "Squat Jump + Stick", prescription: "4 × 5", cue: "Land soft, freeze for one second.", videoQuery: "squat jump landing mechanics" }],
      staple: [{ name: "Ankle Rock Prep", prescription: "2 × 8", videoQuery: "ankle rock warmup" }],
    },
  },
  {
    component: c({ id: "explosive-broad-response", type: "EXPLOSIVENESS", stress: "HIGH", priority: 3, baseVolume: 3, minimumVolume: 1, bodyRegion: "LOWER", estimatedMinutes: 8 }),
    title: "Broad jump & response",
    kind: "PHYSICAL",
    rank: 8,
    pool: {
      A: [{ name: "Broad Jump + Stick", prescription: "3 × 3", cue: "Throw the arms, land like a spring.", videoQuery: "broad jump landing" }],
      B: [{ name: "Single-Leg Hop + Stick", prescription: "3 × 3 per leg", cue: "Knee tracks over toes on landing.", videoQuery: "single leg hop landing" }],
      staple: [{ name: "Vertical Jump Practice", prescription: "3 reps", cue: "Full arm swing every time.", videoQuery: "vertical jump technique" }],
    },
  },
  {
    component: c({ id: "explosive-upper-power", type: "EXPLOSIVENESS", stress: "HIGH", priority: 3, baseVolume: 3, minimumVolume: 1, bodyRegion: "UPPER", estimatedMinutes: 8 }),
    title: "Upper-body power",
    kind: "PHYSICAL",
    rank: 13,
    pool: {
      A: [{ name: "Explosive Push-Up", prescription: "3 × 5", cue: "Maximum height, soft catch.", videoQuery: "explosive push up" }],
      B: [{ name: "Wall Chest Pass", prescription: "3 × 8", cue: "Snap the ball, catch and repeat.", videoQuery: "med ball chest pass wall" }],
      staple: [{ name: "Arm Swing Practice", prescription: "2 × 8", videoQuery: "arm swing jump technique" }],
    },
  },
  {
    component: c({ id: "acceleration-sprints", type: "SPEED", stress: "HIGH", priority: 2, baseVolume: 3, minimumVolume: 1, bodyRegion: "FULL", estimatedMinutes: 8 }),
    title: "Acceleration",
    kind: "PHYSICAL",
    rank: 7,
    pool: {
      A: [{ name: "10-Yard Push Sprints", prescription: "6 reps", cue: "Low angle, punch the ground back.", videoQuery: "10 yard acceleration sprint" }],
      B: [{ name: "Push-Up Start Sprints", prescription: "6 reps", cue: "Pop up and go — first three steps own the floor.", videoQuery: "push up sprint start technique" }],
      staple: [{ name: "Ankling Drill", prescription: "2 × 10 yd", videoQuery: "ankling drills for sprinting" }],
    },
  },
  {
    component: c({ id: "speed-strides", type: "SPEED", stress: "HIGH", priority: 3, baseVolume: 3, minimumVolume: 1, bodyRegion: "FULL", estimatedMinutes: 10 }),
    title: "Top speed strides",
    kind: "PHYSICAL",
    rank: 10,
    pool: {
      A: [{ name: "Build-Up Strides", prescription: "6 × 40 yd", cue: "Relax jaw and hands, let speed come to you.", videoQuery: "build up strides sprint" }],
      B: [{ name: "Flying 10s", prescription: "5 reps", cue: "Build for 20 yd, then float fast.", videoQuery: "flying 10m sprint drill" }],
      staple: [{ name: "A-Skip", prescription: "2 × 20 yd", videoQuery: "a skip drill" }],
    },
  },
  {
    component: c({ id: "cod-drills", type: "CHANGE_OF_DIRECTION", stress: "HIGH", priority: 3, baseVolume: 3, minimumVolume: 1, bodyRegion: "FULL", estimatedMinutes: 8 }),
    title: "Change of direction",
    kind: "PHYSICAL",
    rank: 6,
    pool: {
      A: [{ name: "5-10-5 Pro Agility", prescription: "5 reps", cue: "Low hips, punch the ground to cut.", videoQuery: "pro agility 5-10-5 shuttle technique" }],
      B: [{ name: "Lane Slide Touches", prescription: "5 reps", cue: "Stay low, feet never cross.", videoQuery: "defensive lane slide drill" }],
      staple: [{ name: "45° Cut Prep", prescription: "2 × 4 per side", videoQuery: "45 degree cut basketball" }],
    },
  },
  {
    component: c({ id: "decel-braking", type: "DECELERATION", stress: "HIGH", priority: 3, baseVolume: 3, minimumVolume: 1, bodyRegion: "LOWER", estimatedMinutes: 8 }),
    title: "Braking & landing",
    kind: "PHYSICAL",
    rank: 10,
    pool: {
      A: [{ name: "Sprint-to-Stop Holds", prescription: "6 reps", cue: "Three steps to a frozen finish.", videoQuery: "deceleration training sprint stop" }],
      B: [{ name: "Lateral Hop + Stick", prescription: "3 × 4 per side", cue: "Absorb through the hip, knee over toe.", videoQuery: "lateral hop stick landing" }],
      staple: [{ name: "Backpedal Breaks", prescription: "2 × 4", videoQuery: "backpedal to break basketball" }],
    },
  },
  {
    component: c({ id: "skill-ballhandling", type: "EXPLOSIVENESS", stress: "LOW", priority: 4, baseVolume: 3, bodyRegion: "FULL", estimatedMinutes: 12 }),
    title: "Ball-handling",
    kind: "SKILL",
    rank: 2,
    pool: {
      A: [{ name: "Figure-8 Dribble Series", prescription: "3 × 45 sec", cue: "Eyes up, ball talks to the floor.", videoQuery: "figure 8 basketball dribbling drill" }],
      B: [{ name: "Two-Ball Pound", prescription: "3 × 30 sec", cue: "Same rhythm both hands.", videoQuery: "two ball dribbling drill" }],
      staple: [{ name: "Crossover Walks", prescription: "2 × court length", videoQuery: "crossover walking dribble drill" }],
    },
  },
  {
    component: c({ id: "skill-shooting", type: "EXPLOSIVENESS", stress: "LOW", priority: 4, baseVolume: 3, bodyRegion: "FULL", estimatedMinutes: 12 }),
    title: "Shooting",
    kind: "SKILL",
    rank: 1,
    pool: {
      A: [{ name: "Form Shooting (5 spots)", prescription: "5 makes per spot", cue: "Same shot every time — legs to fingers.", videoQuery: "form shooting basketball drill" }],
      B: [{ name: "Free-Throw Rhythm Sets", prescription: "3 sets of 5", cue: "Same breath, same bounce, same routine.", videoQuery: "free throw routine practice" }],
      staple: [{ name: "Catch-and-Shoot Touch", prescription: "2 × 10", videoQuery: "catch and shoot drill" }],
    },
  },
  {
    component: c({ id: "skill-finishing", type: "EXPLOSIVENESS", stress: "LOW", priority: 4, baseVolume: 3, bodyRegion: "FULL", estimatedMinutes: 12 }),
    title: "Finishing",
    kind: "SKILL",
    rank: 2,
    pool: {
      A: [{ name: "Mikan Series", prescription: "3 × 30 sec", cue: "Soft touch off the glass, either hand.", videoQuery: "mikan drill" }],
      B: [{ name: "Reverse Layup Package", prescription: "3 × 4 per side", cue: "Eyes on the target, finish high.", videoQuery: "reverse layup footwork" }],
      staple: [{ name: "Two-Foot Finish Prep", prescription: "2 × 4 per side", videoQuery: "stride stop vs jump stop basketball footwork" }],
    },
  },
  {
    component: c({ id: "skill-passing-reads", type: "EXPLOSIVENESS", stress: "LOW", priority: 4, baseVolume: 3, bodyRegion: "FULL", estimatedMinutes: 12 }),
    title: "Passing & reads",
    kind: "SKILL",
    rank: 3,
    pool: {
      A: [{ name: "Wall Pass Targets", prescription: "3 × 10", cue: "Pass away from the target hand.", videoQuery: "wall passing drill basketball" }],
      B: [{ name: "Catch-Pivot-Scan", prescription: "3 × 8", cue: "Catch on two feet, scan before you decide.", videoQuery: "catch and pivot scanning drill" }],
      staple: [{ name: "Pass-and-Cut Walkthrough", prescription: "2 × 5", videoQuery: "pass and cut basketball drill" }],
    },
  },
  {
    component: c({ id: "mobility-recovery", type: "RECOVERY", stress: "RECOVERY", priority: 6, baseVolume: 1, bodyRegion: "FULL", estimatedMinutes: 5 }),
    title: "Mobility & recovery",
    kind: "RECOVERY",
    rank: 14,
    pool: {
      A: [{ name: "Hip & Ankle Flow", prescription: "5 min", cue: "Breathe slow, never bounce sharp.", videoQuery: "hip ankle mobility flow" }],
      B: [{ name: "Full-Body Stretch Flow", prescription: "5 min", videoQuery: "full body stretch routine basketball" }],
      staple: [{ name: "Box Breathing", prescription: "1 min", cue: "Four counts in, four out.", videoQuery: "box breathing" }],
    },
  },
  {
    component: c({ id: "recovery-hip-ankle", type: "RECOVERY", stress: "RECOVERY", priority: 6, baseVolume: 1, bodyRegion: "LOWER", estimatedMinutes: 5 }),
    title: "Hip & ankle care",
    kind: "RECOVERY",
    rank: 14,
    pool: {
      A: [{ name: "90/90 Hip Switches", prescription: "8 reps", cue: "Slow and controlled, no forcing.", videoQuery: "90 90 hip switch" }],
      B: [{ name: "Ankle Dorsiflexion Rocks", prescription: "2 × 10 per side", videoQuery: "ankle dorsiflexion mobility" }],
      staple: [{ name: "Calf Stretch", prescription: "2 × 30 sec per side", videoQuery: "calf stretch" }],
    },
  },
];

export function libraryBlockById(componentId: string): LibraryBlock | undefined {
  return BLOCK_LIBRARY.find((block) => block.component.id === componentId);
}

/**
 * Built-plan exercise detail for one block: the rotated variant's exercises
 * plus the staple. Deterministic on (blockId, variant).
 */
export function libraryExerciseDetail(
  componentId: string,
  variant: ExerciseVariantTag,
): { title: string; exercises: ReadonlyArray<ExerciseVariant> } | undefined {
  const block = libraryBlockById(componentId);
  if (block === undefined) return undefined;
  const rotated = block.pool[variant];
  return { title: block.title, exercises: [...rotated, ...block.pool.staple] };
}
