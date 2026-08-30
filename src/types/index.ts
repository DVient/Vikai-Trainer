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
  | "OTHER";

/** Future/planned commitments. Distinct from completed `ActivityLog` (SPEC §9). */
export interface ScheduledEvent {
  id: string;
  eventType: ScheduledEventType;
  /** ISO datetime string. */
  startAt: string;
  /** ISO datetime string. Optional. */
  endAt?: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
}

/* ──────────────── §9.2 / §10 — Completed Activity & Activity Log ──────── */

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
