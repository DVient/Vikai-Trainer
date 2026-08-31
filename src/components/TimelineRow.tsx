import { Text, View } from "react-native";

import type { TimelineEntry } from "../lib/calendar";

/**
 * Timestamped timeline row (design iteration): one entry of a day's history —
 * used by the Calendar screen for both past activity and scheduled events.
 */
export function TimelineRow({ entry }: { entry: TimelineEntry }) {
  return (
    <View className="flex-row items-center gap-3 py-2">
      <Text className="w-[76px] text-xs font-semibold text-slate-400" numberOfLines={1}>
        {entry.time === "" ? "—" : entry.time}
      </Text>
      <Text className="text-base">{entry.emoji}</Text>
      <Text className="flex-1 text-sm text-slate-200">{entry.text}</Text>
    </View>
  );
}
