import { Pressable, Text } from "react-native";
import { useRouter } from "expo-router";

import { tapLight } from "../lib/haptics";

/**
 * Guaranteed way back from any sub-page: goes back one level when history
 * exists, otherwise lands on Home. Rendered in the stack header's left
 * slot on every sub-screen, so even a fresh deep-load (no history — the
 * default back chevron hides there) can always exit the page.
 */
export function HeaderBack() {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      onPress={() => {
        tapLight();
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace("/");
        }
      }}
      className="h-12 min-w-[48px] items-start justify-center px-2"
      hitSlop={6}
    >
      <Text className="text-2xl text-slate-100">‹</Text>
    </Pressable>
  );
}
