/**
 * VIKAI — Local App Store (Phase 3.2)
 *
 * Zustand store persisted to AsyncStorage (SPEC §31, §33). Fully local and
 * offline: no server, no remote database, no network transport of readiness
 * or athlete data (SPEC §34).
 *
 * STORAGE SCHEMA (SPEC §33): profile, training_objective, readiness_inputs,
 * activity_logs, scheduled_events, workout_logs. `notification_preferences`
 * is added in Phase 5 together with the notification pipeline, where its
 * shape (per-notification identifier tracking) is defined.
 *
 * Timestamps and IDs are generated here — store actions are allowed to touch
 * the clock; purity is only required inside src/engine (AGENTS.md).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  DEFAULT_OBJECTIVE,
  type ActivityLog,
  type AthleteProfile,
  type CompletedComponent,
  type NotificationIdentifiers,
  type NotificationSlot,
  type ReadinessInput,
  type ScheduledEvent,
  type TrainingObjective,
  type WorkoutLog,
} from "../types";
import { DEFAULT_ATHLETE_PROFILE } from "../config/defaults";

/** Collision-resistant local identifier (no native crypto dependency). */
function createLocalId(prefix: string): string {
  const time = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${time}-${random}`;
}

type ReadinessDraft = Omit<ReadinessInput, "id" | "createdAt" | "updatedAt">;
type ActivityDraft = Omit<ActivityLog, "id" | "createdAt" | "updatedAt">;
type ScheduledEventDraft = Omit<ScheduledEvent, "id" | "createdAt" | "updatedAt">;
type WorkoutLogDraft = Omit<WorkoutLog, "id" | "createdAt" | "updatedAt">;

export interface VikaiTrainerAppState {
  /* ── State slices (SPEC §33) ── */
  /** Initialized with the §1.2 default baseline; overridable in-app. */
  profile: AthleteProfile;
  trainingObjective: TrainingObjective;
  readinessInputs: ReadinessInput[];
  activityLogs: ActivityLog[];
  scheduledEvents: ScheduledEvent[];
  workoutLogs: WorkoutLog[];
  /**
   * Live-session check-offs, keyed by localDate then componentId (additive
   * to the §33 schema). Completed sets are frozen at check-off time.
   */
  workoutProgress: Record<string, Record<string, CompletedComponent>>;
  /** Per-notification identifier tracking (SPEC §35 / AGENTS.md guardrail). */
  notificationIdentifiers: NotificationIdentifiers;

  /* ── Actions ── */
  /** Replaces the profile on confirmation (SPEC §32 overwrite semantics). */
  setProfile: (profile: AthleteProfile) => void;
  /** Overrides the default training objective (user/parent/coach config). */
  setTrainingObjective: (objective: TrainingObjective) => void;
  /** Upserts the daily check-in: one record per localDate (SPEC §11/§32). */
  saveDailyCheckIn: (draft: ReadinessDraft) => ReadinessInput;
  /** Appends a completed activity log (SPEC §10). */
  logActivity: (draft: ActivityDraft) => ActivityLog;
  removeActivityLog: (id: string) => void;
  /** Adds a future/planned event (SPEC §9.1). */
  scheduleEvent: (draft: ScheduledEventDraft) => ScheduledEvent;
  /**
   * Adds several events as one recurring series (one shared seriesId, one
   * persist write). Returns the created records in input order.
   */
  scheduleEventSeries: (drafts: ScheduledEventDraft[]) => ScheduledEvent[];
  updateScheduledEvent: (
    id: string,
    patch: Partial<Omit<ScheduledEvent, "id" | "createdAt">>,
  ) => void;
  removeScheduledEvent: (id: string) => void;
  /** Removes every member of a recurring series; returns what was removed. */
  removeEventSeries: (seriesId: string) => ScheduledEvent[];
  recordWorkoutLog: (draft: WorkoutLogDraft) => WorkoutLog;
  /** Checks off (or un-checks) one Game Plan component for a local date. */
  toggleComponentDone: (localDate: string, componentId: string, sets: number) => void;
  /** Tracks (or clears, with null) a scheduled notification identifier. */
  storeNotificationId: (slot: NotificationSlot, id: string | null) => void;
  /** Tracks (or clears, with null) a per-event SCHEDULE_REMINDER identifier. */
  setScheduleReminderId: (eventId: string, id: string | null) => void;
}

export const useAppStore = create<VikaiTrainerAppState>()(
  persist(
    (set, get) => ({
      profile: DEFAULT_ATHLETE_PROFILE,
      trainingObjective: DEFAULT_OBJECTIVE,
      readinessInputs: [],
      activityLogs: [],
      scheduledEvents: [],
      workoutLogs: [],
      workoutProgress: {},
      notificationIdentifiers: { scheduleReminders: {} },

      setProfile: (profile) => {
        set({ profile });
      },

      setTrainingObjective: (objective) => {
        set({ trainingObjective: objective });
      },

      saveDailyCheckIn: (draft) => {
        const now = new Date().toISOString();
        const record: ReadinessInput = {
          ...draft,
          id: createLocalId("readiness"),
          createdAt: now,
          updatedAt: now,
        };
        set((state) => {
          const existingIndex = state.readinessInputs.findIndex(
            (entry) => entry.localDate === draft.localDate,
          );
          if (existingIndex === -1) {
            return { readinessInputs: [...state.readinessInputs, record] };
          }
          const next = state.readinessInputs.slice();
          next.splice(existingIndex, 1, record);
          return { readinessInputs: next };
        });
        return record;
      },

      logActivity: (draft) => {
        const now = new Date().toISOString();
        const record: ActivityLog = {
          ...draft,
          id: createLocalId("activity"),
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({ activityLogs: [...state.activityLogs, record] }));
        return record;
      },

      removeActivityLog: (id) => {
        set((state) => ({
          activityLogs: state.activityLogs.filter((entry) => entry.id !== id),
        }));
      },

      scheduleEvent: (draft) => {
        const now = new Date().toISOString();
        const record: ScheduledEvent = {
          ...draft,
          id: createLocalId("event"),
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({ scheduledEvents: [...state.scheduledEvents, record] }));
        return record;
      },

      scheduleEventSeries: (drafts) => {
        if (drafts.length === 0) return [];
        const now = new Date().toISOString();
        const seriesId = createLocalId("series");
        const records: ScheduledEvent[] = drafts.map((draft) => ({
          ...draft,
          id: createLocalId("event"),
          seriesId,
          createdAt: now,
          updatedAt: now,
        }));
        set((state) => ({ scheduledEvents: [...state.scheduledEvents, ...records] }));
        return records;
      },

      updateScheduledEvent: (id, patch) => {
        set((state) => ({
          scheduledEvents: state.scheduledEvents.map((event) =>
            event.id === id ? { ...event, ...patch, updatedAt: new Date().toISOString() } : event,
          ),
        }));
      },

      removeScheduledEvent: (id) => {
        set((state) => ({
          scheduledEvents: state.scheduledEvents.filter((event) => event.id !== id),
        }));
      },

      removeEventSeries: (seriesId) => {
        const removed = get().scheduledEvents.filter((event) => event.seriesId === seriesId);
        if (removed.length === 0) return [];
        set((state) => ({
          scheduledEvents: state.scheduledEvents.filter((event) => event.seriesId !== seriesId),
        }));
        return removed;
      },

      recordWorkoutLog: (draft) => {
        const now = new Date().toISOString();
        const record: WorkoutLog = {
          ...draft,
          id: createLocalId("workout"),
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({ workoutLogs: [...state.workoutLogs, record] }));
        return record;
      },

      toggleComponentDone: (localDate, componentId, sets) => {
        set((state) => {
          const dayProgress = { ...state.workoutProgress[localDate] };
          if (dayProgress[componentId] !== undefined) {
            delete dayProgress[componentId];
          } else {
            dayProgress[componentId] = { componentId, sets, completedAt: new Date().toISOString() };
          }
          return {
            workoutProgress: { ...state.workoutProgress, [localDate]: dayProgress },
          };
        });
      },

      storeNotificationId: (slot, id) => {
        set((state) => {
          const identifiers = { ...state.notificationIdentifiers };
          if (id === null) delete identifiers[slot];
          else identifiers[slot] = id;
          return { notificationIdentifiers: identifiers };
        });
      },

      setScheduleReminderId: (eventId, id) => {
        set((state) => {
          const scheduleReminders = { ...state.notificationIdentifiers.scheduleReminders };
          if (id === null) delete scheduleReminders[eventId];
          else scheduleReminders[eventId] = id;
          return {
            notificationIdentifiers: { ...state.notificationIdentifiers, scheduleReminders },
          };
        });
      },
    }),
    {
      name: "vikai-trainer-local-store",
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
