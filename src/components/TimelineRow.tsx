import { Pressable, Text, View } from "react-native";

import { tapLight } from "../lib/haptics";
import type { TimelineEntry } from "../lib/calendar";

/**
 * Timestamped timeline row (design iteration): one entry of a day's history —
 * used by the Calendar screen for both past activity and scheduled events.
 * Future event rows are tappable and open the event editor.
 */
export function TimelineRow({
  entry,
  onPressEvent,
}: {
  entry: TimelineEntry;
  onPressEvent?: (eventId: string) => void;
}) {
  const body = (
    <View className="flex-row items-center gap-3 py-2">
      <Text className="w-[76px] text-xs font-semibold text-slate-400" numberOfLines={1}>
        {entry.time === "" ? "—" : entry.time}
      </Text>
      <Text className="text-base">{entry.emoji}</Text>
      <Text className="flex-1 text-sm text-slate-200">{entry.text}</Text>
      {entry.eventId !== undefined ? <Text className="text-sm text-slate-500">›</Text> : null}
    </View>
  );

  const eventId = entry.eventId;
  if (eventId === undefined || onPressEvent === undefined) return body;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Edit event: ${entry.text}`}
      onPress={() => {
        tapLight();
        onPressEvent(eventId);
      }}
      className="min-h-[48px]"
    >
      {body}
    </Pressable>
  );
}
