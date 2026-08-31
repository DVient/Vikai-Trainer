import { Pressable, Text, View } from "react-native";

import { tapLight } from "../lib/haptics";
import type { DayStep, StepId } from "../lib/flow";

/**
 * "Your Day" stepper (design iteration): the guided sequence on the Home Hub
 * — check in → Game Plan → log it. Active step glows GO-green, done steps
 * carry a ✓, locked steps show the padlock and what unlocks them.
 */

interface DayStepperProps {
  steps: ReadonlyArray<DayStep>;
  /** Optional summary line shown under the Game Plan step when unlocked. */
  gamePlanSummary?: string;
  onStepPress: (id: StepId, route: DayStep["route"]) => void;
}

export function DayStepper({ steps, gamePlanSummary, onStepPress }: DayStepperProps) {
  return (
    <View className="rounded-2xl border border-slate-700 bg-slate-800 p-4 gap-2">
      <Text className="text-xs font-bold uppercase tracking-widest text-slate-400">
        Your day — 3 steps
      </Text>
      {steps.map((step, index) => (
        <StepRow
          key={step.id}
          step={step}
          index={index}
          gamePlanSummary={step.id === "gamePlan" ? gamePlanSummary : undefined}
          onPress={() => {
            tapLight();
            onStepPress(step.id, step.route);
          }}
        />
      ))}
    </View>
  );
}

function StepRow({
  step,
  index,
  gamePlanSummary,
  onPress,
}: {
  step: DayStep;
  index: number;
  gamePlanSummary?: string;
  onPress: () => void;
}) {
  const active = step.state === "active";
  const done = step.state === "done";

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Step ${index + 1}: ${step.title}`}
        onPress={onPress}
        className={`min-h-[64px] flex-row items-center gap-3 rounded-xl border-2 px-3 py-3 ${
          active
            ? "border-green-500/60 bg-green-500/10"
            : done
              ? "border-transparent bg-slate-700/50"
              : "border-slate-700 bg-slate-800 opacity-70"
        }`}
      >
        <Text className="text-2xl">{step.emoji}</Text>
        <View className="flex-1">
          <Text className="text-sm font-bold text-slate-50">
            {index + 1}. {step.title}
          </Text>
          <Text
            className={`text-xs ${done ? "text-green-300" : active ? "text-slate-300" : "text-slate-500"}`}
          >
            {step.subtitle}
          </Text>
        </View>
        <Text className="text-lg">
          {done ? "✅" : active ? "›" : "🔒"}
        </Text>
      </Pressable>
      {gamePlanSummary !== undefined && step.state !== "locked" ? (
        <Text className="mt-1 px-3 text-xs text-slate-400">{gamePlanSummary}</Text>
      ) : null}
    </View>
  );
}
