import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { OptionCard } from "../src/components/OptionCard";
import { Toast } from "../src/components/Toast";
import { partitionActivities } from "../src/lib/activityTiming";
import { toLocalDateString } from "../src/engine/autoregulation";
import { tapHeavy, tapLight, tapSuccess } from "../src/lib/haptics";
import {
  ACTIVITY_TYPE_LABELS,
  rpeBand,
  validateActivityDraft,
} from "../src/lib/format";
import { useAppStore } from "../src/stores/useAppStore";
import type { ActivityType } from "../src/types";

/**
 * Practice Log (design refresh): visual 1–10 effort slider (Chilling → All
 * Out), big quick-sport toggle chips, duration chips, and today's logged
 * activities. Built for several entries a day (morning practice + afternoon
 * skill work): saving keeps the screen open with a fresh form; a Done button
 * returns home. Entries carry a before/after-session badge once today's
 * workout is done — post-workout logs shape the NEXT workout, today's
 * session is frozen. Session load (RPE × minutes) shown as an internal
 * workload number — never a medical indicator (SPEC §10).
 */

const ACTIVITY_TYPES = Object.keys(ACTIVITY_TYPE_LABELS) as ActivityType[];
const DURATION_CHIPS = [30, 45, 60, 90, 120] as const;
const SAVED_TOAST = "Logged ✓ — add another or head back";

export default function PracticeLog() {
  const router = useRouter();
  const logActivity = useAppStore((state) => state.logActivity);
  const updateActivityLog = useAppStore((state) => state.updateActivityLog);
  const removeActivityLog = useAppStore((state) => state.removeActivityLog);
  const activityLogs = useAppStore((state) => state.activityLogs);
  const workoutLogs = useAppStore((state) => state.workoutLogs);
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
  const { pre, post } = partitionActivities(activityLogs, workoutLogs, today);
  const todaysLogs = [...pre, ...post];
  const workoutDone = workoutLogs.some((entry) => entry.activityDate === today);
  const band = rpeBand(sessionRpe);

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
        activityDate: today,
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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-slate-900"
    >
      <ScrollView
        className="flex-1 bg-slate-900"
        contentContainerClassName="w-full max-w-md self-center gap-5 p-4"
      >
      <View className="gap-2">
        <Text className="text-sm font-bold text-slate-100">What did you do?</Text>
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
        <Text className="text-sm font-bold text-slate-100">
          How hard was it? (effort {sessionRpe}/10)
        </Text>
        <View className="flex-row gap-1">
          {Array.from({ length: 10 }, (_, index) => index + 1).map((rpe) => {
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
                    : "border-slate-700 bg-slate-800"
                }`}
              >
                <Text
                  className={`text-sm font-black ${
                    selected ? "text-slate-950" : "text-slate-300"
                  }`}
                >
                  {rpe}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View className="flex-row items-center justify-between">
          <Text className="text-xs text-slate-500">😴 Chilling</Text>
          <Text className="text-xs font-bold text-slate-200">
            {band.label} {sessionRpe <= 3 ? "😌" : sessionRpe <= 6 ? "🙂" : sessionRpe <= 8 ? "😤" : "🔥"}
          </Text>
          <Text className="text-xs text-slate-500">🔥 All Out</Text>
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-sm font-bold text-slate-100">How long? (minutes)</Text>
        <TextInput
          value={durationText}
          onChangeText={setDurationText}
          keyboardType="number-pad"
          className="h-14 rounded-xl border-2 border-slate-600 bg-slate-800 px-3 text-sm text-slate-100"
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
                  ? "border-green-500 bg-green-500/20"
                  : "border-slate-700 bg-slate-800"
              }`}
            >
              <Text
                className={`text-sm font-bold ${
                  durationText === String(minutes) ? "text-green-300" : "text-slate-300"
                }`}
              >
                {minutes}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-sm font-bold text-slate-100">Notes (optional)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Anything worth remembering?"
          placeholderTextColor="#64748B"
          multiline
          className="min-h-[72px] rounded-xl border-2 border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
        />
      </View>

      {error !== null ? (
        <Text className="text-sm font-semibold text-red-400">{error}</Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          tapHeavy();
          onSave();
        }}
        className="h-14 items-center justify-center rounded-xl bg-green-500"
      >
        <Text className="text-base font-black text-slate-950">
          {editingId !== null ? "Save changes" : "Save activity"}
        </Text>
      </Pressable>

      {editingId !== null ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel edit"
          onPress={cancelEdit}
          className="h-12 items-center justify-center rounded-xl border-2 border-slate-700 bg-slate-800"
        >
          <Text className="text-sm font-bold text-slate-300">Cancel — back to adding</Text>
        </Pressable>
      ) : null}

      {todaysLogs.length > 0 ? (
        <View className="rounded-2xl border border-slate-700 bg-slate-800 p-4">
          <Text className="text-xs font-bold uppercase tracking-widest text-slate-400">
            {todaysLogs.length === 1 ? "Today's log (1 entry)" : `Today's log (${todaysLogs.length} entries)`}
          </Text>
          {todaysLogs.map((entry) => {
            const after = post.some((logged) => logged.createdAt === entry.createdAt);
            return (
              <View
                key={entry.id}
                className="mt-2 flex-row items-center justify-between"
              >
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-slate-100">
                    {ACTIVITY_TYPE_LABELS[entry.activityType]}
                  </Text>
                  <Text className="text-xs text-slate-400">
                    {entry.sessionRpe ?? "?"}/10 · {entry.durationMinutes ?? "?"} min · load{" "}
                    {(entry.sessionRpe ?? 0) * (entry.durationMinutes ?? 0)}
                  </Text>
                  {workoutDone ? (
                    <Text className="mt-0.5 text-xs font-semibold text-slate-500">
                      {after
                        ? "After today's session — shapes your next workout"
                        : "Before today's session — already shaped today"}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${ACTIVITY_TYPE_LABELS[entry.activityType]} entry`}
                  onPress={() => startEdit(entry.id)}
                  className="h-14 w-14 items-center justify-center rounded-lg bg-slate-700"
                >
                  <Text className="text-base font-bold text-slate-300">✎</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${ACTIVITY_TYPE_LABELS[entry.activityType]} entry`}
                  onPress={() => {
                    tapLight();
                    removeActivityLog(entry.id);
                  }}
                  className="ml-2 h-14 w-14 items-center justify-center rounded-lg bg-slate-700"
                >
                  <Text className="text-base font-bold text-slate-300">✕</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}

      {todaysLogs.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Done logging activities"
          onPress={() => {
            tapLight();
            router.replace("/");
          }}
          className="h-14 items-center justify-center rounded-xl border-2 border-slate-700 bg-slate-800"
        >
          <Text className="text-base font-bold text-slate-100">Done — back to your day</Text>
        </Pressable>
      ) : null}

      <Toast message={toast} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
