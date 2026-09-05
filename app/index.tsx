import { Stack, useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { DayStepper } from "../src/components/DayStepper";
import { PowerGauge } from "../src/components/PowerGauge";
import { ReminderStatusChip } from "../src/components/ReminderStatusChip";
import { applyRestrictionsToBasePlan } from "../src/engine/generator";
import { toLocalDateString } from "../src/engine/autoregulation";
import { useEngineResult } from "../src/hooks/useEngineResult";
import { nextUpcomingEvents, SCHEDULED_EVENT_LABELS } from "../src/lib/format";
import { todaySteps } from "../src/lib/flow";
import { buildSessionView } from "../src/lib/session";
import { formatTimeOfDay } from "../src/lib/calendar";
import { partitionActivities } from "../src/lib/activityTiming";
import { checkInStreak, powerLevel } from "../src/lib/power";
import { soreAreaLabel } from "../src/lib/bodyMap";
import { tapHeavy, tapLight, tapSuccess } from "../src/lib/haptics";
import { ADULT_ATTENTION_MESSAGE } from "../src/lib/status";
import { computePerformanceScales } from "../src/plans/adherence";
import { BASE_PLAN_TITLES, defaultPlanForDate } from "../src/plans/basePlan";
import { activePlanForDay, planPhaseLabel, planStatus, weekIndexOf } from "../src/plans/planBuilder";
import { libraryBlockById } from "../src/plans/library";
import { personaById } from "../src/plans/personas";
import { useAppStore } from "../src/stores/useAppStore";
import { isSoreArea } from "../src/types";

/**
 * Home Hub: the Ready State battery, the guided day flow, the athlete's
 * plan, and a compact Game Plan summary that opens the full session on
 * /workout — where blocks are checked off and logging mid-session re-scales
 * the remaining rows. The battery alone carries the engine state (GO /
 * Power Save / Shielded); reason chips live on the session screen where
 * the athlete acts on them. GREEN can never display without today's
 * check-in (SPEC §27 rule).
 */
export default function Index() {
  const router = useRouter();
  const { result, today, hasCheckedInToday, stripOptional } = useEngineResult();
  const scheduledEvents = useAppStore((state) => state.scheduledEvents);
  const readinessInputs = useAppStore((state) => state.readinessInputs);
  const activityLogs = useAppStore((state) => state.activityLogs);
  const workoutLogs = useAppStore((state) => state.workoutLogs);
  const workoutProgress = useAppStore((state) => state.workoutProgress);
  const recordWorkoutLog = useAppStore((state) => state.recordWorkoutLog);
  const profile = useAppStore((state) => state.profile);
  const trainingObjective = useAppStore((state) => state.trainingObjective);
  const activePlan = useAppStore((state) => state.activePlan);
  const clearTrainingPlan = useAppStore((state) => state.clearTrainingPlan);

  const now = new Date();
  const localToday = toLocalDateString(now, profile.timezone);
  // Built plans replace the default template; no plan ⇒ exactly today's
  // default 9-block behavior.
  const basePlan = activePlan ? activePlanForDay(activePlan, localToday) : defaultPlanForDate(localToday);
  const prescription = applyRestrictionsToBasePlan(basePlan, result.restrictions, {
    stripOptional,
    primaryGoals: trainingObjective.primaryGoals,
    // Phase 8.3 — comfort-effort categories auto-scale from completion history.
    performanceScales: computePerformanceScales(activePlan, workoutLogs, workoutProgress, localToday),
  });
  const session = buildSessionView(prescription, workoutProgress[localToday] ?? {});
  const power = powerLevel(result);
  const streak = checkInStreak(readinessInputs, localToday);

  const hasWorkoutLogToday = workoutLogs.some((entry) => entry.activityDate === localToday);
  const activityPartition = partitionActivities(activityLogs, workoutLogs, localToday);
  const steps = todaySteps({
    hasCheckedInToday,
    hasWorkoutLogToday,
    activityPartition,
  });

  const latestCheckIn = [...readinessInputs]
    .filter((entry) => entry.localDate === localToday)
    .at(-1);
  const upcoming = nextUpcomingEvents(scheduledEvents, now, 3);
  const nextGame = upcoming.find((view) => view.event.eventType === "GAME");
  const soreAreasToday = Object.keys(result.restrictions.sorenessScale ?? {}).filter(isSoreArea);

  const finish = () => {
    tapHeavy();
    tapSuccess();
    recordWorkoutLog({ activityDate: localToday, notes: undefined });
    router.navigate("/practice-log");
  };

  // The summary card names the next block to do — same title resolution
  // the session screen's checklist uses.
  const nextUp = session.rows.find((row) => row.state === "remaining");
  const nextUpTitle =
    nextUp !== undefined
      ? (BASE_PLAN_TITLES[nextUp.componentId] ??
        libraryBlockById(nextUp.componentId)?.title ??
        nextUp.componentId)
      : undefined;
  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View className="flex-row">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Team skin settings"
                onPress={() => {
                  tapLight();
                  router.navigate("/settings");
                }}
                className="h-12 w-12 items-center justify-center"
                hitSlop={6}
              >
                <Text className="text-2xl">⚙️</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="How this app works"
                onPress={() => {
                  tapLight();
                  router.navigate("/about");
                }}
                className="h-12 w-12 items-center justify-center"
                hitSlop={6}
              >
                <Text className="text-2xl">❓</Text>
              </Pressable>
            </View>
          ),
        }}
      />
      <ScrollView
        className="flex-1 bg-app"
      contentContainerClassName="w-full max-w-md self-center gap-4 p-4"
    >
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-3xl font-black text-strong">Vikai Trainer</Text>
          <Text className="mt-1 text-sm text-faint">Today · {today}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open calendar"
          onPress={() => router.navigate("/history")}
          className="rounded-full border border-modulate-line bg-modulate-soft px-4 py-2"
        >
          <Text className="text-sm font-bold text-modulate">🔥 {streak}-day streak</Text>
        </Pressable>
      </View>

      <PowerGauge
        percent={power.percent}
        tone={power.tone}
        label={power.label}
        sublabel={hasCheckedInToday ? "Checked in ✓" : "Check-in pending"}
      />

      {result.requiresAdultAttention ? (
        <View className="rounded-2xl border-2 border-shield-line bg-card p-4">
          <Text className="text-sm font-semibold text-shield">{ADULT_ATTENTION_MESSAGE}</Text>
        </View>
      ) : null}

      <ReminderStatusChip />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open check-in"
        onPress={() => router.navigate("/checkin")}
        className={`min-h-[64px] flex-row items-center gap-3 rounded-2xl border-2 p-4 ${
          hasCheckedInToday
            ? "border-go-line bg-go-soft"
            : "border-go-line bg-go-soft"
        }`}
      >
        <Text className="text-2xl">{hasCheckedInToday ? "✅" : "😴"}</Text>
        <View className="flex-1">
          <Text className="text-sm font-bold text-strong">
            {hasCheckedInToday ? "Checked in" : "Check in first"}
          </Text>
          <Text className="text-xs text-faint">
            {hasCheckedInToday && latestCheckIn
              ? `${formatTimeOfDay(latestCheckIn.recordedAt, profile.timezone)} — update if anything changed`
              : "Three taps. Unlocks today's plan."}
          </Text>
        </View>
        <Text className="text-xl text-faint">›</Text>
      </Pressable>

      <DayStepper steps={steps} onStepPress={(_id, route) => router.navigate(route)} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open my plan"
        onPress={() => {
          tapLight();
          router.navigate("/plan");
        }}
        className={
          activePlan !== null
            ? "min-h-[64px] flex-row items-center gap-3 rounded-2xl border-2 border-go-line bg-go-soft p-4"
            : "min-h-[64px] flex-row items-center gap-3 rounded-2xl border-2 border-edge bg-card p-4"
        }
      >
        <Text className="text-3xl">🎯</Text>
        <View className="flex-1">
          <Text className="text-base font-bold text-strong">
            {activePlan !== null
              ? `${personaById(activePlan.personaId ?? "ALL_ROUND")?.label ?? "Custom plan"}`
              : "My Plan"}
          </Text>
          <Text className="text-sm text-faint">
            {activePlan !== null
              ? `${planPhaseLabel(activePlan, localToday)} · Week ${Math.min(weekIndexOf(activePlan, localToday) + 1, activePlan.periodWeeks)} of ${activePlan.periodWeeks}`
              : "Build a plan around your goal"}
          </Text>
        </View>
        <Text className="text-xl text-faint">›</Text>
      </Pressable>

      {activePlan !== null && planStatus(activePlan, localToday) === "final-week" ? (
        <View className="rounded-2xl border border-modulate-line bg-modulate-soft p-4">
          <Text className="text-sm font-semibold text-modulate">
            Last week of your plan — record fresh test results so your next plan
            starts from reality.
          </Text>
        </View>
      ) : null}

      {activePlan !== null && planStatus(activePlan, localToday) === "ended" ? (
        <View className="rounded-2xl border-2 border-go-line bg-go-soft p-4">
          <Text className="text-base font-bold text-go">
            Your {activePlan.periodWeeks}-week plan is complete 🎉
          </Text>
          <Text className="mt-1 text-sm text-body">
            Ready for the next one? Set a new goal and the app will build your
            next plan from everything you just did.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Set a new goal"
            onPress={() => {
              tapLight();
              router.navigate("/plan");
            }}
            className="mt-3 h-12 items-center justify-center rounded-xl bg-accent"
          >
            <Text className="text-sm font-black text-onaccent">Set a new goal 🎯</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reset to default plan"
            onPress={() => {
              tapLight();
              clearTrainingPlan();
            }}
            className="mt-2 h-12 items-center justify-center rounded-xl border-2 border-edge bg-card"
          >
            <Text className="text-sm font-bold text-body">Reset to default plan</Text>
          </Pressable>
        </View>
      ) : null}

      <View className="rounded-2xl border border-edge bg-card p-4 gap-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-base font-black text-strong">Today's Game Plan</Text>
          <Text className="text-xs font-semibold text-faint">
            {session.doneCount}/{session.doneCount + session.remainingCount} checked off
          </Text>
        </View>

        {hasWorkoutLogToday ? (
          <>
            <Text className="rounded-xl bg-go-soft px-3 py-2 text-sm font-semibold text-go">
              Session complete 🎉
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open practice log"
              onPress={() => {
                tapLight();
                router.navigate("/practice-log");
              }}
              className="h-12 items-center justify-center rounded-xl border-2 border-edge bg-card"
            >
              <Text className="text-sm font-bold text-strong">
                Log how it went 📝
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            {nextUpTitle !== undefined ? (
              <Text className="text-sm text-body">
                Up next: <Text className="font-bold text-strong">{nextUpTitle}</Text>
                {session.remainingCount > 1
                  ? ` · ${session.remainingCount} blocks to go`
                  : ""}
              </Text>
            ) : null}
            {session.skippedCount > 0 ? (
              <Text className="text-xs text-faint">
                {session.skippedCount === 1
                  ? "1 block adjusted out today"
                  : `${session.skippedCount} blocks adjusted out today`}{" "}
                — the session screen shows why.
              </Text>
            ) : null}
            {result.reasons.includes("SORENESS_FLAGGED") && soreAreasToday.length > 0 ? (
              <Text className="text-xs text-modulate">
                Sore today: {soreAreasToday.map(soreAreaLabel).join(", ")} — those blocks are
                scaled.
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open today's session"
              onPress={() => {
                tapLight();
                router.navigate("/workout");
              }}
              className="h-14 items-center justify-center rounded-xl bg-accent"
            >
              <Text className="text-base font-black text-onaccent">
                Open today's session →
              </Text>
            </Pressable>
          </>
        )}

        {session.finishable && !hasWorkoutLogToday ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Finish workout"
            onPress={finish}
            className="h-14 items-center justify-center rounded-xl border-2 border-accent bg-go-soft"
          >
            <Text className="text-base font-black text-go">Finish workout 🏁</Text>
          </Pressable>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Log an activity"
        onPress={() => router.navigate("/practice-log")}
        className="min-h-[64px] flex-row items-center gap-3 rounded-2xl border-2 border-edge bg-card p-4"
      >
        <Text className="text-2xl">📝</Text>
        <View className="flex-1">
          <Text className="text-sm font-bold text-strong">Log activity</Text>
          <Text className="text-xs text-faint">
            What you did shapes today's volume — and your next workout
          </Text>
        </View>
        <Text className="text-xl text-faint">›</Text>
      </Pressable>

      {upcoming.length > 0 ? (
        <View className="rounded-2xl bg-card border border-edge p-4">
          {nextGame ? (
            <View className="mb-1">
              <Text className="text-xs font-bold uppercase tracking-widest text-faint">
                Next game
              </Text>
              <Text className="mt-0.5 text-lg font-black text-strong">
                {nextGame.countdown}
              </Text>
              <Text className="text-sm text-faint">
                Fresh legs win games — protect them today.
              </Text>
            </View>
          ) : null}
          <Text className="text-xs font-bold uppercase tracking-widest text-faint">
            Upcoming
          </Text>
          {upcoming.map((view) => (
            <Pressable
              key={view.event.id}
              accessibilityRole="button"
              accessibilityLabel={`Edit event: ${SCHEDULED_EVENT_LABELS[view.event.eventType]}`}
              onPress={() => {
                tapLight();
                router.navigate(`/event-form?eventId=${view.event.id}`);
              }}
              className="min-h-[48px] mt-1 flex-row items-center justify-between"
            >
              <Text className="text-sm font-semibold text-strong">
                {SCHEDULED_EVENT_LABELS[view.event.eventType]}
              </Text>
              <View className="flex-row items-center gap-2">
                <Text
                  className={`text-sm ${
                    view.event.eventType === "GAME"
                      ? "font-bold text-modulate"
                      : "text-faint"
                  }`}
                >
                  {view.countdown}
                </Text>
                <Text className="text-sm text-faint">›</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open calendar"
        onPress={() => router.navigate("/history")}
        className="min-h-[64px] flex-row items-center gap-3 rounded-2xl border-2 border-edge bg-card p-4"
      >
        <Text className="text-3xl">📅</Text>
        <View className="flex-1">
          <Text className="text-base font-bold text-strong">Calendar</Text>
          <Text className="text-sm text-faint">Past sessions & upcoming events</Text>
        </View>
        <Text className="text-xl text-faint">›</Text>
      </Pressable>
    </ScrollView>
    </>
  );
}
