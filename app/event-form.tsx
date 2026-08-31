import { useRouter, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { OptionCard } from "../src/components/OptionCard";
import { Toast } from "../src/components/Toast";
import { toLocalDateString } from "../src/engine/autoregulation";
import {
  isEventEditable,
  parseEventDateTime,
  prefillFromIso,
} from "../src/lib/eventForm";
import { tapSuccess } from "../src/lib/haptics";
import { SCHEDULED_EVENT_LABELS } from "../src/lib/format";
import { useAppStore } from "../src/stores/useAppStore";
import type { ScheduledEventType } from "../src/types";

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

/**
 * Add / edit a future commitment (athlete-managed calendar events). Saves
 * via the existing store actions; the engine then considers competitions
 * and high-stress days automatically on the next derivation.
 */
export default function EventForm() {
  const router = useRouter();
  const params = useLocalSearchParams<{ eventId?: string }>();
  const scheduledEvents = useAppStore((state) => state.scheduledEvents);
  const profile = useAppStore((state) => state.profile);
  const scheduleEvent = useAppStore((state) => state.scheduleEvent);
  const updateScheduledEvent = useAppStore((state) => state.updateScheduledEvent);
  const removeScheduledEvent = useAppStore((state) => state.removeScheduledEvent);

  const existing = params.eventId
    ? scheduledEvents.find((event) => event.id === params.eventId)
    : undefined;

  const prefill = existing
    ? prefillFromIso(existing.startAt, profile.timezone)
    : { dateText: "", timeText: "" };

  const [eventType, setEventType] = useState<ScheduledEventType>(
    existing?.eventType ?? "TEAM_PRACTICE",
  );
  const [title, setTitle] = useState(existing?.title ?? "");
  const [dateText, setDateText] = useState(prefill.dateText);
  const [timeText, setTimeText] = useState(prefill.timeText);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const editable = !existing || isEventEditable(existing.startAt, new Date());
  const today = toLocalDateString(new Date(), profile.timezone);

  const save = () => {
    if (!editable) return;
    const parsed = parseEventDateTime(dateText, timeText, profile.timezone);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    if (toLocalDateString(new Date(parsed.iso), profile.timezone) < today) {
      setError("Pick today or a future date");
      return;
    }
    if (existing) {
      updateScheduledEvent(existing.id, {
        eventType,
        startAt: parsed.iso,
        title: title.trim() === "" ? undefined : title.trim(),
      });
    } else {
      scheduleEvent({
        eventType,
        startAt: parsed.iso,
        title: title.trim() === "" ? undefined : title.trim(),
      });
    }
    tapSuccess();
    setToast(SAVED_TOAST);
    setTimeout(() => router.replace("/history"), 900);
  };

  const remove = () => {
    if (!existing) return;
    removeScheduledEvent(existing.id);
    tapSuccess();
    router.replace("/history");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-slate-900"
    >
      <ScrollView
        className="flex-1 bg-slate-900"
        contentContainerClassName="w-full max-w-md self-center gap-4 p-4"
      >
      <Text className="text-sm text-slate-400">
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

      <View className="gap-1">
        <Text className="text-xs font-bold uppercase tracking-widest text-slate-400">
          Date
        </Text>
        <TextInput
          value={dateText}
          onChangeText={(text) => {
            setDateText(text);
            setError("");
          }}
          editable={editable}
          placeholder="2026-01-15"
          placeholderTextColor="#64748B"
          className="h-14 rounded-xl border border-slate-700 bg-slate-800 px-4 text-base text-slate-50"
        />
      </View>

      <View className="gap-1">
        <Text className="text-xs font-bold uppercase tracking-widest text-slate-400">
          Start time
        </Text>
        <TextInput
          value={timeText}
          onChangeText={(text) => {
            setTimeText(text);
            setError("");
          }}
          editable={editable}
          placeholder="18:00"
          placeholderTextColor="#64748B"
          className="h-14 rounded-xl border border-slate-700 bg-slate-800 px-4 text-base text-slate-50"
        />
      </View>

      <View className="gap-1">
        <Text className="text-xs font-bold uppercase tracking-widest text-slate-400">
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
          className="h-14 rounded-xl border border-slate-700 bg-slate-800 px-4 text-base text-slate-50"
        />
      </View>

      {error !== "" ? (
        <Text className="text-sm font-semibold text-red-400">{error}</Text>
      ) : null}

      {editable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save event"
          onPress={save}
          className="h-14 items-center justify-center rounded-xl bg-green-500"
        >
          <Text className="text-base font-black text-slate-950">
            {existing ? "Save changes" : "Add to calendar"}
          </Text>
        </Pressable>
      ) : (
        <Text className="text-sm text-slate-500">
          This event already happened — history stays as it was.
        </Text>
      )}

      {existing ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete event"
          onPress={remove}
          className="h-14 items-center justify-center rounded-xl border-2 border-red-500/60"
        >
          <Text className="text-base font-bold text-red-400">Remove from calendar</Text>
        </Pressable>
      ) : null}

      <Toast message={toast} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
