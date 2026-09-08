import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { BodyMap } from "../src/components/BodyMap";
import { OptionCard } from "../src/components/OptionCard";
import { Toast } from "../src/components/Toast";
import { partitionActivities } from "../src/lib/activityTiming";
import { toLocalDateString } from "../src/engine/autoregulation";
import { tapHeavy, tapLight, tapSuccess } from "../src/lib/haptics";
import { formatDateLong } from "../src/lib/calendar";
import {
  ACTIVITY_TYPE_LABELS,
  rpeBand,
  validateActivityDraft,
} from "../src/lib/format";
import { activePlanForDay, blockVariant } from "../src/plans/planBuilder";
import { BASE_PLAN_TITLES, defaultPlanForDate } from "../src/plans/basePlan";
import { libraryBlockById } from "../src/plans/library";
import { useAppStore } from "../src/stores/useAppStore";
import type { ActivityType, SoreArea } from "../src/types";

/**
 * Practice Log (design refresh): visual 1–10 effort slider (Chilling → All
 * Out), big quick-sport toggle chips, duration chips, and the day's logged
 * activities. Built for several entries a day (morning practice + afternoon
 * skill work): saving keeps the screen open with a fresh form; a Done button
 * returns home. Entries carry a before/after-session badge once the day's
 * workout is done — post-workout logs shape the NEXT workout. Session load
 * (RPE × minutes) shown as an internal workload number — never a medical
 * indicator (SPEC §10).
 *
 * Phase 9.12 — the screen doubles as the missed-day editor: `?date=` puts it
 * in backfill mode for a PAST day, where forgotten activities, the
 * post-session body map, and the day's block check-offs can all be recorded.
 * Those inputs flow into the same store slices the engine already reads, so
 * today's Game Plan prices them immediately.
 */

const ACTIVITY_TYPES = Object.keys(ACTIVITY_TYPE_LABELS) as ActivityType[];
const DURATION_CHIPS = [30, 45, 60, 90, 120] as const;
const SAVED_TOAST = "Logged ✓ — add another or head back";
/** Two rows of five: one row of ten 48px targets doesn't fit a phone. */
const EFFORT_ROWS: ReadonlyArray<ReadonlyArray<number>> = [
  [1, 2, 3, 4, 5],
  [6, 7, 8, 9, 10],
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export default function PracticeLog() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const logActivity = useAppStore((state) => state.logActivity);
  const updateActivityLog = useAppStore((state) => state.updateActivityLog);
  const removeActivityLog = useAppStore((state) => state.removeActivityLog);
  const updateWorkoutLog = useAppStore((state) => state.updateWorkoutLog);
  const toggleComponentDone = useAppStore((state) => state.toggleComponentDone);
  const activityLogs = useAppStore((state) => state.activityLogs);
  const workoutLogs = useAppStore((state) => state.workoutLogs);
  const workoutProgress = useAppStore((state) => state.workoutProgress);
  const activePlan = useAppStore((state) => state.activePlan);
  const profile = useAppStore((state) => state.profile);

  const [activityType, setActivityType] = useState<ActivityType>("TEAM_PRACTICE");
  const [sessionRpe, setSessionRpe] = useState(5);
  const [durationText, setDurationText] = useState("60");
  const [notes, setNotes] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const now = new Date();
  const today = toLocalDateString(now, profile.timezone);

  // Phase 9.12 — backfill mode: a valid PAST date upgrades this screen into
  // the missed-day editor. Anything else (no param, malformed, today, future)
  // falls back to the normal today flow.
  const requested = typeof params.date === "string" ? params.date : undefined;
  const isBackfill =
    requested !== undefined && ISO_DATE.test(requested) && requested < today;
  const targetDate = isBackfill ? (requested as string) : today;

  const dayWorkout = workoutLogs.find((entry) => entry.activityDate === targetDate);
  const dayProgress = workoutProgress[targetDate] ?? {};
  const dayBlocks = (
    activePlan ? activePlanForDay(activePlan, targetDate) : defaultPlanForDate(targetDate)
  ).filter((component) => !component.optional);

  const { pre, post } = partitionActivities(activityLogs, workoutLogs, targetDate);
  const orderedEntries = [...pre, ...post].filter(
    (entry) => entry.activityDate === targetDate,
  );
  const workoutDone = dayWorkout !== undefined;
  const band = rpeBand(sessionRpe);

  const blockTitle = (componentId: string): string =>
    BASE_PLAN_TITLES[componentId] ?? libraryBlockById(componentId)?.title ?? componentId;

  const startEdit = (entryId: string) => {
    const entry = activityLogs.find((candidate) => candidate.id === entryId);
    if (entry === undefined) return;
    tapLight();
    setEditingId(entry.id);
    setActivityType(entry.activityType);
    setSessionRpe(entry.sessionRpe ?? 5);
    setDurationText(String(entry.durationMinutes ?? 60));
    setNotes(entry.notes ?? "");
    setError(null);
  };

  const cancelEdit = () => {
    tapLight();
    setEditingId(null);
    setActivityType("TEAM_PRACTICE");
    setSessionRpe(5);
    setDurationText("60");
    setNotes("");
    setError(null);
  };

  const onSave = () => {
    const durationMinutes = Number.parseInt(durationText, 10);
    const validationError = validateActivityDraft(sessionRpe, durationMinutes);
    if (validationError !== null) {
      setError(validationError);
      return;
    }

    const draft = {
      activityType,
      sessionRpe,
      durationMinutes,
      notes: notes.trim() === "" ? undefined : notes.trim(),
    };
    if (editingId !== null) {
      updateActivityLog(editingId, draft);
    } else {
      logActivity({
        activityDate: targetDate,
        timezone: profile.timezone,
        ...draft,
      });
    }

    // Multi-entry friendly: reset the form, keep the screen open.
    setEditingId(null);
    setActivityType("TEAM_PRACTICE");
    setSessionRpe(5);
    setDurationText("60");
    setNotes("");
    setError(null);
    tapSuccess();
    setToast(SAVED_TOAST);
  };

  const logListLabel =
    isBackfill
      ? orderedEntries.length === 1
        ? `Log for ${formatDateLong(targetDate)} (1 entry)`
        : `Log for ${formatDateLong(targetDate)} (${orderedEntries.length} entries)`
      : orderedEntries.length === 1
        ? "Today's log (1 entry)"
        : `Today's log (${orderedEntries.length} entries)`;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-app"
    >
      <ScrollView
        className="flex-1 bg-app"
        contentContainerClassName="w-full max-w-md self-center gap-5 p-4"
      >
      {isBackfill ? (
        <View className="rounded-2xl border-2 border-modulate-line bg-modulate-soft p-3">
          <Text className="text-sm font-black text-strong">
            Updating {formatDateLong(targetDate)}
          </Text>
          <Text className="mt-1 text-xs text-body">
            Forgot to log this day? Everything you add here — activities, the
            post-session body map, and what you actually finished — is priced
            into today's Game Plan.
          </Text>
        </View>
      ) : null}

      <View className="gap-2">
        <Text className="text-sm font-bold text-strong">What did you do?</Text>
        <View className="flex-row flex-wrap gap-2">
          {ACTIVITY_TYPES.map((type) => (
            <OptionCard
              key={type}
              label={ACTIVITY_TYPE_LABELS[type]}
              selected={activityType === type}
              onSelect={() => setActivityType(type)}
              className="w-[31%]"
            />
          ))}
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-sm font-bold text-strong">
          How hard was it? (effort {sessionRpe}/10)
        </Text>
        {/* Two rows of five: ten 48px-tap targets need ~550px in one row,
            wider than any phone — 8/9/10 fell off the right edge. Five per
            row keeps every button ≥48px and fully on-screen. */}
        {EFFORT_ROWS.map((row) => (
          <View key={row[0]} className="flex-row gap-1">
            {row.map((rpe) => {
              const selected = sessionRpe === rpe;
              return (
                <Pressable
                  key={rpe}
                  accessibilityRole="button"
                  accessibilityLabel={`Effort ${rpe} of 10`}
                  onPress={() => {
                    tapLight();
                    setSessionRpe(rpe);
                  }}
                  className={`h-14 min-w-[48px] flex-1 items-center justify-center rounded-lg border-2 ${
                    selected
                      ? `${band.colorClass} border-transparent`
                      : "border-edge bg-card"
                  }`}
                >
                  <Text
                    className={`text-sm font-black ${
                      selected ? "text-onaccent" : "text-body"
                    }`}
                  >
                    {rpe}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
        <View className="flex-row items-center justify-between">
          <Text className="text-xs text-faint">😴 Chilling</Text>
          <Text className="text-xs font-bold text-body">
            {band.label} {sessionRpe <= 3 ? "😌" : sessionRpe <= 6 ? "🙂" : sessionRpe <= 8 ? "😤" : "🔥"}
          </Text>
          <Text className="text-xs text-faint">🔥 All Out</Text>
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-sm font-bold text-strong">How long? (minutes)</Text>
        <TextInput
          value={durationText}
          onChangeText={setDurationText}
          keyboardType="number-pad"
          className="h-14 rounded-xl border-2 border-edge bg-card px-3 text-sm text-strong"
        />
        <View className="flex-row gap-2">
          {DURATION_CHIPS.map((minutes) => (
            <Pressable
              key={minutes}
              accessibilityRole="button"
              accessibilityLabel={`${minutes} minutes`}
              onPress={() => {
                tapLight();
                setDurationText(String(minutes));
              }}
              className={`h-14 flex-1 items-center justify-center rounded-lg border-2 ${
                durationText === String(minutes)
                  ? "border-accent bg-soft"
                  : "border-edge bg-card"
              }`}
            >
              <Text
                className={`text-sm font-bold ${
                  durationText === String(minutes) ? "text-go" : "text-body"
                }`}
              >
                {minutes}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-sm font-bold text-strong">Notes (optional)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Anything worth remembering?"
          placeholderTextColor="#64748B"
          multiline
          className="min-h-[72px] rounded-xl border-2 border-edge bg-card px-3 py-2 text-sm text-strong"
        />
      </View>

      {error !== null ? (
        <Text className="text-sm font-semibold text-shield">{error}</Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          tapHeavy();
          onSave();
        }}
        className="h-14 items-center justify-center rounded-xl bg-accent"
      >
        <Text className="text-base font-black text-onaccent">
          {editingId !== null ? "Save changes" : "Save activity"}
        </Text>
      </Pressable>

      {editingId !== null ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel edit"
          onPress={cancelEdit}
          className="h-12 items-center justify-center rounded-xl border-2 border-edge bg-card"
        >
          <Text className="text-sm font-bold text-body">Cancel — back to adding</Text>
        </Pressable>
      ) : null}

      {orderedEntries.length > 0 ? (
        <View className="rounded-2xl border border-edge bg-card p-4">
          <Text className="text-xs font-bold uppercase tracking-widest text-faint">
            {logListLabel}
          </Text>
          {orderedEntries.map((entry) => {
            const after =
              dayWorkout !== undefined && entry.createdAt > dayWorkout.createdAt;
            return (
              <View
                key={entry.id}
                className="mt-2 flex-row items-center justify-between"
              >
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-strong">
                    {ACTIVITY_TYPE_LABELS[entry.activityType]}
                  </Text>
                  <Text className="text-xs text-faint">
                    {entry.sessionRpe ?? "?"}/10 · {entry.durationMinutes ?? "?"} min · load{" "}
                    {(entry.sessionRpe ?? 0) * (entry.durationMinutes ?? 0)}
                  </Text>
                  {workoutDone ? (
                    <Text className="mt-0.5 text-xs font-semibold text-faint">
                      {after
                        ? "After the session — shapes the next workout"
                        : "Before the session — already shaped that day"}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${ACTIVITY_TYPE_LABELS[entry.activityType]} entry`}
                  onPress={() => startEdit(entry.id)}
                  className="h-14 w-14 items-center justify-center rounded-lg bg-edge"
                >
                  <Text className="text-base font-bold text-body">✎</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${ACTIVITY_TYPE_LABELS[entry.activityType]} entry`}
                  onPress={() => {
                    tapLight();
                    removeActivityLog(entry.id);
                  }}
                  className="ml-2 h-14 w-14 items-center justify-center rounded-lg bg-edge"
                >
                  <Text className="text-base font-bold text-body">✕</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}

      {isBackfill && dayWorkout !== undefined ? (
        <View className="rounded-2xl border border-edge bg-card p-4">
          <BodyMap
            areas={dayWorkout.soreAreasAfter ?? []}
            onAreasChange={(areas) => {
              tapLight();
              updateWorkoutLog(dayWorkout.id, { soreAreasAfter: [...areas] });
            }}
            heading="After that session, how did the body feel?"
            note="These flags ride into today's workout — the engine scales the blocks they touch."
          />
        </View>
      ) : null}

      {isBackfill && dayBlocks.length > 0 ? (
        <View className="rounded-2xl border border-edge bg-card p-4">
          <Text className="text-xs font-bold uppercase tracking-widest text-faint">
            Blocks that day — check off what you finished
          </Text>
          <Text className="mt-1 text-xs text-faint">
            Unchecked blocks look like missed volume — the plan adapts to what
            you actually did.
          </Text>
          {dayBlocks.map((component) => {
            const done = dayProgress[component.id] !== undefined;
            return (
              <Pressable
                key={component.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: done }}
                accessibilityLabel={`${done ? "Uncheck" : "Check off"} ${blockTitle(component.id)}`}
                onPress={() => {
                  tapLight();
                  toggleComponentDone(targetDate, component.id, component.baseVolume);
                }}
                className="mt-2 min-h-[48px] flex-row items-center gap-2"
              >
                <Text className={`text-lg ${done ? "text-go" : "text-faint"}`}>
                  {done ? "☑" : "☐"}
                </Text>
                <Text className="flex-1 text-sm text-body">
                  {blockTitle(component.id)}
                </Text>
                <Text className="text-xs text-faint">
                  {component.baseVolume} {component.baseVolume === 1 ? "set" : "sets"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {orderedEntries.length > 0 || isBackfill ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Done logging activities"
          onPress={() => {
            tapLight();
            if (isBackfill) router.back();
            else router.replace("/");
          }}
          className="h-14 items-center justify-center rounded-xl border-2 border-edge bg-card"
        >
          <Text className="text-base font-bold text-strong">
            {isBackfill ? "Done — back to the calendar" : "Done — back to your day"}
          </Text>
        </Pressable>
      ) : null}

      <Toast message={toast} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
