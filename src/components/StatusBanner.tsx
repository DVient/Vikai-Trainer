import { Text, View } from "react-native";

import { ADULT_ATTENTION_MESSAGE, ENGINE_REASON_LABELS, ENGINE_STATUS_THEME } from "../lib/status";
import type { EngineReason, EngineStatus } from "../types";

interface StatusBannerProps {
  status: EngineStatus;
  reasons: readonly EngineReason[];
}

/**
 * Engine Status banner (SPEC §27): color-coded status card with reason chips.
 * Never renders GREEN semantics itself — the status comes from the engine,
 * which returns CHECKIN_REQUIRED when today's check-in is missing.
 */
export function StatusBanner({ status, reasons }: StatusBannerProps) {
  const theme = ENGINE_STATUS_THEME[status];

  return (
    <View className={`${theme.containerClass} rounded-2xl p-4`}>
      <Text className={`${theme.headingClass} text-2xl font-bold`}>{theme.label}</Text>
      <Text className={`${theme.headingClass} mt-1 text-sm opacity-70`}>{theme.description}</Text>
      <View className="mt-3 flex-row flex-wrap gap-2">
        {reasons.map((reason) => (
          <View key={reason} className={`${theme.chipClass} rounded-full px-3 py-1`}>
            <Text className={`${theme.chipTextClass} text-xs font-semibold`}>
              {ENGINE_REASON_LABELS[reason]}
            </Text>
          </View>
        ))}
      </View>
      {status === "RED" ? (
        <Text className={`${theme.headingClass} mt-3 text-xs opacity-70`}>
          {ADULT_ATTENTION_MESSAGE}
        </Text>
      ) : null}
    </View>
  );
}
