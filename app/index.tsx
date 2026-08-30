import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { StatusBanner } from "../src/components/StatusBanner";
import { applyRestrictionsToBasePlan } from "../src/engine/generator";
import { useEngineResult } from "../src/hooks/useEngineResult";
import { nextUpcomingEvents, SCHEDULED_EVENT_LABELS } from "../src/lib/format";
import { ADULT_ATTENTION_MESSAGE } from "../src/lib/status";
import { DEFAULT_BASE_PLAN } from "../src/plans/basePlan";
import { useAppStore } from "../src/stores/useAppStore";

/**
 * Dashboard (FLOW 4.1, SPEC §27): engine status banner, recommendation
 * summary, today's session summary, upcoming event reminders, action cards.
 * GREEN can never display without today's check-in — the derived engine input
 * omits stale/missing check-ins, and the engine resolves that to
 * CHECKIN_REQUIRED (SPEC §27 rule).
 */
export default function Index() {
  const router = useRouter();
  const { result, today, hasCheckedInToday } = useEngineResult();
  const scheduledEvents = useAppStore((state) => state.scheduledEvents);

  const now = new Date();
  const prescription = applyRestrictionsToBasePlan(DEFAULT_BASE_PLAN, result.restrictions);
  const kept = prescription.filter((entry) => entry.modification === "KEPT").length;
  const reduced = prescription.filter((entry) => entry.modification === "REDUCED").length;
  const removed = prescription.filter((entry) => entry.modification === "REMOVED").length;

  const upcoming = nextUpcomingEvents(scheduledEvents, now, 3);
  const nextGame = upcoming.find((view) => view.event.eventType === "GAME");

  return (
    <ScrollView className="flex-1 bg-slate-100" contentContainerClassName="gap-4 p-4">
      <View>
        <Text className="text-3xl font-bold text-slate-900">Vikai</Text>
        <Text className="mt-1 text-sm text-slate-500">Today · {today}</Text>
      </View>

      <StatusBanner status={result.status} reasons={result.reasons} />

      {result.requiresAdultAttention ? (
        <View className="rounded-2xl border-2 border-red-300 bg-white p-4">
          <Text className="text-sm font-semibold text-red-700">{ADULT_ATTENTION_MESSAGE}</Text>
        </View>
      ) : null}

      {nextGame ? (
        <View className="rounded-2xl bg-white p-4">
          <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Next game
          </Text>
          <Text className="mt-1 text-lg font-bold text-slate-900">{nextGame.countdown}</Text>
          <Text className="text-sm text-slate-500">
            Fresh legs win games — protect them today.
          </Text>
        </View>
      ) : null}

      {upcoming.length > 0 ? (
        <View className="rounded-2xl bg-white p-4">
          <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Upcoming
          </Text>
          {upcoming.map((view) => (
            <View key={view.event.id} className="mt-2 flex-row items-center justify-between">
              <Text className="text-sm font-semibold text-slate-800">
                {SCHEDULED_EVENT_LABELS[view.event.eventType]}
              </Text>
              <Text className="text-sm text-slate-500">{view.countdown}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View className="rounded-2xl bg-white p-4">
        <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Today's session
        </Text>
        <Text className="mt-1 text-sm text-slate-700">
          {kept} kept · {reduced} reduced · {removed} removed
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.navigate("/workout")}
          className="mt-3 h-12 items-center justify-center rounded-xl bg-sky-600"
        >
          <Text className="text-sm font-bold text-white">View today's workout</Text>
        </Pressable>
      </View>

      <View className="gap-2">
        <ActionCard
          label="Daily check-in"
          hint={hasCheckedInToday ? "Completed for today" : "Unlock your status"}
          emphasized={result.status === "CHECKIN_REQUIRED"}
          onPress={() => router.navigate("/checkin")}
        />
        <ActionCard
          label="Log activity"
          hint="Practices, games, sessions"
          onPress={() => router.navigate("/activity-log")}
        />
      </View>
    </ScrollView>
  );
}

interface ActionCardProps {
  label: string;
  hint: string;
  onPress: () => void;
  emphasized?: boolean;
}

function ActionCard({ label, hint, onPress, emphasized = false }: ActionCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`min-h-[64px] flex-row items-center justify-between rounded-2xl border-2 bg-white p-4 ${
        emphasized ? "border-amber-400" : "border-transparent"
      }`}
    >
      <View>
        <Text className="text-base font-bold text-slate-900">{label}</Text>
        <Text className="text-sm text-slate-500">{hint}</Text>
      </View>
      <Text className="text-xl text-slate-400">›</Text>
    </Pressable>
  );
}
