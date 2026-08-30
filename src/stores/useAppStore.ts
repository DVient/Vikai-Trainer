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
  type ReadinessInput,
  type ScheduledEvent,
  type TrainingObjective,
  type WorkoutLog,
} from "../types";

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

export interface VikaiAppState {
  /* ── State slices (SPEC §33) ── */
  profile: AthleteProfile | null;
  trainingObjective: TrainingObjective;
  readinessInputs: ReadinessInput[];
  activityLogs: ActivityLog[];
  scheduledEvents: ScheduledEvent[];
  workoutLogs: WorkoutLog[];

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
  updateScheduledEvent: (
    id: string,
    patch: Partial<Omit<ScheduledEvent, "id" | "createdAt">>,
  ) => void;
  removeScheduledEvent: (id: string) => void;
  recordWorkoutLog: (draft: WorkoutLogDraft) => WorkoutLog;
}

export const useAppStore = create<VikaiAppState>()(
  persist(
    (set) => ({
      profile: null,
      trainingObjective: DEFAULT_OBJECTIVE,
      readinessInputs: [],
      activityLogs: [],
      scheduledEvents: [],
      workoutLogs: [],

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
    }),
    {
      name: "vikai-local-store",
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
