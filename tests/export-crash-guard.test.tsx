// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

/**
 * Phase 9.12 regression — the OTA crash guard.
 *
 * The first OTA after expo-file-system/expo-sharing were added crashed the
 * calendar screen on every APK built BEFORE those packages existed: the
 * screen imported them at module scope, and OTA can add JavaScript to an
 * installed binary but never native code. The fix renders the screen with
 * dynamic imports guarded by try/catch. The vi.mock factories here THROW —
 * exactly like requiring the JS of a native-backed package on a binary
 * without the native module — and this file has no other tests, so factory
 * caching can never turn the simulation back into a healthy module.
 */

const routerMock = vi.hoisted(() => ({
  navigate: vi.fn<(route: string) => void>(),
  replace: vi.fn<(route: string) => void>(),
  back: vi.fn<() => void>(),
  canGoBack: vi.fn<() => boolean>(() => true),
}));

const hapticsMock = vi.hoisted(() => ({
  impactAsync: vi.fn<(style: unknown) => Promise<void>>(async () => undefined),
  notificationAsync: vi.fn<(type: unknown) => Promise<void>>(async () => undefined),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));

const AsyncStorageMock = vi.hoisted(() => ({
  getItem: vi.fn<(key: string) => Promise<string | null>>(async () => null),
  setItem: vi.fn<(key: string, value: string) => Promise<void>>(async () => undefined),
  removeItem: vi.fn<(key: string) => Promise<void>>(async () => undefined),
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: AsyncStorageMock,
}));

vi.mock("expo-haptics", () => hapticsMock);

vi.mock("expo-router", () => ({
  useRouter: () => routerMock,
  useLocalSearchParams: () => ({}),
  Link: () => null,
  Stack: { Screen: () => null },
}));

// The crash simulators — factories throw like a binary missing the native
// modules would.
vi.mock("expo-file-system", () => {
  throw new Error("Cannot find native module 'ExpoFileSystem'.");
});
vi.mock("expo-sharing", () => {
  throw new Error("Cannot find native module 'ExpoSharing'.");
});

vi.mock("react-native", async () => {
  const rnw = await import("react-native-web");
  const react = await import("react");
  const mod = {
    ...(rnw as unknown as Record<string, unknown>),
    ...(((rnw as unknown as { default?: Record<string, unknown> }).default) ?? {}),
  } as Record<string, unknown>;
  const RealScrollView = mod.ScrollView as unknown as import("react").FC<Record<string, unknown>>;
  mod.ScrollView = function TestScrollView(props: Record<string, unknown>) {
    const { contentContainerClassName: _dropped, ...rest } = props;
    return react.createElement(RealScrollView, rest);
  };
  return mod;
});

import History from "../app/history";
import Workout from "../app/workout";
import { useAppStore } from "../src/stores/useAppStore";

describe("export on an APK without the export native modules (OTA crash guard)", () => {
  beforeEach(() => {
    useAppStore.setState({
      readinessInputs: [],
      activityLogs: [],
      scheduledEvents: [],
      workoutLogs: [],
      workoutProgress: {},
      activePlan: null,
      personalBests: [],
      backfillNudgesDismissed: [],
    });
    routerMock.navigate.mockClear();
    routerMock.replace.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("calendar renders, export degrades to a note, no crash", async () => {
    render(<History />);

    // The screen itself survives the throwaway imports at module scope…
    expect(screen.getByText("Your data — everything stays on this phone")).toBeTruthy();

    // …and the export press rejects lazily into the friendly note.
    fireEvent.click(screen.getByLabelText("Export all data as a JSON backup"));
    await waitFor(() =>
      expect(screen.getByText("Sharing isn't available on this device.")).toBeTruthy(),
    );
  });

  it("workout screen renders, share degrades to a note, no crash", async () => {
    render(<Workout />);

    // The share press rejects lazily into the friendly note — the screen
    // never crashes on an APK without the share native modules.
    fireEvent.click(screen.getByLabelText("Share this workout"));
    await waitFor(() =>
      expect(screen.getByText("Sharing isn't available on this device.")).toBeTruthy(),
    );
  });
});
