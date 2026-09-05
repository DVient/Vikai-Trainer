/**
 * VIKAI — Local Domain Types (Phase 1.2)
 *
 * Single source of truth for every domain model in the application, defined in
 * SPECIFICATIONS.md §6–§14 (core schemas) and §18–§24 (supporting models).
 *
 * Architecture invariants (AGENTS.md):
 * - The Autoregulation Engine consumes `EngineInput` and produces `EngineResult`
 *   (a `TrainingRestrictions` bundle). It never selects exercises.
 * - Types are pure data contracts: no storage, no clocks, no side effects.
 */

/* ─────────────────────────── §6 — Core Unions ─────────────────────────── */

/** Training goals supported by the base plan builder (SPEC §6). */
export type TrainingGoal =
  | "STRENGTH"
  | "EXPLOSIVENESS"
  | "CHANGE_OF_DIRECTION"
  | "ACCELERATION"
  | "DECELERATION"
  | "SPEED"
  | "RECOVERY";

/** Athlete maturity band (SPEC §6). */
export type AthleteLevel = "YOUTH" | "HIGH_SCHOOL" | "ADULT";

/** Supported sports. Vikai is basketball-first (SPEC §6). */
export type Sport = "BASKETBALL";

/**
 * Top-level engine status. `CHECKIN_REQUIRED` and `INSUFFICIENT_DATA` are
 * data-availability states and must be shown instead of GREEN when the
 * dashboard lacks the required daily check-in (SPEC §27).
 */
export type EngineStatus =
  | "CHECKIN_REQUIRED"
  | "INSUFFICIENT_DATA"
  | "GREEN"
  | "YELLOW"
  | "RED";

/* ──────────────────────── §7 — Athlete Profile Schema ─────────────────── */

export interface AthleteProfile {
  id: string;
  displayName: string;
  sport: Sport;
  athleteLevel: AthleteLevel;
  /** ISO date (YYYY-MM-DD). Optional. */
  birthDate?: string;
  /** Optional — must never block workout generation (SPEC §7). */
  heightInches?: number;
  /** Optional — must never block workout generation (SPEC §7). */
  weightLbs?: number;
  primaryGoals: TrainingGoal[];
  /** IANA timezone identifier, e.g. "America/New_York". */
  timezone: string;
  /** ISO datetime string. */
  createdAt: string;
  /** ISO datetime string. */
  updatedAt: string;
}

/* ──────────────────── §8 — Default Training Objective Schema ──────────── */

/** Charlie Francis-inspired principles, applied appropriately for youth (SPEC §8). */
export interface TrainingObjectivePhilosophy {
  highLowOrganization: boolean;
  qualityOverVolume: boolean;
  fatigueManagement: boolean;
  consolidateHighStress: boolean;
  prioritizeRecovery: boolean;
}

/** Basketball-specific physical demands the plan must respect (SPEC §2.1, §8). */
export interface TrainingObjectiveSportRequirements {
  acceleration: boolean;
  deceleration: boolean;
  changeOfDirection: boolean;
  jumping: boolean;
  landing: boolean;
  basketballSkillCompatibility: boolean;
}

export interface TrainingObjective {
  primaryGoals: TrainingGoal[];
  philosophy: TrainingObjectivePhilosophy;
  sportRequirements: TrainingObjectiveSportRequirements;
}

/** Default objective per SPEC §8. May be overridden by user/parent/coach inputs. */
export const DEFAULT_OBJECTIVE: TrainingObjective = {
  primaryGoals: ["STRENGTH", "EXPLOSIVENESS", "CHANGE_OF_DIRECTION"],
  philosophy: {
    highLowOrganization: true,
    qualityOverVolume: true,
    fatigueManagement: true,
    consolidateHighStress: true,
    prioritizeRecovery: true,
  },
  sportRequirements: {
    acceleration: true,
    deceleration: true,
    changeOfDirection: true,
    jumping: true,
    landing: true,
    basketballSkillCompatibility: true,
  },
};

/* ─────────────────────── §9.1 — Scheduled Event Model ─────────────────── */

export type ScheduledEventType =
  | "TEAM_PRACTICE"
  | "GAME"
  | "STRENGTH_SESSION"
  | "SKILL_SESSION"
  | "SCHOOL"
  | "OTHER"
  | "BASKETBALL_CAMP"
  | "ID_SESSION"
  | "OTHER_SPORTS_GAME";

/** Future/planned commitments. Distinct from completed `ActivityLog` (SPEC §9). */
export interface ScheduledEvent {
  id: string;
  eventType: ScheduledEventType;
  /** ISO datetime string. */
  startAt: string;
  /** ISO datetime string. Optional. */
  endAt?: string;
  title?: string;
  /**
   * Present when the event was created as part of a recurring series
   * (additive to the §33 schema). All members of one series share it;
   * one-off events leave it undefined.
   */
  seriesId?: string;
  createdAt: string;
  updatedAt: string;
}

/* ──────────────── §9.2 / §10 — Completed Activity & Activity Log ──────── */

/**
 * One checked-off Game Plan component (live session cockpit). `sets` is the
 * prescription at check-off time — completed work is frozen and never
 * re-scaled by later logs (additive to the §33 schema).
 */
export interface CompletedComponent {
  componentId: string;
  sets: number;
  completedAt: string;
}

export type ActivityType =
  | "TEAM_PRACTICE"
  | "GAME"
  | "SCHOOL_PE"
  | "FITNESS_TESTING"
  | "PICKUP_BASKETBALL"
  | "SKILL_WORK"
  | "STRENGTH_TRAINING"
  | "SPEED_TRAINING"
  | "OTHER";

/**
 * A completed activity. Session Load = sessionRpe × durationMinutes is an
 * internal workload coordination variable — never a clinical/medical
 * injury-risk indicator (SPEC §10).
 */
export interface ActivityLog {
  id: string;
  /** Local calendar date, YYYY-MM-DD. */
  activityDate: string;
  timezone: string;
  activityType: ActivityType;
  /** Valid range: 1–10 (validated at the store/UI boundary). */
  sessionRpe?: number;
  /** Valid range: 1–600 minutes (validated at the store/UI boundary). */
  durationMinutes?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/* ───────────────────────── §11 — Readiness Model ──────────────────────── */

export type SleepAnchor = "UNDER_7_HRS" | "SEVEN_TO_EIGHT_HRS" | "OVER_8_HRS";

export type JointStatus = "NO_CONCERN" | "MILD_STIFFNESS" | "PAIN_CONCERN";

export type EnergyAnchor = "DRAINED" | "NORMAL" | "HIGH";

/* ────────────── §11.1 — Body-map soreness areas (Phase 7) ─────────────── */

/**
 * Body areas the stepped check-in can flag as sore (Phase 7 body map).
 * Muscle-level, deliberately coarse: the athlete taps a region, then areas —
 * the app leads the discussion (UX decision from the builder/expert review).
 * This is NOT pain assessment: the `PAIN_CONCERN` joint path keeps its own
 * safety semantics; sore areas only scale the blocks that target them.
 */
export type SoreArea =
  | "FOOT"
  | "ANKLE"
  | "KNEE"
  | "QUAD"
  | "HAMSTRING"
  | "CALF"
  | "ABS"
  | "SHOULDER"
  | "ARM";

/** Top-level region grouping for the check-in's stepped body map. */
export type SoreRegion = "LEGS" | "CORE" | "ARMS";

/** Canonical area ids (catalog display data lives in src/lib/bodyMap.ts). */
export const SORE_AREA_IDS: readonly SoreArea[] = [
  "FOOT",
  "ANKLE",
  "KNEE",
  "QUAD",
  "HAMSTRING",
  "CALF",
  "ABS",
  "SHOULDER",
  "ARM",
];

/** Type guard for persisted/untrusted area values. Pure. */
export function isSoreArea(value: unknown): value is SoreArea {
  return typeof value === "string" && (SORE_AREA_IDS as readonly string[]).includes(value);
}

/** The daily check-in record (SPEC §11). */
export interface ReadinessInput {
  id: string;
  /** Local calendar date, YYYY-MM-DD. */
  localDate: string;
  timezone: string;
  /** ISO datetime string. */
  recordedAt: string;
  sleepAnchor: SleepAnchor;
  jointStatus: JointStatus;
  energyAnchor: EnergyAnchor;
  /** Required in UI when jointStatus === "PAIN_CONCERN" (SPEC §28). */
  painLocation?: string;
  /** Required in UI when jointStatus === "PAIN_CONCERN" (SPEC §28). */
  painDescription?: string;
  /**
   * Sore areas flagged on the body map (additive Phase 7). Optional — the
   * all-good path stays one tap. The engine maps these to targeted scales;
   * it never treats them as pain (§16 path unchanged).
   */
  soreAreas?: readonly SoreArea[];
  createdAt: string;
  updatedAt: string;
}

/* ──────────────── §13 / §14 — Engine Input & Output Interfaces ────────── */

/**
 * Input contract for the pure autoregulation engine. `now` is injected as a
 * parameter — engine functions must never read the system clock (AGENTS.md).
 */
export interface EngineInput {
  athlete: AthleteProfile;
  objective: TrainingObjective;
  /** Today's check-in, if one exists. Missing ⇒ CHECKIN_REQUIRED precedence. */
  readiness?: ReadinessInput;
  recentActivities: ActivityLog[];
  upcomingEvents: ScheduledEvent[];
  now: Date;
}

/** Machine-readable reasons attached to an `EngineResult` (SPEC §14). */
export type EngineReason =
  | "CHECKIN_REQUIRED"
  | "INSUFFICIENT_DATA"
  | "PAIN_CONCERN"
  | "IMMINENT_GAME"
  | "UPCOMING_GAME"
  | "HIGH_RECENT_WORKLOAD"
  | "LOW_SLEEP"
  | "LOW_ENERGY"
  | "MULTIPLE_READINESS_CONCERNS"
  | "SORENESS_FLAGGED"
  | "NORMAL_READINESS";

/**
 * Restriction constraints produced by the engine. The Workout Generator maps
 * these onto base plans — the engine itself never touches exercises (AGENTS.md).
 * Scales are clamped to 0.0–1.0.
 */
export interface TrainingRestrictions {
  lowerBodyAllowed: boolean;
  /** 0.0 to 1.0 */
  lowerBodyScale: number;
  upperBodyAllowed: boolean;
  /** 0.0 to 1.0 */
  upperBodyScale: number;
  plyometricsAllowed: boolean;
  highImpactAllowed: boolean;
  /**
   * Per-area soreness scales (additive Phase 7): areas flagged on the body
   * map map to a 0.0–1.0 factor the generator applies to blocks whose
   * `muscleGroups` target them. Absent ⇒ nothing sore-scaled.
   */
  sorenessScale?: Partial<Record<SoreArea, number>>;
  /** Optional ceiling on total session duration in minutes. */
  maxTrainingDurationMinutes?: number;
}

/** Deterministic output of `evaluateAutoregulationEngine` (SPEC §14, §36). */
export interface EngineResult {
  status: EngineStatus;
  restrictions: TrainingRestrictions;
  reasons: EngineReason[];
  recoveryActions: string[];
  requiresAdultAttention: boolean;
}

/* ─────────────── §18–§24 — Supporting Training-Plan Models ────────────── */

/** Aggregated workload metrics the engine derives from recent activities (SPEC §18). */
export interface RecentWorkload {
  last24HoursLoad: number;
  last48HoursLoad: number;
  activityCount24Hours: number;
  hadHighIntensityActivity: boolean;
}

/** High/low stress classification for training components (SPEC §19). */
export type TrainingStress = "HIGH" | "LOW" | "RECOVERY";

/** Season phase (SPEC §24). Boundaries are configurable date rules, not hardcodes. */
export type TrainingPhase =
  | "PRESEASON_PREP"
  | "PRESEASON"
  | "IN_SEASON"
  | "TOURNAMENT"
  | "OFF_SEASON";

/** Body-region classification for plan components (additive Phase 3 extension). */
export type BodyRegion = "LOWER" | "UPPER" | "FULL";

/** A single component of the base training plan (SPEC §21). */
export interface TrainingComponent {
  id: string;
  type: TrainingGoal;
  stress: TrainingStress;
  /** Lower sorts earlier; the generator trims by priority order (SPEC §23). */
  priority: number;
  baseVolume: number;
  /** Volume floor the generator never scales below. */
  minimumVolume?: number;
  optional: boolean;
  /**
   * Additive Phase-3 extension to SPEC §21: region tag the Workout Generator
   * uses to map lower/upper restrictions onto components. Undefined ⇒ "FULL"
   * (governed by both body-region scales).
   */
  bodyRegion?: BodyRegion;
  /**
   * Planning estimate of minutes for the FULL base volume (additive). The
   * generator uses it to enforce `maxTrainingDurationMinutes` — it never
   * reaches the UI as a duration promise.
   */
  estimatedMinutes?: number;
  /**
   * Sore areas this block targets (additive Phase 7, authoring data). The
   * generator applies `sorenessScale` to a block through these tags; a block
   * whose ENTIRE tag set is sore sits out for the day, a partial overlap is
   * scaled. SKILL and RECOVERY blocks stay untagged ⇒ never sore-scaled.
   * Undefined ⇒ exempt (default-plan components authored before Phase 7).
   */
  muscleGroups?: readonly SoreArea[];
}

/* ─────────────── §33 — Workout log (minimal Phase 3 shape) ─────────────── */

/**
 * Minimal workout-log entry for the §33 storage schema. Extended in later
 * phases when completed-session details are captured.
 */
export interface WorkoutLog {
  id: string;
  /** Local calendar date the session belongs to, YYYY-MM-DD. */
  activityDate: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/* ────────────────── §35 — Local notification identifiers ──────────────── */

export type NotificationType =
  | "READINESS_CHECKIN"
  | "ACTIVITY_LOG"
  | "FUEL_REMINDER"
  | "RECOVERY_REMINDER"
  | "SCHEDULE_REMINDER";

/** App-level reminder slots: at most one live scheduled notification each. */
export type NotificationSlot =
  | "readinessCheckIn"
  | "activityLog"
  | "fuelReminder"
  | "recoveryReminder";

/**
 * Scheduled-notification identifier tracking (SPEC §35, AGENTS.md guardrail).
 * Every scheduled notification's string identifier is stored so reminders can
 * be cancelled or replaced individually — the bulk
 * `cancelAllScheduledNotificationsAsync()` is never used anywhere.
 */
export interface NotificationIdentifiers {
  readinessCheckIn?: string;
  activityLog?: string;
  fuelReminder?: string;
  recoveryReminder?: string;
  /** SCHEDULE_REMINDER per scheduled event, keyed by event id. */
  scheduleReminders: Record<string, string>;
}

/* ──────────────── Plan Builder — personas, milestones, plans ──────────── */

/** Persona archetypes the athlete can base a plan on (Plan Builder). */
export type PersonaId =
  | "JUMP_HIGHER"
  | "GET_STRONGER"
  | "FASTER_FIRST_STEP"
  | "TWO_WAY_ENGINE"
  | "ALL_ROUND"
  | "HANDLES_PRESSURE"
  | "CATCH_SHOOT"
  | "FINISHING_RIM"
  | "COURT_VISION";

/**
 * A benchmark drill that measures a training capacity. Fixed protocol text
 * makes re-tests comparable — the drill catalog is curated data, and each
 * entry carries a one-line basis note so the pairing is inspectable.
 */
export interface MilestoneDrill {
  id: string;
  label: string;
  /** The training capacity this drill is a field proxy for. */
  goal: TrainingGoal;
  unit: "reps" | "seconds" | "cm" | "count";
  higherIsBetter: boolean;
  /** Fixed procedure shown whenever a result is logged. */
  protocol: string;
  /** One line on why this drill measures the construct. */
  basis: string;
}

/** One logged attempt at a benchmark drill. Attempts are never overwritten. */
export interface PersonalBest {
  id: string;
  drillId: string;
  value: number;
  /** ISO instant of the entry. */
  recordedAt: string;
  /** Local calendar date, YYYY-MM-DD. */
  activityDate: string;
}

/** A built training plan: the athlete's active base plan for its period. */
export interface BuiltPlan {
  id: string;
  /** First day of the plan, local date YYYY-MM-DD (week 1 starts here). */
  startDate: string;
  /** 4–12. */
  periodWeeks: number;
  primaryGoals: TrainingGoal[];
  personaId?: PersonaId;
  /** The week-1 session template (progression scales it per day). */
  components: TrainingComponent[];
  /** History-calibrated starting volume factor (0.7–1.0). */
  startScale: number;
}

/** Where a built plan is in its life, derived purely from date + period. */
export type PlanStatus = "active" | "final-week" | "ended";
