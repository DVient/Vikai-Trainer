import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { PowerGauge } from "../src/components/PowerGauge";
import { SessionChecklist } from "../src/components/SessionChecklist";
import { StatusBanner } from "../src/components/StatusBanner";
import { toLocalDateString } from "../src/engine/autoregulation";
import { applyRestrictionsToBasePlan } from "../src/engine/generator";
import { useEngineResult } from "../src/hooks/useEngineResult";
import { buildSessionView } from "../src/lib/session";
import { powerBanner, powerLevel } from "../src/lib/power";
import { tapHeavy, tapSuccess } from "../src/lib/haptics";
import { TRAINING_GOAL_LABELS } from "../src/lib/format";
import { ADULT_ATTENTION_MESSAGE } from "../src/lib/status";
import { DEFAULT_BASE_PLAN } from "../src/plans/basePlan";
import { useAppStore } from "../src/stores/useAppStore";

/**
 * Daily Game Plan detail (live session cockpit): intensity multiplier banner
 * up top (e.g. "100% Full Send" / "60% Power Save"), the same checkable list
 * as Home (state is shared through the store), and the Finish CTA. This
 * screen never invents exercises — it renders the generator's output
 * (AGENTS.md decoupling).
 */
export default function Workout() {
  const router = useRouter();
  const { result, stripOptional, hasCheckedInToday } = useEngineResult();
  const profile = useAppStore((state) => state.profile);
  const trainingObjective = useAppStore((state) => state.trainingObjective);
  const workoutProgress = useAppStore((state) => state.workoutProgress);
  const toggleComponentDone = useAppStore((state) => state.toggleComponentDone);
  const recordWorkoutLog = useAppStore((state) => state.recordWorkoutLog);
  const workoutLogs = useAppStore((state) => state.workoutLogs);

  const localToday = toLocalDateString(new Date(), profile.timezone);
  const prescription = applyRestrictionsToBasePlan(DEFAULT_BASE_PLAN, result.restrictions, {
    stripOptional,
  });
  const session = buildSessionView(prescription, workoutProgress[localToday] ?? {});
  const power = powerLevel(result);
  const hasWorkoutLogToday = workoutLogs.some((entry) => entry.activityDate === localToday);

  const finish = () => {
    tapHeavy();
    tapSuccess();
    recordWorkoutLog({ activityDate: localToday, notes: undefined });
    router.navigate("/practice-log");
  };

  return (
    <ScrollView className="flex-1 bg-slate-900" contentContainerClassName="gap-4 p-4">
      <PowerGauge
        percent={power.percent}
        tone={power.tone}
        label={power.label}
        sublabel={hasWorkoutLogToday ? "Session complete ✓" : undefined}
      />
      <Text className="text-center text-2xl font-black text-slate-50">
        {powerBanner(power)}
      </Text>

      <StatusBanner status={result.status} reasons={result.reasons} />

      <Text className="text-center text-lg font-black text-slate-50">Today's Game Plan</Text>

      {hasCheckedInToday ? null : (
        <Text className="rounded-xl bg-slate-800 px-3 py-2 text-center text-xs text-slate-400">
          Showing the unscaled base plan — check in to scale it to your day.
        </Text>
      )}

      <View className="rounded-2xl bg-slate-800 border border-slate-700 p-4">
        <Text className="text-xs font-bold uppercase tracking-widest text-slate-400">
          Focus
        </Text>
        <Text className="mt-1 text-lg font-black text-slate-50">
          {trainingObjective.primaryGoals.map((goal) => TRAINING_GOAL_LABELS[goal]).join(" · ")}
        </Text>
        <Text className="mt-1 text-xs text-slate-400">
          Quality over volume — the plan protects the high/low balance.
        </Text>
      </View>

      {hasWorkoutLogToday ? (
        <Text className="rounded-xl bg-green-500/10 px-3 py-2 text-sm font-semibold text-green-300">
          Session complete 🎉
        </Text>
      ) : (
        <Text className="text-xs text-slate-400">
          Check off each block as you go. Logging an activity updates the
          remaining volume automatically 🔄
        </Text>
      )}

      <SessionChecklist
        view={session}
        finished={hasWorkoutLogToday}
        onToggle={(componentId, sets) => toggleComponentDone(localToday, componentId, sets)}
      />

      {session.finishable && !hasWorkoutLogToday ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Finish workout"
          onPress={finish}
          className="h-14 items-center justify-center rounded-xl bg-green-500"
        >
          <Text className="text-base font-black text-slate-950">Finish workout 🏁</Text>
        </Pressable>
      ) : null}

      {session.skippedCount > 0 ? (
        <View className="rounded-xl border border-slate-700 bg-slate-800 p-3">
          <Text className="text-sm font-bold text-slate-100">
            Why the plan looks like this
          </Text>
          <Text className="mt-1 text-xs text-slate-400">
            {session.skippedCount === 1
              ? "1 block was adjusted out today."
              : `${session.skippedCount} blocks were adjusted out today.`}{" "}
            The engine only pauses training — it never pushes through pain.
          </Text>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={() => router.navigate("/practice-log")}
        className="h-14 items-center justify-center rounded-xl border-2 border-slate-700 bg-slate-800"
      >
        <Text className="text-base font-bold text-slate-100">📝 Log an activity</Text>
      </Pressable>

      {result.requiresAdultAttention ? (
        <View className="rounded-2xl border-2 border-red-500/40 bg-slate-800 p-4">
          <Text className="text-sm font-semibold text-red-300">{ADULT_ATTENTION_MESSAGE}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}
