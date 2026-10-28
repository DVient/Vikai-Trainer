# VIKAI — TECHNICAL BUILD SPECIFICATION
*Version 4.0 — Adaptive Performance Engine*

---

## 1. PRODUCT OBJECTIVE & ATHLETE PROFILE

### 1.1 Product Purpose
Vikai is an adaptive basketball performance application designed for youth athletes[cite: 3].

* **Primary Sport:** Basketball[cite: 3]
* **Default Training Objectives:**
  * Strength[cite: 3]
  * Explosiveness[cite: 3]
  * Change of Direction[cite: 3]
* **Training Framework:** Charlie Francis-inspired principles (applied appropriately for youth development)[cite: 3]
* **Real-World Constraints:** Basketball practices, games, school schedule, travel/bus commute, fatigue, daily readiness, and unmonitored physical activity[cite: 3].

### 1.2 Default Athlete Profile
The system initializes with a default baseline profile[cite: 3]. User, parent, coach, or administrative configuration inputs may override any value[cite: 3].

```typescript
const defaultAthleteProfile = {
  sport: "BASKETBALL",
  ageGroup: "YOUTH",
  heightInches: 72,
  weightLbs: 140,
  primaryGoals: [
    "STRENGTH",
    "EXPLOSIVENESS",
    "CHANGE_OF_DIRECTION"
  ],
  practicesPerWeek: 3,
  practiceWeekdays: [2, 3, 4],
  practiceTime: "18:00",
  seasonStart: "2026-09-14",
  firstGame: "2026-10-15",
  schoolStartTime: "09:00",
  schoolEndTime: "15:30",
  commuteMinutes: 40
};

```

---

## 2. TRAINING PHILOSOPHY

The system applies compatible Charlie Francis-inspired training principles suited for a youth basketball context:

* **High/Low Organization:** Strict separation of high-stress and low-stress training days.


* **CNS Stress Management:** Central nervous system recovery is prioritized to maintain athletic movement quality.


* **Quality Over Fatigue:** High-intensity work must be performed under low fatigue; avoid turning every session into conditioning or junk volume.


* **Consolidated Stress:** Group demanding physical elements together where appropriate to protect full recovery windows.


* **Speed/Power Exposure:** Prioritize pristine acceleration, jumping, and change-of-direction mechanics without fatigue-induced degradation.



### 2.1 Basketball-Specific Adaptation

Track sprint models must not be blindly replicated. The training engine explicitly accounts for:

* Acceleration and deceleration


* Multi-planar change of direction


* Vertical jumping and landing mechanics


* Repeated game demands and practice loads


* Skill development and age-appropriate strength progression



---

## 3. SYSTEM ARCHITECTURE

```
Athlete Profile
       │
       ▼
Default Training Objective
       │
       ▼
Base Training Plan
       │
       ├──────────────┐
       ▼              ▼
   Schedule     Athlete Inputs
       │              │
       └──────┬───────┘
              ▼
    Autoregulation Engine
              │
              ▼
     Training Constraints
              │
              ▼
      Workout Generator
              │
              ▼
     Today's Prescription
              │
              ▼
         Workout Log
              │
              ▼
    Future Adaptation Data

```

Note: The readiness/autoregulation engine provides boundaries and restrictions; it does NOT directly own or hardcode the workout program.

---

## 4. CORE DOMAINS

Athlete Profile, Goals, Schedule, Readiness, Activity Workload, Training Plan, Workout, Autoregulation, Recovery, Notifications, History.

---

## 5. TECH STACK

* **Mobile Frontend:** React Native, Expo, TypeScript (Strict Mode), Expo Router, NativeWind (Tailwind CSS)


* **Client State & Storage:** Zustand with persistent local storage (AsyncStorage / MMKV)


* **Architecture Directive:** Serverless, purely local client architecture. No custom webservers, no Supabase, and no remote database connectivity.



---

## 6. CORE DOMAIN TYPES

```typescript
type TrainingGoal =
  | "STRENGTH"
  | "EXPLOSIVENESS"
  | "CHANGE_OF_DIRECTION"
  | "ACCELERATION"
  | "DECELERATION"
  | "SPEED"
  | "RECOVERY";

type AthleteLevel =
  | "YOUTH"
  | "HIGH_SCHOOL"
  | "ADULT";

type Sport =
  | "BASKETBALL";

type EngineStatus =
  | "CHECKIN_REQUIRED"
  | "INSUFFICIENT_DATA"
  | "GREEN"
  | "YELLOW"
  | "RED";

```

---

## 7. ATHLETE PROFILE SCHEMA

```typescript
type AthleteProfile = {
  id: string;
  displayName: string;
  sport: Sport;
  athleteLevel: AthleteLevel;
  birthDate?: string;
  heightInches?: number;
  weightLbs?: number;
  primaryGoals: TrainingGoal[];
  timezone: string;
  createdAt: string;
  updatedAt: string;
};

```

Height and weight are strictly optional and must not block workout generation.

---

## 8. DEFAULT TRAINING OBJECTIVE SCHEMA

```typescript
type TrainingObjective = {
  primaryGoals: TrainingGoal[];
  philosophy: {
    highLowOrganization: boolean;
    qualityOverVolume: boolean;
    fatigueManagement: boolean;
    consolidateHighStress: boolean;
    prioritizeRecovery: boolean;
  };
  sportRequirements: {
    acceleration: boolean;
    deceleration: boolean;
    changeOfDirection: boolean;
    jumping: boolean;
    landing: boolean;
    basketballSkillCompatibility: boolean;
  };
};

const DEFAULT_OBJECTIVE: TrainingObjective = {
  primaryGoals: [
    "STRENGTH",
    "EXPLOSIVENESS",
    "CHANGE_OF_DIRECTION"
  ],
  philosophy: {
    highLowOrganization: true,
    qualityOverVolume: true,
    fatigueManagement: true,
    consolidateHighStress: true,
    prioritizeRecovery: true
  },
  sportRequirements: {
    acceleration: true,
    deceleration: true,
    changeOfDirection: true,
    jumping: true,
    landing: true,
    basketballSkillCompatibility: true
  }
};

```

---

## 9. SCHEDULE MODEL

Scheduled events (future/planned) and activity logs (completed) are distinct models.

### 9.1 Scheduled Event Model

```typescript
type ScheduledEventType =
  | "TEAM_PRACTICE"
  | "GAME"
  | "STRENGTH_SESSION"
  | "SKILL_SESSION"
  | "SCHOOL"
  | "OTHER";

type ScheduledEvent = {
  id: string;
  eventType: ScheduledEventType;
  startAt: string; // ISO String
  endAt?: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
};

```

### 9.2 Completed Activity Types

```typescript
type ActivityType =
  | "TEAM_PRACTICE"
  | "GAME"
  | "SCHOOL_PE"
  | "FITNESS_TESTING"
  | "PICKUP_BASKETBALL"
  | "SKILL_WORK"
  | "STRENGTH_TRAINING"
  | "SPEED_TRAINING"
  | "OTHER";

```

---

## 10. ACTIVITY LOGGING

```typescript
type ActivityLog = {
  id: string;
  activityDate: string; // YYYY-MM-DD
  timezone: string;
  activityType: ActivityType;
  sessionRpe?: number; // Valid range: 1–10
  durationMinutes?: number; // Valid range: 1–600
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

```

* **Calculation:** Session Load = sessionRpe * durationMinutes


* **Internal Metric Notice:** Session load is an internal workload coordination variable, not a clinical or medical injury-risk indicator.



---

## 11. READINESS MODEL

```typescript
type SleepAnchor =
  | "UNDER_7_HRS"
  | "SEVEN_TO_EIGHT_HRS"
  | "OVER_8_HRS";

type JointStatus =
  | "NO_CONCERN"
  | "MILD_STIFFNESS"
  | "PAIN_CONCERN";

type EnergyAnchor =
  | "DRAINED"
  | "NORMAL"
  | "HIGH";

type ReadinessInput = {
  id: string;
  localDate: string; // YYYY-MM-DD
  timezone: string;
  recordedAt: string;
  sleepAnchor: SleepAnchor;
  jointStatus: JointStatus;
  energyAnchor: EnergyAnchor;
  painLocation?: string;
  painDescription?: string;
  createdAt: string;
  updatedAt: string;
};

```

### 11.2 FINGER-TAP FRESHNESS MODEL (Phase 10)

The 10-second maximal finger-tap trial is the behavioral readout of central
motor drive (Halstead–Reitan tradition: fixed 10-second trials, downstrokes
counted, best trial as the criterion measure). Interpretation is strictly
within-subject — absolute counts are never compared across people.

```typescript
type FingerTapTrial = {
  id: string;
  localDate: string; // YYYY-MM-DD
  timezone: string;
  recordedAt: string;
  tapCount: number;  // downstrokes in a 10.0-second window
};

type FingerTapTier =
  | "NOT_TESTED"   // no valid trial today
  | "NO_BASELINE"  // tested today, not enough distinct prior days yet
  | "FRESH"        // today/baseline ≥ 0.95 (inside day-to-day noise)
  | "MODERATE"     // 0.85 ≤ ratio < 0.95
  | "SIGNIFICANT"; // ratio < 0.85

```

Measurement rules:

* **Trial validity:** 20–120 taps (plausible 10-second envelope). Invalid trials never count.
* **Daily score:** the best valid trial of the local date (maximal-performance criterion).
* **Baseline:** median of the top-3 daily bests within a rolling 14-day window, requiring ≥ 3 distinct valid days, today always excluded. Median-of-top-3 is robust to one fluke day (cannot raise the bar) and one bad day (cannot lower it).
* **Band edges:** 5% and 15% decrement conventions follow jump-based monitoring practice, adapted to tap rate's ~3–5% day-to-day variability.

### 11.3 TAP × SURVEY FUSION MATRIX (Phase 10)

The objective tier decides WHETHER the rule fires; the survey axis (short sleep, drained energy, or an in-band readiness score) decides HOW STRONG the template is. Every flagged cell removes plyometrics AND high-impact work — central drive powers rate of force development first. FRESH / NO_BASELINE / NOT_TESTED fire no rule: the tap test can only ADD protection, never soften a survey-driven reduction (most-protective-wins merge).

| Tier × Survey | Flagged | Clean |
| --- | --- | --- |
| SIGNIFICANT | 0.6 / 0.7 · cap 45 | 0.7 / 0.8 · cap 60 |
| MODERATE | 0.65 / 0.75 · cap 60 | 0.8 / 0.85 · cap 75 |

(Lower/upper body scales; `maxTrainingDurationMinutes` cap; plyometrics + high impact OFF in all flagged cells. Reason: `CNS_FATIGUE_FLAGGED`, global YELLOW.)

```

---

## 12. READINESS SCORING

```typescript
const sleepScore = { UNDER_7_HRS: 1, SEVEN_TO_EIGHT_HRS: 2, OVER_8_HRS: 3 };
const jointScore = { NO_CONCERN: 3, MILD_STIFFNESS: 2, PAIN_CONCERN: 0 };
const energyScore = { DRAINED: 1, NORMAL: 2, HIGH: 3 };

const totalReadinessScore = 
  sleepScore[readiness.sleepAnchor] + 
  jointScore[readiness.jointStatus] + 
  energyScore[readiness.energyAnchor];

```

Note: Any selection of PAIN_CONCERN immediately bypasses numerical scoring and triggers Priority 1 overrides.

---

## 13. ENGINE INPUT INTERFACE

```typescript
interface EngineInput {
  athlete: AthleteProfile;
  objective: TrainingObjective;
  readiness?: ReadinessInput;
  carriedSoreAreas?: SoreArea[];          // Phase 8/9.7: post-session body map
  carriedSoreAreasFrom?: string;          // Phase 10: source date for the carry window
  fingerTapTrials?: FingerTapTrial[];     // Phase 10: objective freshness axis
  recentActivities: ActivityLog[];
  upcomingEvents: ScheduledEvent[];
  now: Date;
}

```

---

## 14. ENGINE OUTPUT INTERFACE

```typescript
type EngineReason =
  | "CHECKIN_REQUIRED"
  | "INSUFFICIENT_DATA"
  | "PAIN_CONCERN"
  | "IMMINENT_GAME"
  | "UPCOMING_GAME"
  | "HIGH_RECENT_WORKLOAD"
  | "CNS_FATIGUE_FLAGGED"
  | "LOW_SLEEP"
  | "LOW_ENERGY"
  | "MULTIPLE_READINESS_CONCERNS"
  | "SORENESS_FLAGGED"
  | "NORMAL_READINESS";

type TrainingRestrictions = {
  lowerBodyAllowed: boolean;
  lowerBodyScale: number; // 0.0 to 1.0
  upperBodyAllowed: boolean;
  upperBodyScale: number; // 0.0 to 1.0
  plyometricsAllowed: boolean;
  highImpactAllowed: boolean;
  maxTrainingDurationMinutes?: number;
};

type EngineResult = {
  status: EngineStatus;
  restrictions: TrainingRestrictions;
  reasons: EngineReason[];
  recoveryActions: string[];
  requiresAdultAttention: boolean;
};

```

---

## 15. ENGINE PRECEDENCE RULES

The autoregulation engine strictly evaluates input conditions in this order:

1. Missing Check-In: Prompt user; restrict to standard baseline until submitted.


2. Pain Concern: Safety override takes absolute priority.


3. Imminent Game: Game in < 12 hours.


4. Upcoming Game: Game in 12–24 hours.


5. Recent Workload: High cumulative session loads or high RPE activities in the last 24–48 hours (defaults recalibrated in Phase 10: single-session 750, cumulative-24h 1100).


5b. Finger-Tap Fusion (Phase 10): objective CNS-freshness tier × survey evidence picks a protection template (§11.3). Evaluated after workload, ahead of the survey anchors — an objective performance decrement outranks self-report in the blend. Counts as a global YELLOW (unlike status-neutral soreness).


6. Sleep Status: Short sleep (< 7 hours).


7. Energy Status: Low or drained state.


8. Combined Readiness: Evaluate arithmetic score (Phase 10: the YELLOW band tightens to ≤ 5 by default, so "7–8 h sleep + mildly stiff + normal energy" (score 6) no longer auto-reduces; two-plus explicit concerns keep the stricter template, and the band stays configurable).


9. Generate Restrictions & Reasons: Output deterministic prescription object.



---

## 16. PAIN CONCERN PROTOCOL

If `jointStatus === "PAIN_CONCERN"`:

* **Engine Status:** RED


* **Restrictions:**
* `lowerBodyAllowed`: false (Scale: 0.0)


* `upperBodyAllowed`: false (Scale: 0.0)


* `plyometricsAllowed`: false


* `highImpactAllowed`: false




* **System Directive:** `requiresAdultAttention = true`

* **User Message:** "High-impact and training activity should be paused until the athlete has appropriate guidance."


* **Safety Non-Goals:** Do NOT attempt medical diagnosis, do NOT guess injury type, and do NOT automatically prescribe corrective or rehabilitation exercises.



---

## 17. GAME PROTECTION RULES

* **Game in < 12 Hours:** Zero fatigue-producing training allowed. Lower-body strength locked (0.0). Plyometrics and high impact locked.


* **Game in 12–24 Hours:** Reduced neural primer work allowed. No high-volume lower body work. Eliminate unnecessary high-intensity conditioning.


* **Game in 24–36 Hours:** Evaluated based on recent workload, phase, and readiness score. Does not automatically force a YELLOW status unless elevated fatigue is present.



---

## 18. WORKLOAD EVALUATION

Workload tracking evaluates parameters dynamically:

```typescript
type RecentWorkload = {
  last24HoursLoad: number;
  last48HoursLoad: number;
  activityCount24Hours: number;
  hadHighIntensityActivity: boolean;
};

```

Thresholds must be stored as configurable parameters, not hardcoded strings.

Phase 10 recalibration (per the "never a reduced day" review): defaults rise to `highSessionLoad = 750` and `highCumulative24hLoad = 1100` so a typical ~90-minute RPE-8 practice (load 720) no longer flags the next day on its own, and `readinessScoreYellowMax` tightens from 6 to 5 (see §15 step 8). The Settings screen exposes all thresholds plus Protective (700/1000/6) and Performance (850/1300/5) presets; the engine additionally enforces a `carriedSorenessCarryDays` window (default 2) so a stale post-session body map stops pricing later days.

---

## 19. TRAINING STRESS CLASSIFICATION

```typescript
type TrainingStress =
  | "HIGH"
  | "LOW"
  | "RECOVERY";

```

* **HIGH:** Explosive strength, sprint/acceleration, maximum jumping, change of direction drills, hard team practices, games.


* **LOW:** Low-intensity skill work, light mobility, aerobic recovery, controlled technical drills.


* **RECOVERY:** Complete rest, light walking, targeted recovery strategies.



---

## 20. HIGH/LOW ORGANIZATION

* **Baseline Pattern:** HIGH -> LOW -> HIGH


* **Rule:** Avoid scheduling consecutive high-stress training days whenever possible.


* **Unavoidable Overlap Handling:** If games, practices, or tournaments force consecutive high-stress days, optional training volume is stripped automatically. Do not add compensating "catch-up" sessions.



---

## 21. BASE TRAINING PLAN MODEL

```typescript
type TrainingComponent = {
  id: string;
  type: TrainingGoal;
  stress: TrainingStress;
  priority: number;
  baseVolume: number;
  minimumVolume?: number;
  optional: boolean;
};

```

---

## 22. WORKOUT GENERATION PIPELINE

`Base Plan + Engine Restrictions + Schedule Constraints + Recent Workload = Today's Prescription`

* **Keep:** Components meeting safety and energy criteria.


* **Reduce:** Scale down sets/reps based on multipliers.


* **Remove:** Strip optional or restricted exercises (e.g., plyometrics on yellow light).


* **Reschedule/Move:** Reallocate sessions across available training windows.



---

## 23. VOLUME SCALING RULES

```typescript
function scaleSets(baseSets: number, scale: number): number {
  return Math.max(1, Math.round(baseSets * scale));
}

```

**Truncation Order When Volume Reduction Is Required:**

1. Remove optional accessory exercises.


2. Remove redundant secondary drills.


3. Reduce sets on main accessory lifts.


4. Reduce primary movement set volume.


5. Preserve execution quality and technical form.


6. Strip high-impact elements when required by restrictions.



---

## 24. TRAINING PHASES

```typescript
type TrainingPhase =
  | "PRESEASON_PREP"
  | "PRESEASON"
  | "IN_SEASON"
  | "TOURNAMENT"
  | "OFF_SEASON";

```

* **Before Sept 14, 2026:** PRESEASON_PREP


* **Sept 14 – Oct 14, 2026:** PRESEASON


* **Oct 15, 2026 Onward:** IN_SEASON



---

## 25. PHASE PRIORITIES

* **PRESEASON_PREP:** General strength development, movement quality, acceleration mechanics, deceleration landing tolerance.


* **PRESEASON:** Increase specificity, maximize explosive quality, coordinate strength sessions around team practices.


* **IN_SEASON:** Strength maintenance, preserve explosiveness/freshness, schedule around game dates, minimize extra volume.



---

## 26. YOUTH ATHLETE DEVELOPMENT RULES

* **Primary Focus:** Technique, progressive exposure, movement quality, long-term athletic development.


* **Prohibited Automations:** No forced maximal 1RM testing, no punishment-driven conditioning, no aggressive workload spikes, no high-volume plyometrics under fatigue.



---

## 27. DASHBOARD ARCHITECTURE (`/app/index.tsx`)

* **Displays:** Engine Status, Recommendation Summary, Today's Session View, Upcoming Events Banner, Action Cards.


* **Rule:** The dashboard must NEVER display GREEN if required check-in data is missing.



---

## 28. READINESS SCREEN UI (`/app/checkin.tsx`)

* **Target Interface:** Minimum 48x48px touch targets, high contrast, one-handed usability.


* **Core Inputs:** Sleep quality/duration, Joint/body feel, Energy level.


* **Pain Sub-Form:** Conditional prompt for location and description if PAIN_CONCERN is selected.



---

## 29. ACTIVITY LOG UI (`/app/activity-log.tsx`)

* **Inputs:** Activity type, RPE slider (1–10), duration in minutes, optional notes.



---

## 30. WORKOUT SCREEN UI (`/app/workout.tsx`)

* Displays today's prescription vs. base session layout, specific modifications applied, explicit display of removed exercises, recovery notes.



---

## 31. LOCAL PERSISTENCE ARCHITECTURE

All application state is stored locally on device using Zustand persisted via AsyncStorage or MMKV. Data persists across app restarts completely offline without requiring network connections or webservers.

---

## 32. DATA INTEGRITY & RETENTION

* **Historical Readiness & Activity Logs:** Saved directly to persistent local storage upon entry.


* **Profile Updates:** Overwritten in local store upon user confirmation.



---

## 33. STORAGE SCHEMA

Local entity stores managed via Zustand:

* `profile`
* `training_objective`
* `readiness_inputs`
* `activity_logs`
* `scheduled_events`
* `workout_logs`
* `notification_preferences`
* `active_program_id` *(additive, Phase 11 — the selected curated season program; null = the first registry program, preserving prior behavior for existing installs)*

**Phase 11 — Curated season programs & schedule-aware shaping.** The hardcoded base plan is the first entry of a selectable program registry (`src/plans/programs.ts`): the early-season speed/power regimen (unchanged, now named) and an in-season game-day program whose weekday templates are built around the athlete's real week (skill + shooting sessions Mon/Wed/Thu mornings before school as designated skill-slot days, Tue/Wed/Thu practices with zero lower-body loading, one consolidated HIGH-CNS day, near-rest Friday, full Sunday reset, and the December tryout countdown as a phase note). Day plans are resolved through a schedule-aware shaping layer: a scheduled or logged team practice applies the legs-saved filter dynamically (off-template days included), and a scheduled or logged skill session makes the plan's own skill blocks step aside except on designated skill-slot weekdays. Built (custom) plans keep precedence over curated programs; the engine stays restriction-only.

---

## 34. PRIVACY & SECURITY

All data resides strictly on the user's physical device. No external network transport or server storage of readiness/athlete data is permitted.

---

## 35. NOTIFICATIONS ARCHITECTURE

Handled via `expo-notifications`.

* **Notification Types:** READINESS_CHECKIN, ACTIVITY_LOG, RECOVERY_REMINDER, SCHEDULE_REMINDER.
* **Identifier Management:** Store scheduled notification IDs in local state. NEVER execute `cancelAllScheduledNotificationsAsync()`.



---

## 36. ENGINE IMPLEMENTATION CONTRACT

```typescript
export function evaluateAutoregulationEngine(input: EngineInput): EngineResult;

```

* **Pure & Deterministic:** Returns identical output given identical input.
* **Zero Side Effects:** No storage mutations, system clocks, network calls, or notification triggers inside.



---

## 37. TESTING REQUIREMENTS

Unit tests built using Vitest and React Native Testing Library:

* **Safety & Pain:** Pain overrides high sleep, low load, and upcoming games.
* **Game Windows:** Test <12h, 12–24h, 24–36h thresholds.
* **Workload Calculations:** RPE * duration limits, multiple daily activities.
* **Readiness Combinations:** Low sleep, drained energy, stiffness.
* **Boundary Conditions:** RPE 1 and 10, minimum/maximum durations, exact timestamp boundaries.

---

## 38. IMPLEMENTATION ROADMAP

* **Phase 1:** Project foundation & local domain types.
* **Phase 2:** Pure Autoregulation Engine implementation & Vitest suite.
* **Phase 3:** Base Training Plan, Workout Generator, and Zustand Local Persistence.
* **Phase 4:** Dashboard (`/app/index.tsx`), Check-In UI, Activity UI, Workout UI.
* **Phase 5:** Local notifications pipeline.
* **Phase 6:** E2E Integration testing & spec audit.