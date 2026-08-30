import { Text, View } from "react-native";

/**
 * Temporary foundation placeholder.
 * Phase 4 (4.1) replaces this with the real Engine Status dashboard.
 */
export default function Index() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-2xl font-bold text-black">Vikai</Text>
      <Text className="mt-2 text-sm text-neutral-500">
        Foundation initialized. Dashboard arrives in Phase 4.
      </Text>
    </View>
  );
}
