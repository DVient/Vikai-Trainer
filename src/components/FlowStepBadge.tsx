import { Text, View } from "react-native";

import { flowStepPosition, type StepId } from "../lib/flow";

/**
 * "Step N of 4" wayfinding chip (Phase 12): every screen of the guided day
 * shows where the athlete is, using the same numbering as the Home stepper
 * ("1. 3-Tap Check-In" … "4. Complete your Game Plan"). `done` marks the
 * step complete for today — the badge stays informative, never an action.
 */
export function FlowStepBadge({ id, done = false }: { id: StepId; done?: boolean }) {
  const { position, total } = flowStepPosition(id);
  return (
    <View
      accessibilityLabel={`Step ${position} of ${total}`}
      className="flex-row items-center justify-center gap-1"
    >
      <Text className="text-xs font-bold uppercase tracking-widest text-faint">
        {`Step ${position} of ${total}`}
      </Text>
      {done ? <Text className="text-xs font-black text-go">✓ done</Text> : null}
    </View>
  );
}
