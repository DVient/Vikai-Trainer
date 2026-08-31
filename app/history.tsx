import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { CalendarGrid } from "../src/components/CalendarGrid";
import { TimelineRow } from "../src/components/TimelineRow";
import { toLocalDateString } from "../src/engine/autoregulation";
import {
  dayTimeline,
  formatDateLong,
  monthMarks,
  monthMatrix,
} from "../src/lib/calendar";
import { useAppStore } from "../src/stores/useAppStore";

/**
 * Calendar (design iteration): past and future at a glance. The month grid
 * marks check-ins, logged activity, completed sessions, and scheduled
 * games/practices; selecting a day shows its timestamped timeline. Past
 * comes from local records; the future comes from scheduled events.
 */
export default function History() {
  const profile = useAppStore((state) => state.profile);
  const readinessInputs = useAppStore((state) => state.readinessInputs);
  const activityLogs = useAppStore((state) => state.activityLogs);
  const workoutLogs = useAppStore((state) => state.workoutLogs);
  const scheduledEvents = useAppStore((state) => state.scheduledEvents);

  const now = new Date();
  const today = toLocalDateString(now, profile.timezone);

  // Cursor starts on the current month (profile timezone), free browsing.
  const [cursor, setCursor] = useState(() => ({
    year: Number(today.slice(0, 4)),
    month: Number(today.slice(5, 7)),
  }));
  const [selected, setSelected] = useState(today);

  const sources = useMemo(
    () => ({
      readiness: readinessInputs,
      activities: activityLogs,
      workoutLogs,
      events: scheduledEvents,
    }),
    [readinessInputs, activityLogs, workoutLogs, scheduledEvents],
  );

  const weeks = useMemo(() => monthMatrix(cursor.year, cursor.month), [cursor]);
  const marks = useMemo(
    () => monthMarks(sources, weeks, profile.timezone),
    [sources, weeks, profile.timezone],
  );
  const timeline = useMemo(
    () => dayTimeline(sources, selected, profile.timezone),
    [sources, selected, profile.timezone],
  );

  const shiftMonth = (delta: number) => {
    setCursor((current) => {
      const next = new Date(Date.UTC(current.year, current.month - 1 + delta, 1));
      return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1 };
    });
  };

  return (
    <ScrollView className="flex-1 bg-slate-900" contentContainerClassName="gap-4 p-4">
      <CalendarGrid
        year={cursor.year}
        month={cursor.month}
        weeks={weeks}
        today={today}
        selected={selected}
        marks={marks}
        onSelect={setSelected}
        onPrevMonth={() => shiftMonth(-1)}
        onNextMonth={() => shiftMonth(1)}
      />

      <View className="rounded-2xl border border-slate-700 bg-slate-800 p-4">
        <Text className="text-xs font-bold uppercase tracking-widest text-slate-400">
          {formatDateLong(selected)}
          {selected === today ? " · Today" : ""}
        </Text>
        {timeline.length === 0 ? (
          <Text className="mt-2 text-sm text-slate-400">
            Nothing logged yet — your first session starts today.
          </Text>
        ) : (
          <View className="mt-2">
            {timeline.map((entry, index) => (
              <TimelineRow key={`${entry.sortKey}-${index}`} entry={entry} />
            ))}
          </View>
        )}
      </View>

      <View className="flex-row flex-wrap gap-2 pb-2">
        <LegendDot color="#22C55E" label="Checked in" />
        <LegendDot color="#0EA5E9" label="Activity" />
        <LegendDot color="#34D399" label="Session done" />
        <LegendDot color="#EF4444" label="Game" />
        <LegendDot color="#EAB308" label="Event" />
      </View>
    </ScrollView>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1.5">
      <View className="rounded-full" style={{ width: 8, height: 8, backgroundColor: color }} />
      <Text className="text-xs text-slate-300">{label}</Text>
    </View>
  );
}
