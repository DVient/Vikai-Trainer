import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_OBJECTIVE,
  type AthleteProfile,
  type TrainingObjective,
} from "../src/types";
import { DEFAULT_ATHLETE_PROFILE } from "../src/config/defaults";
import { useAppStore, type VikaiAppState } from "../src/stores/useAppStore";

/**
 * Phase 3.2 — Zustand store tests with AsyncStorage mocked (node runtime).
 * Verifies local check-in upsert semantics, activity/schedule management,
 * workout logging, and that every mutation persists to local storage (§31).
 */

const AsyncStorageMock = vi.hoisted(() => ({
  getItem: vi.fn<(key: string) => Promise<string | null>>(async () => null),
  setItem: vi.fn<(key: string, value: string) => Promise<void>>(async () => undefined),
  removeItem: vi.fn<(key: string) => Promise<void>>(async () => undefined),
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: AsyncStorageMock,
}));

const INITIAL_SLICES = {
  profile: DEFAULT_ATHLETE_PROFILE,
  trainingObjective: DEFAULT_OBJECTIVE,
  readinessInputs: [],
  activityLogs: [],
  scheduledEvents: [],
  workoutLogs: [],
  notificationIdentifiers: { scheduleReminders: {} },
} satisfies Partial<VikaiAppState>;

function resetStore(): void {
  useAppStore.setState(INITIAL_SLICES);
}

function makeProfile(): AthleteProfile {
  return {
    id: "athlete-1",
    displayName: "Athlete",
    sport: "BASKETBALL",
    athleteLevel: "YOUTH",
    primaryGoals: ["STRENGTH", "EXPLOSIVENESS", "CHANGE_OF_DIRECTION"],
    timezone: "America/New_York",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
});

describe("initial state", () => {
  it("starts with the spec defaults and empty local collections", () => {
    const state = useAppStore.getState();

    expect(state.profile).toEqual(DEFAULT_ATHLETE_PROFILE);
    expect(state.trainingObjective).toEqual(DEFAULT_OBJECTIVE);
    expect(state.readinessInputs).toEqual([]);
    expect(state.activityLogs).toEqual([]);
    expect(state.scheduledEvents).toEqual([]);
    expect(state.workoutLogs).toEqual([]);
    expect(state.notificationIdentifiers).toEqual({ scheduleReminders: {} });
  });
});

describe("profile & objective", () => {
  it("stores a profile overwrite on confirmation (SPEC §32)", () => {
    useAppStore.getState().setProfile(makeProfile());

    expect(useAppStore.getState().profile?.displayName).toBe("Athlete");
  });

  it("allows overriding the default training objective", () => {
    const custom: TrainingObjective = {
      ...DEFAULT_OBJECTIVE,
      primaryGoals: ["SPEED", "RECOVERY"],
    };
    useAppStore.getState().setTrainingObjective(custom);

    expect(useAppStore.getState().trainingObjective.primaryGoals).toEqual(["SPEED", "RECOVERY"]);
  });
});

describe("daily check-ins", () => {
  it("appends a check-in with generated id and timestamps", () => {
    const record = useAppStore.getState().saveDailyCheckIn({
      localDate: "2026-01-02",
      timezone: "America/New_York",
      recordedAt: "2026-01-02T08:00:00.000Z",
      sleepAnchor: "SEVEN_TO_EIGHT_HRS",
      jointStatus: "NO_CONCERN",
      energyAnchor: "NORMAL",
    });

    expect(record.id).toMatch(/^readiness-/);
    expect(record.createdAt).toBe(record.updatedAt);
    expect(useAppStore.getState().readinessInputs).toHaveLength(1);
  });

  it("upserts one record per localDate (overwrite semantics, SPEC §32)", () => {
    const store = useAppStore.getState();
    store.saveDailyCheckIn({
      localDate: "2026-01-02",
      timezone: "America/New_York",
      recordedAt: "2026-01-02T08:00:00.000Z",
      sleepAnchor: "UNDER_7_HRS",
      jointStatus: "MILD_STIFFNESS",
      energyAnchor: "DRAINED",
    });
    const second = store.saveDailyCheckIn({
      localDate: "2026-01-02",
      timezone: "America/New_York",
      recordedAt: "2026-01-02T09:00:00.000Z",
      sleepAnchor: "OVER_8_HRS",
      jointStatus: "NO_CONCERN",
      energyAnchor: "HIGH",
    });

    const inputs = useAppStore.getState().readinessInputs;
    expect(inputs).toHaveLength(1);
    expect(inputs[0]?.id).toBe(second.id);
    expect(inputs[0]?.sleepAnchor).toBe("OVER_8_HRS");
  });

  it("keeps separate records for different local dates", () => {
    const store = useAppStore.getState();
    store.saveDailyCheckIn({
      localDate: "2026-01-01",
      timezone: "America/New_York",
      recordedAt: "2026-01-01T08:00:00.000Z",
      sleepAnchor: "OVER_8_HRS",
      jointStatus: "NO_CONCERN",
      energyAnchor: "HIGH",
    });
    store.saveDailyCheckIn({
      localDate: "2026-01-02",
      timezone: "America/New_York",
      recordedAt: "2026-01-02T08:00:00.000Z",
      sleepAnchor: "OVER_8_HRS",
      jointStatus: "NO_CONCERN",
      energyAnchor: "HIGH",
    });

    expect(useAppStore.getState().readinessInputs).toHaveLength(2);
  });
});

describe("activity logs", () => {
  it("appends and removes activity logs", () => {
    const store = useAppStore.getState();
    const log = store.logActivity({
      activityDate: "2026-01-02",
      timezone: "America/New_York",
      activityType: "TEAM_PRACTICE",
      sessionRpe: 7,
      durationMinutes: 90,
    });

    expect(log.id).toMatch(/^activity-/);
    expect(useAppStore.getState().activityLogs).toHaveLength(1);

    useAppStore.getState().removeActivityLog(log.id);
    expect(useAppStore.getState().activityLogs).toHaveLength(0);
  });
});

describe("scheduled events", () => {
  it("schedules, updates, and removes events", () => {
    const store = useAppStore.getState();
    const event = store.scheduleEvent({
      eventType: "GAME",
      startAt: "2026-01-05T19:00:00.000Z",
    });

    expect(event.id).toMatch(/^event-/);
    expect(useAppStore.getState().scheduledEvents).toHaveLength(1);

    useAppStore.getState().updateScheduledEvent(event.id, { title: "Home opener" });
    const updated = useAppStore.getState().scheduledEvents[0];
    expect(updated?.title).toBe("Home opener");
    expect(updated?.eventType).toBe("GAME");

    useAppStore.getState().removeScheduledEvent(event.id);
    expect(useAppStore.getState().scheduledEvents).toHaveLength(0);
  });

  it("ignores updates for unknown event ids", () => {
    useAppStore.getState().updateScheduledEvent("does-not-exist", { title: "Ghost" });

    expect(useAppStore.getState().scheduledEvents).toHaveLength(0);
  });
});

describe("workout logs", () => {
  it("records completed workout sessions", () => {
    const log = useAppStore.getState().recordWorkoutLog({
      activityDate: "2026-01-02",
      notes: "Felt fresh",
    });

    expect(log.id).toMatch(/^workout-/);
    expect(useAppStore.getState().workoutLogs).toHaveLength(1);
  });
});

describe("notification identifier tracking (SPEC §35)", () => {
  it("stores and clears app-level reminder slots", () => {
    useAppStore.getState().storeNotificationId("readinessCheckIn", "notif-1");
    expect(useAppStore.getState().notificationIdentifiers.readinessCheckIn).toBe("notif-1");

    useAppStore.getState().storeNotificationId("readinessCheckIn", null);
    expect(useAppStore.getState().notificationIdentifiers.readinessCheckIn).toBeUndefined();
  });

  it("tracks per-event schedule reminder identifiers", () => {
    useAppStore.getState().setScheduleReminderId("event-1", "notif-2");
    expect(
      useAppStore.getState().notificationIdentifiers.scheduleReminders["event-1"],
    ).toBe("notif-2");

    useAppStore.getState().setScheduleReminderId("event-1", null);
    expect(
      useAppStore.getState().notificationIdentifiers.scheduleReminders["event-1"],
    ).toBeUndefined();
  });
});

describe("local persistence (SPEC §31)", () => {
  it("writes the persisted store to AsyncStorage on every mutation", async () => {
    useAppStore.getState().saveDailyCheckIn({
      localDate: "2026-01-02",
      timezone: "America/New_York",
      recordedAt: "2026-01-02T08:00:00.000Z",
      sleepAnchor: "OVER_8_HRS",
      jointStatus: "NO_CONCERN",
      energyAnchor: "HIGH",
    });

    expect(AsyncStorageMock.setItem).toHaveBeenCalled();
    const calls = AsyncStorageMock.setItem.mock.calls as Array<[string, string]>;
    // The reset in beforeEach also persists; assert against the latest write.
    const last = calls.at(-1);
    if (!last) throw new Error("expected a persisted store write");
    const [key, payload] = last;
    expect(key).toBe("vikai-local-store");

    const persisted = JSON.parse(payload) as {
      state: { readinessInputs: Array<{ localDate: string }> };
    };
    expect(persisted.state.readinessInputs).toHaveLength(1);
    expect(persisted.state.readinessInputs[0]?.localDate).toBe("2026-01-02");
  });
});
