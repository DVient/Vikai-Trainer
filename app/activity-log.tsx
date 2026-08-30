import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { OptionCard } from "../src/components/OptionCard";
import { toLocalDateString } from "../src/engine/autoregulation";
import {
  ACTIVITY_TYPE_LABELS,
  rpeBandClass,
  RPE_BANDS,
  validateActivityDraft,
} from "../src/lib/format";
import { useAppStore } from "../src/stores/useAppStore";
import type { ActivityType } from "../src/types";

/**
 * Workload & activity log (FLOW 4.3, SPEC §29): activity selector, RPE
 * selector 1–10 with visual legend, duration input, optional notes, and
 * today's logged activities. Session load (RPE × minutes) shown as an
 * internal workload number — never a medical indicator (SPEC §10).
 */

const ACTIVITY_TYPES = Object.keys(ACTIVITY_TYPE_LABELS) as ActivityType[];
const DURATION_CHIPS = [30, 45, 60, 90, 120] as const;

export default function ActivityLog() {
  const router = useRouter();
  const logActivity = useAppStore((state) => state.logActivity);
  const removeActivityLog = useAppStore((state) => state.removeActivityLog);
  const activityLogs = useAppStore((state) => state.activityLogs);
  const profile = useAppStore((state) => state.profile);

  const [activityType, setActivityType] = useState<ActivityType>("TEAM_PRACTICE");
  const [sessionRpe, setSessionRpe] = useState(5);
  const [durationText, setDurationText] = useState("60");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const today = toLocalDateString(now, profile.timezone);
  const todaysLogs = activityLogs.filter((entry) => entry.activityDate === today);

  const onSave = () => {
    const durationMinutes = Number.parseInt(durationText, 10);
    const validationError = validateActivityDraft(sessionRpe, durationMinutes);
    if (validationError !== null) {
      setError(validationError);
      return;
    }

    logActivity({
      activityDate: today,
      timezone: profile.timezone,
      activityType,
      sessionRpe,
      durationMinutes,
      notes: notes.trim() === "" ? undefined : notes.trim(),
    });
    router.replace("/");
  };

  return (
    <ScrollView className="flex-1 bg-slate-100" contentContainerClassName="gap-5 p-4">
      <View className="gap-2">
        <Text className="text-sm font-bold text-slate-900">What did you do?</Text>
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
        <Text className="text-sm font-bold text-slate-900">How hard was it? (effort {sessionRpe}/10)</Text>
        <View className="flex-row gap-1">
          {Array.from({ length: 10 }, (_, index) => index + 1).map((rpe) => (
            <Pressable
              key={rpe}
              accessibilityRole="button"
              accessibilityLabel={`Effort ${rpe} of 10`}
              onPress={() => setSessionRpe(rpe)}
              className={`h-12 min-w-[48px] flex-1 items-center justify-center rounded-lg ${
                sessionRpe === rpe ? rpeBandClass(rpe) : "bg-white"
              }`}
            >
              <Text
                className={`text-sm font-bold ${
                  sessionRpe === rpe ? "text-white" : "text-slate-700"
                }`}
              >
                {rpe}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text className="text-xs text-slate-500">
          1–3 Light · 4–6 Moderate · 7–8 Hard · 9–10 Max
        </Text>
      </View>

      <View className="gap-2">
        <Text className="text-sm font-bold text-slate-900">How long? (minutes)</Text>
        <TextInput
          value={durationText}
          onChangeText={setDurationText}
          keyboardType="number-pad"
          className="h-12 rounded-xl border-2 border-slate-300 px-3 text-sm text-slate-900"
        />
        <View className="flex-row gap-2">
          {DURATION_CHIPS.map((minutes) => (
            <Pressable
              key={minutes}
              accessibilityRole="button"
              accessibilityLabel={`${minutes} minutes`}
              onPress={() => setDurationText(String(minutes))}
              className={`h-12 flex-1 items-center justify-center rounded-lg border-2 ${
                durationText === String(minutes)
                  ? "border-sky-600 bg-sky-600"
                  : "border-slate-300 bg-white"
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  durationText === String(minutes) ? "text-white" : "text-slate-700"
                }`}
              >
                {minutes}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-sm font-bold text-slate-900">Notes (optional)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Anything worth remembering?"
          multiline
          className="min-h-[72px] rounded-xl border-2 border-slate-300 px-3 py-2 text-sm text-slate-900"
        />
      </View>

      {error !== null ? (
        <Text className="text-sm font-semibold text-red-600">{error}</Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={onSave}
        className="h-14 items-center justify-center rounded-xl bg-sky-600"
      >
        <Text className="text-base font-bold text-white">Save activity</Text>
      </Pressable>

      {todaysLogs.length > 0 ? (
        <View className="rounded-2xl bg-white p-4">
          <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Today's log
          </Text>
          {todaysLogs.map((entry) => (
            <View
              key={entry.id}
              className="mt-2 flex-row items-center justify-between"
            >
              <View className="flex-1">
                <Text className="text-sm font-semibold text-slate-800">
                  {ACTIVITY_TYPE_LABELS[entry.activityType]}
                </Text>
                <Text className="text-xs text-slate-500">
                  {entry.sessionRpe ?? "?"}/10 · {entry.durationMinutes ?? "?"} min · load{" "}
                  {(entry.sessionRpe ?? 0) * (entry.durationMinutes ?? 0)}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${ACTIVITY_TYPE_LABELS[entry.activityType]} entry`}
                onPress={() => removeActivityLog(entry.id)}
                className="h-12 w-12 items-center justify-center rounded-lg bg-slate-100"
              >
                <Text className="text-base font-bold text-slate-500">✕</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}
