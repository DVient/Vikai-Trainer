import "../global.css";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import {
  configureNotificationHandler,
  ensureDefaultRemindersScheduledAsync,
} from "../src/services/notifications";

export default function RootLayout() {
  useEffect(() => {
    // Notification pipeline setup (Phase 5): presentation behavior plus
    // first-run scheduling of the daily check-in / activity-log reminders.
    // Fully guarded: expo-notifications is partially unsupported on web and
    // a notification hiccup must never block app startup on any platform.
    try {
      configureNotificationHandler();
      void ensureDefaultRemindersScheduledAsync().catch(() => undefined);
    } catch {
      // Notifications unsupported on this platform — continue without them.
    }
  }, []);

  return (
    <>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="index" options={{ title: "Vikai" }} />
        <Stack.Screen name="checkin" options={{ title: "Daily check-in" }} />
        <Stack.Screen name="activity-log" options={{ title: "Log activity" }} />
        <Stack.Screen name="workout" options={{ title: "Today's workout" }} />
      </Stack>
    </>
  );
}
