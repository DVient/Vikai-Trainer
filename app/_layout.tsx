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
    // first-run scheduling of the daily reminders (check-in, fuel-up,
    // activity log). Fully guarded: expo-notifications is partially
    // unsupported on web and a notification hiccup must never block startup.
    try {
      configureNotificationHandler();
      void ensureDefaultRemindersScheduledAsync().catch(() => undefined);
    } catch {
      // Notifications unsupported on this platform — continue without them.
    }
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#0F172A" },
          headerTintColor: "#F8FAFC",
          contentStyle: { backgroundColor: "#0F172A" },
        }}
      >
        <Stack.Screen name="index" options={{ title: "Vikai Trainer" }} />
        <Stack.Screen
          name="checkin"
          options={{ title: "3-Tap Check-In", presentation: "modal" }}
        />
        <Stack.Screen name="practice-log" options={{ title: "Practice Log" }} />
        <Stack.Screen name="workout" options={{ title: "Today's Game Plan" }} />
        <Stack.Screen name="history" options={{ title: "Calendar" }} />
        <Stack.Screen
          name="event-form"
          options={{ title: "Add Event", presentation: "modal" }}
        />
        <Stack.Screen name="about" options={{ title: "About Vikai Trainer" }} />
        <Stack.Screen name="plan" options={{ title: "My Plan" }} />
      </Stack>
    </>
  );
}
