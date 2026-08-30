/**
 * Minimal type surface for react-native-web, used only by the Phase 6
 * component-test harness (tests/components.test.tsx) to alias the
 * "react-native" import to react-native-web under jsdom. The full RNW
 * surface ships without bundled types; the harness only spreads the module
 * into a mock, so these component declarations are all it touches.
 */
declare module "react-native-web" {
  import type { FC } from "react";

  type WebProps = Record<string, unknown>;

  export const View: FC<WebProps>;
  export const Text: FC<WebProps>;
  export const Pressable: FC<WebProps>;
  export const TextInput: FC<WebProps>;
  export const ScrollView: FC<WebProps>;

  const reactNativeWeb: Record<string, unknown>;
  export default reactNativeWeb;
}
