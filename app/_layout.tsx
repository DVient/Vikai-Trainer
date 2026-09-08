import "../global.css";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo } from "react";
import { View } from "react-native";
import { vars } from "nativewind";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  configureNotificationHandler,
  ensureDefaultRemindersScheduledAsync,
} from "../src/services/notifications";
import { HeaderBack } from "../src/components/HeaderBack";
import { themeRoles } from "../src/lib/theme";
import { useAppStore } from "../src/stores/useAppStore";

/**
 * Android 15+ draws apps edge-to-edge: scrolled content runs behind the
 * system navigation bar (the minimize/back/recents row). This spacer shrinks
 * every screen by exactly the bar's height so nothing hides beneath it, and
 * paints it in the app background so it reads as part of the screen. Top
 * insets need no help — the Stack header already sits below the status bar.
 */
function BottomSystemBarSpacer() {
  const insets = useSafeAreaInsets();
  if (insets.bottom <= 0) return null;
  return <View style={{ height: insets.bottom }} className="bg-app" />;
}

export default function RootLayout() {
  const teamColors = useAppStore((state) => state.teamColors);
  const roles = useMemo(
    () => themeRoles(teamColors.primary, teamColors.secondary),
    [teamColors],
  );

  useEffect(() => {
    // Default practice schedule (Tue/Wed/Thu 6 PM): seeded exactly once —
    // the persistence guard keeps athlete edits sticky afterwards.
    try {
      useAppStore.getState().seedDefaultSchedule();
    } catch {
      // A seeding hiccup must never block startup.
    }

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
    <View
      className="flex-1"
      style={
        vars({
          "--vk-app": roles.appBg,
          "--vk-card": roles.card,
          "--vk-edge": roles.edge,
          "--vk-edge-soft": roles.edgeSoft,
          "--vk-edge-mid": roles.edgeMid,
          "--vk-soft": roles.soft,
          "--vk-strong": roles.strong,
          "--vk-body": roles.body,
          "--vk-faint": roles.muted,
          "--vk-accent": roles.accent,
          "--vk-on-accent": roles.onAccent,
          "--vk-go": roles.status.go,
          "--vk-go-soft": roles.status.goSoft,
          "--vk-go-line": roles.status.goLine,
          "--vk-modulate": roles.status.modulate,
          "--vk-modulate-soft": roles.status.modulateSoft,
          "--vk-modulate-line": roles.status.modulateLine,
          "--vk-shield": roles.status.shield,
          "--vk-shield-soft": roles.status.shieldSoft,
          "--vk-shield-line": roles.status.shieldLine,
        }) as Record<string, string>
      }
    >
      <StatusBar style={roles.isDarkBackground ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: roles.accent },
          headerTintColor: roles.onAccent,
          contentStyle: { backgroundColor: roles.appBg },
        }}
      >
        <Stack.Screen name="index" options={{ title: "Vikai Trainer" }} />
        {/* Every sub-page carries a back control that works even with no
            history (fresh deep-load): it falls back to navigating Home. */}
        <Stack.Screen
          name="checkin"
          options={{
            title: "3-Tap Check-In",
            presentation: "modal",
            headerBackVisible: false,
            headerLeft: () => <HeaderBack />,
          }}
        />
        <Stack.Screen
          name="practice-log"
          options={{ title: "Practice Log", headerBackVisible: false, headerLeft: () => <HeaderBack /> }}
        />
        <Stack.Screen
          name="workout"
          options={{ title: "Today's Game Plan", headerBackVisible: false, headerLeft: () => <HeaderBack /> }}
        />
        <Stack.Screen
          name="history"
          options={{ title: "Calendar", headerBackVisible: false, headerLeft: () => <HeaderBack /> }}
        />
        <Stack.Screen
          name="event-form"
          options={{
            title: "Add Event",
            presentation: "modal",
            headerBackVisible: false,
            headerLeft: () => <HeaderBack />,
          }}
        />
        <Stack.Screen
          name="about"
          options={{ title: "About Vikai Trainer", headerBackVisible: false, headerLeft: () => <HeaderBack /> }}
        />
        <Stack.Screen
          name="plan"
          options={{ title: "My Plan", headerBackVisible: false, headerLeft: () => <HeaderBack /> }}
        />
        <Stack.Screen
          name="settings"
          options={{
            title: "Team Skin",
            presentation: "modal",
            headerBackVisible: false,
            headerLeft: () => <HeaderBack />,
          }}
        />
      </Stack>
      <BottomSystemBarSpacer />
    </View>
  );
}
