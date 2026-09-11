import { useRouter, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { DateGridSection, TimeChipSection } from "../src/components/EventDateTimePicker";
import { OptionCard } from "../src/components/OptionCard";
import { Toast } from "../src/components/Toast";
import { toLocalDateString } from "../src/engine/autoregulation";
import {
  monthMarks,
  monthMatrix,
  plannedWorkoutDatesFor,
} from "../src/lib/calendar";
import {
  isEventEditable,
  parseEventDateTime,
  prefillFromIso,
  splitTimeText,
} from "../src/lib/eventForm";
import { tapSuccess } from "../src/lib/haptics";
import { SCHEDULED_EVENT_LABELS } from "../src/lib/format";
import {
  MAX_RECURRENCE_WEEKS,
  WEEKDAY_LABELS_SHORT,
  expandRecurrence,
  normalizeWeekdays,
  parseWeeksInput,
  recurrenceSummary,
  weekdayOfIsoDate,
} from "../src/lib/recurrence";
import {
  cancelScheduleReminderAsync,
  syncScheduleReminderAsync,
} from "../src/services/notifications";
import { useAppStore } from "../src/stores/useAppStore";
import type { ScheduledEvent, ScheduledEventType } from "../src/types";

const EVENT_TYPES: ScheduledEventType[] = [
  "TEAM_PRACTICE",
  "GAME",
  "BASKETBALL_CAMP",
  "ID_SESSION",
  "OTHER_SPORTS_GAME",
  "STRENGTH_SESSION",
  "SKILL_SESSION",
  "SCHOOL",
  "OTHER",
];

const SAVED_TOAST = "Event saved offline · Syncs when back online ✅";

const WEEKDAY_NAMES: readonly string[] = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Add / edit a future commitment (athlete-managed calendar events). One-off
 * events save via scheduleEvent; a "Every week" series expands into concrete
 * events (Gmail-style: one submission → the whole season) via
 * scheduleEventSeries. Every saved event also gets its targeted lead-time
 * reminder; deletions cancel those reminders by tracked identifier only.
 */
export default function EventForm() {
  const router = useRouter();
  const params = useLocalSearchParams<{ eventId?: string }>();
  const scheduledEvents = useAppStore((state) => state.scheduledEvents);
  const profile = useAppStore((state) => state.profile);
  const activePlan = useAppStore((state) => state.activePlan);
  const readinessInputs = useAppStore((state) => state.readinessInputs);
  const activityLogs = useAppStore((state) => state.activityLogs);
  const workoutLogs = useAppStore((state) => state.workoutLogs);
  const scheduleEvent = useAppStore((state) => state.scheduleEvent);
  const scheduleEventSeries = useAppStore((state) => state.scheduleEventSeries);
  const updateScheduledEvent = useAppStore((state) => state.updateScheduledEvent);
  const removeScheduledEvent = useAppStore((state) => state.removeScheduledEvent);
  const removeEventSeries = useAppStore((state) => state.removeEventSeries);

  const existing = params.eventId
    ? scheduledEvents.find((event) => event.id === params.eventId)
    : undefined;

  const prefill = existing ? prefillFromIso(existing.startAt, profile.timezone) : undefined;
  const today = toLocalDateString(new Date(), profile.timezone);

  // Add-mode starts at today · 6:00 PM (the seeded default practice time)
  // so a save can succeed with zero typing; the grid and chips adjust it.
  const [eventType, setEventType] = useState<ScheduledEventType>(
    existing?.eventType ?? "TEAM_PRACTICE",
  );
  const [title, setTitle] = useState(existing?.title ?? "");
  const [dateText, setDateText] = useState(prefill?.dateText ?? today);
  const [hour, setHour] = useState(
    () => splitTimeText(prefill?.timeText ?? "")?.hours ?? 18,
  );
  const [minute, setMinute] = useState(
    () => splitTimeText(prefill?.timeText ?? "")?.minutes ?? 0,
  );
  // The pickers speak "HH:MM" internally — parseEventDateTime, the series
  // expansion, and the DST guard are untouched; only the input changed.
  const timeText = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]);
  const [weeksText, setWeeksText] = useState("6");
  const [error, setError] = useState("");
  // Must start null, not "": Toast hides on null only, and an empty-string
  // toast renders a permanent white pill over the Save button that swallows
  // its touches (the "dead save button" bug).
  const [toast, setToast] = useState<string | null>(null);

  const editable = !existing || isEventEditable(existing.startAt, new Date());

  // The date grid mirrors the Calendar screen: same matrix, same mark dots
  // (existing events, planned sessions) so double-booking is visible while
  // picking. Cursor opens on the selected date's month.
  const [cursor, setCursor] = useState(() => ({
    year: Number(dateText.slice(0, 4)),
    month: Number(dateText.slice(5, 7)),
  }));
  const weeks = useMemo(() => monthMatrix(cursor.year, cursor.month), [cursor]);
  const plannedWorkoutDates = useMemo(
    () => plannedWorkoutDatesFor(weeks, today, activePlan, workoutLogs),
    [weeks, today, activePlan, workoutLogs],
  );
  const sources = useMemo(
    () => ({
      readiness: readinessInputs,
      activities: activityLogs,
      workoutLogs,
      events: scheduledEvents,
    }),
    [readinessInputs, activityLogs, workoutLogs, scheduledEvents],
  );
  const marks = useMemo(
    () => monthMarks({ ...sources, plannedWorkoutDates }, weeks, profile.timezone),
    [sources, plannedWorkoutDates, weeks, profile.timezone],
  );
  const shiftMonth = (delta: number) => {
    setCursor((current) => {
      const next = new Date(Date.UTC(current.year, current.month - 1 + delta, 1));
      return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1 };
    });
  };

  const seriesSize =
    existing?.seriesId !== undefined
      ? scheduledEvents.filter((event) => event.seriesId === existing.seriesId).length
      : 0;

  const toggleWeekday = (weekday: number) => {
    setSelectedWeekdays((current) =>
      current.includes(weekday)
        ? current.filter((day) => day !== weekday)
        : [...current, weekday],
    );
    setError("");
  };

  const enableRepeat = (next: boolean) => {
    setRepeatEnabled(next);
    setError("");
    // Like Google Calendar: switching to repeat pre-checks the start date's
    // own weekday, so a Tuesday start opens with Tuesday selected.
    if (next && selectedWeekdays.length === 0 && DATE_PATTERN.test(dateText.trim())) {
      setSelectedWeekdays([weekdayOfIsoDate(dateText.trim())]);
    }
  };

  // Live series preview (repeat section only; pure string math, no side effects).
  let repeatHint = "";
  let seriesPreview = "";
  if (repeatEnabled) {
    if (selectedWeekdays.length === 0) {
      repeatHint = "Pick at least one day of the week";
    } else {
      const weeks = parseWeeksInput(weeksText);
      if (weeks === null) {
        repeatHint = `How many weeks? Use 1–${MAX_RECURRENCE_WEEKS}`;
      } else if (!DATE_PATTERN.test(dateText.trim())) {
        repeatHint = "Enter a start date to see the series";
      } else {
        seriesPreview = recurrenceSummary(expandRecurrence(dateText.trim(), selectedWeekdays, weeks));
      }
    }
  }

  const syncReminders = (records: ScheduledEvent[]) => {
    // Fire-and-forget: a notification hiccup must never block the save.
    for (const record of records) {
      void syncScheduleReminderAsync(record).catch(() => undefined);
    }
  };

  const save = () => {
    if (!editable) return;
    const trimmedDate = dateText.trim();
    const parsed = parseEventDateTime(trimmedDate, timeText, profile.timezone);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    if (toLocalDateString(new Date(parsed.iso), profile.timezone) < today) {
      setError("Pick today or a future date");
      return;
    }
    const titleText = title.trim() === "" ? undefined : title.trim();

    if (repeatEnabled) {
      const weeks = parseWeeksInput(weeksText);
      if (weeks === null) {
        setError(`How many weeks? Use 1–${MAX_RECURRENCE_WEEKS}`);
        return;
      }
      const weekdays = normalizeWeekdays(selectedWeekdays);
      if (weekdays.length === 0) {
        setError("Pick at least one day of the week");
        return;
      }
      const dates = expandRecurrence(trimmedDate, weekdays, weeks);
      const drafts: { eventType: ScheduledEventType; startAt: string; title?: string }[] = [];
      for (const date of dates) {
        const occurrence = parseEventDateTime(date, timeText, profile.timezone);
        if (!occurrence.ok) {
          setError(`That time does not exist on ${date} (clock change)`);
          return;
        }
        drafts.push({ eventType, startAt: occurrence.iso, title: titleText });
      }
      syncReminders(scheduleEventSeries(drafts));
    } else if (existing) {
      const updated: ScheduledEvent = {
        ...existing,
        eventType,
        startAt: parsed.iso,
        ...(titleText !== undefined ? { title: titleText } : {}),
        updatedAt: new Date().toISOString(),
      };
      updateScheduledEvent(existing.id, {
        eventType,
        startAt: parsed.iso,
        title: titleText,
      });
      // Rescheduled times must move the reminder too — drop the stale one
      // and re-arm at the new instant (update-safe, fire-and-forget).
      void syncScheduleReminderAsync(updated).catch(() => undefined);
    } else {
      const record = scheduleEvent({ eventType, startAt: parsed.iso, title: titleText });
      syncReminders([record]);
    }
    tapSuccess();
    setToast(SAVED_TOAST);
    setTimeout(() => router.replace("/history"), 900);
  };

  const remove = () => {
    if (!existing) return;
    void cancelScheduleReminderAsync(existing.id).catch(() => undefined);
    removeScheduledEvent(existing.id);
    tapSuccess();
    router.replace("/history");
  };

  const removeSeries = () => {
    if (existing?.seriesId === undefined) return;
    const removed = removeEventSeries(existing.seriesId);
    for (const event of removed) {
      void cancelScheduleReminderAsync(event.id).catch(() => undefined);
    }
    tapSuccess();
    router.replace("/history");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-app"
    >
      <ScrollView
        className="flex-1 bg-app"
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="w-full max-w-md self-center gap-4 p-4"
      >
      <Text className="text-sm text-faint">
        Games, practices, camps — anything that asks something of your legs.
      </Text>

      <View className="gap-2">
        {EVENT_TYPES.map((type) => (
          <OptionCard
            key={type}
            label={SCHEDULED_EVENT_LABELS[type]}
            selected={eventType === type}
            onSelect={() => setEventType(type)}
          />
        ))}
      </View>

      <DateGridSection
        dateText={dateText}
        today={today}
        year={cursor.year}
        month={cursor.month}
        weeks={weeks}
        marks={marks}
        editable={editable}
        onSelect={(date) => {
          setDateText(date);
          setError("");
        }}
        onPrevMonth={() => shiftMonth(-1)}
        onNextMonth={() => shiftMonth(1)}
      />

      <TimeChipSection
        hours={hour}
        minutes={minute}
        editable={editable}
        onHours={(nextHour) => {
          setHour(nextHour);
          setError("");
        }}
        onMinutes={(nextMinute) => {
          setMinute(nextMinute);
          setError("");
        }}
      />

      <View className="gap-1">
        <Text className="text-xs font-bold uppercase tracking-widest text-faint">
          Title (optional)
        </Text>
        <TextInput
          value={title}
          onChangeText={(text) => {
            setTitle(text);
            setError("");
          }}
          editable={editable}
          placeholder="Home opener"
          placeholderTextColor="#64748B"
          className="h-14 rounded-xl border border-edge bg-card px-4 text-base text-strong"
        />
      </View>

      {existing === undefined ? (
        <View className="gap-2">
          <Text className="text-xs font-bold uppercase tracking-widest text-faint">
            Repeats
          </Text>
          <View className="flex-row gap-2">
            <OptionCard
              label="Just once"
              selected={!repeatEnabled}
              onSelect={() => enableRepeat(false)}
              className="flex-1"
            />
            <OptionCard
              label="Every week"
              selected={repeatEnabled}
              onSelect={() => enableRepeat(true)}
              className="flex-1"
            />
          </View>

          {repeatEnabled ? (
            <View className="gap-3 rounded-2xl border border-edge bg-card p-4">
              <Text className="text-xs font-bold uppercase tracking-widest text-faint">
                Which days?
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {WEEKDAY_LABELS_SHORT.map((label, weekday) => {
                  const selected = selectedWeekdays.includes(weekday);
                  return (
                    <Pressable
                      key={weekday}
                      accessibilityRole="button"
                      accessibilityLabel={`Repeat on ${WEEKDAY_NAMES[weekday]}`}
                      accessibilityState={{ selected }}
                      onPress={() => toggleWeekday(weekday)}
                      className={`min-h-[48px] min-w-[56px] flex-1 items-center justify-center rounded-xl border-2 py-2 ${
                        selected
                          ? "border-accent bg-soft"
                          : "border-edge bg-app"
                      }`}
                    >
                      <Text
                        className={`text-sm font-bold ${selected ? "text-go" : "text-body"}`}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View className="gap-1">
                <Text className="text-xs font-bold uppercase tracking-widest text-faint">
                  For how many weeks?
                </Text>
                <TextInput
                  value={weeksText}
                  onChangeText={(text) => {
                    setWeeksText(text);
                    setError("");
                  }}
                  editable={editable}
                  keyboardType="number-pad"
                  placeholder="6"
                  placeholderTextColor="#64748B"
                  className="h-14 rounded-xl border border-edge bg-card px-4 text-base text-strong"
                />
              </View>

              {seriesPreview !== "" ? (
                <Text className="text-sm font-bold text-go">
                  Creates {seriesPreview} — all at the same time.
                </Text>
              ) : null}
              {repeatHint !== "" ? (
                <Text className="text-xs text-faint">{repeatHint}</Text>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      {seriesSize > 1 ? (
        <Text className="text-xs font-semibold text-faint">
          Part of a weekly series ({seriesSize} events total) — edits change only this one.
        </Text>
      ) : null}

      {error !== "" ? (
        <Text className="text-sm font-semibold text-shield">{error}</Text>
      ) : null}

      {editable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save event"
          onPress={save}
          className="h-14 items-center justify-center rounded-xl bg-accent"
        >
          <Text className="text-base font-black text-onaccent">
            {existing ? "Save changes" : "Add to calendar"}
          </Text>
        </Pressable>
      ) : (
        <Text className="text-sm text-faint">
          This event already happened — history stays as it was.
        </Text>
      )}

      {existing ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete event"
          onPress={remove}
          className="h-14 items-center justify-center rounded-xl border-2 border-shield-line"
        >
          <Text className="text-base font-bold text-shield">Remove from calendar</Text>
        </Pressable>
      ) : null}

      {seriesSize > 1 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete series"
          onPress={removeSeries}
          className="h-14 items-center justify-center rounded-xl border-2 border-shield-line"
        >
          <Text className="text-base font-bold text-shield">
            Remove whole series ({seriesSize})
          </Text>
        </Pressable>
      ) : null}

      <Toast message={toast} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
