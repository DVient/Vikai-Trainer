import { Pressable, Text, View } from "react-native";

import { CalendarGrid } from "./CalendarGrid";
import type { DayMark } from "../lib/calendar";
import { formatWallClock } from "../lib/eventForm";
import { tapLight } from "../lib/haptics";
import { weekdayOfIsoDate } from "../lib/recurrence";

/**
 * The event form's date & time pickers (Phase 9.16). The form used to ask
 * for raw text — a date like "2026-01-15" and a time like "18:00" — which
 * fought the athlete on every save. Both sections now speak the app's own
 * language, with zero keyboard friction:
 *
 * - DateGridSection embeds the same month grid the Calendar screen uses
 *   (including the mark dots, so an existing game or a planned session is
 *   visible while picking). Tapping a day selects it.
 * - TimeChipSection is chip rows — hours 6 AM–10 PM, minutes in 15-minute
 *   steps — mirroring the repeat section's weekday chips.
 *
 * Pure presentation: state lives in the event form; these only render and
 * report taps. The summary lines always show the current selection, so an
 * event whose stored time falls outside the chip range still reads right.
 */

const WEEKDAY_NAMES: readonly string[] = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** Chip coverage: hours 6 AM–10 PM, minutes in 15-minute steps. */
export const PICKER_HOURS: readonly number[] = [
  6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22,
];
const PICKER_MINUTES: readonly number[] = [0, 15, 30, 45];

/** Chip label for an hour: 6 → "6 AM", 12 → "12 PM", 18 → "6 PM". */
export function hourChipLabel(hour: number): string {
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12} ${hour < 12 ? "AM" : "PM"}`;
}

export function DateGridSection({
  dateText,
  today,
  year,
  month,
  weeks,
  marks,
  editable,
  onSelect,
  onPrevMonth,
  onNextMonth,
}: {
  dateText: string;
  today: string;
  year: number;
  month: number;
  weeks: ReadonlyArray<ReadonlyArray<string | null>>;
  marks: Record<string, DayMark>;
  editable: boolean;
  onSelect: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) {
  const weekday =
    dateText !== "" ? (WEEKDAY_NAMES[weekdayOfIsoDate(dateText)] ?? undefined) : undefined;
  return (
    <View className="gap-1">
      <Text className="text-xs font-bold uppercase tracking-widest text-faint">Date</Text>
      <Text className="text-sm font-bold text-strong">
        {weekday !== undefined ? `${weekday} · ${dateText}` : "Pick a date below"}
      </Text>
      {editable ? (
        <CalendarGrid
          year={year}
          month={month}
          weeks={weeks}
          today={today}
          selected={dateText}
          marks={marks}
          onSelect={onSelect}
          onPrevMonth={onPrevMonth}
          onNextMonth={onNextMonth}
        />
      ) : null}
    </View>
  );
}

export function TimeChipSection({
  hours,
  minutes,
  editable,
  onHours,
  onMinutes,
}: {
  hours: number;
  minutes: number;
  editable: boolean;
  onHours: (hour: number) => void;
  onMinutes: (minute: number) => void;
}) {
  return (
    <View className="gap-1">
      <Text className="text-xs font-bold uppercase tracking-widest text-faint">
        Start time
      </Text>
      <Text className="text-sm font-bold text-strong">
        Starts at {formatWallClock(hours, minutes)}
      </Text>
      {editable ? (
        <>
          <View className="flex-row flex-wrap gap-2">
            {PICKER_HOURS.map((hour) => {
              const selected = hours === hour;
              return (
                <Pressable
                  key={hour}
                  accessibilityRole="button"
                  accessibilityLabel={`Start hour ${hourChipLabel(hour)}`}
                  accessibilityState={{ selected }}
                  onPress={() => {
                    tapLight();
                    onHours(hour);
                  }}
                  className={`min-h-[48px] min-w-[56px] flex-1 items-center justify-center rounded-xl border-2 py-2 ${
                    selected ? "border-accent bg-soft" : "border-edge bg-app"
                  }`}
                >
                  <Text
                    className={`text-sm font-bold ${selected ? "text-go" : "text-body"}`}
                  >
                    {hourChipLabel(hour)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View className="flex-row flex-wrap gap-2">
            {PICKER_MINUTES.map((minute) => {
              const selected = minutes === minute;
              return (
                <Pressable
                  key={minute}
                  accessibilityRole="button"
                  accessibilityLabel={`Start minute :${String(minute).padStart(2, "0")}`}
                  accessibilityState={{ selected }}
                  onPress={() => {
                    tapLight();
                    onMinutes(minute);
                  }}
                  className={`min-h-[48px] min-w-[56px] flex-1 items-center justify-center rounded-xl border-2 py-2 ${
                    selected ? "border-accent bg-soft" : "border-edge bg-app"
                  }`}
                >
                  <Text
                    className={`text-sm font-bold ${selected ? "text-go" : "text-body"}`}
                  >
                    :{String(minute).padStart(2, "0")}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}
    </View>
  );
}