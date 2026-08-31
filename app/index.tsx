import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { DayStepper } from "../src/components/DayStepper";
import { PowerGauge } from "../src/components/PowerGauge";
import { StatusBanner } from "../src/components/StatusBanner";
import { applyRestrictionsToBasePlan } from "../src/engine/generator";
import { toLocalDateString } from "../src/engine/autoregulation";
import { useEngineResult } from "../src/hooks/useEngineResult";
import { nextUpcomingEvents, SCHEDULED_EVENT_LABELS } from "../src/lib/format";
import { todaySteps } from "../src/lib/flow";
import { checkInStreak, powerLevel } from "../src/lib/power";
import { ADULT_ATTENTION_MESSAGE } from "../src/lib/status";
import { DEFAULT_BASE_PLAN } from "../src/plans/basePlan";
import { useAppStore } from "../src/stores/useAppStore";

/**
 * Home Hub (guided flow): power gauge, streak, and the "Your Day" stepper —
 * the single sequence that carries the athlete from check-in to the Game
 * Plan to logging. GREEN can never display without today's check-in — the
 * derived engine input omits stale/missing check-ins, and the engine
 * resolves that to CHECKIN_REQUIRED (SPEC §27 rule).
 */
export default function Index() {
  const router = useRouter();
  const { result, today, hasCheckedInToday, stripOptional } = useEngineResult();
  const scheduledEvents = useAppStore((state) => state.scheduledEvents);
  const readinessInputs = useAppStore((state) => state.readinessInputs);
  const workoutLogs = useAppStore((state) => state.workoutLogs);
  const gamePlanViewedOn = useAppStore((state) => state.gamePlanViewedOn);

  const now = new Date();
  const prescription = applyRestrictionsToBasePlan(DEFAULT_BASE_PLAN, result.restrictions, {
    stripOptional,
  });
  const kept = prescription.filter((entry) => entry.modification === "KEPT").length;
  const reduced = prescription.filter((entry) => entry.modification === "REDUCED").length;
  const removed = prescription.filter((entry) => entry.modification === "REMOVED").length;

  const power = powerLevel(result);
  const localToday = toLocalDateString(now, "America/New_York");
  const streak = checkInStreak(readinessInputs, localToday);
  const hasWorkoutLogToday = workoutLogs.some((entry) => entry.activityDate === localToday);
  const steps = todaySteps({
    hasCheckedInToday,
    gamePlanViewedOn,
    hasWorkoutLogToday,
    today: localToday,
  });

  const upcoming = nextUpcomingEvents(scheduledEvents, now, 3);
  const nextGame = upcoming.find((view) => view.event.eventType === "GAME");

  return (
    <ScrollView className="flex-1 bg-slate-900" contentContainerClassName="gap-4 p-4">
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-3xl font-black text-slate-50">Vikai</Text>
          <Text className="mt-1 text-sm text-slate-400">Today · {today}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open calendar"
          onPress={() => router.navigate("/history")}
          className="rounded-full border border-orange-500/40 bg-orange-500/15 px-4 py-2"
        >
          <Text className="text-sm font-bold text-orange-300">🔥 {streak}-day streak</Text>
        </Pressable>
      </View>

      <PowerGauge
        percent={power.percent}
        tone={power.tone}
        label={power.label}
        sublabel={hasCheckedInToday ? "Checked in ✓" : "Check-in pending"}
      />

      <StatusBanner status={result.status} reasons={result.reasons} />

      <DayStepper
        steps={steps}
        gamePlanSummary={`${kept} kept · ${reduced} reduced · ${removed} removed`}
        onStepPress={(_id, route) => router.navigate(route)}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open calendar"
        onPress={() => router.navigate("/history")}
        className="min-h-[64px] flex-row items-center gap-3 rounded-2xl border-2 border-slate-700 bg-slate-800 p-4"
      >
        <Text className="text-3xl">📅</Text>
        <View className="flex-1">
          <Text className="text-base font-bold text-slate-50">Calendar</Text>
          <Text className="text-sm text-slate-400">Past sessions & upcoming games</Text>
        </View>
        <Text className="text-xl text-slate-500">›</Text>
      </Pressable>

      {nextGame ? (
        <View className="rounded-2xl bg-slate-800 border border-slate-700 p-4">
          <Text className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Next game
          </Text>
          <Text className="mt-1 text-lg font-black text-slate-50">{nextGame.countdown}</Text>
          <Text className="text-sm text-slate-400">
            Fresh legs win games — protect them today.
          </Text>
        </View>
      ) : null}

      {upcoming.length > 0 ? (
        <View className="rounded-2xl bg-slate-800 border border-slate-700 p-4">
          <Text className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Upcoming
          </Text>
          {upcoming.map((view) => (
            <View key={view.event.id} className="mt-2 flex-row items-center justify-between">
              <Text className="text-sm font-semibold text-slate-100">
                {SCHEDULED_EVENT_LABELS[view.event.eventType]}
              </Text>
              <Text className="text-sm text-slate-400">{view.countdown}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {result.requiresAdultAttention ? (
        <View className="rounded-2xl border-2 border-red-500/40 bg-slate-800 p-4">
          <Text className="text-sm font-semibold text-red-300">{ADULT_ATTENTION_MESSAGE}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}
