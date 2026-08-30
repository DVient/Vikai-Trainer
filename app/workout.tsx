import { ScrollView, Text, View } from "react-native";

import { StatusBanner } from "../src/components/StatusBanner";
import { applyRestrictionsToBasePlan } from "../src/engine/generator";
import { useEngineResult } from "../src/hooks/useEngineResult";
import {
  STRESS_LABELS,
  TRAINING_GOAL_LABELS,
} from "../src/lib/format";
import { ADULT_ATTENTION_MESSAGE } from "../src/lib/status";
import { BASE_PLAN_TITLES, DEFAULT_BASE_PLAN } from "../src/plans/basePlan";
import type { ScaledComponent } from "../src/engine/generator";

/**
 * Scaled workout view (FLOW 4.4, SPEC §30): today's prescription rendered by
 * applying engine restrictions to the base plan, with explicit "REMOVED" and
 * "REDUCED" labels, recovery notes, and an adult-attention callout when the
 * engine requires one. This screen never invents exercises — it renders the
 * generator's output (AGENTS.md decoupling).
 */
export default function Workout() {
  const { result } = useEngineResult();
  const prescription = applyRestrictionsToBasePlan(DEFAULT_BASE_PLAN, result.restrictions);

  return (
    <ScrollView className="flex-1 bg-slate-100" contentContainerClassName="gap-4 p-4">
      <StatusBanner status={result.status} reasons={result.reasons} />

      {result.requiresAdultAttention ? (
        <View className="rounded-2xl border-2 border-red-300 bg-white p-4">
          <Text className="text-sm font-semibold text-red-700">{ADULT_ATTENTION_MESSAGE}</Text>
        </View>
      ) : null}

      {result.status === "CHECKIN_REQUIRED" ? (
        <View className="rounded-2xl bg-white p-4">
          <Text className="text-sm text-slate-700">
            This is the unscaled base plan. Complete today's check-in to unlock automatic volume
            adjustments.
          </Text>
        </View>
      ) : null}

      {result.recoveryActions.length > 0 ? (
        <View className="rounded-2xl bg-white p-4">
          <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Recovery focus
          </Text>
          {result.recoveryActions.map((action) => (
            <Text key={action} className="mt-2 text-sm text-slate-700">
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

      <Text className="pb-4 text-center text-xs text-slate-400">
        Volume auto-adjusts from today's readiness. High/low balance stays protected.
      </Text>
    </ScrollView>
  );
}

function ComponentRow({ entry }: { entry: ScaledComponent }) {
  const { component, modification, scaledVolume, modificationReason } = entry;
  const title = BASE_PLAN_TITLES[component.id] ?? component.id;
  const removed = modification === "REMOVED";

  return (
    <View
      className={`rounded-2xl bg-white p-4 ${removed ? "opacity-50" : ""}`}
    >
      <View className="flex-row items-center justify-between">
        <Text
          className={`text-base font-bold text-slate-900 ${removed ? "line-through" : ""}`}
        >
          {title}
        </Text>
        {modification === "REMOVED" ? (
          <View className="rounded-full bg-red-200 px-2 py-1">
            <Text className="text-xs font-bold text-red-900">REMOVED</Text>
          </View>
        ) : null}
        {modification === "REDUCED" ? (
          <View className="rounded-full bg-amber-200 px-2 py-1">
            <Text className="text-xs font-bold text-amber-900">REDUCED</Text>
          </View>
        ) : null}
      </View>

      <Text className="mt-1 text-xs text-slate-500">
        {TRAINING_GOAL_LABELS[component.type]} · {STRESS_LABELS[component.stress]} stress
      </Text>

      <Text className="mt-2 text-sm font-semibold text-slate-800">
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
