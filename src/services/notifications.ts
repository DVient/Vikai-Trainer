/**
 * VIKAI — Local notifications pipeline (Phase 5.1, SPEC §35)
 *
 * expo-notifications based, fully local (no push tokens, no servers — SPEC
 * §34). Implements the four §35 notification types:
 *
 *   READINESS_CHECKIN  → daily morning check-in reminder      (store slot:
 *                         readinessCheckIn)
 *   ACTIVITY_LOG       → daily evening activity-log reminder  (activityLog)
 *   RECOVERY_REMINDER  → one-shot nudge after high workload   (recoveryReminder)
 *   SCHEDULE_REMINDER  → per-event lead reminder for games/   (scheduleReminders
 *                         practices, keyed by event id)
 *
 * GUARDRAIL (AGENTS.md / SPEC §35): every scheduled notification's identifier
 * is tracked in the Zustand store, and reminders are cancelled/replaced by
 * that specific identifier only. `cancelAllScheduledNotificationsAsync()`
 * is NEVER called anywhere in this codebase.
 */

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { SCHEDULED_EVENT_LABELS } from "../lib/format";
import { useAppStore } from "../stores/useAppStore";
import type { NotificationSlot, ScheduledEvent } from "../types";

export interface ReminderTime {
  hour: number;
  minute: number;
}

export const DEFAULT_CHECKIN_REMINDER_TIME: ReminderTime = { hour: 8, minute: 0 };
export const DEFAULT_ACTIVITY_LOG_REMINDER_TIME: ReminderTime = { hour: 19, minute: 30 };
/** SCHEDULE_REMINDER fires this many minutes before a game or practice. */
export const SCHEDULE_REMINDER_LEAD_MINUTES = 120;

const ANDROID_CHANNEL_ID = "vikai-reminders";

/** Notification presentation setup (call once at app start). */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Returns true when notification permissions are (or become) granted. */
export async function ensureNotificationPermissionsAsync(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

async function ensureAndroidChannelAsync(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: "Vikai reminders",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

function dailyTrigger(time: ReminderTime): Notifications.DailyTriggerInput {
  return {
    type: Notifications.SchedulableTriggerInputTypes.DAILY,
    hour: time.hour,
    minute: time.minute,
    channelId: ANDROID_CHANNEL_ID,
  };
}

/* ── READINESS_CHECKIN / ACTIVITY_LOG: daily reminders ─────────────────── */

async function scheduleDailyReminderAsync(
  slot: NotificationSlot,
  content: { title: string; body: string },
  time: ReminderTime,
): Promise<string | null> {
  if (!(await ensureNotificationPermissionsAsync())) return null;
  await ensureAndroidChannelAsync();

  // Replace by specific identifier — never a bulk cancel (SPEC §35).
  const previous = useAppStore.getState().notificationIdentifiers[slot];
  if (previous !== undefined) {
    await Notifications.cancelScheduledNotificationAsync(previous);
  }

  const id = await Notifications.scheduleNotificationAsync({
    content: { title: content.title, body: content.body },
    trigger: dailyTrigger(time),
  });
  useAppStore.getState().storeNotificationId(slot, id);
  return id;
}

export async function scheduleCheckInReminderAsync(
  time: ReminderTime = DEFAULT_CHECKIN_REMINDER_TIME,
): Promise<string | null> {
  return scheduleDailyReminderAsync(
    "readinessCheckIn",
    {
      title: "Vikai daily check-in",
      body: "Take a minute: sleep, body feel, and energy.",
    },
    time,
  );
}

export async function scheduleActivityLogReminderAsync(
  time: ReminderTime = DEFAULT_ACTIVITY_LOG_REMINDER_TIME,
): Promise<string | null> {
  return scheduleDailyReminderAsync(
    "activityLog",
    {
      title: "Log today's activity",
      body: "Practices, games, or sessions — log them while it's fresh.",
    },
    time,
  );
}

/* ── RECOVERY_REMINDER: one-shot after high workload ───────────────────── */

export async function scheduleRecoveryReminderAsync(when: Date): Promise<string | null> {
  if (!(await ensureNotificationPermissionsAsync())) return null;
  await ensureAndroidChannelAsync();

  const previous = useAppStore.getState().notificationIdentifiers.recoveryReminder;
  if (previous !== undefined) {
    await Notifications.cancelScheduledNotificationAsync(previous);
  }

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Recovery time",
      body: "High recent workload — favor recovery, hydration, and sleep tonight.",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: when,
      channelId: ANDROID_CHANNEL_ID,
    },
  });
  useAppStore.getState().storeNotificationId("recoveryReminder", id);
  return id;
}

/* ── Slot cancellation (targeted, by stored identifier) ────────────────── */

async function cancelSlotReminderAsync(slot: NotificationSlot): Promise<void> {
  const previous = useAppStore.getState().notificationIdentifiers[slot];
  if (previous === undefined) return;
  await Notifications.cancelScheduledNotificationAsync(previous);
  useAppStore.getState().storeNotificationId(slot, null);
}

export async function cancelCheckInReminderAsync(): Promise<void> {
  await cancelSlotReminderAsync("readinessCheckIn");
}

export async function cancelActivityLogReminderAsync(): Promise<void> {
  await cancelSlotReminderAsync("activityLog");
}

export async function cancelRecoveryReminderAsync(): Promise<void> {
  await cancelSlotReminderAsync("recoveryReminder");
}

/* ── SCHEDULE_REMINDER: per-event lead reminders ───────────────────────── */

export async function syncScheduleReminderAsync(
  event: ScheduledEvent,
  now: Date = new Date(),
): Promise<string | null> {
  // Always drop a stale reminder for this event first (update-safe resync).
  const existing = useAppStore.getState().notificationIdentifiers.scheduleReminders[event.id];
  if (existing !== undefined) {
    await Notifications.cancelScheduledNotificationAsync(existing);
  }

  const kickoff = new Date(event.startAt);
  if (!Number.isFinite(kickoff.getTime())) {
    useAppStore.getState().setScheduleReminderId(event.id, null);
    return null;
  }
  const fireAt = new Date(kickoff.getTime() - SCHEDULE_REMINDER_LEAD_MINUTES * 60_000);
  if (fireAt.getTime() <= now.getTime()) {
    useAppStore.getState().setScheduleReminderId(event.id, null);
    return null;
  }

  if (!(await ensureNotificationPermissionsAsync())) return null;
  await ensureAndroidChannelAsync();

  const label = SCHEDULED_EVENT_LABELS[event.eventType];
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Vikai schedule reminder",
      body: `${label} coming up${event.title ? ` — ${event.title}` : ""}.`,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireAt,
      channelId: ANDROID_CHANNEL_ID,
    },
  });
  useAppStore.getState().setScheduleReminderId(event.id, id);
  return id;
}

export async function cancelScheduleReminderAsync(eventId: string): Promise<void> {
  const existing = useAppStore.getState().notificationIdentifiers.scheduleReminders[eventId];
  if (existing === undefined) return;
  await Notifications.cancelScheduledNotificationAsync(existing);
  useAppStore.getState().setScheduleReminderId(eventId, null);
}

/* ── First-run setup ───────────────────────────────────────────────────── */

/**
 * Schedules the two daily reminders when their slots are still empty.
 * Called from the root layout; the caller swallows failures so a
 * notification hiccup can never block app startup.
 */
export async function ensureDefaultRemindersScheduledAsync(): Promise<void> {
  const identifiers = useAppStore.getState().notificationIdentifiers;
  if (identifiers.readinessCheckIn === undefined) await scheduleCheckInReminderAsync();
  if (identifiers.activityLog === undefined) await scheduleActivityLogReminderAsync();
}
