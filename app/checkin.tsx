import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { OptionCard } from "../src/components/OptionCard";
import { Toast } from "../src/components/Toast";
import { toLocalDateString } from "../src/engine/autoregulation";
import { tapHeavy, tapSuccess } from "../src/lib/haptics";
import { useAppStore } from "../src/stores/useAppStore";
import type { EnergyAnchor, JointStatus, SleepAnchor } from "../src/types";

/**
 * 3-Tap Check-In (design refresh): sleep, body feel, and energy as big
 * emoji selector cards with haptic ticks — done in under 5 seconds. Includes
 * a conditional pain sub-form (location & description) and an offline save
 * toast. Purely a data-entry screen — the engine decides what the answers
 * mean (AGENTS.md decoupling).
 */

const SLEEP_OPTIONS: ReadonlyArray<{ value: SleepAnchor; emoji: string; label: string }> = [
  { value: "UNDER_7_HRS", emoji: "😴", label: "< 7h" },
  { value: "SEVEN_TO_EIGHT_HRS", emoji: "🌙", label: "7–8h" },
  { value: "OVER_8_HRS", emoji: "⚡", label: "8h+" },
];

const JOINT_OPTIONS: ReadonlyArray<{ value: JointStatus; emoji: string; label: string }> = [
  { value: "PAIN_CONCERN", emoji: "⚠️", label: "Sharp pain" },
  { value: "MILD_STIFFNESS", emoji: "🩹", label: "Stiff" },
  { value: "NO_CONCERN", emoji: "🔥", label: "Zero pain" },
];

const ENERGY_OPTIONS: ReadonlyArray<{ value: EnergyAnchor; emoji: string; label: string }> = [
  { value: "DRAINED", emoji: "🪫", label: "Drained" },
  { value: "NORMAL", emoji: "🔋", label: "Good" },
  { value: "HIGH", emoji: "🚀", label: "Hyped" },
];

const SAVED_TOAST = "Saved offline · Syncs when back online ✅";

export default function CheckIn() {
  const router = useRouter();
  const saveDailyCheckIn = useAppStore((state) => state.saveDailyCheckIn);
  const profile = useAppStore((state) => state.profile);

  const [sleepAnchor, setSleepAnchor] = useState<SleepAnchor | null>(null);
  const [jointStatus, setJointStatus] = useState<JointStatus | null>(null);
  const [energyAnchor, setEnergyAnchor] = useState<EnergyAnchor | null>(null);
  const [painLocation, setPainLocation] = useState("");
  const [painDescription, setPainDescription] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const navigateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (navigateTimer.current !== null) clearTimeout(navigateTimer.current);
    },
    [],
  );

  const painReported = jointStatus === "PAIN_CONCERN";
  const painLocationMissing = painReported && painLocation.trim() === "";
  const canSave =
    sleepAnchor !== null && jointStatus !== null && energyAnchor !== null && !painLocationMissing;

  const onSave = () => {
    if (sleepAnchor === null || jointStatus === null || energyAnchor === null) return;
    if (painLocationMissing) return;

    const now = new Date();
    saveDailyCheckIn({
      localDate: toLocalDateString(now, profile.timezone),
      timezone: profile.timezone,
      recordedAt: now.toISOString(),
      sleepAnchor,
      jointStatus,
      energyAnchor,
      ...(painReported
        ? { painLocation: painLocation.trim(), painDescription: painDescription.trim() || undefined }
        : {}),
    });

    // Confirm physically, show the offline toast, then return Home where
    // the updated Game Plan is already on screen.
    tapSuccess();
    setToast(SAVED_TOAST);
    navigateTimer.current = setTimeout(() => router.replace("/"), 1200);
  };

  return (
    <ScrollView className="flex-1 bg-slate-900" contentContainerClassName="gap-5 p-4">
      <SelectorGroup label="Tap 1 — Sleep 😴">
        {SLEEP_OPTIONS.map((option) => (
          <OptionCard
            key={option.value}
            emoji={option.emoji}
            label={option.label}
            selected={sleepAnchor === option.value}
            onSelect={() => setSleepAnchor(option.value)}
            className="flex-1"
          />
        ))}
      </SelectorGroup>

      <SelectorGroup label="Tap 2 — Joints 🦴">
        {JOINT_OPTIONS.map((option) => (
          <OptionCard
            key={option.value}
            emoji={option.emoji}
            label={option.label}
            selected={jointStatus === option.value}
            onSelect={() => setJointStatus(option.value)}
            className="flex-1"
          />
        ))}
      </SelectorGroup>

      {painReported ? (
        <View className="rounded-2xl border border-red-500/40 bg-slate-800 p-4 gap-3">
          <Text className="text-sm font-bold text-slate-50">Tell us about the pain</Text>
          <Text className="text-xs text-slate-400">
            Vikai does not assess anything — it only pauses training and alerts an adult.
          </Text>
          <TextInput
            value={painLocation}
            onChangeText={setPainLocation}
            placeholder="Where do you feel it? (e.g. right knee)"
            placeholderTextColor="#64748B"
            className="min-h-[56px] rounded-xl border-2 border-slate-600 bg-slate-900 px-3 text-sm text-slate-100"
          />
          <TextInput
            value={painDescription}
            onChangeText={setPainDescription}
            placeholder="Describe how it feels (optional)"
            placeholderTextColor="#64748B"
            multiline
            className="min-h-[72px] rounded-xl border-2 border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          />
          {painLocationMissing ? (
            <Text className="text-xs font-semibold text-red-400">A location is required.</Text>
          ) : null}
        </View>
      ) : null}

      <SelectorGroup label="Tap 3 — Energy 🔋">
        {ENERGY_OPTIONS.map((option) => (
          <OptionCard
            key={option.value}
            emoji={option.emoji}
            label={option.label}
            selected={energyAnchor === option.value}
            onSelect={() => setEnergyAnchor(option.value)}
            className="flex-1"
          />
        ))}
      </SelectorGroup>

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          tapHeavy();
          onSave();
        }}
        disabled={!canSave}
        className={`h-14 items-center justify-center rounded-xl ${
          canSave ? "bg-green-500" : "bg-slate-700"
        }`}
      >
        <Text className={`text-base font-black ${canSave ? "text-slate-950" : "text-slate-500"}`}>
          Save check-in
        </Text>
      </Pressable>

      <Toast message={toast} />
    </ScrollView>
  );
}

function SelectorGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-bold text-slate-100">{label}</Text>
      <View className="flex-row gap-2">{children}</View>
    </View>
  );
}
