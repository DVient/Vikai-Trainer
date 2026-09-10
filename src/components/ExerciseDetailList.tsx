import { Linking, Pressable, Text, View } from "react-native";

import { scalePrescriptionSets } from "../lib/session";
import type { ComponentDetail } from "../plans/fall2026";

/**
 * The "See the work" panel (Fall 2026 detail overlay): the exercises behind
 * a Game Plan block — name, prescription, numbered technique steps (the
 * offline guidance layer), one-line cue, and an optional "Watch a demo"
 * button. Demo videos are a curated online-only supplement — the badge says
 * so; the steps work with zero network.
 *
 * `setsScale` carries the block's engine scaling ratio on REDUCED rows:
 * each prescription's leading set count scales by the same proportion the
 * engine applied to the block ("3 × 6" under a 4 → 2 block reads "2 × 6"),
 * so the sub-card can never contradict the block's scaled target. KEPT rows
 * (no scale) render the plan's authored prescriptions unchanged.
 */
export function ExerciseDetailList({
  detail,
  setsScale,
}: {
  detail: ComponentDetail;
  setsScale?: number;
}) {
  const ratio = setsScale ?? 1;
  return (
    <View className="gap-2">
      {detail.note !== undefined ? (
        <Text className="text-xs font-semibold text-modulate">{detail.note}</Text>
      ) : null}
      {detail.exercises.map((exercise) => (
        <View key={exercise.name} className="rounded-lg bg-edge-mid p-2.5">
          <View className="flex-row items-baseline justify-between gap-2">
            <Text className="flex-1 text-sm font-bold text-strong">{exercise.name}</Text>
            <Text className="text-xs font-semibold text-go">
              {scalePrescriptionSets(exercise.prescription, ratio)}
            </Text>
          </View>
          {exercise.cue !== undefined ? (
            <Text className="mt-0.5 text-xs text-faint">{exercise.cue}</Text>
          ) : null}
          {exercise.steps !== undefined && exercise.steps.length > 0 ? (
            <View className="mt-1.5 gap-1">
              {exercise.steps.map((step, index) => (
                <View key={`${index}`} className="flex-row gap-1.5">
                  <Text className="text-xs font-bold text-go">{index + 1}.</Text>
                  <Text className="flex-1 text-xs text-body">{step}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {exercise.videoUrl !== undefined ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Watch form: ${exercise.name}`}
              onPress={() => {
                void Linking.openURL(exercise.videoUrl as string);
              }}
              className="mt-2 h-12 flex-row items-center justify-center gap-2 rounded-lg bg-go-soft"
            >
              <Text className="text-sm font-bold text-go">▶ Watch a demo</Text>
              <Text className="rounded-full bg-card px-2 py-0.5 text-[10px] font-bold text-faint">
                Needs internet
              </Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}
