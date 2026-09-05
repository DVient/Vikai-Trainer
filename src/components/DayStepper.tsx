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
    <View className="rounded-2xl border border-edge bg-card p-4 gap-2">
      <Text className="text-xs font-bold uppercase tracking-widest text-faint">
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
            ? "border-go-line bg-go-soft"
            : done
              ? "border-transparent bg-edge-mid"
              : "border-edge bg-card opacity-70"
        }`}
      >
        <Text className="text-2xl">{step.emoji}</Text>
        <View className="flex-1">
          <Text className="text-sm font-bold text-strong">
            {index + 1}. {step.title}
          </Text>
          <Text
            className={`text-xs ${done ? "text-go" : active ? "text-body" : "text-faint"}`}
          >
            {step.subtitle}
          </Text>
        </View>
        <Text className="text-lg">
          {done ? "✅" : active ? "›" : "🔒"}
        </Text>
      </Pressable>
      {gamePlanSummary !== undefined && step.state !== "locked" ? (
        <Text className="mt-1 px-3 text-xs text-faint">{gamePlanSummary}</Text>
      ) : null}
    </View>
  );
}
