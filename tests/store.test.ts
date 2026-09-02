import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_OBJECTIVE,
  type AthleteProfile,
  type TrainingObjective,
} from "../src/types";
import { DEFAULT_ATHLETE_PROFILE } from "../src/config/defaults";
import { useAppStore, type VikaiTrainerAppState } from "../src/stores/useAppStore";

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
  workoutProgress: {},
  notificationIdentifiers: { scheduleReminders: {} },
  activePlan: null,
  personalBests: [],
} satisfies Partial<VikaiTrainerAppState>;

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

  it("updates a logged activity in place without duplicating", () => {
    const log = useAppStore.getState().logActivity({
      activityDate: "2026-01-02",
      timezone: "UTC",
      activityType: "TEAM_PRACTICE",
      sessionRpe: 7,
      durationMinutes: 60,
    });

    useAppStore.getState().updateActivityLog(log.id, {
      sessionRpe: 9,
      durationMinutes: 90,
      notes: "Harder than it felt",
    });

    const entries = useAppStore.getState().activityLogs;
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ id: log.id, sessionRpe: 9, durationMinutes: 90 });
    // createdAt is untouched; updatedAt was bumped by the patch.
    expect(entries[0]?.createdAt).toBe(log.createdAt);
    expect((entries[0]?.updatedAt ?? "") >= log.updatedAt).toBe(true);
  });

  it("ignores activity updates for unknown ids", () => {
    useAppStore.getState().updateActivityLog("does-not-exist", { sessionRpe: 3 });
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

  it("schedules a recurring series in one submission with a shared seriesId", () => {
    const times = [
      "2026-09-15", "2026-09-17", "2026-09-22", "2026-09-24",
      "2026-09-29", "2026-10-01", "2026-10-06", "2026-10-08",
      "2026-10-13", "2026-10-15", "2026-10-20", "2026-10-22",
    ];
    const drafts = times.map((date) => ({
      eventType: "TEAM_PRACTICE" as const,
      startAt: `${date}T18:00:00.000Z`,
    }));
    const created = useAppStore.getState().scheduleEventSeries(drafts);

    expect(created).toHaveLength(12);
    const ids = new Set(created.map((event) => event.id));
    expect(ids.size).toBe(12);
    // All members share exactly one seriesId; one-off events have none.
    const seriesIds = new Set(created.map((event) => event.seriesId));
    expect(seriesIds.size).toBe(1);
    expect(created[0]?.seriesId).toMatch(/^series-/);
    expect(useAppStore.getState().scheduledEvents).toHaveLength(12);
  });

  it("removes a whole series and leaves one-off events alone", () => {
    const store = useAppStore.getState();
    const oneOff = store.scheduleEvent({ eventType: "GAME", startAt: "2026-01-05T19:00:00.000Z" });
    const created = store.scheduleEventSeries([
      { eventType: "TEAM_PRACTICE", startAt: "2026-09-15T18:00:00.000Z" },
      { eventType: "TEAM_PRACTICE", startAt: "2026-09-17T18:00:00.000Z" },
      { eventType: "TEAM_PRACTICE", startAt: "2026-09-22T18:00:00.000Z" },
    ]);
    const seriesId = created[0]?.seriesId;
    expect(seriesId).toBeDefined();

    const removed = useAppStore.getState().removeEventSeries(seriesId as string);
    expect(removed).toHaveLength(3);
    expect(useAppStore.getState().scheduledEvents).toHaveLength(1);
    expect(useAppStore.getState().scheduledEvents[0]?.id).toBe(oneOff.id);

    // Unknown seriesId is a no-op.
    expect(useAppStore.getState().removeEventSeries("series-ghost")).toEqual([]);
  });

  it("creates an empty series as a no-op", () => {
    expect(useAppStore.getState().scheduleEventSeries([])).toEqual([]);
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

describe("workout progress — live session check-offs (guided flow)", () => {
  it("checks a component off and freezes its sets", () => {
    useAppStore.getState().toggleComponentDone("2026-01-02", "primary-lower-squat", 4);
    const day = useAppStore.getState().workoutProgress["2026-01-02"];

    expect(day?.["primary-lower-squat"]).toMatchObject({
      componentId: "primary-lower-squat",
      sets: 4,
    });
    expect(day?.["primary-lower-squat"]?.completedAt).toBeTruthy();
  });

  it("toggles back off, and days stay isolated", () => {
    useAppStore.getState().toggleComponentDone("2026-01-02", "a", 3);
    useAppStore.getState().toggleComponentDone("2026-01-03", "a", 2);

    useAppStore.getState().toggleComponentDone("2026-01-02", "a", 3);
    expect(useAppStore.getState().workoutProgress["2026-01-02"]?.a).toBeUndefined();
    // The other day's check-off is untouched.
    expect(useAppStore.getState().workoutProgress["2026-01-03"]?.a).toMatchObject({
      sets: 2,
    });
  });

  it("re-records a re-checked block with the current volume and a fresh timestamp", () => {
    useAppStore.getState().toggleComponentDone("2026-01-02", "a", 3);
    const first = useAppStore.getState().workoutProgress["2026-01-02"]?.a;

    // Mistaken check-off → undo → re-check with the engine's current volume.
    useAppStore.getState().toggleComponentDone("2026-01-02", "a", 3);
    useAppStore.getState().toggleComponentDone("2026-01-02", "a", 2);
    const second = useAppStore.getState().workoutProgress["2026-01-02"]?.a;

    expect(second).toMatchObject({ componentId: "a", sets: 2 });
    expect(second?.completedAt ?? "").toBeTruthy();
    expect((second?.completedAt ?? "") >= (first?.completedAt ?? "")).toBe(true);
  });
});

describe("plan builder — store integration", () => {
  it("builds and activates a plan from a persona draft", () => {
    const plan = useAppStore.getState().buildTrainingPlan({
      personaId: "JUMP_HIGHER",
      periodWeeks: 8,
    });

    const state = useAppStore.getState();
    expect(state.activePlan?.id).toBe(plan.id);
    expect(state.activePlan?.primaryGoals).toEqual(["EXPLOSIVENESS", "STRENGTH"]);
    expect(state.activePlan?.startScale).toBeCloseTo(0.75, 5);
    for (const component of plan.components) {
      expect(component.id).toBeTruthy();
      expect(component.priority).toBeGreaterThanOrEqual(1);
    }
  });

  it("rebuilding with identical inputs is idempotent; clearing returns to default", () => {
    const first = useAppStore.getState().buildTrainingPlan({ personaId: "ALL_ROUND", periodWeeks: 6 });
    const second = useAppStore.getState().buildTrainingPlan({ personaId: "ALL_ROUND", periodWeeks: 6 });
    expect(first.components).toEqual(second.components);
    expect(second.id).not.toBe(first.id); // new plan record, same shape

    useAppStore.getState().clearTrainingPlan();
    expect(useAppStore.getState().activePlan).toBeNull();
  });

  it("history feeds the calibration: logged workouts raise the start scale", () => {
    const now = new Date();
    const logs = Array.from({ length: 8 }, (_, index) => ({
      id: `w${index}`,
      activityDate: "2026-01-02",
      createdAt: new Date(now.getTime() - index * 86_400_000).toISOString(),
      updatedAt: now.toISOString(),
    }));
    useAppStore.setState({ workoutLogs: logs });

    const plan = useAppStore.getState().buildTrainingPlan({ personaId: "GET_STRONGER", periodWeeks: 4 });
    expect(plan.startScale).toBeGreaterThan(0.75);
  });

  it("buildTrainingPlan passes chosen skills through — they lead the plan", () => {
    const plan = useAppStore.getState().buildTrainingPlan({
      primaryGoals: ["SPEED"],
      skillIds: ["skill-shooting", "skill-ballhandling"],
      periodWeeks: 6,
    });

    expect(plan.components[0]?.id).toBe("skill-shooting");
    expect(plan.components[1]?.id).toBe("skill-ballhandling");
    expect(plan.components[0]?.priority).toBe(1);
  });
});

describe("personal milestones — store integration", () => {
  it("logs attempts with full history (no overwriting)", () => {
    const first = useAppStore.getState().addPersonalBest({ drillId: "jump-touch", value: 40 });
    const second = useAppStore.getState().addPersonalBest({ drillId: "jump-touch", value: 46 });

    const attempts = useAppStore.getState().personalBests;
    expect(attempts).toHaveLength(2);
    expect(attempts.map((entry) => entry.id)).toEqual([first.id, second.id]);
    expect(second.activityDate).toBeTruthy();
  });

  it("removes a mistyped attempt", () => {
    const attempt = useAppStore.getState().addPersonalBest({ drillId: "sprint-20yd", value: 3.1 });
    useAppStore.getState().addPersonalBest({ drillId: "sprint-20yd", value: 3.0 });
    useAppStore.getState().removePersonalBest(attempt.id);
    expect(useAppStore.getState().personalBests).toHaveLength(1);
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
    expect(key).toBe("vikai-trainer-local-store");

    const persisted = JSON.parse(payload) as {
      state: { readinessInputs: Array<{ localDate: string }> };
    };
    expect(persisted.state.readinessInputs).toHaveLength(1);
    expect(persisted.state.readinessInputs[0]?.localDate).toBe("2026-01-02");
  });
});
