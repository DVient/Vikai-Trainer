import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { PowerGauge } from "../src/components/PowerGauge";
import { StatusBanner } from "../src/components/StatusBanner";
import { applyRestrictionsToBasePlan } from "../src/engine/generator";
import { toLocalDateString } from "../src/engine/autoregulation";
import { useEngineResult } from "../src/hooks/useEngineResult";
import { nextUpcomingEvents, SCHEDULED_EVENT_LABELS } from "../src/lib/format";
import { checkInStreak, powerLevel } from "../src/lib/power";
import { ADULT_ATTENTION_MESSAGE } from "../src/lib/status";
import { DEFAULT_BASE_PLAN } from "../src/plans/basePlan";
import { useAppStore } from "../src/stores/useAppStore";

/**
 * Home Hub (design refresh): power gauge (daily readiness battery), streak
 * counter, large action cards. GREEN can never display without today's
 * check-in — the derived engine input omits stale/missing check-ins, and the
 * engine resolves that to CHECKIN_REQUIRED (SPEC §27 rule).
 */
export default function Index() {
  const router = useRouter();
  const { result, today, hasCheckedInToday, stripOptional } = useEngineResult();
  const scheduledEvents = useAppStore((state) => state.scheduledEvents);
  const readinessInputs = useAppStore((state) => state.readinessInputs);

  const now = new Date();
  const prescription = applyRestrictionsToBasePlan(DEFAULT_BASE_PLAN, result.restrictions, {
    stripOptional,
  });
  const kept = prescription.filter((entry) => entry.modification === "KEPT").length;
  const reduced = prescription.filter((entry) => entry.modification === "REDUCED").length;
  const removed = prescription.filter((entry) => entry.modification === "REMOVED").length;

  const power = powerLevel(result);
  const streak = checkInStreak(readinessInputs, toLocalDateString(now, "America/New_York"));

  const upcoming = nextUpcomingEvents(scheduledEvents, now, 3);
  const nextGame = upcoming.find((view) => view.event.eventType === "GAME");

  return (
    <ScrollView className="flex-1 bg-slate-900" contentContainerClassName="gap-4 p-4">
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-3xl font-black text-slate-50">Vikai</Text>
          <Text className="mt-1 text-sm text-slate-400">Today · {today}</Text>
        </View>
        <View className="rounded-full border border-orange-500/40 bg-orange-500/15 px-4 py-2">
          <Text className="text-sm font-bold text-orange-300">🔥 {streak}-day streak</Text>
        </View>
      </View>

      <PowerGauge
        percent={power.percent}
        tone={power.tone}
        label={power.label}
        sublabel={hasCheckedInToday ? "Checked in ✓" : "Check-in pending"}
      />

      <StatusBanner status={result.status} reasons={result.reasons} />

      {result.requiresAdultAttention ? (
        <View className="rounded-2xl border-2 border-red-500/40 bg-slate-800 p-4">
          <Text className="text-sm font-semibold text-red-300">{ADULT_ATTENTION_MESSAGE}</Text>
        </View>
      ) : null}

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

      <View className="rounded-2xl bg-slate-800 border border-slate-700 p-4">
        <Text className="text-xs font-bold uppercase tracking-widest text-slate-400">
          Today's Game Plan
        </Text>
        <Text className="mt-1 text-sm text-slate-300">
          {kept} kept · {reduced} reduced · {removed} removed
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.navigate("/workout")}
          className="mt-3 h-14 items-center justify-center rounded-xl bg-green-500"
        >
          <Text className="text-base font-black text-slate-950">Open Game Plan 🏀</Text>
        </Pressable>
      </View>

      <View className="gap-3">
        <ActionCard
          emoji="😴"
          label="3-Tap Check-In"
          hint={hasCheckedInToday ? "Done for today ✓" : "Unlock your power — under 5 sec"}
          emphasized={result.status === "CHECKIN_REQUIRED"}
          onPress={() => router.navigate("/checkin")}
        />
        <ActionCard
          emoji="📝"
          label="Practice Log"
          hint="Practices, games, sessions"
          onPress={() => router.navigate("/practice-log")}
        />
      </View>
    </ScrollView>
  );
}

interface ActionCardProps {
  emoji: string;
  label: string;
  hint: string;
  onPress: () => void;
  emphasized?: boolean;
}

function ActionCard({ emoji, label, hint, onPress, emphasized = false }: ActionCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`min-h-[72px] flex-row items-center gap-3 rounded-2xl border-2 bg-slate-800 p-4 ${
        emphasized ? "border-yellow-500/60" : "border-slate-700"
      }`}
    >
      <Text className="text-3xl">{emoji}</Text>
      <View className="flex-1">
        <Text className="text-base font-bold text-slate-50">{label}</Text>
        <Text className="text-sm text-slate-400">{hint}</Text>
      </View>
      <Text className="text-xl text-slate-500">›</Text>
    </Pressable>
  );
}
