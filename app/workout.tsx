import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { BodyMap } from "../src/components/BodyMap";
import { PowerGauge } from "../src/components/PowerGauge";
import { SessionChecklist } from "../src/components/SessionChecklist";
import { StatusBanner } from "../src/components/StatusBanner";
import { toLocalDateString } from "../src/engine/autoregulation";
import { applyRestrictionsToBasePlan } from "../src/engine/generator";
import { useEngineResult } from "../src/hooks/useEngineResult";
import { soreAreaLabel } from "../src/lib/bodyMap";
import { buildSessionView } from "../src/lib/session";
import { seasonPhaseFor, exerciseDetailsFor } from "../src/plans/fall2026";
import { powerLevel } from "../src/lib/power";
import { tapHeavy, tapLight, tapSuccess } from "../src/lib/haptics";
import { TRAINING_GOAL_LABELS } from "../src/lib/format";
import { computePerformanceScales } from "../src/plans/adherence";
import { DEFAULT_BASE_PLAN } from "../src/plans/basePlan";
import { activePlanForDay, blockVariant } from "../src/plans/planBuilder";
import { libraryExerciseDetail } from "../src/plans/library";
import { useAppStore } from "../src/stores/useAppStore";
import { isSoreArea, type SoreArea } from "../src/types";

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
  const activityLogs = useAppStore((state) => state.activityLogs);

  const localToday = toLocalDateString(new Date(), profile.timezone);
  const activePlan = useAppStore((state) => state.activePlan);
  // Built plans replace the default template; no plan ⇒ today's default.
  const basePlan = activePlan ? activePlanForDay(activePlan, localToday) : DEFAULT_BASE_PLAN;
  const prescription = applyRestrictionsToBasePlan(basePlan, result.restrictions, {
    stripOptional,
    primaryGoals: trainingObjective.primaryGoals,
    // Phase 8.3 — comfort-effort categories auto-scale from completion history.
    performanceScales: computePerformanceScales(activePlan, workoutLogs, workoutProgress, localToday),
  });
  const session = buildSessionView(prescription, workoutProgress[localToday] ?? {});
  const power = powerLevel(result);
  const hasWorkoutLogToday = workoutLogs.some((entry) => entry.activityDate === localToday);
  const hasActivityToday = activityLogs.some((entry) => entry.activityDate === localToday);
  const seasonPhase = seasonPhaseFor(localToday);

  const [finishStep, setFinishStep] = useState<"idle" | "bodymap">("idle");
  const [soreAfter, setSoreAfter] = useState<SoreArea[]>([]);

  const finish = () => {
    tapHeavy();
    tapSuccess();
    recordWorkoutLog({
      activityDate: localToday,
      notes: undefined,
      // Phase 8.1 — post-session body map prices TOMORROW's workout.
      ...(soreAfter.length > 0 ? { soreAreasAfter: [...soreAfter] } : {}),
    });
    router.navigate("/practice-log");
  };

  const soreAreasToday = Object.keys(result.restrictions.sorenessScale ?? {}).filter(isSoreArea);

  // Built plans rotate through their library pools; the default plan keeps
  // the season-plan details.
  const resolveDetail = (componentId: string) => {
    if (activePlan !== null) {
      const rotated = libraryExerciseDetail(
        componentId,
        blockVariant(activePlan, localToday, componentId),
      );
      if (rotated !== undefined) {
        return {
          componentId,
          exercises: rotated.exercises.map((exercise) => ({
            name: exercise.name,
            prescription: exercise.prescription,
            cue: exercise.cue,
            videoQuery: exercise.videoQuery,
          })),
        };
      }
    }
    return exerciseDetailsFor(componentId, localToday);
  };

  return (
    <ScrollView
      className="flex-1 bg-slate-900"
      contentContainerClassName="w-full max-w-md self-center gap-4 p-4"
    >
      <PowerGauge
        percent={power.percent}
        tone={power.tone}
        label={power.label}
        sublabel={hasWorkoutLogToday ? "Session complete ✓" : undefined}
      />

      <StatusBanner status={result.status} reasons={result.reasons} />

      {result.reasons.includes("SORENESS_FLAGGED") && soreAreasToday.length > 0 ? (
        <Text className="rounded-xl bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-300">
          Sore today: {soreAreasToday.map(soreAreaLabel).join(", ")} — blocks targeting them are
          scaled. Everything else runs as planned.
        </Text>
      ) : null}

      <Text className="text-center text-lg font-black text-slate-50">Today's Game Plan</Text>

      {seasonPhase !== undefined ? (
        <View className="rounded-xl border border-slate-700 bg-slate-800 p-3">
          <Text className="text-xs font-bold uppercase tracking-widest text-green-300">
            Fall 2026 · {seasonPhase.label}
          </Text>
          <Text className="mt-1 text-xs text-slate-400">{seasonPhase.focus}</Text>
          {seasonPhase.note !== undefined ? (
            <Text className="mt-1 text-xs font-semibold text-slate-300">{seasonPhase.note}</Text>
          ) : null}
        </View>
      ) : null}

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
          Quality over volume — the plan protects the high/low balance. On
          lighter days, your focus areas keep their work longest.
        </Text>
      </View>

      {!hasWorkoutLogToday && !hasActivityToday ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Log activities before the workout"
          onPress={() => router.navigate("/practice-log")}
          className="min-h-[48px] rounded-xl border-2 border-yellow-500/50 bg-yellow-500/10 px-3 py-3"
        >
          <Text className="text-sm font-bold text-yellow-300">
            Anything already on your legs today? Log it before you start — it
            shapes today's volume 🔄
          </Text>
        </Pressable>
      ) : null}

      {hasWorkoutLogToday ? (
        <Text className="rounded-xl bg-green-500/10 px-3 py-2 text-sm font-semibold text-green-300">
          Session complete 🎉 Log anything else you did today — it shapes your
          next workout 🔄
        </Text>
      ) : (
        <Text className="text-xs text-slate-400">
          Check off each block as you go. Logging an activity updates the
          remaining volume automatically 🔄
        </Text>
      )}

      <SessionChecklist
        view={session}
        localDate={localToday}
        onToggle={(componentId, sets) => toggleComponentDone(localToday, componentId, sets)}
        resolveDetail={resolveDetail}
      />

      {session.finishable && !hasWorkoutLogToday ? (
        finishStep === "idle" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Finish workout"
            onPress={() => {
              tapLight();
              setFinishStep("bodymap");
            }}
            className="h-14 items-center justify-center rounded-xl bg-green-500"
          >
            <Text className="text-base font-black text-slate-950">Finish workout 🏁</Text>
          </Pressable>
        ) : (
          <View className="rounded-2xl border border-slate-700 bg-slate-800 p-4 gap-3">
            <BodyMap
              areas={soreAfter}
              onAreasChange={setSoreAfter}
              heading="Before you close the session — how does the body feel? 🗺️"
              note="This prices tomorrow's workout. Today's plan is already locked."
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save and close session"
              onPress={finish}
              className="h-14 items-center justify-center rounded-xl bg-green-500"
            >
              <Text className="text-base font-black text-slate-950">Save & close session 🏁</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close session without body notes"
              onPress={() => {
                setSoreAfter([]);
                finish();
              }}
              className="h-12 items-center justify-center rounded-xl border-2 border-slate-700 bg-slate-900"
            >
              <Text className="text-sm font-bold text-slate-300">Close without notes</Text>
            </Pressable>
          </View>
        )
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
    </ScrollView>
  );
}
