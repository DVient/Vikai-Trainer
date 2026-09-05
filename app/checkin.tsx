import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { OptionCard } from "../src/components/OptionCard";
import { Toast } from "../src/components/Toast";
import { soreAreaLabel, SORE_REGIONS } from "../src/lib/bodyMap";
import { toLocalDateString } from "../src/engine/autoregulation";
import { tapHeavy, tapLight, tapSuccess } from "../src/lib/haptics";
import { useAppStore } from "../src/stores/useAppStore";
import type { EnergyAnchor, JointStatus, SleepAnchor, SoreArea, SoreRegion } from "../src/types";

/**
 * 3-Tap Check-In (design refresh): sleep, body feel, and energy as big
 * emoji selector cards with haptic ticks — done in under 5 seconds. Includes
 * a conditional pain sub-form (location & description), the Phase-7 body map
 * (optional stepped soreness input: regions → areas; skipped entirely when
 * everything feels good), and an offline save toast. Purely a data-entry
 * screen — the engine decides what the answers mean (AGENTS.md decoupling).
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
  const [openRegions, setOpenRegions] = useState<SoreRegion[]>([]);
  const [soreAreas, setSoreAreas] = useState<SoreArea[]>([]);
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

  const toggleRegion = (region: SoreRegion) => {
    tapLight();
    const wasOpen = openRegions.includes(region);
    setOpenRegions((prev) => (wasOpen ? prev.filter((entry) => entry !== region) : [...prev, region]));
    if (wasOpen) {
      // Collapsing a region clears its flagged areas — state never lingers.
      const regionAreas = SORE_REGIONS.find((entry) => entry.id === region)?.areas ?? [];
      const regionAreaIds = regionAreas.map((area) => area.id);
      setSoreAreas((prev) => prev.filter((area) => !regionAreaIds.includes(area)));
    }
  };

  const toggleArea = (area: SoreArea) => {
    tapLight();
    setSoreAreas((prev) => (prev.includes(area) ? prev.filter((entry) => entry !== area) : [...prev, area]));
  };

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
      ...(soreAreas.length > 0 ? { soreAreas: [...soreAreas] } : {}),
    });

    // Confirm physically, show the offline toast, then return Home where
    // the updated Game Plan is already on screen.
    tapSuccess();
    setToast(SAVED_TOAST);
    navigateTimer.current = setTimeout(() => router.replace("/"), 1200);
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

      {painReported ? null : (
        <View className="gap-2">
          <Text className="text-sm font-bold text-slate-100">Optional — Body map 🗺️</Text>
          <Text className="text-xs text-slate-400">
            Flag sore spots and Vikai scales just those blocks today — not the whole day. Skip if
            everything feels good. 💪
          </Text>
          <View className="flex-row gap-2">
            {SORE_REGIONS.map((region) => (
              <OptionCard
                key={region.id}
                emoji={region.emoji}
                label={region.label}
                selected={openRegions.includes(region.id)}
                onSelect={() => toggleRegion(region.id)}
                className="flex-1"
              />
            ))}
          </View>
          {openRegions.map((region) => {
            const option = SORE_REGIONS.find((entry) => entry.id === region);
            if (option === undefined) return null;
            return (
              <View
                key={region}
                className="rounded-2xl border border-slate-700 bg-slate-800 p-3 gap-2"
              >
                <Text className="text-xs font-semibold text-slate-300">
                  What's sore in the {option.label.toLowerCase()}?
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {option.areas.map((area) => (
                    <AreaChip
                      key={area.id}
                      emoji={area.emoji}
                      label={area.label}
                      selected={soreAreas.includes(area.id)}
                      onPress={() => toggleArea(area.id)}
                    />
                  ))}
                </View>
              </View>
            );
          })}
          {soreAreas.length > 0 ? (
            <Text className="text-xs text-slate-400">
              Sore today: {soreAreas.map(soreAreaLabel).join(", ")}
            </Text>
          ) : null}
        </View>
      )}

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
    </KeyboardAvoidingView>
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

/** ≥48px tappable sore-area chip (second step of the body map). */
function AreaChip({
  emoji,
  label,
  selected,
  onPress,
}: {
  emoji: string;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label} ${selected ? "flagged as sore" : ""}`.trim()}
      onPress={onPress}
      className={`h-12 flex-row items-center gap-1.5 rounded-full border-2 px-4 ${
        selected ? "border-amber-400 bg-amber-400/20" : "border-slate-600 bg-slate-900"
      }`}
    >
      <Text className="text-base">{emoji}</Text>
      <Text className={`text-sm font-semibold ${selected ? "text-amber-300" : "text-slate-300"}`}>
        {label}
      </Text>
    </Pressable>
  );
}
