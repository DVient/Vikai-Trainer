import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { toLocalDateString } from "../src/engine/autoregulation";
import { DEFAULT_ENGINE_THRESHOLDS, type EngineThresholds } from "../src/engine/autoregulation";
import {
  baselineDaysSoFar,
  classifyTapTier,
  fingerTapBaseline,
  isValidTapCount,
  trialsLoggedToday,
  type FingerTapTier,
} from "../src/engine/fingerTap";
import { tapLight, tapSuccess } from "../src/lib/haptics";
import { useAppStore } from "../src/stores/useAppStore";

/**
 * 10-second tap test (Phase 10): the athlete taps the pad as fast as
 * possible with one finger for exactly 10 seconds; every downstroke counts.
 * The screen is pure UI — counting, the 10-second window (a UI-layer clock)
 * and saving. All interpretation (validity, daily best, personal baseline,
 * freshness tier) lives in the pure engine module, and the engine decides
 * what the result means for today's plan (AGENTS.md decoupling).
 *
 * Protocol notes shown to the athlete: comfortable stance, one finger
 * (index preferred), the phone resting on a flat surface — and never an
 * absolute score comparison against other people.
 */

const TEST_SECONDS = 10;

type Phase = "idle" | "running" | "result";

const TIER_COPY: Record<FingerTapTier, { headline: string; detail: string }> = {
  FRESH: {
    headline: "Fresh ✅",
    detail: "Your tap speed matches your recent best today.",
  },
  NO_BASELINE: {
    headline: "Baseline building 📈",
    detail: "Keep testing on training days — after a few days this becomes a real comparison.",
  },
  MODERATE: {
    headline: "A little below your best 🟡",
    detail: "Today's plan leans lighter. Rest, fuel and an early night help.",
  },
  SIGNIFICANT: {
    headline: "Well below your best 🟠",
    detail: "Your body is asking for a lighter day. The plan already reflects it.",
  },
  NOT_TESTED: {
    headline: "Not tested yet",
    detail: "Run the test to see where you stand today.",
  },
};

export default function FingerTapTest() {
  const router = useRouter();
  const profile = useAppStore((state) => state.profile);
  const fingerTapTrials = useAppStore((state) => state.fingerTapTrials);
  const engineThresholds = useAppStore((state) => state.engineThresholds);
  const addFingerTapTrial = useAppStore((state) => state.addFingerTapTrial);

  const thresholds: EngineThresholds = engineThresholds ?? DEFAULT_ENGINE_THRESHOLDS;

  const [phase, setPhase] = useState<Phase>("idle");
  const [count, setCount] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(TEST_SECONDS);

  const countRef = useRef(0);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const today = toLocalDateString(new Date(), profile.timezone);
  const trialsToday = trialsLoggedToday(fingerTapTrials, today);
  const trialsLeft = thresholds.cnsMaxTrialsPerDay - trialsToday;
  const baseline = fingerTapBaseline(fingerTapTrials, today, thresholds);
  const baselineDays = baselineDaysSoFar(fingerTapTrials, today, thresholds);
  const reading = classifyTapTier(fingerTapTrials, today, thresholds);

  useEffect(
    () => () => {
      if (timerRef.current !== null) clearInterval(timerRef.current);
    },
    [],
  );

  const stopTimer = () => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const finishTrial = () => {
    stopTimer();
    const tapCount = countRef.current;
    addFingerTapTrial({ localDate: today, timezone: profile.timezone, tapCount });
    tapSuccess();
    setSecondsLeft(0);
    setPhase("result");
  };

  const startTrial = () => {
    if (trialsLeft <= 0) return;
    tapLight();
    countRef.current = 0;
    setCount(0);
    setSecondsLeft(TEST_SECONDS);
    startedAtRef.current = Date.now();
    setPhase("running");
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startedAtRef.current) / 1000;
      const remaining = Math.max(0, TEST_SECONDS - elapsed);
      setSecondsLeft(Math.round(remaining * 10) / 10);
      if (remaining <= 0) finishTrial();
    }, 100);
  };

  const registerTap = () => {
    if (phase !== "running") return;
    countRef.current += 1;
    setCount(countRef.current);
  };

  const tierCopy = TIER_COPY[reading.tier];

  return (
    <ScrollView
      className="flex-1 bg-app"
      contentContainerClassName="w-full max-w-md self-center gap-4 p-4"
    >
      <View className="rounded-2xl border border-edge bg-card p-4 gap-1">
        <Text className="text-base font-black text-strong">
          Tap fast for 10 seconds ⚡
        </Text>
        <Text className="text-sm text-body">
          One finger, the phone on a flat surface. This measures your speed
          today against your OWN recent best — never against other people.
        </Text>
      </View>

      <View className="flex-row gap-2">
        <View className="flex-1 rounded-xl border border-edge bg-card p-3">
          <Text className="text-xs font-bold uppercase tracking-widest text-faint">
            Today's best
          </Text>
          <Text className="text-2xl font-black text-strong">
            {reading.todayBest ?? "—"}
          </Text>
        </View>
        <View className="flex-1 rounded-xl border border-edge bg-card p-3">
          <Text className="text-xs font-bold uppercase tracking-widest text-faint">
            Your baseline
          </Text>
          <Text className="text-2xl font-black text-strong">
            {baseline ?? "—"}
          </Text>
          {baseline === undefined ? (
            <Text className="text-xs text-faint">
              {baselineDays}/{thresholds.cnsMinBaselineDays} days logged
            </Text>
          ) : null}
        </View>
      </View>

      {phase === "idle" ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start the 10-second tap test"
            onPress={startTrial}
            disabled={trialsLeft <= 0}
            className={`min-h-[64px] items-center justify-center rounded-2xl ${
              trialsLeft > 0 ? "bg-accent" : "bg-edge"
            }`}
          >
            <Text
              className={`text-base font-black ${
                trialsLeft > 0 ? "text-onaccent" : "text-faint"
              }`}
            >
              {trialsLeft > 0 ? "Start test — tap the pad 🚀" : "No trials left today"}
            </Text>
          </Pressable>
          <Text className="text-xs text-faint">
            Trials used today: {trialsToday} of {thresholds.cnsMaxTrialsPerDay}.
            The best one counts — a warm-up attempt never hurts you.
          </Text>
        </>
      ) : null}

      {phase === "running" ? (
        <>
          <View className="flex-row items-center justify-between rounded-xl bg-card border border-edge px-4 py-2">
            <Text className="text-sm font-bold text-strong">
              Taps: {count}
            </Text>
            <Text className="text-sm font-black text-modulate">
              {secondsLeft.toFixed(1)}s left
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tap pad — tap here as fast as you can"
            onPressIn={registerTap}
            className="min-h-[320px] items-center justify-center rounded-3xl border-4 border-go-line bg-go-soft active:bg-go-line"
          >
            <Text className="text-6xl font-black text-go">{count}</Text>
            <Text className="mt-2 text-base font-bold text-body">
              Tap! Tap! Tap!
            </Text>
          </Pressable>
        </>
      ) : null}

      {phase === "result" ? (
        <>
          <View className="rounded-2xl border border-edge bg-card p-4 gap-1">
            <Text className="text-4xl font-black text-strong">
              {count} taps
            </Text>
            {!isValidTapCount(count, thresholds) ? (
              <Text className="text-sm font-semibold text-modulate">
                That run looks off for a 10-second effort — it won't count as
                today's score. {trialsLeft > 0 ? "Try again." : ""}
              </Text>
            ) : null}
            <Text className="mt-1 text-lg font-black text-strong">
              {tierCopy.headline}
            </Text>
            <Text className="text-sm text-body">{tierCopy.detail}</Text>
          </View>
          <Text className="text-sm text-body">
            Your plan for today already blends this with your check-in — check
            the Home screen to see your status.
          </Text>
          {trialsLeft > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Run the tap test again"
              onPress={() => {
                setPhase("idle");
                setCount(0);
                setSecondsLeft(TEST_SECONDS);
              }}
              className="min-h-[48px] items-center justify-center rounded-xl border-2 border-edge bg-card"
            >
              <Text className="text-sm font-bold text-strong">
                Test again ({trialsLeft} left today)
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Done — back to home"
            onPress={() => {
              tapLight();
              router.replace("/");
            }}
            className="min-h-[48px] items-center justify-center rounded-xl bg-accent"
          >
            <Text className="text-base font-black text-onaccent">Done</Text>
          </Pressable>
        </>
      ) : null}
    </ScrollView>
  );
}
