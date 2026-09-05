import { Linking, Pressable, Text, View } from "react-native";

import type { ComponentDetail } from "../plans/fall2026";

/**
 * The "See the work" panel (Fall 2026 detail overlay): the exercises behind
 * a Game Plan block — name, prescription, one-line cue, and a ▶ Watch form
 * button that opens the plan's video link.
 */
export function ExerciseDetailList({ detail }: { detail: ComponentDetail }) {
  return (
    <View className="gap-2">
      {detail.note !== undefined ? (
        <Text className="text-xs font-semibold text-modulate">{detail.note}</Text>
      ) : null}
      {detail.exercises.map((exercise) => (
        <View key={exercise.name} className="rounded-lg bg-edge-mid p-2.5">
          <View className="flex-row items-baseline justify-between gap-2">
            <Text className="flex-1 text-sm font-bold text-strong">{exercise.name}</Text>
            <Text className="text-xs font-semibold text-go">{exercise.prescription}</Text>
          </View>
          {exercise.cue !== undefined ? (
            <Text className="mt-0.5 text-xs text-faint">{exercise.cue}</Text>
          ) : null}
          {exercise.videoUrl !== undefined ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Watch form: ${exercise.name}`}
              onPress={() => {
                void Linking.openURL(exercise.videoUrl as string);
              }}
              className="mt-2 h-12 flex-row items-center justify-center rounded-lg bg-go-soft"
            >
              <Text className="text-sm font-bold text-go">▶ Watch form</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}
