import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { toLocalDateString } from "../src/engine/autoregulation";
import {
  MAX_PERIOD_WEEKS,
  MIN_PERIOD_WEEKS,
  activePlanForDay,
  planPhaseLabel,
  planStatus,
  weekIndexOf,
} from "../src/plans/planBuilder";
import { PERSONAS, personaById } from "../src/plans/personas";
import {
  MILESTONE_DRILLS,
  currentBests,
  drillsForGoals,
  milestoneDrillById,
} from "../src/plans/milestones";
import { BASE_PLAN_TITLES } from "../src/plans/basePlan";
import { libraryBlockById, SKILL_OPTIONS } from "../src/plans/library";
import { TRAINING_GOAL_LABELS } from "../src/lib/format";
import { tapHeavy, tapLight, tapSuccess } from "../src/lib/haptics";
import { useAppStore } from "../src/stores/useAppStore";
import type { PersonaId, TrainingGoal } from "../src/types";

/**
 * My Plan (Plan Builder): where the athlete picks a persona and a time
 * period, and the app builds their training plan. Three states — build,
 * active (with milestones), and ended (recap + set a new goal). The doing
 * stays on the Game Plan screens; this screen is the plan's home.
 */

const SELECTABLE_GOALS: TrainingGoal[] = [
  "STRENGTH",
  "EXPLOSIVENESS",
  "CHANGE_OF_DIRECTION",
  "ACCELERATION",
  "SPEED",
  "DECELERATION",
];

export default function Plan() {
  const router = useRouter();
  const profile = useAppStore((state) => state.profile);
  const activePlan = useAppStore((state) => state.activePlan);
  const personalBests = useAppStore((state) => state.personalBests);
  const buildTrainingPlan = useAppStore((state) => state.buildTrainingPlan);
  const clearTrainingPlan = useAppStore((state) => state.clearTrainingPlan);
  const addPersonalBest = useAppStore((state) => state.addPersonalBest);
  const removePersonalBest = useAppStore((state) => state.removePersonalBest);

  const today = toLocalDateString(new Date(), profile.timezone);
  const status = activePlan !== null ? planStatus(activePlan, today) : null;

  const [selectedPersona, setSelectedPersona] = useState<PersonaId | null>(null);
  const [customGoals, setCustomGoals] = useState<TrainingGoal[]>([]);
  const [customSkills, setCustomSkills] = useState<string[]>([]);
  const [buildMode, setBuildMode] = useState<"preset" | "custom" | null>(null);
  const [weeks, setWeeks] = useState(8);
  const [rebuilding, setRebuilding] = useState(false);
  const [loggingDrill, setLoggingDrill] = useState<string | null>(null);
  const [valueText, setValueText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const showBuild = activePlan === null || rebuilding;
  const bests = currentBests(personalBests);

  const build = () => {
    if (selectedPersona === null && customGoals.length === 0) {
      setError("Choose Preset or Customized, then pick your focus to build your plan.");
      return;
    }
    if (buildMode === "custom" && customSkills.length === 0) {
      setError("Customized plans need 1–3 basketball skills. Pick at least one.");
      return;
    }
    tapHeavy();
    tapSuccess();
    buildTrainingPlan({
      personaId: selectedPersona ?? undefined,
      primaryGoals: customGoals.length > 0 ? customGoals : undefined,
      skillIds: buildMode === "custom" && customSkills.length > 0 ? customSkills : undefined,
      periodWeeks: weeks,
      startDate: today,
    });
    setRebuilding(false);
    setError(null);
  };

  const toggleCustomGoal = (goal: TrainingGoal) => {
    tapLight();
    setCustomGoals((current) =>
      current.includes(goal)
        ? current.filter((entry) => entry !== goal)
        : current.length >= 3
          ? current // up to 3 focus areas — extra taps do nothing
          : [...current, goal],
    );
  };

  const toggleCustomSkill = (skillId: string) => {
    tapLight();
    setCustomSkills((current) =>
      current.includes(skillId)
        ? current.filter((entry) => entry !== skillId)
        : current.length >= 3
          ? current // 1–3 skills — a fourth tap does nothing
          : [...current, skillId],
    );
  };

  const chooseMode = (mode: "preset" | "custom") => {
    tapLight();
    setBuildMode(mode);
    // Only one path's selections can be live at a time.
    if (mode === "custom") {
      setSelectedPersona(null);
    } else {
      setCustomGoals([]);
      setCustomSkills([]);
    }
  };

  const planDrills = () => {
    if (activePlan === null) return [];
    const persona = activePlan.personaId !== undefined ? personaById(activePlan.personaId) : undefined;
    const referenced = persona?.benchmarkDrillIds ?? [];
    const referencedDrills = referenced
      .map((drillId) => milestoneDrillById(drillId))
      .filter((drill) => drill !== undefined);
    if (referencedDrills.length > 0) return referencedDrills;
    return drillsForGoals(activePlan.primaryGoals);
  };

  if (showBuild) {
    return (
      <ScrollView
        className="flex-1 bg-app"
        contentContainerClassName="w-full max-w-md self-center gap-4 p-4 pb-8"
      >
        <View className="rounded-2xl border-2 border-go-line bg-go-soft p-4">
          <Text className="text-lg font-black text-go">Build my training plan 🎯</Text>
          <Text className="mt-1 text-sm text-body">
            Pick what you're training for and how long. The app builds your
            plan from your focus, your recent work, and how often you've been
            showing up.
          </Text>
        </View>

        <Text className="text-sm font-bold text-strong">1 · How do you want to build it?</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Preset plan"
          accessibilityState={{ selected: buildMode === "preset" }}
          onPress={() => chooseMode("preset")}
          className={`min-h-[64px] rounded-2xl border-2 p-3 ${
            buildMode === "preset"
              ? "border-accent bg-soft"
              : "border-edge bg-card"
          }`}
        >
          <Text className="text-base font-bold text-strong">Preset plan 🏋️</Text>
          <Text className="mt-0.5 text-xs text-faint">
            Pick a ready-made focus, and the app builds around it.
          </Text>
        </Pressable>

        {buildMode === "preset" ? (
          <View className="gap-2">
            {PERSONAS.map((persona) => {
              const selected = selectedPersona === persona.id;
              return (
                <Pressable
                  key={persona.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Focus: ${persona.label}`}
                  accessibilityState={{ selected }}
                  onPress={() => {
                    tapLight();
                    setSelectedPersona(persona.id);
                    setCustomGoals([]);
                    setWeeks(persona.suggestedWeeks);
                  }}
                  className={`min-h-[64px] rounded-2xl border-2 p-3 ${
                    selected
                      ? "border-accent bg-soft"
                      : "border-edge bg-card"
                  }`}
                >
                  <Text className="text-base font-bold text-strong">
                    {persona.emoji} {persona.label}
                  </Text>
                  <Text className="mt-0.5 text-xs text-faint">{persona.blurb}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Customized plan"
          accessibilityState={{ selected: buildMode === "custom" }}
          onPress={() => chooseMode("custom")}
          className={`min-h-[64px] rounded-2xl border-2 p-3 ${
            buildMode === "custom"
              ? "border-accent bg-soft"
              : "border-edge bg-card"
          }`}
        >
          <Text className="text-base font-bold text-strong">Customized plan 🎯</Text>
          <Text className="mt-0.5 text-xs text-faint">
            Choose your own focus areas — up to 3 — plus 1–3 basketball skills.
          </Text>
        </Pressable>

        {buildMode === "custom" ? (
          <>
            <Text className="text-sm font-bold text-strong">
              Pick your focus (up to 3)
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {SELECTABLE_GOALS.map((goal) => {
                const selected = customGoals.includes(goal);
                return (
                  <Pressable
                    key={goal}
                    accessibilityRole="button"
                    accessibilityLabel={`Goal ${TRAINING_GOAL_LABELS[goal]}`}
                    accessibilityState={{ selected }}
                    onPress={() => toggleCustomGoal(goal)}
                    className={`h-12 rounded-full border-2 px-4 ${
                      selected ? "border-accent bg-soft" : "border-edge bg-card"
                    }`}
                  >
                    <Text
                      className={`h-12 text-sm font-bold leading-12 ${
                        selected ? "text-go" : "text-body"
                      }`}
                    >
                      {TRAINING_GOAL_LABELS[goal]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {customGoals.length > 0 ? (
              <Text className="text-xs text-faint">
                {customGoals.length} of 3 picked — tap a goal again to remove it.
              </Text>
            ) : null}

            <Text className="text-sm font-bold text-strong">
              Pick your skills (1–3)
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {SKILL_OPTIONS.map((skill) => {
                const selected = customSkills.includes(skill.id);
                return (
                  <Pressable
                    key={skill.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Skill ${skill.label}`}
                    accessibilityState={{ selected }}
                    onPress={() => toggleCustomSkill(skill.id)}
                    className={`h-12 rounded-full border-2 px-4 ${
                      selected ? "border-accent bg-soft" : "border-edge bg-card"
                    }`}
                  >
                    <Text
                      className={`h-12 text-sm font-bold leading-12 ${
                        selected ? "text-go" : "text-body"
                      }`}
                    >
                      {skill.emoji} {skill.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text className="text-xs text-faint">
              {customSkills.length} of 3 picked — customized plans need at
              least one skill.
            </Text>
          </>
        ) : null}

        <Text className="text-sm font-bold text-strong">2 · How many weeks?</Text>
        <View className="flex-row items-center gap-3">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fewer weeks"
            onPress={() => {
              tapLight();
              setWeeks((current) => Math.max(MIN_PERIOD_WEEKS, current - 1));
            }}
            className="h-14 w-14 items-center justify-center rounded-xl border-2 border-edge bg-card"
          >
            <Text className="text-2xl font-black text-strong">−</Text>
          </Pressable>
          <View className="h-14 flex-1 items-center justify-center rounded-xl border-2 border-edge bg-card">
            <Text className="text-lg font-black text-strong">{weeks} weeks</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="More weeks"
            onPress={() => {
              tapLight();
              setWeeks((current) => Math.min(MAX_PERIOD_WEEKS, current + 1));
            }}
            className="h-14 w-14 items-center justify-center rounded-xl border-2 border-edge bg-card"
          >
            <Text className="text-2xl font-black text-strong">＋</Text>
          </Pressable>
        </View>

        <Text className="text-xs text-faint">
          Every plan builds up week by week, takes an easier week every fourth
          week, and eases off in the final week. Your first week starts at a
          level matched to how much you've been training lately.
        </Text>

        {error !== null ? (
          <Text className="text-sm font-semibold text-shield">{error}</Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Build my plan"
          onPress={build}
          className="h-14 items-center justify-center rounded-xl bg-accent"
        >
          <Text className="text-base font-black text-onaccent">Build my plan 🏗️</Text>
        </Pressable>

        {activePlan !== null && rebuilding ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel rebuild"
            onPress={() => {
              tapLight();
              setRebuilding(false);
            }}
            className="h-12 items-center justify-center rounded-xl border-2 border-edge bg-card"
          >
            <Text className="text-sm font-bold text-body">Cancel — keep current plan</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    );
  }

  // ── Active or ended plan ──
  const plan = activePlan;
  const weekIndex = weekIndexOf(plan, today);
  const drills = planDrills();
  const todayBlocks = activePlanForDay(plan, today);

  const saveResult = () => {
    if (loggingDrill === null) return;
    const value = Number.parseFloat(valueText);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter a number for your result.");
      return;
    }
    tapSuccess();
    addPersonalBest({ drillId: loggingDrill, value, activityDate: today });
    setLoggingDrill(null);
    setValueText("");
    setError(null);
  };

  return (
    <ScrollView
      className="flex-1 bg-app"
      contentContainerClassName="w-full max-w-md self-center gap-4 p-4 pb-8"
    >
      <View className="rounded-2xl border-2 border-go-line bg-go-soft p-4">
        <Text className="text-lg font-black text-go">
          {plan.personaId !== undefined
            ? `${personaById(plan.personaId)?.emoji ?? "🎯"} ${personaById(plan.personaId)?.label ?? "Custom plan"}`
            : "Your custom plan"}
        </Text>
        <Text className="mt-1 text-sm text-body">
          {status === "ended"
            ? "Complete — great work finishing the full period."
            : `${planPhaseLabel(plan, today)} · Week ${Math.min(weekIndex + 1, plan.periodWeeks)} of ${plan.periodWeeks}`}
        </Text>
        <Text className="mt-0.5 text-xs text-faint">
          Focus: {plan.primaryGoals.map((goal) => TRAINING_GOAL_LABELS[goal]).join(" · ")}
        </Text>
      </View>

      {status === "final-week" ? (
        <View className="rounded-2xl border border-modulate-line bg-modulate-soft p-4">
          <Text className="text-sm font-semibold text-modulate">
            Test week — record fresh results for your drills below so your next
            plan starts from reality.
          </Text>
        </View>
      ) : null}

      <View className="rounded-2xl border border-edge bg-card p-4">
        <Text className="text-xs font-bold uppercase tracking-widest text-faint">
          This week's session blocks
        </Text>
        <View className="mt-2 gap-1">
          {todayBlocks.map((component) => (
            <View key={component.id} className="flex-row items-center justify-between">
              <Text className="flex-1 text-sm text-body">
                {BASE_PLAN_TITLES[component.id] ?? libraryBlockById(component.id)?.title ?? component.id}
              </Text>
              <Text className="text-sm font-bold text-faint">
                {component.baseVolume} {component.baseVolume === 1 ? "set" : "sets"}
              </Text>
            </View>
          ))}
        </View>
        <Text className="mt-2 text-xs text-faint">
          Do the work on the Game Plan — this is just the map.
        </Text>
      </View>

      <View className="rounded-2xl border border-edge bg-card p-4">
        <Text className="text-xs font-bold uppercase tracking-widest text-faint">
          Personal milestones
        </Text>
        {drills.length === 0 ? (
          <Text className="mt-2 text-sm text-faint">No drills for this focus yet.</Text>
        ) : (
          <View className="mt-2 gap-3">
            {drills.map((drill) => {
              const best = bests[drill.id];
              const attempts = personalBests
                .filter((entry) => entry.drillId === drill.id)
                .slice(-3)
                .reverse();
              return (
                <View key={drill.id} className="rounded-xl border border-edge bg-edge-mid p-3">
                  <Text className="text-sm font-bold text-strong">{drill.label}</Text>
                  <Text className="mt-0.5 text-xs text-faint">{drill.protocol}</Text>
                  {best !== undefined ? (
                    <Text className="mt-1 text-sm font-black text-go">
                      Best: {best.value} {drill.unit}
                    </Text>
                  ) : (
                    <Text className="mt-1 text-xs text-faint">No result yet.</Text>
                  )}
                  {attempts.length > 0 ? (
                    <Text className="mt-1 text-xs text-faint">
                      Recent: {attempts.map((entry) => `${entry.value} (${entry.activityDate})`).join(" · ")}
                    </Text>
                  ) : null}

                  {loggingDrill === drill.id ? (
                    <View className="mt-2 flex-row items-center gap-2">
                      <TextInput
                        value={valueText}
                        onChangeText={setValueText}
                        keyboardType="decimal-pad"
                        placeholder={`Result (${drill.unit})`}
                        placeholderTextColor="#64748B"
                        className="h-12 flex-1 rounded-lg border-2 border-edge bg-card px-3 text-sm text-strong"
                      />
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Save ${drill.label} result`}
                        onPress={saveResult}
                        className="h-12 w-20 items-center justify-center rounded-lg bg-accent"
                      >
                        <Text className="text-sm font-black text-onaccent">Save</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Cancel ${drill.label} result`}
                        onPress={() => {
                          tapLight();
                          setLoggingDrill(null);
                          setValueText("");
                          setError(null);
                        }}
                        className="h-12 w-12 items-center justify-center rounded-lg bg-edge"
                      >
                        <Text className="text-base font-bold text-body">✕</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Log result: ${drill.label}`}
                      onPress={() => {
                        tapLight();
                        setLoggingDrill(drill.id);
                        setValueText("");
                      }}
                      className="mt-2 h-12 items-center justify-center rounded-lg border-2 border-edge bg-card"
                    >
                      <Text className="text-sm font-bold text-go">＋ Log a result</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </View>

      {error !== null ? (
        <Text className="text-sm font-semibold text-shield">{error}</Text>
      ) : null}

      {status === "ended" ? (
        <View className="rounded-2xl border-2 border-go-line bg-go-soft p-4">
          <Text className="text-base font-black text-go">
            Period complete 🎉 — what's next?
          </Text>
          <Text className="mt-1 text-sm text-body">
            Check your milestone results above, pick your next focus, and the
            app builds the next plan from everything you just did.
          </Text>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Rebuild plan"
        onPress={() => {
          tapLight();
          setRebuilding(true);
          // Pre-fill the form with what the saved plan used, revealed in
          // the matching mode. Skills come back from the plan's SKILL blocks.
          const savedSkills = plan.components
            .map((component) => component.id)
            .filter((id) => libraryBlockById(id)?.kind === "SKILL")
            .slice(0, 3);
          if (plan.personaId !== undefined) {
            setBuildMode("preset");
            setSelectedPersona(plan.personaId);
            setCustomGoals([]);
            setCustomSkills([]);
            setWeeks(plan.periodWeeks);
          } else {
            setBuildMode("custom");
            setSelectedPersona(null);
            setCustomGoals(plan.primaryGoals.slice(0, 3));
            setCustomSkills(savedSkills);
            setWeeks(plan.periodWeeks);
          }
        }}
        className="h-14 items-center justify-center rounded-xl border-2 border-edge bg-card"
      >
        <Text className="text-sm font-bold text-strong">Rebuild plan 🔄</Text>
      </Pressable>

      <View className="gap-1">
        <Text className="text-xs text-faint">
          Changed your mind? The default plan is always here.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reset to default plan"
          onPress={() => {
            tapLight();
            clearTrainingPlan();
            setRebuilding(false);
            setBuildMode(null);
          }}
          className="h-12 items-center justify-center rounded-xl border-2 border-edge bg-card"
        >
          <Text className="text-sm font-bold text-faint">Reset to default plan</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
