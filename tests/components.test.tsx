// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { FC } from "react";

/**
 * Phase 6 component tests + design refresh: the REAL screens (app/*.tsx) and
 * components render through react-native-web in jsdom, queried with Testing
 * Library. Only module boundaries are mocked: expo-router (navigation),
 * AsyncStorage (persistence), expo-haptics (native-only), and react-native
 * is aliased to react-native-web (dropping the NativeWind-only
 * contentContainerClassName prop that react-native-web does not accept).
 */

const AsyncStorageMock = vi.hoisted(() => ({
  getItem: vi.fn<(key: string) => Promise<string | null>>(async () => null),
  setItem: vi.fn<(key: string, value: string) => Promise<void>>(async () => undefined),
  removeItem: vi.fn<(key: string) => Promise<void>>(async () => undefined),
}));

const routerMock = vi.hoisted(() => ({
  navigate: vi.fn<(route: string) => void>(),
  replace: vi.fn<(route: string) => void>(),
  back: vi.fn<() => void>(),
}));

const hapticsMock = vi.hoisted(() => ({
  impactAsync: vi.fn<(style: unknown) => Promise<void>>(async () => undefined),
  notificationAsync: vi.fn<(type: unknown) => Promise<void>>(async () => undefined),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: AsyncStorageMock,
}));

vi.mock("expo-haptics", () => hapticsMock);

vi.mock("expo-router", () => ({
  useRouter: () => routerMock,
  Link: () => null,
  Stack: { Screen: () => null },
}));

vi.mock("react-native", async () => {
  const rnw = await import("react-native-web");
  const react = await import("react");
  const mod = {
    ...(rnw as unknown as Record<string, unknown>),
    ...(((rnw as unknown as { default?: Record<string, unknown> }).default) ?? {}),
  } as Record<string, unknown>;
  const RealScrollView = mod.ScrollView as unknown as FC<Record<string, unknown>>;
  mod.ScrollView = function TestScrollView(props: Record<string, unknown>) {
    const { contentContainerClassName: _dropped, ...rest } = props;
    return react.createElement(RealScrollView, rest);
  };
  return mod;
});

import Index from "../app/index";
import CheckIn from "../app/checkin";
import PracticeLog from "../app/practice-log";
import Workout from "../app/workout";
import { DEFAULT_ATHLETE_PROFILE } from "../src/config/defaults";
import { toLocalDateString } from "../src/engine/autoregulation";
import { ACTIVITY_TYPE_LABELS } from "../src/lib/format";
import { ADULT_ATTENTION_MESSAGE } from "../src/lib/status";
import { useAppStore } from "../src/stores/useAppStore";
import {
  DEFAULT_OBJECTIVE,
  type EnergyAnchor,
  type JointStatus,
  type ReadinessInput,
  type SleepAnchor,
} from "../src/types";

const TIMEZONE = DEFAULT_ATHLETE_PROFILE.timezone;

function localDate(offsetDays: number): string {
  return toLocalDateString(new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000), TIMEZONE);
}

function makeCheckIn(
  day: string,
  anchors: { sleep: SleepAnchor; joint: JointStatus; energy: EnergyAnchor },
): ReadinessInput {
  const now = new Date().toISOString();
  return {
    id: `checkin-${day}`,
    localDate: day,
    timezone: TIMEZONE,
    recordedAt: now,
    createdAt: now,
    updatedAt: now,
    sleepAnchor: anchors.sleep,
    jointStatus: anchors.joint,
    energyAnchor: anchors.energy,
  };
}

const GOOD_ANCHORS = { sleep: "OVER_8_HRS", joint: "NO_CONCERN", energy: "HIGH" } as const;
const PAIN_ANCHORS = { sleep: "OVER_8_HRS", joint: "PAIN_CONCERN", energy: "HIGH" } as const;

function resetStore(): void {
  useAppStore.setState({
    profile: DEFAULT_ATHLETE_PROFILE,
    trainingObjective: DEFAULT_OBJECTIVE,
    readinessInputs: [],
    activityLogs: [],
    scheduledEvents: [],
    workoutLogs: [],
    notificationIdentifiers: { scheduleReminders: {} },
  });
}

beforeEach(() => {
  resetStore();
  routerMock.navigate.mockClear();
  routerMock.replace.mockClear();
});

afterEach(() => {
  cleanup();
});

describe("home hub (app/index)", () => {
  it("shows the GO status, full battery, and streak after a good check-in", () => {
    useAppStore.setState({
      readinessInputs: [
        makeCheckIn(localDate(-1), GOOD_ANCHORS),
        makeCheckIn(localDate(0), GOOD_ANCHORS),
      ],
      scheduledEvents: [
        { id: "g1", eventType: "GAME", startAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), createdAt: "", updatedAt: "" },
      ],
    });

    render(<Index />);

    expect(screen.getByText("Vikai")).toBeTruthy();
    expect(screen.getByText("GO 🟢")).toBeTruthy();
    expect(screen.getByText("100%")).toBeTruthy();
    expect(screen.getByText("Full Send")).toBeTruthy();
    expect(screen.getByText("🔥 2-day streak")).toBeTruthy();
    expect(screen.getByText("9 kept · 0 reduced · 0 removed")).toBeTruthy();
    expect(screen.getByText("Done for today ✓")).toBeTruthy();
    expect(screen.queryByText(ADULT_ATTENTION_MESSAGE)).toBeNull();
  });

  it("never shows GO without today's check-in (SPEC §27) — battery asks for a charge", () => {
    useAppStore.setState({ readinessInputs: [makeCheckIn(localDate(-1), GOOD_ANCHORS)] });

    render(<Index />);

    expect(screen.queryByText("GO 🟢")).toBeNull();
    expect(screen.getByText("Tap to charge ⚡")).toBeTruthy();
    expect(screen.getByText("No check-in yet")).toBeTruthy();
  });

  it("renders SHIELD with the verbatim adult-attention callout on pain concern", () => {
    useAppStore.setState({ readinessInputs: [makeCheckIn(localDate(0), PAIN_ANCHORS)] });

    render(<Index />);

    expect(screen.getByText("SHIELD 🔴")).toBeTruthy();
    expect(screen.getByText("0%")).toBeTruthy();
    // Status banner + dedicated callout card.
    expect(screen.getAllByText(ADULT_ATTENTION_MESSAGE)).toHaveLength(2);
    expect(screen.getByText("0 kept · 0 reduced · 9 removed")).toBeTruthy();
  });

  it("navigates to game plan and check-in routes from the action cards", () => {
    useAppStore.setState({ readinessInputs: [makeCheckIn(localDate(0), GOOD_ANCHORS)] });

    render(<Index />);

    fireEvent.click(screen.getByText("Open Game Plan 🏀"));
    expect(routerMock.navigate).toHaveBeenCalledWith("/workout");

    fireEvent.click(screen.getByText("3-Tap Check-In"));
    expect(routerMock.navigate).toHaveBeenCalledWith("/checkin");

    fireEvent.click(screen.getByText("Practice Log"));
    expect(routerMock.navigate).toHaveBeenCalledWith("/practice-log");
  });
});

describe("3-tap check-in (app/checkin)", () => {
  it("saves the check-in after all three taps, with toast + navigation", async () => {
    render(<CheckIn />);

    const save = screen.getByRole("button", { name: "Save check-in" });

    // Incomplete check-in must not store anything (outcome, not styling).
    fireEvent.click(save);
    expect(useAppStore.getState().readinessInputs).toHaveLength(0);

    // Tap 1 / 2 / 3 — emoji cards.
    fireEvent.click(screen.getByText("8h+"));
    fireEvent.click(screen.getByText("Zero pain"));
    fireEvent.click(screen.getByText("Hyped"));
    fireEvent.click(save);

    const saved = useAppStore.getState().readinessInputs[0];
    expect(saved?.sleepAnchor).toBe("OVER_8_HRS");
    expect(saved?.jointStatus).toBe("NO_CONCERN");
    expect(saved?.energyAnchor).toBe("HIGH");
    expect(saved?.localDate).toBe(localDate(0));

    // Offline toast confirms the local save; navigation follows shortly.
    expect(screen.getByText("Saved offline · Syncs when back online ✅")).toBeTruthy();
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith("/"), {
      timeout: 3000,
    });
  });

  it("reveals the conditional pain sub-form and requires a location", () => {
    render(<CheckIn />);

    fireEvent.click(screen.getByText("Sharp pain"));

    expect(screen.getByText("Tell us about the pain")).toBeTruthy();
    const location = screen.getByPlaceholderText("Where do you feel it? (e.g. right knee)");
    fireEvent.change(location, { target: { value: "Right knee" } });
    fireEvent.click(screen.getByText("8h+"));
    fireEvent.click(screen.getByText("Hyped"));

    fireEvent.click(screen.getByRole("button", { name: "Save check-in" }));

    const saved = useAppStore.getState().readinessInputs[0];
    expect(saved?.jointStatus).toBe("PAIN_CONCERN");
    expect(saved?.painLocation).toBe("Right knee");
  });
});

describe("practice log (app/practice-log)", () => {
  it("validates the draft and surfaces the exact error", () => {
    render(<PracticeLog />);

    const duration = screen.getByDisplayValue("60");
    fireEvent.change(duration, { target: { value: "abc" } });
    fireEvent.click(screen.getByText("Save activity"));

    expect(screen.getByText("Duration must be between 1 and 600 minutes.")).toBeTruthy();
    expect(useAppStore.getState().activityLogs).toHaveLength(0);
  });

  it("logs a valid activity and shows it under today's log", () => {
    render(<PracticeLog />);

    fireEvent.click(screen.getByLabelText("Effort 9 of 10"));
    expect(screen.getByText("How hard was it? (effort 9/10)")).toBeTruthy();
    expect(screen.getByText(/All Out 🔥/)).toBeTruthy();

    fireEvent.change(screen.getByDisplayValue("60"), { target: { value: "45" } });
    fireEvent.click(screen.getByText("Save activity"));

    const entries = useAppStore.getState().activityLogs;
    expect(entries).toHaveLength(1);
    expect(entries[0]?.activityType).toBe("TEAM_PRACTICE");
    expect(entries[0]?.sessionRpe).toBe(9);
    expect(entries[0]?.durationMinutes).toBe(45);

    expect(screen.getByText("Today's log")).toBeTruthy();
    // Label appears as the selected chip AND in the log row.
    expect(screen.getAllByText(ACTIVITY_TYPE_LABELS.TEAM_PRACTICE).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("9/10 · 45 min · load 405")).toBeTruthy();
  });
});

describe("game plan screen (app/workout)", () => {
  it("shows the unscaled base plan and a charge prompt when no check-in exists", () => {
    render(<Workout />);

    // Gauge + status banner both prompt for the 3-tap check-in.
    expect(screen.getAllByText("Tap to charge ⚡").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/unscaled base plan/i)).toBeTruthy();
    expect(screen.queryAllByText("Not part of today's plan")).toHaveLength(0);
  });

  it("renders the RED prescription: everything locked for joint shielding", () => {
    useAppStore.setState({ readinessInputs: [makeCheckIn(localDate(0), PAIN_ANCHORS)] });

    render(<Workout />);

    expect(screen.getByText("SHIELD 🔴")).toBeTruthy();
    expect(screen.getByText("0% Shielded 🛡️")).toBeTruthy();
    expect(screen.getAllByText("Not part of today's plan")).toHaveLength(9);
    // 6 region locks + 1 plyo lock + 2 high-impact locks = all 9 explicit.
    expect(screen.getAllByText("Locked for Joint Shielding 🛡️")).toHaveLength(6);
    expect(screen.getAllByText("Plyos Paused 🚫")).toHaveLength(1);
    expect(screen.getAllByText("High-Impact Locked 🛡️")).toHaveLength(2);
    expect(screen.getAllByText(ADULT_ATTENTION_MESSAGE)).toHaveLength(2);
  });

  it("renders the game-plan multiplier, REDUCED sets, and lock badges", () => {
    useAppStore.setState({
      readinessInputs: [makeCheckIn(localDate(0), GOOD_ANCHORS)],
      scheduledEvents: [
        { id: "g1", eventType: "GAME", startAt: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString(), createdAt: "", updatedAt: "" },
      ],
    });

    render(<Workout />);

    expect(screen.getByText("MODULATE 🟡")).toBeTruthy();
    expect(screen.getByText("50% Power Save 🌙")).toBeTruthy();
    // Primary lower scales (4 × 0.5 = 2).
    expect(screen.getByText("4 → 2 sets")).toBeTruthy();
    expect(screen.getByText("4 → 3 sets")).toBeTruthy();
    // Sprints, COD, and jumps are high-impact → locked; optionals skipped.
    expect(screen.getAllByText("High-Impact Locked 🛡️").length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByText("Optional — Skipped Today 😴").length).toBeGreaterThanOrEqual(2);
  });
});
