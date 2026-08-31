import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { PowerGauge } from "../src/components/PowerGauge";
import { StatusBanner } from "../src/components/StatusBanner";
import { applyRestrictionsToBasePlan } from "../src/engine/generator";
import { useEngineResult } from "../src/hooks/useEngineResult";
import { powerBanner, powerLevel } from "../src/lib/power";
import { tapHeavy } from "../src/lib/haptics";
import {
  STRESS_LABELS,
  TRAINING_GOAL_LABELS,
} from "../src/lib/format";
import { ADULT_ATTENTION_MESSAGE } from "../src/lib/status";
import { BASE_PLAN_TITLES, DEFAULT_BASE_PLAN } from "../src/plans/basePlan";
import { useAppStore } from "../src/stores/useAppStore";
import type { ScaledComponent } from "../src/engine/generator";

/**
 * Daily Game Plan (guided flow, step 2): intensity multiplier banner up top
 * (e.g. "100% Full Send" / "60% Power Save"), restricted moves grayed out
 * with explicit lock badges, and a bottom CTA that continues the sequence
 * into the Practice Log. Viewing the plan marks it done for the stepper.
 * This screen never invents exercises — it renders the generator's output
 * (AGENTS.md decoupling).
 */
export default function Workout() {
  const router = useRouter();
  const { result, stripOptional, today } = useEngineResult();
  const markGamePlanViewed = useAppStore((state) => state.markGamePlanViewed);
  const prescription = applyRestrictionsToBasePlan(DEFAULT_BASE_PLAN, result.restrictions, {
    stripOptional,
  });
  const power = powerLevel(result);

  useEffect(() => {
    markGamePlanViewed(today);
  }, [markGamePlanViewed, today]);

  return (
    <ScrollView className="flex-1 bg-slate-900" contentContainerClassName="gap-4 p-4">
      <Text className="text-2xl font-black text-slate-50">Today's Game Plan</Text>

      <PowerGauge
        percent={power.percent}
        tone={power.tone}
        label={power.label}
        sublabel="Game Plan intensity"
      />

      <View className="rounded-2xl border border-slate-700 bg-slate-800 p-4">
        <Text className="text-3xl font-black text-slate-50">{powerBanner(power)}</Text>
        <Text className="mt-1 text-sm text-slate-400">
          Volume auto-adjusts from your Ready State. Unsafe moves lock themselves.
        </Text>
      </View>

      <StatusBanner status={result.status} reasons={result.reasons} />

      {result.requiresAdultAttention ? (
        <View className="rounded-2xl border-2 border-red-500/40 bg-slate-800 p-4">
          <Text className="text-sm font-semibold text-red-300">{ADULT_ATTENTION_MESSAGE}</Text>
        </View>
      ) : null}

      {result.status === "CHECKIN_REQUIRED" ? (
        <View className="rounded-2xl border border-slate-700 bg-slate-800 p-4">
          <Text className="text-sm text-slate-300">
            This is the unscaled base plan. Do the 3-Tap Check-In to unlock automatic volume
            adjustments.
          </Text>
        </View>
      ) : null}

      {result.recoveryActions.length > 0 ? (
        <View className="rounded-2xl border border-slate-700 bg-slate-800 p-4">
          <Text className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Recovery focus
          </Text>
          {result.recoveryActions.map((action) => (
            <Text key={action} className="mt-2 text-sm text-slate-300">
              • {action}
            </Text>
          ))}
        </View>
      ) : null}

      <View className="gap-2">
        {prescription.map((entry) => (
          <ComponentRow key={entry.component.id} entry={entry} />
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          tapHeavy();
          router.navigate("/practice-log");
        }}
        className="mb-2 h-14 items-center justify-center rounded-xl bg-green-500"
      >
        <Text className="text-base font-black text-slate-950">
          Done — Log your session 🏀
        </Text>
      </Pressable>

      <Text className="pb-4 text-center text-xs text-slate-500">
        High/low balance stays protected automatically.
      </Text>
    </ScrollView>
  );
}

/** Maps the generator's technical removal reason to a youth-facing badge. */
function lockBadge(reason: string): string {
  if (reason.includes("plyometrics")) return "Plyos Paused 🚫";
  if (reason.includes("high-impact")) return "High-Impact Locked 🛡️";
  if (reason.includes("back-to-back")) return "Auto-Skipped — Back-to-Back Days 🛌";
  if (reason.includes("optional")) return "Optional — Skipped Today 😴";
  return "Locked for Joint Shielding 🛡️";
}

function ComponentRow({ entry }: { entry: ScaledComponent }) {
  const { component, modification, scaledVolume, modificationReason } = entry;
  const title = BASE_PLAN_TITLES[component.id] ?? component.id;
  const removed = modification === "REMOVED";

  return (
    <View
      className={`relative rounded-2xl border border-slate-700 bg-slate-800 p-4 ${
        removed ? "opacity-50" : ""
      }`}
    >
      <View className="flex-row items-center justify-between">
        <Text
          className={`text-base font-bold text-slate-50 ${removed ? "line-through" : ""}`}
        >
          {title}
        </Text>
        {modification === "REMOVED" ? (
          <View className="rounded-full bg-red-500/25 px-3 py-1">
            <Text className="text-xs font-black text-red-300">
              {modificationReason !== undefined ? lockBadge(modificationReason) : "Locked 🛡️"}
            </Text>
          </View>
        ) : null}
        {modification === "REDUCED" ? (
          <View className="rounded-full bg-yellow-500/25 px-3 py-1">
            <Text className="text-xs font-black text-yellow-300">REDUCED</Text>
          </View>
        ) : null}
      </View>

      <Text className="mt-1 text-xs text-slate-400">
        {TRAINING_GOAL_LABELS[component.type]} · {STRESS_LABELS[component.stress]} stress
      </Text>

      <Text className="mt-2 text-sm font-bold text-slate-200">
        {removed
          ? "Not part of today's plan"
          : modification === "REDUCED"
            ? `${component.baseVolume} → ${scaledVolume} sets`
            : `${scaledVolume} set${scaledVolume === 1 ? "" : "s"}`}
      </Text>

      {modificationReason !== undefined ? (
        <Text className="mt-1 text-xs text-slate-500">{modificationReason}</Text>
      ) : null}
    </View>
  );
}
