// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { FC } from "react";

/**
 * Phase 6 — Component tests for the UI layer (AGENTS.md QA role).
 *
 * The REAL screens (app/*.tsx) and components render through react-native-web
 * in jsdom, queried with Testing Library. Only module boundaries are mocked:
 * expo-router (navigation), AsyncStorage (persistence), and react-native is
 * aliased to react-native-web (dropping the NativeWind-only
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

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: AsyncStorageMock,
}));

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
import ActivityLog from "../app/activity-log";
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

describe("dashboard (app/index)", () => {
  it("shows the GREEN status after a good check-in", () => {
    useAppStore.setState({
      readinessInputs: [makeCheckIn(localDate(0), GOOD_ANCHORS)],
      scheduledEvents: [
        { id: "g1", eventType: "GAME", startAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), createdAt: "", updatedAt: "" },
      ],
    });

    render(<Index />);

    expect(screen.getByText("Vikai")).toBeTruthy();
    expect(screen.getByText("Ready to go")).toBeTruthy();
    expect(screen.getByText("9 kept · 0 reduced · 0 removed")).toBeTruthy();
    expect(screen.getByText("Completed for today")).toBeTruthy();
    expect(screen.queryByText(ADULT_ATTENTION_MESSAGE)).toBeNull();
  });

  it("never shows GREEN without today's check-in (SPEC §27)", () => {
    useAppStore.setState({ readinessInputs: [makeCheckIn(localDate(-1), GOOD_ANCHORS)] });

    render(<Index />);

    expect(screen.queryByText("Ready to go")).toBeNull();
    expect(screen.getByText("Check-in required")).toBeTruthy();
    expect(screen.getByText("No check-in yet")).toBeTruthy();
  });

  it("renders RED with the verbatim adult-attention callout on pain concern", () => {
    useAppStore.setState({ readinessInputs: [makeCheckIn(localDate(0), PAIN_ANCHORS)] });

    render(<Index />);

    expect(screen.getByText("Training paused")).toBeTruthy();
    // Status banner + dedicated callout card.
    expect(screen.getAllByText(ADULT_ATTENTION_MESSAGE)).toHaveLength(2);
    expect(screen.getByText("0 kept · 0 reduced · 9 removed")).toBeTruthy();
  });

  it("navigates to workout and check-in routes from the action cards", () => {
    useAppStore.setState({ readinessInputs: [makeCheckIn(localDate(0), GOOD_ANCHORS)] });

    render(<Index />);

    fireEvent.click(screen.getByText("View today's workout"));
    expect(routerMock.navigate).toHaveBeenCalledWith("/workout");

    fireEvent.click(screen.getByText("Daily check-in"));
    expect(routerMock.navigate).toHaveBeenCalledWith("/checkin");
  });
});

describe("check-in screen (app/checkin)", () => {
  it("saves the check-in after all three selectors are answered", () => {
    render(<CheckIn />);

    const save = screen.getByRole("button", { name: "Save check-in" });

    // Incomplete check-in must not store anything (outcome, not styling).
    fireEvent.click(save);
    expect(useAppStore.getState().readinessInputs).toHaveLength(0);

    fireEvent.click(screen.getByText("Over 8 hours"));
    fireEvent.click(screen.getByText("No concerns"));
    fireEvent.click(screen.getByText("High"));
    fireEvent.click(save);

    const saved = useAppStore.getState().readinessInputs[0];
    expect(saved?.sleepAnchor).toBe("OVER_8_HRS");
    expect(saved?.jointStatus).toBe("NO_CONCERN");
    expect(saved?.energyAnchor).toBe("HIGH");
    expect(saved?.localDate).toBe(localDate(0));
    expect(routerMock.replace).toHaveBeenCalledWith("/");
  });

  it("reveals the conditional pain sub-form and requires a location", () => {
    render(<CheckIn />);

    fireEvent.click(screen.getByText("Pain"));

    expect(screen.getByText("Tell us about the pain")).toBeTruthy();
    const location = screen.getByPlaceholderText("Where do you feel it? (e.g. right knee)");
    fireEvent.change(location, { target: { value: "Right knee" } });
    fireEvent.click(screen.getByText("Over 8 hours"));
    fireEvent.click(screen.getByText("High"));

    fireEvent.click(screen.getByRole("button", { name: "Save check-in" }));

    const saved = useAppStore.getState().readinessInputs[0];
    expect(saved?.jointStatus).toBe("PAIN_CONCERN");
    expect(saved?.painLocation).toBe("Right knee");
  });
});

describe("activity log screen (app/activity-log)", () => {
  it("validates the draft and surfaces the exact error", () => {
    render(<ActivityLog />);

    const duration = screen.getByDisplayValue("60");
    fireEvent.change(duration, { target: { value: "abc" } });
    fireEvent.click(screen.getByText("Save activity"));

    expect(screen.getByText("Duration must be between 1 and 600 minutes.")).toBeTruthy();
    expect(useAppStore.getState().activityLogs).toHaveLength(0);
  });

  it("logs a valid activity and shows it under today's log", () => {
    render(<ActivityLog />);

    fireEvent.click(screen.getByLabelText("Effort 9 of 10"));
    expect(screen.getByText("How hard was it? (effort 9/10)")).toBeTruthy();

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

describe("workout screen (app/workout)", () => {
  it("explains the unscaled base plan when no check-in exists", () => {
    render(<Workout />);

    expect(screen.getByText(/unscaled base plan/i)).toBeTruthy();
    expect(screen.queryByText("REMOVED")).toBeNull();
    expect(screen.queryByText("REDUCED")).toBeNull();
  });

  it("renders the RED prescription: everything removed, callout shown", () => {
    useAppStore.setState({ readinessInputs: [makeCheckIn(localDate(0), PAIN_ANCHORS)] });

    render(<Workout />);

    expect(screen.getByText("Training paused")).toBeTruthy();
    expect(screen.getAllByText("REMOVED")).toHaveLength(9);
    expect(screen.getAllByText("Not part of today's plan")).toHaveLength(9);
    expect(screen.getAllByText(ADULT_ATTENTION_MESSAGE)).toHaveLength(2);
  });

  it("renders generator scaling output: REDUCED badges and set transitions", () => {
    useAppStore.setState({
      readinessInputs: [makeCheckIn(localDate(0), GOOD_ANCHORS)],
      scheduledEvents: [
        { id: "g1", eventType: "GAME", startAt: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString(), createdAt: "", updatedAt: "" },
      ],
    });

    render(<Workout />);

    expect(screen.getByText("Take it easy")).toBeTruthy();
    // Primary lower scales (4 × 0.5 = 2); jumps/sprints/COD are high-impact
    // and get removed by the game window instead.
    expect(screen.getByText("4 → 2 sets")).toBeTruthy();
    expect(screen.getByText("4 → 3 sets")).toBeTruthy();
    expect(screen.getAllByText("REMOVED").length).toBeGreaterThanOrEqual(3);
  });
});
