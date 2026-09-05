import { Text, View } from "react-native";

import type { PowerTone } from "../lib/power";

/**
 * Power gauge (design refresh): the Home Hub "battery" that mirrors the
 * engine's real volume multiplier, plus the Game Plan intensity banner.
 * Pure presentation — tone/percent come from src/lib/power.ts.
 */

const TONE_FILL: Record<PowerTone, string> = {
  green: "bg-accent",
  yellow: "bg-modulate",
  red: "bg-shield",
  neutral: "bg-edge",
};

const TONE_TEXT: Record<PowerTone, string> = {
  green: "text-go",
  yellow: "text-modulate",
  red: "text-shield",
  neutral: "text-faint",
};

interface PowerGaugeProps {
  percent: number | null;
  tone: PowerTone;
  label: string;
  sublabel?: string;
}

export function PowerGauge({ percent, tone, label, sublabel }: PowerGaugeProps) {
  const fill = TONE_FILL[tone];
  const text = TONE_TEXT[tone];

  return (
    <View className="rounded-2xl bg-card border border-edge p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-bold uppercase tracking-widest text-faint">
          Ready State
        </Text>
        {sublabel !== undefined ? (
          <Text className="text-xs font-semibold text-faint">{sublabel}</Text>
        ) : null}
      </View>

      <View className="mt-3 flex-row items-center gap-3">
        {/* Battery shell with terminal cap */}
        <View className="flex-1 flex-row items-center">
          <View className="h-14 flex-1 rounded-xl border-2 border-edge p-1">
            <View className="h-full overflow-hidden rounded-lg">
              <View
                className={`h-full rounded-lg ${fill}`}
                style={{ width: percent === null ? "0%" : `${Math.max(percent, 4)}%` }}
              />
            </View>
          </View>
          <View className="ml-1 rounded-r-md bg-edge" style={{ width: 8, height: 24 }} />
        </View>

        <View className="min-w-[84px] items-end">
          <Text className={`text-2xl font-black ${text}`}>
            {percent === null ? "?" : `${percent}%`}
          </Text>
          <Text className="text-xs font-semibold text-body">{label}</Text>
        </View>
      </View>
    </View>
  );
}
