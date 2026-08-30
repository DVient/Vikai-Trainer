import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { OptionCard } from "../src/components/OptionCard";
import { toLocalDateString } from "../src/engine/autoregulation";
import { useAppStore } from "../src/stores/useAppStore";
import type { EnergyAnchor, JointStatus, SleepAnchor } from "../src/types";

/**
 * Daily check-in (FLOW 4.2, SPEC §28): sleep, joint/body feel, and energy
 * selector cards with ≥48x48px touch targets, plus a conditional pain
 * sub-form (location & description). Purely a data-entry screen — the
 * engine decides what the answers mean (AGENTS.md decoupling).
 */

const SLEEP_OPTIONS: ReadonlyArray<{ value: SleepAnchor; label: string }> = [
  { value: "UNDER_7_HRS", label: "Under 7 hours" },
  { value: "SEVEN_TO_EIGHT_HRS", label: "7–8 hours" },
  { value: "OVER_8_HRS", label: "Over 8 hours" },
];

const JOINT_OPTIONS: ReadonlyArray<{ value: JointStatus; label: string }> = [
  { value: "NO_CONCERN", label: "No concerns" },
  { value: "MILD_STIFFNESS", label: "Mild stiffness" },
  { value: "PAIN_CONCERN", label: "Pain" },
];

const ENERGY_OPTIONS: ReadonlyArray<{ value: EnergyAnchor; label: string }> = [
  { value: "DRAINED", label: "Drained" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
];

export default function CheckIn() {
  const router = useRouter();
  const saveDailyCheckIn = useAppStore((state) => state.saveDailyCheckIn);
  const profile = useAppStore((state) => state.profile);

  const [sleepAnchor, setSleepAnchor] = useState<SleepAnchor | null>(null);
  const [jointStatus, setJointStatus] = useState<JointStatus | null>(null);
  const [energyAnchor, setEnergyAnchor] = useState<EnergyAnchor | null>(null);
  const [painLocation, setPainLocation] = useState("");
  const [painDescription, setPainDescription] = useState("");

  const painReported = jointStatus === "PAIN_CONCERN";
  const painLocationMissing = painReported && painLocation.trim() === "";
  const canSave = sleepAnchor !== null && jointStatus !== null && energyAnchor !== null && !painLocationMissing;

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
    router.replace("/");
  };

  return (
    <ScrollView className="flex-1 bg-slate-100" contentContainerClassName="gap-5 p-4">
      <SelectorGroup label="Sleep — how long did you sleep?">
        {SLEEP_OPTIONS.map((option) => (
          <OptionCard
            key={option.value}
            label={option.label}
            selected={sleepAnchor === option.value}
            onSelect={() => setSleepAnchor(option.value)}
            className="flex-1"
          />
        ))}
      </SelectorGroup>

      <SelectorGroup label="Body feel — how do your joints feel?">
        {JOINT_OPTIONS.map((option) => (
          <OptionCard
            key={option.value}
            label={option.label}
            selected={jointStatus === option.value}
            onSelect={() => setJointStatus(option.value)}
            className="flex-1"
          />
        ))}
      </SelectorGroup>

      {painReported ? (
        <View className="rounded-2xl bg-white p-4 gap-3">
          <Text className="text-sm font-bold text-slate-900">Tell us about the pain</Text>
          <Text className="text-xs text-slate-500">
            This app does not diagnose anything — it only pauses training and alerts an adult.
          </Text>
          <TextInput
            value={painLocation}
            onChangeText={setPainLocation}
            placeholder="Where do you feel it? (e.g. right knee)"
            className="min-h-[48px] rounded-xl border-2 border-slate-300 px-3 text-sm text-slate-900"
          />
          <TextInput
            value={painDescription}
            onChangeText={setPainDescription}
            placeholder="Describe how it feels (optional)"
            multiline
            className="min-h-[72px] rounded-xl border-2 border-slate-300 px-3 py-2 text-sm text-slate-900"
          />
          {painLocationMissing ? (
            <Text className="text-xs font-semibold text-red-600">A location is required.</Text>
          ) : null}
        </View>
      ) : null}

      <SelectorGroup label="Energy — how do you feel overall?">
        {ENERGY_OPTIONS.map((option) => (
          <OptionCard
            key={option.value}
            label={option.label}
            selected={energyAnchor === option.value}
            onSelect={() => setEnergyAnchor(option.value)}
            className="flex-1"
          />
        ))}
      </SelectorGroup>

      <Pressable
        accessibilityRole="button"
        onPress={onSave}
        disabled={!canSave}
        className={`h-14 items-center justify-center rounded-xl ${
          canSave ? "bg-sky-600" : "bg-slate-300"
        }`}
      >
        <Text className={`text-base font-bold ${canSave ? "text-white" : "text-slate-500"}`}>
          Save check-in
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function SelectorGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-bold text-slate-900">{label}</Text>
      <View className="flex-row gap-2">{children}</View>
    </View>
  );
}
