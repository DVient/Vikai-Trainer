import { Text, View } from "react-native";

/**
 * Offline toast (design refresh): non-disruptive save confirmation.
 * Shown by screens after a successful local write; auto-hidden by the screen
 * after a short delay — never a blocking dialog (AGENTS.md client-only
 * architecture: there is no server, data is already safely local).
 */
export function Toast({ message }: { message: string | null }) {
  if (message === null) return null;

  return (
    <View className="absolute inset-x-4 bottom-6 z-10 items-center">
      <View className="rounded-full border border-green-500/40 bg-slate-800 px-5 py-3">
        <Text className="text-sm font-semibold text-green-300">{message}</Text>
      </View>
    </View>
  );
}
