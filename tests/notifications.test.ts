import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  cancelCheckInReminderAsync,
  cancelScheduleReminderAsync,
  configureNotificationHandler,
  ensureDefaultRemindersScheduledAsync,
  scheduleActivityLogReminderAsync,
  scheduleCheckInReminderAsync,
  scheduleRecoveryReminderAsync,
  syncScheduleReminderAsync,
  SCHEDULE_REMINDER_LEAD_MINUTES,
} from "../src/services/notifications";
import { useAppStore } from "../src/stores/useAppStore";

/**
 * Phase 5.1 — Local notifications pipeline tests (SPEC §35).
 * expo-notifications and react-native are mocked at module level; the
 * Zustand store runs for real against a mocked AsyncStorage.
 *
 * Guardrail assertions enforce that reminders are cancelled BY IDENTIFIER
 * only — the bulk cancel API is never touched (AGENTS.md / SPEC §35).
 */

const notificationsMock = vi.hoisted(() => ({
  getPermissionsAsync: vi.fn<(key?: void) => Promise<{ granted: boolean }>>(async () => ({
    granted: true,
  })),
  requestPermissionsAsync: vi.fn<(key?: void) => Promise<{ granted: boolean }>>(async () => ({
    granted: true,
  })),
  setNotificationChannelAsync: vi.fn<
    (id: string, settings: Record<string, unknown>) => Promise<void>
  >(async () => undefined),
  setNotificationHandler: vi.fn<(handler: unknown) => void>(() => undefined),
  scheduleNotificationAsync: vi.fn<
    (request: {
      content: { title?: string; body?: string };
      trigger: Record<string, unknown>;
    }) => Promise<string>
  >(async () => "notif-id-1"),
  cancelScheduledNotificationAsync: vi.fn<(id: string) => Promise<void>>(
    async () => undefined,
  ),
  cancelAllScheduledNotificationsAsync: vi.fn<() => Promise<void>>(async () => undefined),
  SchedulableTriggerInputTypes: { DAILY: "daily", DATE: "date" },
  AndroidImportance: {
    UNKNOWN: 0,
    UNSPECIFIED: 1,
    NONE: 2,
    MIN: 3,
    LOW: 4,
    DEFAULT: 5,
    HIGH: 6,
    MAX: 7,
  },
}));

const platformMock = vi.hoisted(() => ({ value: "ios" as string }));

const AsyncStorageMock = vi.hoisted(() => ({
  getItem: vi.fn<(key: string) => Promise<string | null>>(async () => null),
  setItem: vi.fn<(key: string, value: string) => Promise<void>>(async () => undefined),
  removeItem: vi.fn<(key: string) => Promise<void>>(async () => undefined),
}));

vi.mock("expo-notifications", () => notificationsMock);
vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return platformMock.value;
    },
  },
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: AsyncStorageMock,
}));

function makeEvent(overrides: {
  id?: string;
  startAt: string;
  eventType?: "GAME" | "TEAM_PRACTICE";
  title?: string;
}) {
  return {
    id: overrides.id ?? "event-1",
    eventType: overrides.eventType ?? ("GAME" as const),
    startAt: overrides.startAt,
    ...(overrides.title !== undefined ? { title: overrides.title } : {}),
    createdAt: "",
    updatedAt: "",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  let idCounter = 0;
  notificationsMock.scheduleNotificationAsync.mockImplementation(async () => {
    idCounter += 1;
    return `notif-id-${idCounter}`;
  });
  platformMock.value = "ios";
  useAppStore.setState({
    notificationIdentifiers: { scheduleReminders: {} },
  });
});

/** Returns the most recent scheduleNotificationAsync request, or throws. */
function lastScheduleCall(): {
  content: { title?: string; body?: string };
  trigger: Record<string, unknown>;
} {
  const call = notificationsMock.scheduleNotificationAsync.mock.calls.at(-1);
  const request = call?.[0];
  if (!request) throw new Error("expected a schedule call");
  return request;
}

describe("setup (FLOW 5.1 expo-notifications configuration)", () => {
  it("registers the notification handler", () => {
    configureNotificationHandler();
    expect(notificationsMock.setNotificationHandler).toHaveBeenCalledTimes(1);
  });

  it("creates the Android channel only on Android", async () => {
    await scheduleCheckInReminderAsync();
    expect(notificationsMock.setNotificationChannelAsync).not.toHaveBeenCalled();

    platformMock.value = "android";
    await scheduleActivityLogReminderAsync();
    expect(notificationsMock.setNotificationChannelAsync).toHaveBeenCalledWith(
      "vikai-reminders",
      expect.objectContaining({ name: "Vikai reminders" }),
    );
  });
});

describe("READINESS_CHECKIN & ACTIVITY_LOG daily reminders", () => {
  it("schedules the daily check-in reminder at 08:00 and tracks its identifier", async () => {
    const id = await scheduleCheckInReminderAsync();

    expect(id).toBe("notif-id-1");
    expect(useAppStore.getState().notificationIdentifiers.readinessCheckIn).toBe("notif-id-1");

    const request = lastScheduleCall();
    expect(request.content).toMatchObject({ title: "Vikai daily check-in" });
    expect(request.trigger).toMatchObject({ type: "daily", hour: 8, minute: 0 });
  });

  it("schedules the evening activity-log reminder with custom time", async () => {
    await scheduleActivityLogReminderAsync({ hour: 20, minute: 15 });

    const request = lastScheduleCall();
    expect(request.trigger).toMatchObject({ type: "daily", hour: 20, minute: 15 });
    expect(useAppStore.getState().notificationIdentifiers.activityLog).toBe("notif-id-1");
  });

  it("replaces the previous reminder by its specific identifier on reschedule", async () => {
    await scheduleCheckInReminderAsync();
    await scheduleCheckInReminderAsync({ hour: 9, minute: 30 });

    expect(notificationsMock.cancelScheduledNotificationAsync).toHaveBeenCalledWith("notif-id-1");
    expect(notificationsMock.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().notificationIdentifiers.readinessCheckIn).toBe("notif-id-2");
  });

  it("cancels by identifier and clears the slot on explicit cancel", async () => {
    await scheduleCheckInReminderAsync();
    await cancelCheckInReminderAsync();

    expect(notificationsMock.cancelScheduledNotificationAsync).toHaveBeenCalledWith("notif-id-1");
    expect(useAppStore.getState().notificationIdentifiers.readinessCheckIn).toBeUndefined();
  });

  it("is a no-op cancel when nothing is scheduled", async () => {
    await cancelCheckInReminderAsync();
    expect(notificationsMock.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });
});

describe("RECOVERY_REMINDER one-shot", () => {
  it("schedules a date trigger and tracks the identifier", async () => {
    const when = new Date(Date.now() + 3_600_000);
    await scheduleRecoveryReminderAsync(when);

    const request = lastScheduleCall();
    expect(request.trigger).toMatchObject({ type: "date" });
    expect((request.trigger.date as Date).getTime()).toBe(when.getTime());
    expect(useAppStore.getState().notificationIdentifiers.recoveryReminder).toBe("notif-id-1");
  });
});

describe("SCHEDULE_REMINDER per-event reminders", () => {
  it("fires SCHEDULE_REMINDER_LEAD_MINUTES before a future game", async () => {
    const startAt = new Date(Date.now() + 4 * 3_600_000);
    await syncScheduleReminderAsync(makeEvent({ id: "event-1", startAt: startAt.toISOString() }));

    const request = lastScheduleCall();
    expect((request.trigger.date as Date).getTime()).toBe(
      startAt.getTime() - SCHEDULE_REMINDER_LEAD_MINUTES * 60_000,
    );
    expect(useAppStore.getState().notificationIdentifiers.scheduleReminders["event-1"]).toBe(
      "notif-id-1",
    );
  });

  it("includes the event label and optional title in the body", async () => {
    await syncScheduleReminderAsync(
      makeEvent({ startAt: new Date(Date.now() + 4 * 3_600_000).toISOString(), title: "Home opener" }),
    );

    const request = lastScheduleCall();
    expect(request.content.body).toContain("Game coming up — Home opener");
  });

  it("removes stale reminders for past events instead of scheduling", async () => {
    useAppStore.getState().setScheduleReminderId("event-1", "stale-id");

    await syncScheduleReminderAsync(
      makeEvent({ startAt: new Date(Date.now() - 3_600_000).toISOString() }),
    );

    expect(notificationsMock.cancelScheduledNotificationAsync).toHaveBeenCalledWith("stale-id");
    expect(notificationsMock.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(
      useAppStore.getState().notificationIdentifiers.scheduleReminders["event-1"],
    ).toBeUndefined();
  });

  it("resyncs by replacing the previous identifier for the same event", async () => {
    const future = new Date(Date.now() + 5 * 3_600_000).toISOString();
    await syncScheduleReminderAsync(makeEvent({ startAt: future }));
    await syncScheduleReminderAsync(makeEvent({ startAt: future }));

    expect(notificationsMock.cancelScheduledNotificationAsync).toHaveBeenCalledWith("notif-id-1");
    expect(useAppStore.getState().notificationIdentifiers.scheduleReminders["event-1"]).toBe(
      "notif-id-2",
    );
  });

  it("cancels a specific event reminder on request", async () => {
    await syncScheduleReminderAsync(
      makeEvent({ startAt: new Date(Date.now() + 5 * 3_600_000).toISOString() }),
    );
    await cancelScheduleReminderAsync("event-1");

    expect(notificationsMock.cancelScheduledNotificationAsync).toHaveBeenCalledWith("notif-id-1");
    expect(
      useAppStore.getState().notificationIdentifiers.scheduleReminders["event-1"],
    ).toBeUndefined();
  });
});

describe("first-run defaults", () => {
  it("schedules both daily reminders only when their slots are empty", async () => {
    await ensureDefaultRemindersScheduledAsync();
    expect(notificationsMock.scheduleNotificationAsync).toHaveBeenCalledTimes(2);

    // Second run: slots are filled, nothing new scheduled.
    await ensureDefaultRemindersScheduledAsync();
    expect(notificationsMock.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
  });
});

describe("permissions and the bulk-cancel guardrail", () => {
  it("schedules nothing and stores nothing when permission is denied", async () => {
    notificationsMock.getPermissionsAsync.mockResolvedValueOnce({ granted: false });
    notificationsMock.requestPermissionsAsync.mockResolvedValueOnce({ granted: false });

    const id = await scheduleCheckInReminderAsync();

    expect(id).toBeNull();
    expect(notificationsMock.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(useAppStore.getState().notificationIdentifiers.readinessCheckIn).toBeUndefined();
  });

  it("NEVER calls cancelAllScheduledNotificationsAsync (AGENTS.md / SPEC §35)", async () => {
    await scheduleCheckInReminderAsync();
    await scheduleCheckInReminderAsync({ hour: 9, minute: 0 });
    await cancelCheckInReminderAsync();
    await scheduleActivityLogReminderAsync();
    await scheduleRecoveryReminderAsync(new Date(Date.now() + 3_600_000));
    await syncScheduleReminderAsync(
      makeEvent({ startAt: new Date(Date.now() + 5 * 3_600_000).toISOString() }),
    );
    await cancelScheduleReminderAsync("event-1");

    expect(notificationsMock.cancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();
    expect(notificationsMock.cancelScheduledNotificationAsync.mock.calls.length).toBeGreaterThan(
      0,
    );
  });
});
