/**
 * VIKAI — Tactile feedback (design refresh: "bus-proof" input confirmation).
 *
 * Thin wrappers over expo-haptics so screens confirm every tap physically —
 * the athlete should feel selection without looking at the screen on a bumpy
 * ride. Fully guarded: web and platforms without haptics support no-op.
 */

import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

function available(): boolean {
  return Platform.OS === "ios" || Platform.OS === "android";
}

/** Light tick for option/card selection. */
export function tapLight(): void {
  if (!available()) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

/** Heavy confirm when a whole form is committed (check-in saved, etc.). */
export function tapHeavy(): void {
  if (!available()) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
}

/** Success pattern for completed flows (save succeeded). */
export function tapSuccess(): void {
  if (!available()) return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}
