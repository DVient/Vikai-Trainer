import { Pressable, Text, View } from "react-native";

import { monthLabel, type DayMark } from "../lib/calendar";
import { tapLight } from "../lib/haptics";

/**
 * Activity calendar (design iteration): Sunday-start month grid with per-day
 * mark dots — green = checked in, sky = activity logged, emerald = session
 * completed, red = competition day (game / other-sport game / ID session),
 * amber = other scheduled event. Pure presentation: weeks/marks come from
 * src/lib/calendar.ts.
 */

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"] as const;

interface CalendarGridProps {
  year: number;
  month: number;
  /** Sunday-start week rows of date keys (or null padding). */
  weeks: ReadonlyArray<ReadonlyArray<string | null>>;
  today: string;
  selected: string;
  marks: Record<string, DayMark>;
  onSelect: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

export function CalendarGrid({
  year,
  month,
  weeks,
  today,
  selected,
  marks,
  onSelect,
  onPrevMonth,
  onNextMonth,
}: CalendarGridProps) {
  return (
    <View className="rounded-2xl border border-slate-700 bg-slate-800 p-4">
      <View className="flex-row items-center justify-between">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          onPress={() => {
            tapLight();
            onPrevMonth();
          }}
          className="h-12 w-12 items-center justify-center rounded-lg bg-slate-700"
        >
          <Text className="text-lg font-bold text-slate-200">‹</Text>
        </Pressable>
        <Text className="text-base font-bold text-slate-50">{monthLabel(year, month)}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          onPress={() => {
            tapLight();
            onNextMonth();
          }}
          className="h-12 w-12 items-center justify-center rounded-lg bg-slate-700"
        >
          <Text className="text-lg font-bold text-slate-200">›</Text>
        </Pressable>
      </View>

      <View className="mt-3 flex-row">
        {WEEKDAY_LABELS.map((label, index) => (
          <Text key={`${label}-${index}`} className="flex-1 text-center text-xs font-bold text-slate-500">
            {label}
          </Text>
        ))}
      </View>

      <View className="mt-1 gap-1">
        {weeks.map((week, weekIndex) => (
          <View key={weekIndex} className="flex-row gap-1">
            {week.map((cell, dayIndex) => {
              if (cell === null) {
                return <View key={`empty-${weekIndex}-${dayIndex}`} className="h-12 flex-1" />;
              }
              const dayMark = marks[cell];
              const isSelected = cell === selected;
              const isToday = cell === today;
              return (
                <Pressable
                  key={cell}
                  accessibilityRole="button"
                  accessibilityLabel={`Day ${cell}`}
                  onPress={() => {
                    tapLight();
                    onSelect(cell);
                  }}
                  className={`h-12 flex-1 items-center justify-center rounded-lg border ${
                    isSelected
                      ? "border-green-500 bg-green-500/20"
                      : isToday
                        ? "border-yellow-500/60 bg-slate-700/50"
                        : "border-transparent bg-slate-700/30"
                  }`}
                >
                  <Text className={`text-xs font-semibold ${isToday ? "text-yellow-300" : "text-slate-300"}`}>
                    {Number(cell.slice(8, 10))}
                  </Text>
                  <View className="flex-row gap-0.5">
                    {dayMark?.checkedIn ? <Dot color="#22C55E" /> : null}
                    {dayMark && dayMark.activityCount > 0 ? <Dot color="#0EA5E9" /> : null}
                    {dayMark?.workoutCompleted ? <Dot color="#34D399" /> : null}
                    {dayMark?.isCompetition ? <Dot color="#EF4444" /> : null}
                    {dayMark?.hasEvent && !dayMark.isCompetition ? (
                      <Dot color="#EAB308" />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

/** Decorative mark dot — intentionally below touch-target size (not tappable). */
function Dot({ color }: { color: string }) {
  return <View className="rounded-full" style={{ width: 6, height: 6, backgroundColor: color }} />;
}
