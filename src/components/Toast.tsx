import { Text, View } from "react-native";

/**
 * Offline toast (design refresh): non-disruptive save confirmation.
 * Shown by screens after a successful local write; auto-hidden by the screen
 * after a short delay — never a blocking dialog (AGENTS.md client-only
 * architecture: there is no server, data is already safely local).
 *
 * Renders only for a non-empty message. This overlay is absolutely
 * positioned and swallows native touches, so an empty/null message must
 * never mount it — an invisible pill over a button makes that button dead.
 */
export function Toast({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <View className="absolute inset-x-4 bottom-6 z-10 items-center">
      <View className="rounded-full border border-go-line bg-card px-5 py-3">
        <Text className="text-sm font-semibold text-go">{message}</Text>
      </View>
    </View>
  );
}
