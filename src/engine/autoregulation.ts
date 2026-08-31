/**
 * VIKAI — Pure Autoregulation Engine (Phase 2.1)
 *
 * Implements `evaluateAutoregulationEngine` per SPECIFICATIONS §12–§20 and §36.
 *
 * ARCHITECTURE GUARANTEES (AGENTS.md):
 * - This engine ONLY produces restriction constraints (TrainingRestrictions).
 *   It never generates workouts and never selects exercises — the Workout
 *   Generator (Phase 3) maps restrictions onto base plans separately.
 * - Pure & deterministic: identical input ⇒ identical output. No storage
 *   access, no network, no randomness, no system clocks — `now` is injected
 *   via EngineInput and never read from the environment.
 * - No medical outputs: reasons and recovery actions are training-domain
 *   prompts only, never diagnoses, severity assessments, or rehab protocols.
 *
 * EVALUATION PRECEDENCE (FLOW 2.1 / SPEC §15):
 *   1. Missing check-in        → CHECKIN_REQUIRED, standard baseline.
 *   2. Pain concern override   → RED, full halt, requiresAdultAttention (§16).
 *   3. Imminent game (<12h)    → RED, fatigue-producing training locked (§17).
 *      Upcoming game (12–24h]  → YELLOW, reduced neural-primer day (§17).
 *      (A game 24–36h out never forces a downgrade by itself; §17 rule 3 —
 *      it only matters through workload/readiness, which are evaluated below.)
 *   4. Recent workload         → session load (RPE × minutes) triggers (§18).
 *   5. Sleep & energy anchors  → single-concern YELLOW states.
 *   6. Arithmetic readiness    → combined-score band check, only reached when
 *      score                   → no earlier readiness rule fired.
 *
 * WINDOW SEMANTICS (documented approximations):
 * - Game windows use exact wall-clock deltas against the injected `now`.
 *   A kickoff at exactly 12h is "upcoming", not "imminent"; a kickoff at
 *   exactly 24h is still inside the 12–24h primer window (inclusive).
 * - ActivityLog only stores a local calendar date (no clock time), so the
 *   24h workload window is date-granular: an activity counts toward the last
 *   24 hours when its local date equals today's or yesterday's local date in
 *   the athlete's timezone. This is deliberately over-inclusive (protective).
 * - A readiness input is treated as "today's check-in" whenever the caller
 *   provides one; selecting the current local date is the store's job (§27).
 */

import type {
  ActivityLog,
  EnergyAnchor,
  EngineInput,
  EngineReason,
  EngineResult,
  EngineStatus,
  JointStatus,
  RecentWorkload,
  ScheduledEvent,
  ScheduledEventType,
  SleepAnchor,
  TrainingRestrictions,
} from "../types";

/* ───────────────────── §12 — Arithmetic readiness scoring ─────────────── */

const SLEEP_SCORE: Record<SleepAnchor, number> = {
  UNDER_7_HRS: 1,
  SEVEN_TO_EIGHT_HRS: 2,
  OVER_8_HRS: 3,
};

const JOINT_SCORE: Record<JointStatus, number> = {
  NO_CONCERN: 3,
  MILD_STIFFNESS: 2,
  PAIN_CONCERN: 0,
};

const ENERGY_SCORE: Record<EnergyAnchor, number> = {
  DRAINED: 1,
  NORMAL: 2,
  HIGH: 3,
};

/* ────────────── §18 — Configurable thresholds (never hardcoded) ───────── */

export interface EngineThresholds {
  /** Kickoff within this many hours ⇒ imminent-game lock (SPEC §17). */
  imminentGameHours: number;
  /** Kickoff within (imminentGameHours, upcomingGameHours] ⇒ primer day (SPEC §17). */
  upcomingGameHours: number;
  /** Single-activity load (RPE × minutes) in the last 24h that flags workload (SPEC §15/§18). */
  highSessionLoad: number;
  /** Summed load in the last 24h that flags workload (SPEC §15/§18 "cumulative"). */
  highCumulative24hLoad: number;
  /** RPE at/above which a logged session counts as high-intensity (SPEC §19). */
  highRpe: number;
  /** Arithmetic readiness score at/below this cannot resolve to GREEN (SPEC §12/§15). */
  readinessScoreYellowMax: number;
}

export const DEFAULT_ENGINE_THRESHOLDS: EngineThresholds = {
  imminentGameHours: 12,
  upcomingGameHours: 24,
  highSessionLoad: 700,
  highCumulative24hLoad: 1000,
  highRpe: 8,
  readinessScoreYellowMax: 6,
};

/* ────────────────────────── Date / window helpers ─────────────────────── */

/**
 * Local calendar date (YYYY-MM-DD) for a moment in a timezone. Pure function
 * of its arguments. Falls back to UTC when the timezone is unknown.
 */
export function toLocalDateString(date: Date, timezone?: string): string {
  if (Number.isNaN(date.getTime())) return "1970-01-01";
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone ?? "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

interface ActivityDateWindow {
  today: string;
  yesterday: string;
  dayBeforeYesterday: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function dateWindow(now: Date, athleteTimezone: string): ActivityDateWindow {
  return {
    today: toLocalDateString(now, athleteTimezone),
    yesterday: toLocalDateString(new Date(now.getTime() - DAY_MS), athleteTimezone),
    dayBeforeYesterday: toLocalDateString(new Date(now.getTime() - 2 * DAY_MS), athleteTimezone),
  };
}

/* ───────────────────── §10/§18 — Session load computation ─────────────── */

/**
 * Valid session load (RPE × minutes), or null when either value is missing
 * or outside its spec range (RPE 1–10, duration 1–600; SPEC §10).
 */
function validSessionLoad(activity: ActivityLog): number | null {
  const { sessionRpe, durationMinutes } = activity;
  if (typeof sessionRpe !== "number" || typeof durationMinutes !== "number") return null;
  if (!Number.isFinite(sessionRpe) || !Number.isFinite(durationMinutes)) return null;
  if (sessionRpe < 1 || sessionRpe > 10) return null;
  if (durationMinutes < 1 || durationMinutes > 600) return null;
  return sessionRpe * durationMinutes;
}

/** §18 workload metrics, derived purely from the provided activities and `now`. */
export function computeRecentWorkload(
  recentActivities: readonly ActivityLog[],
  now: Date,
  athleteTimezone: string,
  thresholds: EngineThresholds = DEFAULT_ENGINE_THRESHOLDS,
): RecentWorkload {
  const window = dateWindow(now, athleteTimezone);

  let last24HoursLoad = 0;
  let last48HoursLoad = 0;
  let activityCount24Hours = 0;
  let hadHighIntensityActivity = false;

  for (const activity of recentActivities) {
    const in24 =
      activity.activityDate === window.today || activity.activityDate === window.yesterday;
    const in48 = in24 || activity.activityDate === window.dayBeforeYesterday;
    if (!in48) continue;
    if (in24) activityCount24Hours += 1;

    const load = validSessionLoad(activity);
    if (load === null) continue;
    if (in24) last24HoursLoad += load;
    last48HoursLoad += load;
    if (
      in24 &&
      activity.sessionRpe !== undefined &&
      activity.sessionRpe >= thresholds.highRpe
    ) {
      hadHighIntensityActivity = true;
    }
  }

  return { last24HoursLoad, last48HoursLoad, activityCount24Hours, hadHighIntensityActivity };
}

/** True when any single in-window (last 24h) session load reaches the threshold. */
function hasHighSessionLoad(
  recentActivities: readonly ActivityLog[],
  now: Date,
  athleteTimezone: string,
  thresholds: EngineThresholds,
): boolean {
  const window = dateWindow(now, athleteTimezone);
  for (const activity of recentActivities) {
    if (activity.activityDate !== window.today && activity.activityDate !== window.yesterday) {
      continue;
    }
    const load = validSessionLoad(activity);
    if (load !== null && load >= thresholds.highSessionLoad) return true;
  }
  return false;
}

/* ───────────────────── §17 — Game protection windows ──────────────────── */

/**
 * Competition commitments: any event the athlete walks into wanting to
 * perform. All of them trigger the §17 protection windows — not just
 * basketball games (an other-sport game or an ID session demands fresh
 * legs just the same).
 */
export const COMPETITION_EVENT_TYPES: readonly ScheduledEventType[] = [
  "GAME",
  "OTHER_SPORTS_GAME",
  "ID_SESSION",
];

/**
 * Commitments that make a day high-stress for §20 back-to-back detection:
 * every competition, plus heavy practice/training days (camps included).
 */
export const HIGH_STRESS_EVENT_TYPES: readonly ScheduledEventType[] = [
  ...COMPETITION_EVENT_TYPES,
  "TEAM_PRACTICE",
  "STRENGTH_SESSION",
  "SKILL_SESSION",
  "BASKETBALL_CAMP",
];

export function isCompetitionEvent(eventType: ScheduledEventType): boolean {
  return COMPETITION_EVENT_TYPES.includes(eventType);
}

export function isHighStressEvent(eventType: ScheduledEventType): boolean {
  return HIGH_STRESS_EVENT_TYPES.includes(eventType);
}

function findGameWindows(
  upcomingEvents: readonly ScheduledEvent[],
  now: Date,
  thresholds: EngineThresholds,
): { imminent: boolean; upcoming: boolean } {
  let imminent = false;
  let upcoming = false;
  for (const event of upcomingEvents) {
    if (!isCompetitionEvent(event.eventType)) continue;
    const kickoff = new Date(event.startAt).getTime();
    if (Number.isNaN(kickoff)) continue; // unparseable date: never fabricate a window
    const msUntil = kickoff - now.getTime();
    // SPEC §17: imminent is strictly "< 12 hours"; the 12–24h primer window
    // is inclusive at both ends (a kickoff at exactly 24h is still upcoming).
    if (msUntil >= 0 && msUntil < thresholds.imminentGameHours * HOUR_MS) imminent = true;
    else if (
      msUntil >= thresholds.imminentGameHours * HOUR_MS &&
      msUntil <= thresholds.upcomingGameHours * HOUR_MS
    ) {
      upcoming = true;
    }
  }
  return { imminent, upcoming };
}

/* ───────────────────── Restriction templates & merging ────────────────── */

/** Standard baseline used by CHECKIN_REQUIRED and GREEN (SPEC §15 step 1). */
function baselineRestrictions(): TrainingRestrictions {
  return {
    lowerBodyAllowed: true,
    lowerBodyScale: 1,
    upperBodyAllowed: true,
    upperBodyScale: 1,
    plyometricsAllowed: true,
    highImpactAllowed: true,
  };
}

interface FiredRule {
  status: EngineStatus;
  restrictions: TrainingRestrictions;
  reason: EngineReason;
  recoveryAction: string;
}

const STATUS_SEVERITY: Record<EngineStatus, number> = {
  CHECKIN_REQUIRED: 0,
  INSUFFICIENT_DATA: 0,
  GREEN: 1,
  YELLOW: 2,
  RED: 3,
};

/**
 * Deterministic merge of every fired rule: allowances AND together, scales
 * and duration caps take the minimum — the most protective interpretation
 * always wins, independent of rule order.
 */
function mergeFiredRules(restrictionsList: readonly TrainingRestrictions[]): TrainingRestrictions {
  let lowerBodyAllowed = true;
  let lowerBodyScale = 1;
  let upperBodyAllowed = true;
  let upperBodyScale = 1;
  let plyometricsAllowed = true;
  let highImpactAllowed = true;
  let maxTrainingDurationMinutes: number | undefined;

  for (const r of restrictionsList) {
    lowerBodyAllowed = lowerBodyAllowed && r.lowerBodyAllowed;
    lowerBodyScale = Math.min(lowerBodyScale, r.lowerBodyScale);
    upperBodyAllowed = upperBodyAllowed && r.upperBodyAllowed;
    upperBodyScale = Math.min(upperBodyScale, r.upperBodyScale);
    plyometricsAllowed = plyometricsAllowed && r.plyometricsAllowed;
    highImpactAllowed = highImpactAllowed && r.highImpactAllowed;
    if (r.maxTrainingDurationMinutes !== undefined) {
      maxTrainingDurationMinutes =
        maxTrainingDurationMinutes === undefined
          ? r.maxTrainingDurationMinutes
          : Math.min(maxTrainingDurationMinutes, r.maxTrainingDurationMinutes);
    }
  }

  return {
    lowerBodyAllowed,
    lowerBodyScale,
    upperBodyAllowed,
    upperBodyScale,
    plyometricsAllowed,
    highImpactAllowed,
    ...(maxTrainingDurationMinutes !== undefined ? { maxTrainingDurationMinutes } : {}),
  };
}

/* ───────────────────── §36 — The engine entry point ───────────────────── */

export function evaluateAutoregulationEngine(
  input: EngineInput,
  thresholds: EngineThresholds = DEFAULT_ENGINE_THRESHOLDS,
): EngineResult {
  /* Priority 1 — Missing check-in: prompt, restrict to standard baseline. */
  const readiness = input.readiness;
  if (readiness === undefined) {
    return {
      status: "CHECKIN_REQUIRED",
      restrictions: baselineRestrictions(),
      reasons: ["CHECKIN_REQUIRED"],
      recoveryActions: ["Complete today's readiness check-in to unlock your training status."],
      requiresAdultAttention: false,
    };
  }

  /*
   * Priority 2 — Pain concern: absolute safety override (SPEC §16, AGENTS.md).
   * No scoring, no other reasons: RED, everything halted, adult attention.
   * No diagnosis, no corrective-exercise prescription — guidance message only.
   */
  if (readiness.jointStatus === "PAIN_CONCERN") {
    return {
      status: "RED",
      restrictions: {
        lowerBodyAllowed: false,
        lowerBodyScale: 0,
        upperBodyAllowed: false,
        upperBodyScale: 0,
        plyometricsAllowed: false,
        highImpactAllowed: false,
      },
      reasons: ["PAIN_CONCERN"],
      recoveryActions: [
        "High-impact and training activity should be paused until the athlete has appropriate guidance.",
      ],
      requiresAdultAttention: true,
    };
  }

  /* Priorities 3–6 — collect every non-pain rule that fires, in precedence order. */
  const fired: FiredRule[] = [];

  const games = findGameWindows(input.upcomingEvents, input.now, thresholds);
  if (games.imminent) {
    // SPEC §17: zero fatigue-producing training; lower body locked at 0.0,
    // plyometrics and high impact locked. Upper-body work stays available at a
    // light, non-fatiguing scale with a short session cap (the spec only locks
    // lower body / plyos / high impact here). RED communicates the paused day.
    fired.push({
      status: "RED",
      restrictions: {
        lowerBodyAllowed: false,
        lowerBodyScale: 0,
        upperBodyAllowed: true,
        upperBodyScale: 0.4,
        plyometricsAllowed: false,
        highImpactAllowed: false,
        maxTrainingDurationMinutes: 30,
      },
      reason: "IMMINENT_GAME",
      recoveryAction: "Game protection: avoid all fatigue-producing training before the game.",
    });
  } else if (games.upcoming) {
    // SPEC §17: reduced neural primer allowed, no high-volume lower-body work,
    // no unnecessary high-intensity conditioning.
    fired.push({
      status: "YELLOW",
      restrictions: {
        lowerBodyAllowed: true,
        lowerBodyScale: 0.5,
        upperBodyAllowed: true,
        upperBodyScale: 0.7,
        plyometricsAllowed: true,
        highImpactAllowed: false,
        maxTrainingDurationMinutes: 45,
      },
      reason: "UPCOMING_GAME",
      recoveryAction:
        "Keep today light: short neural primer only, no high-intensity conditioning.",
    });
  }

  const workload = computeRecentWorkload(
    input.recentActivities,
    input.now,
    input.athlete.timezone,
    thresholds,
  );
  const workloadFlagged =
    hasHighSessionLoad(input.recentActivities, input.now, input.athlete.timezone, thresholds) ||
    workload.last24HoursLoad >= thresholds.highCumulative24hLoad;
  if (workloadFlagged) {
    // Fatigued from recent load: trim volume, strip plyometrics and high
    // impact (high-volume plyometrics under fatigue is prohibited, SPEC §26).
    fired.push({
      status: "YELLOW",
      restrictions: {
        lowerBodyAllowed: true,
        lowerBodyScale: 0.6,
        upperBodyAllowed: true,
        upperBodyScale: 0.8,
        plyometricsAllowed: false,
        highImpactAllowed: false,
        maxTrainingDurationMinutes: 60,
      },
      reason: "HIGH_RECENT_WORKLOAD",
      recoveryAction:
        "High recent workload: prioritize recovery and keep today's session low-stress.",
    });
  }

  const lowSleep = readiness.sleepAnchor === "UNDER_7_HRS";
  const lowEnergy = readiness.energyAnchor === "DRAINED";
  const stiffness = readiness.jointStatus === "MILD_STIFFNESS";
  const concernCount = (lowSleep ? 1 : 0) + (lowEnergy ? 1 : 0) + (stiffness ? 1 : 0);

  if (lowSleep) {
    fired.push({
      status: "YELLOW",
      restrictions: {
        lowerBodyAllowed: true,
        lowerBodyScale: 0.7,
        upperBodyAllowed: true,
        upperBodyScale: 0.8,
        plyometricsAllowed: false,
        highImpactAllowed: false,
        maxTrainingDurationMinutes: 75,
      },
      reason: "LOW_SLEEP",
      recoveryAction: "Short sleep: favor low-stress movement and an earlier night.",
    });
  }
  if (lowEnergy) {
    fired.push({
      status: "YELLOW",
      restrictions: {
        lowerBodyAllowed: true,
        lowerBodyScale: 0.7,
        upperBodyAllowed: true,
        upperBodyScale: 0.8,
        plyometricsAllowed: false,
        highImpactAllowed: false,
        maxTrainingDurationMinutes: 75,
      },
      reason: "LOW_ENERGY",
      recoveryAction: "Low energy: keep intensity low and stop if it feels worse.",
    });
  }

  /*
   * Priority 6 — Arithmetic readiness band (SPEC §12/§15 step 8). Reached only
   * when no earlier readiness rule fired: with perfect anchors the minimum
   * score is 7, so a sub-7 score here comes from mild stiffness or combined
   * moderate anchors (e.g. 2+2+2). Two-plus explicit concerns were already
   * handled above; their stricter template takes precedence over this one.
   */
  if (concernCount >= 2) {
    fired.push({
      status: "YELLOW",
      restrictions: {
        lowerBodyAllowed: true,
        lowerBodyScale: 0.5,
        upperBodyAllowed: true,
        upperBodyScale: 0.6,
        plyometricsAllowed: false,
        highImpactAllowed: false,
        maxTrainingDurationMinutes: 60,
      },
      reason: "MULTIPLE_READINESS_CONCERNS",
      recoveryAction: "Multiple readiness concerns: prioritize full recovery today.",
    });
  } else if (!lowSleep && !lowEnergy) {
    const score =
      SLEEP_SCORE[readiness.sleepAnchor] +
      JOINT_SCORE[readiness.jointStatus] +
      ENERGY_SCORE[readiness.energyAnchor];
    if (score <= thresholds.readinessScoreYellowMax) {
      fired.push({
        status: "YELLOW",
        restrictions: {
          lowerBodyAllowed: true,
          lowerBodyScale: 0.6,
          upperBodyAllowed: true,
          upperBodyScale: 0.7,
          plyometricsAllowed: false,
          highImpactAllowed: false,
          maxTrainingDurationMinutes: 60,
        },
        reason: "MULTIPLE_READINESS_CONCERNS",
        recoveryAction: "Readiness score is low: favor recovery-focused movement today.",
      });
    }
  }

  /* No rule fired ⇒ GREEN with the arithmetic confirmation. */
  if (fired.length === 0) {
    return {
      status: "GREEN",
      restrictions: baselineRestrictions(),
      reasons: ["NORMAL_READINESS"],
      recoveryActions: [],
      requiresAdultAttention: false,
    };
  }

  let status: EngineStatus = "GREEN";
  for (const rule of fired) {
    if (STATUS_SEVERITY[rule.status] > STATUS_SEVERITY[status]) status = rule.status;
  }

  return {
    status,
    restrictions: mergeFiredRules(fired.map((rule) => rule.restrictions)),
    reasons: fired.map((rule) => rule.reason),
    recoveryActions: fired.map((rule) => rule.recoveryAction),
    requiresAdultAttention: false,
  };
}
