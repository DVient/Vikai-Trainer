import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { DayStepper } from "../src/components/DayStepper";
import { PowerGauge } from "../src/components/PowerGauge";
import { ReminderStatusChip } from "../src/components/ReminderStatusChip";
import { SessionChecklist } from "../src/components/SessionChecklist";
import { StatusBanner } from "../src/components/StatusBanner";
import { applyRestrictionsToBasePlan } from "../src/engine/generator";
import { toLocalDateString } from "../src/engine/autoregulation";
import { useEngineResult } from "../src/hooks/useEngineResult";
import { nextUpcomingEvents, SCHEDULED_EVENT_LABELS } from "../src/lib/format";
import { todaySteps } from "../src/lib/flow";
import { buildSessionView } from "../src/lib/session";
import { formatTimeOfDay } from "../src/lib/calendar";
import { checkInStreak, powerLevel } from "../src/lib/power";
import { tapHeavy, tapSuccess } from "../src/lib/haptics";
import { ADULT_ATTENTION_MESSAGE } from "../src/lib/status";
import { DEFAULT_BASE_PLAN } from "../src/plans/basePlan";
import { useAppStore } from "../src/stores/useAppStore";

/**
 * Home Hub (live session cockpit): the Ready State battery and today's full
 * Game Plan live together. The athlete checks off components as they do
 * them; logging an activity mid-session re-derives restrictions and the
 * remaining rows re-scale in place — completed ones keep credit. GREEN can
 * never display without today's check-in (SPEC §27 rule).
 */
export default function Index() {
  const router = useRouter();
  const { result, today, hasCheckedInToday, stripOptional } = useEngineResult();
  const scheduledEvents = useAppStore((state) => state.scheduledEvents);
  const readinessInputs = useAppStore((state) => state.readinessInputs);
  const activityLogs = useAppStore((state) => state.activityLogs);
  const workoutLogs = useAppStore((state) => state.workoutLogs);
  const workoutProgress = useAppStore((state) => state.workoutProgress);
  const toggleComponentDone = useAppStore((state) => state.toggleComponentDone);
  const recordWorkoutLog = useAppStore((state) => state.recordWorkoutLog);
  const profile = useAppStore((state) => state.profile);

  const now = new Date();
  const localToday = toLocalDateString(now, profile.timezone);
  const prescription = applyRestrictionsToBasePlan(DEFAULT_BASE_PLAN, result.restrictions, {
    stripOptional,
  });
  const session = buildSessionView(prescription, workoutProgress[localToday] ?? {});
  const power = powerLevel(result);
  const streak = checkInStreak(readinessInputs, localToday);

  const hasWorkoutLogToday = workoutLogs.some((entry) => entry.activityDate === localToday);
  const hasLoggedActivityToday = activityLogs.some(
    (entry) => entry.activityDate === localToday,
  );
  const steps = todaySteps({
    hasCheckedInToday,
    hasWorkoutLogToday,
    hasLoggedActivityToday,
  });

  const latestCheckIn = [...readinessInputs]
    .filter((entry) => entry.localDate === localToday)
    .at(-1);
  const upcoming = nextUpcomingEvents(scheduledEvents, now, 3);
  const nextGame = upcoming.find((view) => view.event.eventType === "GAME");

  const finish = () => {
    tapHeavy();
    tapSuccess();
    recordWorkoutLog({ activityDate: localToday, notes: undefined });
    router.navigate("/practice-log");
  };
  return (
    <ScrollView
      className="flex-1 bg-slate-900"
      contentContainerClassName="w-full max-w-md self-center gap-4 p-4"
    >
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-3xl font-black text-slate-50">Vikai Trainer</Text>
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

      <ReminderStatusChip />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open check-in"
        onPress={() => router.navigate("/checkin")}
        className={`min-h-[64px] flex-row items-center gap-3 rounded-2xl border-2 p-4 ${
          hasCheckedInToday
            ? "border-green-500/40 bg-green-500/10"
            : "border-green-500/60 bg-green-500/10"
        }`}
      >
        <Text className="text-2xl">{hasCheckedInToday ? "✅" : "😴"}</Text>
        <View className="flex-1">
          <Text className="text-sm font-bold text-slate-50">
            {hasCheckedInToday ? "Checked in" : "Check in first"}
          </Text>
          <Text className="text-xs text-slate-400">
            {hasCheckedInToday && latestCheckIn
              ? `${formatTimeOfDay(latestCheckIn.recordedAt, profile.timezone)} — update if anything changed`
              : "Three taps. Unlocks today's plan."}
          </Text>
        </View>
        <Text className="text-xl text-slate-500">›</Text>
      </Pressable>

      <DayStepper steps={steps} onStepPress={(_id, route) => router.navigate(route)} />

      <View className="rounded-2xl border border-slate-700 bg-slate-800 p-4 gap-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-base font-black text-slate-50">Today's Game Plan</Text>
          <Text className="text-xs font-semibold text-slate-400">
            {session.doneCount}/{session.doneCount + session.remainingCount} checked off
          </Text>
        </View>

        {hasWorkoutLogToday ? (
          <Text className="rounded-xl bg-green-500/10 px-3 py-2 text-sm font-semibold text-green-300">
            Session complete 🎉
          </Text>
        ) : (
          <Text className="text-xs text-slate-400">
            Check off each block as you go. Logs update the remaining volume
            automatically 🔄
          </Text>
        )}

        <SessionChecklist
          view={session}
          finished={hasWorkoutLogToday}
          localDate={localToday}
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
      </View>

      <View className="flex-row gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Log an activity"
          onPress={() => router.navigate("/practice-log")}
          className="min-h-[64px] flex-1 items-center justify-center rounded-2xl border-2 border-slate-700 bg-slate-800 p-3"
        >
          <Text className="text-2xl">📝</Text>
          <Text className="text-sm font-bold text-slate-50">Log activity</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open full plan"
          onPress={() => router.navigate("/workout")}
          className="min-h-[64px] flex-1 items-center justify-center rounded-2xl border-2 border-slate-700 bg-slate-800 p-3"
        >
          <Text className="text-2xl">📋</Text>
          <Text className="text-sm font-bold text-slate-50">Full plan</Text>
        </Pressable>
      </View>

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

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open calendar"
        onPress={() => router.navigate("/history")}
        className="min-h-[64px] flex-row items-center gap-3 rounded-2xl border-2 border-slate-700 bg-slate-800 p-4"
      >
        <Text className="text-3xl">📅</Text>
        <View className="flex-1">
          <Text className="text-base font-bold text-slate-50">Calendar</Text>
          <Text className="text-sm text-slate-400">Past sessions & upcoming events</Text>
        </View>
        <Text className="text-xl text-slate-500">›</Text>
      </Pressable>

      {result.requiresAdultAttention ? (
        <View className="rounded-2xl border-2 border-red-500/40 bg-slate-800 p-4">
          <Text className="text-sm font-semibold text-red-300">{ADULT_ATTENTION_MESSAGE}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}
