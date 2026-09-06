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
 *
 * PHASE 7 (body map): PHYSICAL blocks declare `muscleGroups` — the sore
 * areas they target, which the generator uses to apply the engine's
 * soreness scales. SKILL and RECOVERY blocks are deliberately untagged:
 * skill work and recovery never scale with soreness.
 *
 * PHASE 9.10: every exercise carries `steps` — the offline technique layer
 * (setup → execution → key point). `videoUrl` is an OPTIONAL curated,
 * specific demo video (youtube.com/watch?v=…): an online-only supplement,
 * never a search page. Search links are banned by guardrail test.
 */

import type { SoreArea, TrainingComponent } from "../types";

export type BlockKind = "PHYSICAL" | "SKILL" | "RECOVERY";
export type ExerciseVariantTag = "A" | "B";

export interface ExerciseVariant {
  name: string;
  /** e.g. "3 × 5 (heavy, explosive up)". */
  prescription: string;
  cue?: string;
  /** Numbered technique steps — the offline guidance layer. */
  steps: ReadonlyArray<string>;
  /** Curated specific demo video, online-only; search pages are forbidden. */
  videoUrl?: string;
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

/**
 * CURATED DRAFT — open each link once and confirm it plays the intended
 * demonstration from an appropriate channel before release; swapping a
 * video is a one-string edit here. Exercises without a confident pick get
 * steps only (no video) — steps are the guaranteed layer.
 */
const DEMO = {
  gobletFrontSquat: "https://www.youtube.com/watch?v=ultWZbUMPL8",
  dumbbellRdl: "https://www.youtube.com/watch?v=op9kVnSso6Q",
  calfRaise: "https://www.youtube.com/watch?v=-M4-G8p8fmc",
  wallSit: "https://www.youtube.com/watch?v=-M4-G8p8fmc",
  sprintMechanics: "https://www.youtube.com/watch?v=0E5wK8dbj4k",
  proAgility: "https://www.youtube.com/watch?v=IxSgtRHjVVU",
  cutting: "https://www.youtube.com/watch?v=IxSgtRHjVVU",
  ballHandling: "https://www.youtube.com/watch?v=8JkyBpL0sNY",
  shooting: "https://www.youtube.com/watch?v=8JkyBpL0sNY",
  mobilityFlow: "https://www.youtube.com/watch?v=4BOTvaRaDjI",
} as const;

/** Shared technique steps — the same movement teaches the same everywhere. */
const st = {
  gobletFrontSquat: [
    "Hold one dumbbell vertically at the chest, elbows tucked underneath it.",
    "Sit straight down between the feet — chest tall, knees tracking the toes.",
    "Drive up through the whole foot without letting the elbows drift.",
  ],
  calfRaise: [
    "Stand on one foot on a step, heel off the edge, hand on a wall for balance.",
    "Press up onto the ball of the foot as high as possible and pause a beat.",
    "Lower slowly until the calf stretches — that control is the rep.",
  ],
  rdl: [
    "Stand tall with dumbbells at the sides, knees softly bent.",
    "Push the hips back and slide the weights down the legs until the hamstrings load.",
    "Drive the hips forward to stand — the back stays flat the entire way.",
  ],
  wallSit: [
    "Slide down a wall until the knees sit at 90 degrees.",
    "Keep the whole back on the wall and breathe steadily.",
    "Hold the time — the burn is the point.",
  ],
  pogoHops: [
    "Bounce on the spot with stiff ankles and mostly straight knees.",
    "Minimal ground time — snap off the floor like a spring.",
    "Stay quiet: soft, silent landings.",
  ],
  explosivePushUp: [
    "Set up like a push-up, body rigid, hands just outside the shoulders.",
    "Lower, then explode up so the hands leave the floor.",
    "Catch soft with bent elbows and reset fully between reps.",
  ],
  sprintStart: [
    "Set up facing the direction of the run, weight ready to explode forward.",
    "Explode out low for the first three steps — they own the floor.",
    "Walk back and take the full rest — max quality every rep.",
  ],
  ankling: [
    "Walk on the balls of the feet with stiff ankles, toes pointed forward.",
    "Snap the foot down fast under the hips — small, quick contacts.",
    "One length or set distance, then walk back and reset.",
  ],
  flying10: [
    "Build up to a jog over 20 meters, then hit top speed through the 10-meter zone.",
    "Stay relaxed at max speed — loose jaw, calm face, quick feet.",
    "Full walk-back recovery between reps.",
  ],
  proAgility: [
    "Straddle the middle line in a low athletic stance.",
    "Turn and sprint 5 meters, touch the line, sprint 10 meters the other way.",
    "Touch, then sprint 5 meters back through the middle — hips low on every turn.",
  ],
  ballHandlingEyesUp: [
    "Handle the ball hard and low with the eyes UP the whole time.",
    "Call out what you see while you work — scanning is the skill.",
    "Switch hands and heights before fatigue changes your form.",
  ],
  shootingRoutine: [
    "Same routine every time — same breath, same dip, same release.",
    "Hold the follow-through and watch the ball all the way in.",
    "Track the makes out loud; quality over speed.",
  ],
} as const;

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
    component: c({ id: "primary-lower-squat", type: "STRENGTH", stress: "HIGH", priority: 1, baseVolume: 4, minimumVolume: 2, bodyRegion: "LOWER", estimatedMinutes: 16, muscleGroups: ["QUAD"] as readonly SoreArea[] }),
    title: "Squat pattern strength",
    kind: "PHYSICAL",
    rank: 1,
    pool: {
      A: [{ name: "Goblet Front Squat", prescription: "3 × 5", cue: "Elbows tucked, knees track over toes.", steps: st.gobletFrontSquat, videoUrl: DEMO.gobletFrontSquat }],
      B: [
        {
          name: "Split Squat",
          prescription: "3 × 6 per leg",
          cue: "Front shin vertical, drive through the floor.",
          steps: [
            "Stagger the feet into a split stance, torso tall.",
            "Lower straight down until the back knee kisses the floor.",
            "Drive through the front foot to stand — no leaning forward.",
          ],
        },
      ],
      staple: [{ name: "Single-Leg Calf Raises", prescription: "3 × 10 per leg", cue: "Slow down, quick up.", steps: st.calfRaise, videoUrl: DEMO.calfRaise }],
    },
  },
  {
    component: c({ id: "primary-lower-hinge", type: "STRENGTH", stress: "HIGH", priority: 1, baseVolume: 4, minimumVolume: 2, bodyRegion: "LOWER", estimatedMinutes: 16, muscleGroups: ["HAMSTRING"] as readonly SoreArea[] }),
    title: "Hip hinge strength",
    kind: "PHYSICAL",
    rank: 2,
    pool: {
      A: [{ name: "Dumbbell Romanian Deadlift", prescription: "3 × 8", cue: "Push the hips back, flat back.", steps: st.rdl, videoUrl: DEMO.dumbbellRdl }],
      B: [
        {
          name: "Glute Bridge",
          prescription: "3 × 10",
          cue: "Squeeze at the top, ribs down.",
          steps: [
            "Lie on your back, knees bent, feet flat at hip width.",
            "Drive through the heels and squeeze the glutes at the top.",
            "Ribs stay down — no arching the low back anywhere in the rep.",
          ],
        },
      ],
      staple: [
        {
          name: "Wall Hip Hinge Drill",
          prescription: "2 × 8",
          cue: "Nose to the wall, hips back.",
          steps: [
            "Stand facing a wall, toes a few inches from it.",
            "Push the hips back and hinge until the nose nearly touches.",
            "Stand up keeping the same hinge — that's the groove.",
          ],
        },
      ],
    },
  },
  {
    component: c({ id: "lower-split-squat", type: "STRENGTH", stress: "HIGH", priority: 2, baseVolume: 3, minimumVolume: 2, bodyRegion: "LOWER", estimatedMinutes: 12, muscleGroups: ["QUAD"] as readonly SoreArea[] }),
    title: "Single-leg strength",
    kind: "PHYSICAL",
    rank: 6,
    pool: {
      A: [
        {
          name: "Alternating Split Squat",
          prescription: "3 × 6 per leg",
          cue: "Torso tall, back knee kisses the floor.",
          steps: [
            "Stagger the feet into a split stance, torso tall.",
            "Lower until the back knee kisses the floor, then drive up.",
            "Switch legs each rep — front shin stays vertical.",
          ],
        },
      ],
      B: [
        {
          name: "Lateral Lunge",
          prescription: "3 × 6 per side",
          cue: "Sit into the working hip, other leg straight.",
          steps: [
            "Step wide to one side and sit the hip back over that foot.",
            "Keep the other leg straight and both toes pointing forward.",
            "Push back to standing through the bent-leg heel.",
          ],
        },
      ],
      staple: [{ name: "Wall Sit", prescription: "2 × 30 sec", steps: st.wallSit, videoUrl: DEMO.wallSit }],
    },
  },
  {
    component: c({ id: "lower-calf-ankle", type: "STRENGTH", stress: "HIGH", priority: 4, baseVolume: 3, minimumVolume: 2, bodyRegion: "LOWER", estimatedMinutes: 8, muscleGroups: ["CALF", "ANKLE", "FOOT"] as readonly SoreArea[] }),
    title: "Calf & ankle complex",
    kind: "PHYSICAL",
    rank: 9,
    pool: {
      A: [{ name: "Single-Leg Calf Raises", prescription: "3 × 12 per leg", cue: "Slow down, quick up.", steps: st.calfRaise, videoUrl: DEMO.calfRaise }],
      B: [{ name: "Pogo Hops (low)", prescription: "3 × 15", cue: "Stiff ankles, bounce off the floor.", steps: st.pogoHops }],
      staple: [
        {
          name: "Ankle Circles & Tib Raises",
          prescription: "2 × 10",
          steps: [
            "Circle each ankle slowly in both directions.",
            "Then lean into a wall and rock the knees forward over the toes.",
            "Heels stay glued down on the tib raises.",
          ],
        },
      ],
    },
  },
  {
    component: c({ id: "primary-upper-push", type: "STRENGTH", stress: "HIGH", priority: 1, baseVolume: 4, minimumVolume: 2, bodyRegion: "UPPER", estimatedMinutes: 16, muscleGroups: ["ARM", "SHOULDER"] as readonly SoreArea[] }),
    title: "Upper push strength",
    kind: "PHYSICAL",
    rank: 3,
    pool: {
      A: [
        {
          name: "Push-Up",
          prescription: "3 × 8-12",
          cue: "Body in one line, chest to fists.",
          steps: [
            "Hands just outside the shoulders, body in one straight line.",
            "Lower the chest toward the floor, elbows at about 45 degrees.",
            "Press the floor away to a full lockout — no hip sag.",
          ],
        },
      ],
      B: [
        {
          name: "Dumbbell Floor Press",
          prescription: "3 × 8",
          cue: "Elbows at 45°, control the way down.",
          steps: [
            "Lie on the floor, dumbbells over the chest, elbows at 45 degrees.",
            "Lower until the upper arms rest on the floor.",
            "Press up and slightly together — control, never bounce.",
          ],
        },
      ],
      staple: [{ name: "Explosive Push-Up (low)", prescription: "2 × 5", cue: "Fast up, soft catch.", steps: st.explosivePushUp }],
    },
  },
  {
    component: c({ id: "primary-upper-pull", type: "STRENGTH", stress: "HIGH", priority: 1, baseVolume: 4, minimumVolume: 2, bodyRegion: "UPPER", estimatedMinutes: 14, muscleGroups: ["ARM", "SHOULDER"] as readonly SoreArea[] }),
    title: "Upper pull strength",
    kind: "PHYSICAL",
    rank: 4,
    pool: {
      A: [
        {
          name: "Backpack Row",
          prescription: "3 × 10 per arm",
          cue: "Pull to the hip, shoulder blade back.",
          steps: [
            "Hold a loaded backpack in one hand, other hand braced on a bench.",
            "Pull the weight to the hip, driving the elbow back.",
            "Squeeze the shoulder blade, then lower under control.",
          ],
        },
      ],
      B: [
        {
          name: "Towel Iso Row",
          prescription: "3 × 20 sec",
          cue: "Squeeze hard, breathe steady.",
          steps: [
            "Wrap a towel around a sturdy anchor and grip both ends.",
            "Lean back into a row position and pull hard.",
            "Hold 20 seconds breathing steady — no shrugging.",
          ],
        },
      ],
      staple: [
        {
          name: "Prone Y-Raise",
          prescription: "2 × 10",
          steps: [
            "Lie face-down with the arms overhead in a Y, thumbs up.",
            "Lift the arms and chest, squeezing between the shoulder blades.",
            "Lower slowly — a small movement with big control.",
          ],
        },
      ],
    },
  },
  {
    component: c({ id: "accessory-upper", type: "STRENGTH", stress: "LOW", priority: 5, baseVolume: 3, optional: true, bodyRegion: "UPPER", estimatedMinutes: 10, muscleGroups: ["ARM", "SHOULDER"] as readonly SoreArea[] }),
    title: "Upper accessory",
    kind: "PHYSICAL",
    rank: 12,
    pool: {
      A: [
        {
          name: "Push-Up Plus",
          prescription: "2 × 10",
          cue: "Push the floor away at the top.",
          steps: [
            "Do a push-up, then at the top push the floor away extra hard.",
            "The shoulder blades spread wide at the top — that's the point.",
            "Keep the body rigid the whole time.",
          ],
        },
      ],
      B: [
        {
          name: "Doorway Row",
          prescription: "2 × 12",
          steps: [
            "Grip a sturdy doorframe at waist height.",
            "Lean back on straight arms, body rigid.",
            "Pull the chest to the frame and lower slowly.",
          ],
        },
      ],
      staple: [
        {
          name: "Arm Circles",
          prescription: "2 × 10 each way",
          steps: [
            "Arms out wide, draw small circles forward.",
            "Grow the circles bigger, then reverse direction.",
            "Stay tall — this is a warm-up, not a burnout.",
          ],
        },
      ],
    },
  },
  {
    component: c({ id: "accessory-core", type: "STRENGTH", stress: "LOW", priority: 5, baseVolume: 2, optional: true, bodyRegion: "FULL", estimatedMinutes: 6, muscleGroups: ["ABS"] as readonly SoreArea[] }),
    title: "Core strength",
    kind: "PHYSICAL",
    rank: 11,
    pool: {
      A: [
        {
          name: "Front Plank",
          prescription: "3 × 30 sec",
          cue: "Ribs down, squeeze glutes.",
          steps: [
            "Forearms down, elbows under the shoulders, body one line.",
            "Ribs down, squeeze the glutes, breathe steady.",
            "Hold the time — stop when the hips sag.",
          ],
        },
      ],
      B: [
        {
          name: "Side Plank",
          prescription: "3 × 20 sec per side",
          steps: [
            "Stack the feet, elbow directly under the shoulder.",
            "Lift the hips into one straight line.",
            "Hold 20 seconds per side with steady breathing.",
          ],
        },
      ],
      staple: [
        {
          name: "Dead Bug",
          prescription: "2 × 8 per side",
          cue: "Low back stays glued down.",
          steps: [
            "Lie on your back, arms up, knees bent at 90 degrees.",
            "Lower one arm and the opposite leg toward the floor.",
            "Return without letting the low back leave the ground.",
          ],
        },
      ],
    },
  },
  {
    component: c({ id: "explosive-jumps", type: "EXPLOSIVENESS", stress: "HIGH", priority: 2, baseVolume: 4, minimumVolume: 2, bodyRegion: "LOWER", estimatedMinutes: 10, muscleGroups: ["QUAD", "CALF", "ANKLE"] as readonly SoreArea[] }),
    title: "Jump mechanics",
    kind: "PHYSICAL",
    rank: 5,
    pool: {
      A: [{ name: "Pogo Hops", prescription: "4 × 10", cue: "Stiff ankles, minimal ground time.", steps: st.pogoHops }],
      B: [
        {
          name: "Squat Jump + Stick",
          prescription: "4 × 5",
          cue: "Land soft, freeze for one second.",
          steps: [
            "Quarter squat, arms back.",
            "Jump straight up and land soft, freezing for one second.",
            "Stick it — quiet feet, knee tracking over the toe.",
          ],
        },
      ],
      staple: [
        {
          name: "Ankle Rock Prep",
          prescription: "2 × 8",
          steps: [
            "Kneel on one knee with the front foot flat.",
            "Rock the knee forward over the toes, heel glued down.",
            "Controlled reps — this primes the ankle for jumping.",
          ],
        },
      ],
    },
  },
  {
    component: c({ id: "explosive-broad-response", type: "EXPLOSIVENESS", stress: "HIGH", priority: 3, baseVolume: 3, minimumVolume: 1, bodyRegion: "LOWER", estimatedMinutes: 8, muscleGroups: ["QUAD", "CALF"] as readonly SoreArea[] }),
    title: "Broad jump & response",
    kind: "PHYSICAL",
    rank: 8,
    pool: {
      A: [
        {
          name: "Broad Jump + Stick",
          prescription: "3 × 3",
          cue: "Throw the arms, land like a spring.",
          steps: [
            "Throw the arms and jump forward for distance.",
            "Land like a spring — hips back, quiet feet.",
            "Freeze for one second to own the landing.",
          ],
        },
      ],
      B: [
        {
          name: "Single-Leg Hop + Stick",
          prescription: "3 × 3 per leg",
          cue: "Knee tracks over toes on landing.",
          steps: [
            "Hop forward on one leg.",
            "Land with the knee tracking over the toes.",
            "Freeze and balance for one second before the next rep.",
          ],
        },
      ],
      staple: [
        {
          name: "Vertical Jump Practice",
          prescription: "3 reps",
          cue: "Full arm swing every time.",
          steps: [
            "Stand tall, take a quick dip to a quarter squat.",
            "Jump at maximum height with a full arm swing.",
            "Land soft and reset fully between reps.",
          ],
        },
      ],
    },
  },
  {
    component: c({ id: "explosive-upper-power", type: "EXPLOSIVENESS", stress: "HIGH", priority: 3, baseVolume: 3, minimumVolume: 1, bodyRegion: "UPPER", estimatedMinutes: 8, muscleGroups: ["ARM", "SHOULDER"] as readonly SoreArea[] }),
    title: "Upper-body power",
    kind: "PHYSICAL",
    rank: 13,
    pool: {
      A: [{ name: "Explosive Push-Up", prescription: "3 × 5", cue: "Maximum height, soft catch.", steps: st.explosivePushUp }],
      B: [
        {
          name: "Wall Chest Pass",
          prescription: "3 × 8",
          cue: "Snap the ball, catch and repeat.",
          steps: [
            "Face a wall with a medicine ball held at the chest.",
            "Snap the ball into the wall with straight arms.",
            "Catch and repeat — fast hands, steady feet.",
          ],
        },
      ],
      staple: [
        {
          name: "Arm Swing Practice",
          prescription: "2 × 8",
          steps: [
            "Stand tall and groove the jump arm swing.",
            "Arms explode up as the body extends.",
            "No jump needed — this builds the timing.",
          ],
        },
      ],
    },
  },
  {
    component: c({ id: "acceleration-sprints", type: "SPEED", stress: "HIGH", priority: 2, baseVolume: 3, minimumVolume: 1, bodyRegion: "FULL", estimatedMinutes: 8, muscleGroups: ["QUAD", "HAMSTRING", "CALF", "ANKLE", "FOOT"] as readonly SoreArea[] }),
    title: "Acceleration",
    kind: "PHYSICAL",
    rank: 7,
    pool: {
      A: [
        {
          name: "10-Yard Push Sprints",
          prescription: "6 reps",
          cue: "Low angle, punch the ground back.",
          steps: st.sprintStart,
          videoUrl: DEMO.sprintMechanics,
        },
      ],
      B: [
        {
          name: "Push-Up Start Sprints",
          prescription: "6 reps",
          cue: "Pop up and go — first three steps own the floor.",
          steps: [
            "Set up in a push-up position facing the direction of the run.",
            "Pop to the feet and explode into a forward lean.",
            "Walk back — the first three steps own the floor every rep.",
          ],
          videoUrl: DEMO.sprintMechanics,
        },
      ],
      staple: [{ name: "Ankling Drill", prescription: "2 × 10 yd", steps: st.ankling, videoUrl: DEMO.sprintMechanics }],
    },
  },
  {
    component: c({ id: "speed-strides", type: "SPEED", stress: "HIGH", priority: 3, baseVolume: 3, minimumVolume: 1, bodyRegion: "FULL", estimatedMinutes: 10, muscleGroups: ["QUAD", "HAMSTRING", "CALF", "ANKLE", "FOOT"] as readonly SoreArea[] }),
    title: "Top speed strides",
    kind: "PHYSICAL",
    rank: 10,
    pool: {
      A: [
        {
          name: "Build-Up Strides",
          prescription: "6 × 40 yd",
          cue: "Relax jaw and hands, let speed come to you.",
          steps: [
            "Accelerate smoothly over 40 yards, growing speed every step.",
            "Stay relaxed — loose jaw, calm hands, quick feet.",
            "Walk back fully before the next stride.",
          ],
          videoUrl: DEMO.sprintMechanics,
        },
      ],
      B: [{ name: "Flying 10s", prescription: "5 reps", cue: "Build for 20 yd, then float fast.", steps: st.flying10, videoUrl: DEMO.sprintMechanics }],
      staple: [
        {
          name: "A-Skip",
          prescription: "2 × 20 yd",
          steps: [
            "Skip down the field driving each knee up high.",
            "Punch the ground back under the hips, posture tall.",
            "Rhythm over height — quick, snappy contacts.",
          ],
          videoUrl: DEMO.sprintMechanics,
        },
      ],
    },
  },
  {
    component: c({ id: "cod-drills", type: "CHANGE_OF_DIRECTION", stress: "HIGH", priority: 3, baseVolume: 3, minimumVolume: 1, bodyRegion: "FULL", estimatedMinutes: 8, muscleGroups: ["QUAD", "ANKLE", "KNEE", "CALF"] as readonly SoreArea[] }),
    title: "Change of direction",
    kind: "PHYSICAL",
    rank: 6,
    pool: {
      A: [{ name: "5-10-5 Pro Agility", prescription: "5 reps", cue: "Low hips, punch the ground to cut.", steps: st.proAgility, videoUrl: DEMO.proAgility }],
      B: [
        {
          name: "Lane Slide Touches",
          prescription: "5 reps",
          cue: "Stay low, feet never cross.",
          steps: [
            "Set up on a lane line in a low defensive stance.",
            "Slide laterally and touch the line with the far hand.",
            "Feet never cross — stay low through the whole rep.",
          ],
          videoUrl: DEMO.cutting,
        },
      ],
      staple: [
        {
          name: "45° Cut Prep",
          prescription: "2 × 4 per side",
          steps: [
            "Jog toward the cut point.",
            "Plant the outside foot at 45 degrees, hips low, chest over the knee.",
            "Push out of the cut smoothly — 4 reps per side.",
          ],
          videoUrl: DEMO.cutting,
        },
      ],
    },
  },
  {
    component: c({ id: "decel-braking", type: "DECELERATION", stress: "HIGH", priority: 3, baseVolume: 3, minimumVolume: 1, bodyRegion: "LOWER", estimatedMinutes: 8, muscleGroups: ["QUAD", "HAMSTRING", "CALF", "KNEE", "ANKLE"] as readonly SoreArea[] }),
    title: "Braking & landing",
    kind: "PHYSICAL",
    rank: 10,
    pool: {
      A: [
        {
          name: "Sprint-to-Stop Holds",
          prescription: "6 reps",
          cue: "Three steps to a frozen finish.",
          steps: [
            "Build to a controlled sprint.",
            "Stop in three steps — the last one freezes in a low hold.",
            "Own the stop: chest over the knee, quiet feet.",
          ],
        },
      ],
      B: [
        {
          name: "Lateral Hop + Stick",
          prescription: "3 × 4 per side",
          cue: "Absorb through the hip, knee over toe.",
          steps: [
            "Hop sideways off one leg.",
            "Absorb through the hip, knee tracking over the toe.",
            "Freeze the landing — no extra hops.",
          ],
        },
      ],
      staple: [
        {
          name: "Backpedal Breaks",
          prescription: "2 × 4",
          steps: [
            "Backpedal with quick, low steps.",
            "Break forward into a short sprint on the turn.",
            "Stay low through the whole transition.",
          ],
        },
      ],
    },
  },
  {
    component: c({ id: "skill-ballhandling", type: "EXPLOSIVENESS", stress: "LOW", priority: 4, baseVolume: 3, bodyRegion: "FULL", estimatedMinutes: 12 }),
    title: "Ball-handling",
    kind: "SKILL",
    rank: 2,
    pool: {
      A: [
        {
          name: "Figure-8 Dribble Series",
          prescription: "3 × 45 sec",
          cue: "Eyes up, ball talks to the floor.",
          steps: st.ballHandlingEyesUp,
          videoUrl: DEMO.ballHandling,
        },
      ],
      B: [
        {
          name: "Two-Ball Pound",
          prescription: "3 × 30 sec",
          cue: "Same rhythm both hands.",
          steps: st.ballHandlingEyesUp,
          videoUrl: DEMO.ballHandling,
        },
      ],
      staple: [
        {
          name: "Crossover Walks",
          prescription: "2 × court length",
          steps: [
            "Walk the length of the court with a low, live dribble.",
            "Crossover every two steps.",
            "Eyes up — scan while you walk.",
          ],
          videoUrl: DEMO.ballHandling,
        },
      ],
    },
  },
  {
    component: c({ id: "skill-shooting", type: "EXPLOSIVENESS", stress: "LOW", priority: 4, baseVolume: 3, bodyRegion: "FULL", estimatedMinutes: 12 }),
    title: "Shooting",
    kind: "SKILL",
    rank: 1,
    pool: {
      A: [
        {
          name: "Form Shooting (5 spots)",
          prescription: "5 makes per spot",
          cue: "Same shot every time — legs to fingers.",
          steps: [
            "Start close: one hand, perfect form, shot from the legs up.",
            "Shoot from 5 spots, 5 makes each before moving.",
            "Same shot every time — legs to fingers.",
          ],
          videoUrl: DEMO.shooting,
        },
      ],
      B: [
        {
          name: "Free-Throw Rhythm Sets",
          prescription: "3 sets of 5",
          cue: "Same breath, same bounce, same routine.",
          steps: st.shootingRoutine,
          videoUrl: DEMO.shooting,
        },
      ],
      staple: [
        {
          name: "Catch-and-Shoot Touch",
          prescription: "2 × 10",
          steps: [
            "Feet ready before the ball arrives.",
            "Catch on the one-two step into a smooth shot.",
            "2 sets of 10 — groove the timing.",
          ],
          videoUrl: DEMO.shooting,
        },
      ],
    },
  },
  {
    component: c({ id: "skill-finishing", type: "EXPLOSIVENESS", stress: "LOW", priority: 4, baseVolume: 3, bodyRegion: "FULL", estimatedMinutes: 12 }),
    title: "Finishing",
    kind: "SKILL",
    rank: 2,
    pool: {
      A: [
        {
          name: "Mikan Series",
          prescription: "3 × 30 sec",
          cue: "Soft touch off the glass, either hand.",
          steps: [
            "Under the rim: layup right, catch, layup left — continuous.",
            "Soft touch off the glass with either hand.",
            "Stay on two feet at every catch — 30 seconds per set.",
          ],
        },
      ],
      B: [
        {
          name: "Reverse Layup Package",
          prescription: "3 × 4 per side",
          cue: "Eyes on the target, finish high.",
          steps: [
            "Attack from the wing and plant outside the paint.",
            "Finish high off the glass on the far side.",
            "Eyes on the target the whole way — 4 per side.",
          ],
        },
      ],
      staple: [
        {
          name: "Two-Foot Finish Prep",
          prescription: "2 × 4 per side",
          steps: [
            "Attack the paint and stop on two feet.",
            "Stride stop or jump stop — balance comes first.",
            "Finish high and land soft — 4 per side.",
          ],
        },
      ],
    },
  },
  {
    component: c({ id: "skill-passing-reads", type: "EXPLOSIVENESS", stress: "LOW", priority: 4, baseVolume: 3, bodyRegion: "FULL", estimatedMinutes: 12 }),
    title: "Passing & reads",
    kind: "SKILL",
    rank: 3,
    pool: {
      A: [
        {
          name: "Wall Pass Targets",
          prescription: "3 × 10",
          cue: "Pass away from the target hand.",
          steps: [
            "Pass to a marked target on the wall.",
            "Lead it — pass away from the target hand.",
            "3 sets of 10, snapping passes.",
          ],
        },
      ],
      B: [
        {
          name: "Catch-Pivot-Scan",
          prescription: "3 × 8",
          cue: "Catch on two feet, scan before you decide.",
          steps: [
            "Catch on two feet and pivot away from pressure.",
            "Scan the floor before deciding.",
            "Freeze, call the read out loud, then next rep.",
          ],
        },
      ],
      staple: [
        {
          name: "Pass-and-Cut Walkthrough",
          prescription: "2 × 5",
          steps: [
            "Pass, then cut hard to the basket.",
            "Time it: pass on the cutter's first step.",
            "2 sets of 5 reps at walkthrough speed.",
          ],
        },
      ],
    },
  },
  {
    component: c({ id: "mobility-recovery", type: "RECOVERY", stress: "RECOVERY", priority: 6, baseVolume: 1, bodyRegion: "FULL", estimatedMinutes: 5 }),
    title: "Mobility & recovery",
    kind: "RECOVERY",
    rank: 14,
    pool: {
      A: [
        {
          name: "Hip & Ankle Flow",
          prescription: "5 min",
          cue: "Breathe slow, never bounce sharp.",
          steps: [
            "Slow flow: hip circles, deep squat holds, ankle rocks.",
            "Breathe slow — never bounce sharp into a position.",
            "5 minutes of easy range.",
          ],
          videoUrl: DEMO.mobilityFlow,
        },
      ],
      B: [
        {
          name: "Full-Body Stretch Flow",
          prescription: "5 min",
          steps: [
            "Long, slow stretches from head to toe.",
            "Hold each position 20–30 seconds, breathing.",
            "Never bounce sharp into a stretch.",
          ],
          videoUrl: DEMO.mobilityFlow,
        },
      ],
      staple: [
        {
          name: "Box Breathing",
          prescription: "1 min",
          cue: "Four counts in, four out.",
          steps: [
            "Breathe in for four counts.",
            "Hold four, out four, hold four.",
            "Repeat for one minute.",
          ],
        },
      ],
    },
  },
  {
    component: c({ id: "recovery-hip-ankle", type: "RECOVERY", stress: "RECOVERY", priority: 6, baseVolume: 1, bodyRegion: "LOWER", estimatedMinutes: 5 }),
    title: "Hip & ankle care",
    kind: "RECOVERY",
    rank: 14,
    pool: {
      A: [
        {
          name: "90/90 Hip Switches",
          prescription: "8 reps",
          cue: "Slow and controlled, no forcing.",
          steps: [
            "Sit with both knees bent at 90 degrees.",
            "Switch the legs side to side without using the hands.",
            "Slow and controlled — never force the range.",
          ],
        },
      ],
      B: [
        {
          name: "Ankle Dorsiflexion Rocks",
          prescription: "2 × 10 per side",
          steps: [
            "Kneel with the front foot flat.",
            "Rock the knee forward over the toes, heel glued down.",
            "2 sets of 10 per side, easy range.",
          ],
        },
      ],
      staple: [
        {
          name: "Calf Stretch",
          prescription: "2 × 30 sec per side",
          steps: [
            "Hands on a wall, one leg back, heel pressed down.",
            "Hold 30 seconds per side, breathing easy.",
            "Straight back knee first, then soften it for the lower calf.",
          ],
        },
      ],
    },
  },
];

export function libraryBlockById(componentId: string): LibraryBlock | undefined {
  return BLOCK_LIBRARY.find((block) => block.component.id === componentId);
}

/** A basketball-skill family the athlete can pick in a customized plan. */
export interface SkillOption {
  /** SKILL block id in BLOCK_LIBRARY. */
  id: string;
  label: string;
  emoji: string;
}

/**
 * The basketball-skill choices for the customized plan path (pick 1–3).
 * Verified against BLOCK_LIBRARY: every id resolves to a SKILL block.
 */
export const SKILL_OPTIONS: readonly SkillOption[] = [
  { id: "skill-ballhandling", label: "Ball-handling", emoji: "🏀" },
  { id: "skill-shooting", label: "Shooting", emoji: "🎯" },
  { id: "skill-finishing", label: "Finishing", emoji: "🚀" },
  { id: "skill-passing-reads", label: "Passing & reads", emoji: "👀" },
];

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
