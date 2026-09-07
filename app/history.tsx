import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { CalendarGrid } from "../src/components/CalendarGrid";
import { TimelineRow } from "../src/components/TimelineRow";
import { toLocalDateString } from "../src/engine/autoregulation";
import {
  dayTimeline,
  formatDateLong,
  monthMarks,
  monthMatrix,
  weekSchedule,
  type PlannedWorkoutEntry,
  type WeekScheduleDay,
} from "../src/lib/calendar";
import { tapLight } from "../src/lib/haptics";
import { defaultPlanFocusLabel } from "../src/plans/basePlan";
import { planPhaseLabel, planStatus, weekIndexOf } from "../src/plans/planBuilder";
import { personaById } from "../src/plans/personas";
import { useAppStore } from "../src/stores/useAppStore";

/**
 * Calendar (design iteration): past and future at a glance. The month grid
 * marks check-ins, logged activity, completed sessions, scheduled
 * games/practices, and planned workout days. Below it: a Today card with
 * today's full contents, then the Scheduled card — the next 7 days by
 * default, or the chosen day's contents when a day on the grid is selected
 * (with a way back). Event rows open the editor; athletes add their own
 * commitments with the ＋ button.
 */
export default function History() {
  const router = useRouter();
  const profile = useAppStore((state) => state.profile);
  const readinessInputs = useAppStore((state) => state.readinessInputs);
  const activityLogs = useAppStore((state) => state.activityLogs);
  const workoutLogs = useAppStore((state) => state.workoutLogs);
  const scheduledEvents = useAppStore((state) => state.scheduledEvents);
  const activePlan = useAppStore((state) => state.activePlan);

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

  // Planned sessions: today/future days the plan (default or built) still
  // covers and that have no completed session yet.
  const plannedWorkoutDates = useMemo(() => {
    const logged = new Set(workoutLogs.map((entry) => entry.activityDate));
    const dates: string[] = [];
    for (const week of weeks) {
      for (const cell of week) {
        if (cell === null || cell < today || logged.has(cell)) continue;
        if (activePlan && planStatus(activePlan, cell) === "ended") continue;
        dates.push(cell);
      }
    }
    return dates;
  }, [weeks, today, activePlan, workoutLogs]);

  const marks = useMemo(
    () => monthMarks({ ...sources, plannedWorkoutDates }, weeks, profile.timezone),
    [sources, plannedWorkoutDates, weeks, profile.timezone],
  );

  const plannedEntryFor = (date: string): PlannedWorkoutEntry | undefined => {
    if (date < today) return undefined;
    if (workoutLogs.some((entry) => entry.activityDate === date)) return undefined;
    if (activePlan) {
      if (planStatus(activePlan, date) === "ended") return undefined;
      const persona =
        activePlan.personaId !== undefined ? personaById(activePlan.personaId) : undefined;
      const personaLabel = persona?.label ?? "Your plan";
      const detail = `${personaLabel} · ${planPhaseLabel(activePlan, date)} · Week ${weekIndexOf(activePlan, date) + 1}`;
      return { label: personaLabel, detail };
    }
    return { label: defaultPlanFocusLabel(date), detail: "Base template" };
  };

  const todayTimeline = useMemo(
    () => dayTimeline(sources, today, profile.timezone, plannedEntryFor(today)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sources, today, profile.timezone, activePlan, workoutLogs],
  );

  const choosingOtherDay = selected !== today;
  const selectedTimeline = useMemo(
    () =>
      choosingOtherDay
        ? dayTimeline(sources, selected, profile.timezone, plannedEntryFor(selected))
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [choosingOtherDay, sources, selected, profile.timezone, activePlan, workoutLogs],
  );

  const week = useMemo(
    () =>
      weekSchedule(scheduledEvents, now, profile.timezone, {
        plannedLabelFor: (date) => plannedEntryFor(date)?.label,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scheduledEvents, profile.timezone, today, activePlan, workoutLogs],
  );

  const weekHasContent = week.some(
    (day) => day.events.length > 0 || day.planned !== undefined,
  );

  const shiftMonth = (delta: number) => {
    setCursor((current) => {
      const next = new Date(Date.UTC(current.year, current.month - 1 + delta, 1));
      return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1 };
    });
  };

  const renderTimelineRows = (entries: ReturnType<typeof dayTimeline>) => (
    <View className="mt-2">
      {entries.map((entry, index) => (
        <TimelineRow
          key={`${entry.sortKey}-${index}`}
          entry={entry}
          onPressEvent={(eventId) => router.navigate(`/event-form?eventId=${eventId}`)}
        />
      ))}
    </View>
  );

  const renderWeekDay = (day: WeekScheduleDay, index: number) => (
    <View
      key={day.date}
      className={`mt-2 border-t border-edge pt-2 ${index === 0 ? "mt-0 border-t-0 pt-0" : ""}`}
    >
      <Text className="text-sm font-black text-strong">{day.label}</Text>
      {day.planned !== undefined ? (
        <View className="mt-1 flex-row items-center gap-2">
          <Text className="text-sm">{day.planned.emoji}</Text>
          <Text className="flex-1 text-xs text-body">Planned: {day.planned.label}</Text>
        </View>
      ) : null}
      {day.events.length === 0 && day.planned === undefined ? (
        <Text className="mt-1 text-xs text-faint">Nothing scheduled</Text>
      ) : null}
      {day.events.map((event) => (
        <Pressable
          key={event.id}
          accessibilityRole="button"
          accessibilityLabel={`Edit event: ${event.text}`}
          onPress={() => {
            tapLight();
            router.navigate(`/event-form?eventId=${event.id}`);
          }}
          className="min-h-[48px] flex-row items-center gap-3 py-1"
        >
          <Text className="w-[76px] text-xs font-semibold text-faint" numberOfLines={1}>
            {event.time}
          </Text>
          <Text className="text-base">📅</Text>
          <Text className="flex-1 text-sm text-body">{event.text}</Text>
          {event.seriesCount !== undefined && event.seriesCount > 1 ? (
            <Text className="text-sm" accessibilityLabel={`Recurring, ${event.seriesCount} events`}>
              🔁
            </Text>
          ) : null}
          <Text className="text-sm text-faint">›</Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <ScrollView
      className="flex-1 bg-app"
      contentContainerClassName="w-full max-w-md self-center gap-4 p-4"
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-bold uppercase tracking-widest text-faint">
          Add your commitments — they shape the plan
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add event"
          onPress={() => {
            tapLight();
            router.navigate("/event-form");
          }}
          className="h-12 min-w-[48px] items-center justify-center rounded-lg bg-accent px-4"
        >
          <Text className="text-base font-black text-onaccent">＋ Add</Text>
        </Pressable>
      </View>

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

      <View className="rounded-2xl border border-edge bg-card p-4">
        <Text className="text-xs font-bold uppercase tracking-widest text-faint">
          Today · {formatDateLong(today)}
        </Text>
        {todayTimeline.length === 0 ? (
          <Text className="mt-2 text-sm text-faint">
            Nothing logged yet — your first session starts today.
          </Text>
        ) : (
          renderTimelineRows(todayTimeline)
        )}
      </View>

      <View className="rounded-2xl border border-edge bg-card p-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-bold uppercase tracking-widest text-faint">
            Scheduled — tap to change time or day
          </Text>
          {choosingOtherDay ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Show next 7 days"
              onPress={() => {
                tapLight();
                setSelected(today);
              }}
              className="h-12 min-w-[48px] items-center justify-center rounded-lg border-2 border-edge px-3"
            >
              <Text className="text-xs font-black text-body">Next 7 days</Text>
            </Pressable>
          ) : null}
        </View>

        {choosingOtherDay ? (
          <>
            <Text className="mt-1 text-sm font-black text-strong">
              {formatDateLong(selected)}
            </Text>
            {selectedTimeline.length === 0 ? (
              <Text className="mt-2 text-sm text-faint">
                Nothing scheduled or logged for this day.
              </Text>
            ) : (
              renderTimelineRows(selectedTimeline)
            )}
            {selected < today ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Update the day ${formatDateLong(selected)}`}
                onPress={() => {
                  tapLight();
                  router.navigate(`/practice-log?date=${selected}`);
                }}
                className="mt-3 h-12 items-center justify-center rounded-xl border-2 border-accent bg-soft"
              >
                <Text className="text-sm font-black text-go">
                  ＋ Update this day — it shapes today's plan
                </Text>
              </Pressable>
            ) : null}
          </>
        ) : weekHasContent ? (
          <View className="mt-1">{week.map((day, index) => renderWeekDay(day, index))}</View>
        ) : (
          <Text className="mt-2 text-sm text-faint">
            Nothing scheduled this week — tap ＋ Add to plan your season.
          </Text>
        )}
      </View>

      <View className="flex-row flex-wrap gap-2 pb-2">
        <LegendDot color="#22C55E" label="Checked in" />
        <LegendDot color="#0EA5E9" label="Activity" />
        <LegendDot color="#34D399" label="Session done" />
        <LegendDot color="#A78BFA" label="Planned workout" />
        <LegendDot color="#EF4444" label="Game" />
        <LegendDot color="#EAB308" label="Event" />
      </View>
    </ScrollView>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5 rounded-full bg-card px-3 py-1.5">
      <View className="rounded-full" style={{ width: 8, height: 8, backgroundColor: color }} />
      <Text className="text-xs text-body">{label}</Text>
    </View>
  );
}
