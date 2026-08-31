/**
 * VIKAI — Local notifications pipeline (Phase 5.1, SPEC §35)
 *
 * expo-notifications based, fully local (no push tokens, no servers — SPEC
 * §34). Implements the §35 notification types plus the brand-spec smart
 * nudges:
 *
 *   READINESS_CHECKIN  → daily morning check-in reminder      (store slot:
 *                         readinessCheckIn)
 *   ACTIVITY_LOG       → 8:30 PM "Log Today's Sweat" reminder (activityLog)
 *   FUEL_REMINDER      → 3:30 PM "Fuel Up" bus-ride nudge     (fuelReminder)
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
/** Brand-spec smart nudge: 8:30 PM "Log Today's Sweat". */
export const DEFAULT_ACTIVITY_LOG_REMINDER_TIME: ReminderTime = { hour: 20, minute: 30 };
/** Brand-spec smart nudge: 3:30 PM "Fuel Up" bus-ride snack. */
export const DEFAULT_FUEL_REMINDER_TIME: ReminderTime = { hour: 15, minute: 30 };
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

/** Pure permission state → Home chip wording (youth copy, no jargon). */
export type ReminderPermissionState = "granted" | "denied" | "undetermined";

export function reminderBannerStatus(
  granted: boolean | undefined,
  canAskAgain: boolean | undefined,
): ReminderPermissionState {
  if (granted === true) return "granted";
  if (granted === false && canAskAgain === false) return "denied";
  return "undetermined";
}

export function reminderChipCopy(state: ReminderPermissionState): { label: string; tone: "on" | "off" } {
  switch (state) {
    case "granted":
      return { label: "🔔 Reminders on — Fuel Up 3:30 PM", tone: "on" };
    case "denied":
      return { label: "🔔 Reminders off — enable in Settings", tone: "off" };
    default:
      return { label: "🔔 Turn on reminders", tone: "off" };
  }
}

async function ensureAndroidChannelAsync(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: "Vikai Trainer reminders",
    // HIGH = heads-up banner + vibration for time-sensitive nudges
    // (Fuel Up at 3:30 PM, pre-game reminders) — not a silent tray entry.
    importance: Notifications.AndroidImportance.HIGH,
    enableVibrate: true,
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
      title: "Vikai Trainer daily check-in",
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
      title: "Log Today's Sweat 🏀",
      body: "Quick 10-sec check-in — practices, games, or sessions.",
    },
    time,
  );
}

export async function scheduleFuelReminderAsync(
  time: ReminderTime = DEFAULT_FUEL_REMINDER_TIME,
): Promise<string | null> {
  return scheduleDailyReminderAsync(
    "fuelReminder",
    {
      title: "Fuel Up 🍎",
      body: "Grab a bus ride snack before practice.",
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
      title: "Vikai Trainer schedule reminder",
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
 * Schedules the daily reminders (check-in, fuel-up, activity log) when their
 * slots are still empty. Called from the root layout; the caller swallows
 * failures so a notification hiccup can never block app startup.
 */
export async function ensureDefaultRemindersScheduledAsync(): Promise<void> {
  const identifiers = useAppStore.getState().notificationIdentifiers;
  if (identifiers.readinessCheckIn === undefined) await scheduleCheckInReminderAsync();
  if (identifiers.fuelReminder === undefined) await scheduleFuelReminderAsync();
  if (identifiers.activityLog === undefined) await scheduleActivityLogReminderAsync();
}
