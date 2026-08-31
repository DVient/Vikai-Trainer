import { Linking, Platform, Pressable, Text } from "react-native";
import { useEffect, useState } from "react";

import {
  reminderChipCopy,
  reminderBannerStatus,
} from "../services/notifications";
import * as Notifications from "expo-notifications";

/**
 * Reminder status chip (Home, native only): shows whether the phone will
 * actually deliver the Fuel Up / check-in / activity nudges. Tapping
 * re-requests permission; if the OS won't ask again it deep-links to the
 * app's settings page. Hidden on web — the laptop preview has no local
 * notification scheduler.
 */
export function ReminderStatusChip() {
  const [state, setState] = useState<{ granted?: boolean; canAskAgain?: boolean }>({});
  const visible = Platform.OS !== "web";

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void Notifications.getPermissionsAsync()
      .then((permissions) => {
        if (!cancelled) {
          setState({ granted: permissions.granted, canAskAgain: permissions.canAskAgain });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [visible]);

  if (!visible) return null;

  const banner = reminderBannerStatus(state.granted, state.canAskAgain);
  const copy = reminderChipCopy(banner);

  const onPress = () => {
    if (banner === "granted") return;
    void Notifications.requestPermissionsAsync()
      .then((permissions) => {
        setState({ granted: permissions.granted, canAskAgain: permissions.canAskAgain });
        if (!permissions.granted && permissions.canAskAgain === false) {
          void Linking.openSettings();
        }
      })
      .catch(() => undefined);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Reminder settings"
      onPress={onPress}
      className={`min-h-[48px] flex-row items-center justify-center rounded-xl border-2 px-3 py-2.5 ${
        copy.tone === "on"
          ? "border-green-500/40 bg-green-500/10"
          : "border-yellow-500/60 bg-yellow-500/10"
      }`}
    >
      <Text
        className={`text-sm font-bold ${copy.tone === "on" ? "text-green-300" : "text-yellow-300"}`}
      >
        {copy.label}
      </Text>
    </Pressable>
  );
}
