// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const linkingOpenSpy = vi.hoisted(() =>
  vi.fn<(url: string) => Promise<void>>(async () => undefined),
);

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: AsyncStorageMock,
}));

vi.mock("expo-haptics", () => hapticsMock);

// ReminderStatusChip + event-form reminder sync import expo-notifications;
// keep web tests hermetic with a full service surface.
vi.mock("expo-notifications", () => ({
  getPermissionsAsync: vi.fn(async () => ({ granted: false, canAskAgain: true })),
  requestPermissionsAsync: vi.fn(async () => ({ granted: true, canAskAgain: false })),
  scheduleNotificationAsync: vi.fn(async () => "notif-id-1"),
  cancelScheduledNotificationAsync: vi.fn(async () => undefined),
  setNotificationChannelAsync: vi.fn(async () => undefined),
  setNotificationHandler: vi.fn(() => undefined),
  SchedulableTriggerInputTypes: { DAILY: "daily", DATE: "date" },
  AndroidImportance: { DEFAULT: 5, HIGH: 6 },
}));

vi.mock("expo-router", () => ({
  useRouter: () => routerMock,
  useLocalSearchParams: () => searchParamsMock,
  Link: () => null,
  Stack: { Screen: () => null },
}));

const searchParamsMock = vi.hoisted(() => ({ eventId: undefined as string | undefined }));

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
  // Hermetic video-link clicks: never open a real browser in tests.
  mod.Linking = { openURL: linkingOpenSpy };
  return mod;
});

import Index from "../app/index";
import CheckIn from "../app/checkin";
import PracticeLog from "../app/practice-log";
import Workout from "../app/workout";
import History from "../app/history";
import EventForm from "../app/event-form";
import { DEFAULT_ATHLETE_PROFILE } from "../src/config/defaults";
import { toLocalDateString } from "../src/engine/autoregulation";
import { monthLabel } from "../src/lib/calendar";
import { prefillFromIso } from "../src/lib/eventForm";
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
    workoutProgress: {},
    notificationIdentifiers: { scheduleReminders: {} },
  });
  searchParamsMock.eventId = undefined;
}

beforeEach(() => {
  resetStore();
  routerMock.navigate.mockClear();
  routerMock.replace.mockClear();
  linkingOpenSpy.mockClear();
});

afterEach(() => {
  cleanup();
});

describe("home hub (app/index)", () => {
  it("shows the GO status, full battery, and the live workout after a good check-in", () => {
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

    expect(screen.getByText("Vikai Trainer")).toBeTruthy();
    expect(screen.getByText("GO 🟢")).toBeTruthy();
    expect(screen.getByText("100%")).toBeTruthy();
    expect(screen.getByText("Full Send")).toBeTruthy();
    expect(screen.getByText("🔥 2-day streak")).toBeTruthy();
    // The workout lives on Home, ready to be checked off.
    expect(screen.getByText("Today's Game Plan")).toBeTruthy();
    expect(screen.getByText("0/9 checked off")).toBeTruthy();
    expect(screen.getByText(/Check off each block as you go/)).toBeTruthy();
    expect(screen.queryByText(ADULT_ATTENTION_MESSAGE)).toBeNull();
  });

  it("never shows GO without today's check-in (SPEC §27) — battery asks for a charge", () => {
    useAppStore.setState({ readinessInputs: [makeCheckIn(localDate(-1), GOOD_ANCHORS)] });

    render(<Index />);

    expect(screen.queryByText("GO 🟢")).toBeNull();
    expect(screen.getByText("Tap to charge ⚡")).toBeTruthy();
    expect(screen.getByText("No check-in yet")).toBeTruthy();
  });

  it("encourages the check-in and shows its timestamp once done", () => {
    render(<Index />);

    expect(screen.getByText("Check in first")).toBeTruthy();
    expect(screen.getByText("Three taps. Unlocks today's plan.")).toBeTruthy();

    act(() => {
      useAppStore.setState({ readinessInputs: [makeCheckIn(localDate(0), GOOD_ANCHORS)] });
    });
    expect(screen.getByText("Checked in")).toBeTruthy();
    expect(screen.getByText(/update if anything changed/)).toBeTruthy();
  });

  it("guides the sequence: step 1 active, later steps locked until check-in", () => {
    render(<Index />);

    expect(screen.getByText("Your day — 3 steps")).toBeTruthy();
    expect(screen.getByText("1. 3-Tap Check-In")).toBeTruthy();
    expect(screen.getByText("Unlock your power — under 5 sec")).toBeTruthy();
    // Activities come BEFORE the Game Plan: they shape its volume.
    expect(screen.getByText("2. Log your activities")).toBeTruthy();
    expect(screen.getByText("After your check-in")).toBeTruthy();
    expect(screen.getByText("3. Complete your Game Plan")).toBeTruthy();
    expect(screen.getByText("Unlock with your check-in")).toBeTruthy();
  });

  it("renders SHIELD with the whole plan adjusted out on pain concern", () => {
    useAppStore.setState({ readinessInputs: [makeCheckIn(localDate(0), PAIN_ANCHORS)] });

    render(<Index />);

    expect(screen.getByText("SHIELD 🔴")).toBeTruthy();
    expect(screen.getByText("0%")).toBeTruthy();
    expect(screen.getAllByText(ADULT_ATTENTION_MESSAGE)).toHaveLength(2);
    // All nine blocks sit in the adjusted-out group; nothing is checkable.
    expect(screen.getByText("Adjusted out today")).toBeTruthy();
    expect(screen.getAllByText("Not part of today's plan")).toHaveLength(9);
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("navigates every sequence entry point", () => {
    useAppStore.setState({ readinessInputs: [makeCheckIn(localDate(0), GOOD_ANCHORS)] });

    render(<Index />);

    fireEvent.click(screen.getByText("1. 3-Tap Check-In"));
    expect(routerMock.navigate).toHaveBeenCalledWith("/checkin");

    fireEvent.click(screen.getByText("2. Log your activities"));
    expect(routerMock.navigate).toHaveBeenCalledWith("/practice-log");

    fireEvent.click(screen.getByText("3. Complete your Game Plan"));
    expect(routerMock.navigate).toHaveBeenCalledWith("/workout");

    fireEvent.click(screen.getByLabelText("Log an activity"));
    expect(routerMock.navigate).toHaveBeenCalledWith("/practice-log");

    fireEvent.click(screen.getByLabelText("Open full plan"));
    expect(routerMock.navigate).toHaveBeenCalledWith("/workout");

    fireEvent.click(screen.getByText("Calendar"));
    expect(routerMock.navigate).toHaveBeenCalledWith("/history");

    fireEvent.click(screen.getByText(/-day streak/));
    expect(routerMock.navigate).toHaveBeenCalledWith("/history");
  });
});

describe("live session cockpit — check-offs and mid-session rescaling", () => {
  it("checks off a component: persists progress and freezes the completed sets", () => {
    useAppStore.setState({ readinessInputs: [makeCheckIn(localDate(0), GOOD_ANCHORS)] });

    render(<Index />);

    fireEvent.click(screen.getByLabelText("Toggle Squat pattern strength"));

    const day = useAppStore.getState().workoutProgress[localDate(0)];
    expect(day?.["primary-lower-squat"]).toMatchObject({ sets: 4 });
    expect(screen.getByText("1/9 checked off")).toBeTruthy();
    expect(screen.getByText("You did 4 sets")).toBeTruthy();
    // Finish only appears once NOTHING remains to check off.
    expect(screen.queryByLabelText("Finish workout")).toBeNull();
  });

  it("re-scales remaining rows after an activity log lands mid-session", () => {
    useAppStore.setState({ readinessInputs: [makeCheckIn(localDate(0), GOOD_ANCHORS)] });

    render(<Index />);

    // Before: full volume.
    expect(screen.getAllByText("4 sets").length).toBeGreaterThanOrEqual(1);

    // A heavy practice log arrives mid-session (load 900 ≥ 700 threshold).
    act(() => {
      useAppStore.setState({
        activityLogs: [
          {
            id: "mid-session",
            activityDate: localDate(0),
            timezone: TIMEZONE,
            activityType: "TEAM_PRACTICE",
            sessionRpe: 10,
            durationMinutes: 90,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      });
    });

    // Remaining rows re-scale (lower body 4 × 0.6 = 2); the group appears.
    expect(screen.getAllByText("4 → 2 sets").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Adjusted out today")).toBeTruthy();
    // Finishing is available only when nothing remains.
    expect(screen.queryByLabelText("Finish workout")).toBeNull();
  });

  it("finishes the workout: records the log and completes the loop", () => {
    useAppStore.setState({
      readinessInputs: [makeCheckIn(localDate(0), PAIN_ANCHORS)],
    });

    render(<Index />);

    // RED day — everything adjusted out, so the session is finishable.
    fireEvent.click(screen.getByLabelText("Finish workout"));

    expect(useAppStore.getState().workoutLogs).toHaveLength(1);
    expect(useAppStore.getState().workoutLogs[0]?.activityDate).toBe(localDate(0));
    expect(screen.getByText(/Session complete 🎉/)).toBeTruthy();
  });
});

describe("calendar (app/history)", () => {
  it("renders the current month with the day's timestamped timeline", () => {
    const todayKey = localDate(0);
    useAppStore.setState({
      readinessInputs: [makeCheckIn(todayKey, GOOD_ANCHORS)],
      activityLogs: [
        {
          id: "a1",
          activityDate: todayKey,
          timezone: TIMEZONE,
          activityType: "TEAM_PRACTICE",
          sessionRpe: 9,
          durationMinutes: 45,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      scheduledEvents: [
        {
          id: "g1",
          eventType: "GAME",
          startAt: new Date().toISOString(),
          title: "Home opener",
          createdAt: "",
          updatedAt: "",
        },
      ],
    });

    render(<History />);

    const year = Number(todayKey.slice(0, 4));
    const month = Number(todayKey.slice(5, 7));
    expect(screen.getByText(monthLabel(year, month))).toBeTruthy();
    expect(screen.getByText("Ready State locked in")).toBeTruthy();
    expect(screen.getAllByText(/load 405/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/🏆 Game — Home opener/).length).toBeGreaterThanOrEqual(1);

    // The add button and event rows both lead to the event form.
    fireEvent.click(screen.getByLabelText("Add event"));
    expect(routerMock.navigate).toHaveBeenCalledWith("/event-form");

    fireEvent.click(screen.getByLabelText("Edit event: 🏆 Game — Home opener"));
    expect(routerMock.navigate).toHaveBeenCalledWith("/event-form?eventId=g1");
  });

  it("shows the empty-state message for days without records", () => {
    render(<History />);

    // Jump to the previous month — nothing is logged there.
    fireEvent.click(screen.getByLabelText("Previous month"));
    const firstDay = screen.getAllByLabelText(/^Day \d{4}-/)[0];
    if (!firstDay) throw new Error("expected calendar day cells");
    fireEvent.click(firstDay);

    expect(
      screen.getByText("Nothing logged yet — your first session starts today."),
    ).toBeTruthy();
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

    // Offline toast confirms the local save; Home (with the updated plan)
    // takes over from there.
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

    expect(screen.getByText("Today's log (1 entry)")).toBeTruthy();
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
    expect(screen.getByText(/were adjusted out today/)).toBeTruthy();
    expect(screen.getAllByText(ADULT_ATTENTION_MESSAGE)).toHaveLength(2);
  });

  it("shares check-off state with Home and finishes the session", () => {
    useAppStore.setState({
      readinessInputs: [makeCheckIn(localDate(0), GOOD_ANCHORS)],
      workoutProgress: {
        [localDate(0)]: {
          "primary-lower-squat": {
            componentId: "primary-lower-squat",
            sets: 4,
            completedAt: new Date().toISOString(),
          },
        },
      },
    });

    render(<Workout />);

    // Same frozen view as Home — one source of truth in the store.
    expect(screen.getByText("You did 4 sets")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Toggle Upper push strength"));
    expect(
      useAppStore.getState().workoutProgress[localDate(0)]?.["primary-upper-push"],
    ).toMatchObject({ sets: 4 });

    // Full GREEN plan: after checking everything off, Finish appears — here
    // we just prove the shared toggle + navigation CTA work.
    fireEvent.click(screen.getByText("📝 Log an activity"));
    expect(routerMock.navigate).toHaveBeenCalledWith("/practice-log");
  });

  it("renders the game-plan multiplier, REDUCED sets, and the adjusted-out group", () => {
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
    // Sprints, COD, jumps, and optionals are adjusted out for game prep.
    expect(screen.getByText("Adjusted out today")).toBeTruthy();
    expect(screen.getByText(/were adjusted out today/)).toBeTruthy();
  });
});

describe("exercise detail + video library (Fall 2026 plan)", () => {
  // Saturday, September 12 2026 — in-season phase, primary strength day.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-12T14:00:00.000Z"));
    resetStore();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("expands a block into the document's exercises with a working video link", () => {
    useAppStore.setState({ readinessInputs: [makeCheckIn(localDate(0), GOOD_ANCHORS)] });

    render(<Workout />);

    expect(screen.getByText("Fall 2026 · Team practice integration")).toBeTruthy();
    expect(screen.getByText("Practice nights: Tuesday & Thursday.")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("See the work: Squat pattern strength"));

    expect(screen.getAllByText("Trap Bar Deadlift").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("3 × 5").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Dumbbell RDL")).toBeTruthy();
    expect(screen.getByText(/Saturday is your primary strength day/)).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Watch form: Trap Bar Deadlift"));
    expect(linkingOpenSpy).toHaveBeenCalledWith(
      expect.stringContaining("youtube.com/results?search_query=trap+bar+deadlift"),
    );
  });

  it("explains engine scaling inside the expanded block", () => {
    useAppStore.setState({
      readinessInputs: [makeCheckIn(localDate(0), GOOD_ANCHORS)],
      scheduledEvents: [
        { id: "g1", eventType: "GAME", startAt: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString(), createdAt: "", updatedAt: "" },
      ],
    });

    render(<Workout />);

    expect(screen.getByText("4 → 2 sets")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("See the work: Squat pattern strength"));
    expect(screen.getByText("Volume scaled — keep the weight, drop the extra sets.")).toBeTruthy();
  });

  it("keeps locked blocks studyable without making them checkable", () => {
    useAppStore.setState({ readinessInputs: [makeCheckIn(localDate(0), PAIN_ANCHORS)] });

    render(<Workout />);

    expect(screen.getAllByText("Not part of today's plan")).toHaveLength(9);
    fireEvent.click(screen.getByLabelText("See the work: Squat pattern strength"));
    expect(screen.getByText("Not part of today's plan — study it anyway.")).toBeTruthy();
    // The check-off is present but disabled — locked blocks can't be checked.
    const lockedToggle = screen.getByLabelText("Toggle Squat pattern strength");
    expect(lockedToggle.getAttribute("aria-disabled")).toBe("true");
  });
});

describe("workout-relative activity logging", () => {
  it("prompts to log pre-workout activities before the session starts", () => {
    useAppStore.setState({ readinessInputs: [makeCheckIn(localDate(0), GOOD_ANCHORS)] });

    render(<Workout />);

    expect(screen.getByLabelText("Log activities before the workout")).toBeTruthy();

    // Once anything is logged today, the prompt disappears.
    act(() => {
      useAppStore.getState().logActivity({
        activityDate: localDate(0),
        timezone: TIMEZONE,
        activityType: "TEAM_PRACTICE",
        sessionRpe: 6,
        durationMinutes: 60,
      });
    });
    expect(screen.queryByLabelText("Log activities before the workout")).toBeNull();
  });

  it("keeps the practice log open for several same-day entries", () => {
    render(<PracticeLog />);

    // Change the duration, save, and the form resets for the next entry.
    fireEvent.change(screen.getByDisplayValue("60"), { target: { value: "45" } });
    fireEvent.click(screen.getByText("Save activity"));

    expect(screen.getByText("Logged ✓ — add another or head back")).toBeTruthy();
    expect(screen.getByDisplayValue("60")).toBeTruthy(); // form reset
    expect(screen.getByText("Today's log (1 entry)")).toBeTruthy();

    fireEvent.change(screen.getByDisplayValue("60"), { target: { value: "45" } });
    fireEvent.click(screen.getByText("Save activity"));
    expect(screen.getByText("Today's log (2 entries)")).toBeTruthy();

    // Explicit exit — no auto-navigation after save.
    fireEvent.click(screen.getByLabelText("Done logging activities"));
    expect(routerMock.replace).toHaveBeenCalledWith("/");
  });

  it("attributes today's entries around the finished workout", () => {
    const now = new Date();
    const doneAt = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const beforeWorkout = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
    useAppStore.setState({
      workoutLogs: [{ id: "w1", activityDate: localDate(0), createdAt: doneAt, updatedAt: doneAt }],
      activityLogs: [
        {
          id: "a1",
          activityDate: localDate(0),
          createdAt: beforeWorkout,
          updatedAt: beforeWorkout,
          timezone: TIMEZONE,
          activityType: "TEAM_PRACTICE",
          sessionRpe: 7,
          durationMinutes: 60,
        },
        {
          id: "a2",
          activityDate: localDate(0),
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          timezone: TIMEZONE,
          activityType: "SKILL_WORK",
          sessionRpe: 4,
          durationMinutes: 30,
        },
      ],
    });

    render(<PracticeLog />);

    expect(screen.getByText("Today's log (2 entries)")).toBeTruthy();
    expect(screen.getByText("Before today's session — already shaped today")).toBeTruthy();
    expect(screen.getByText("After today's session — shapes your next workout")).toBeTruthy();
  });
});

describe("event form (app/event-form)", () => {
  it("adds a future competition to the calendar via the store", () => {
    render(<EventForm />);

    fireEvent.click(screen.getByText("🥅 Other sport game"));
    fireEvent.change(screen.getByPlaceholderText("2026-01-15"), {
      target: { value: "2100-01-15" },
    });
    fireEvent.change(screen.getByPlaceholderText("18:00"), {
      target: { value: "18:00" },
    });
    fireEvent.change(screen.getByPlaceholderText("Home opener"), {
      target: { value: "Away lacrosse match" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save event" }));

    const events = useAppStore.getState().scheduledEvents;
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe("OTHER_SPORTS_GAME");
    expect(events[0]?.title).toBe("Away lacrosse match");
    // Far-future date: the exact instant depends on DST, so assert the date.
    expect(events[0]?.startAt.startsWith("2100-01-15T")).toBe(true);
  });

  it("rejects a malformed date with a readable error", () => {
    render(<EventForm />);

    fireEvent.change(screen.getByPlaceholderText("2026-01-15"), {
      target: { value: "tomorrow" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save event" }));

    expect(screen.getByText("Use a date like 2026-01-15")).toBeTruthy();
    expect(useAppStore.getState().scheduledEvents).toHaveLength(0);
  });

  it("prefills for editing and removes on demand", () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    useAppStore.setState({
      scheduledEvents: [
        {
          id: "g1",
          eventType: "GAME",
          startAt: future,
          title: "Home opener",
          createdAt: "",
          updatedAt: "",
        },
      ],
    });
    searchParamsMock.eventId = "g1";

    render(<EventForm />);

    expect(screen.getByText("Save changes")).toBeTruthy();
    const dateInput = screen.getByPlaceholderText("2026-01-15") as HTMLInputElement;
    const timeInput = screen.getByPlaceholderText("18:00") as HTMLInputElement;
    const prefill = prefillFromIso(future, TIMEZONE);
    expect(dateInput.value).toBe(prefill.dateText);
    expect(timeInput.value).toBe(prefill.timeText);

    fireEvent.click(screen.getByRole("button", { name: "Delete event" }));
    expect(useAppStore.getState().scheduledEvents).toHaveLength(0);
  });

  it("creates a six-week two-day practice series in one submission", () => {
    render(<EventForm />);

    fireEvent.click(screen.getByText("Every week"));
    // Pre-checked weekday comes from the (empty) date field; pick Tue + Thu.
    fireEvent.click(screen.getByLabelText("Repeat on Tuesday"));
    fireEvent.click(screen.getByLabelText("Repeat on Thursday"));
    fireEvent.change(screen.getByPlaceholderText("2026-01-15"), {
      target: { value: "2100-09-12" },
    });
    fireEvent.change(screen.getByPlaceholderText("18:00"), {
      target: { value: "17:30" },
    });
    // Weeks input defaults to 6 — leave it.

    // Live preview reflects the expansion before saving.
    // 2100-09-12 is a Sunday → first Tue = Sep 14, last series day = Oct 21.
    expect(screen.getByText(/Creates 12 events · Tue, Sep 14 – Thu, Oct 21/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Save event" }));

    const events = useAppStore.getState().scheduledEvents;
    expect(events).toHaveLength(12);
    const seriesIds = new Set(events.map((event) => event.seriesId));
    expect(seriesIds.size).toBe(1);
    expect(events.every((event) => event.eventType === "TEAM_PRACTICE")).toBe(true);
    const dates = events
      .map((event) => event.startAt.slice(0, 10))
      .sort();
    expect(dates[0]).toBe("2100-09-14");
    expect(dates[dates.length - 1]).toBe("2100-10-21");
    // Every member keeps the same typed wall-clock time.
    const timeParts = new Set(events.map((event) => event.startAt.slice(10)));
    expect(timeParts.size).toBe(1);
  });

  it("deletes a whole series from a member's edit screen", () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const oneOff = {
      id: "solo-1",
      eventType: "GAME" as const,
      startAt: future,
      createdAt: "",
      updatedAt: "",
    };
    const series = ["m1", "m2", "m3"].map((id) => ({
      id,
      eventType: "TEAM_PRACTICE" as const,
      startAt: future,
      seriesId: "series-abc",
      createdAt: "",
      updatedAt: "",
    }));
    useAppStore.setState({ scheduledEvents: [oneOff, ...series] });
    searchParamsMock.eventId = "m2";

    render(<EventForm />);

    expect(screen.getByText(/Part of a weekly series \(3 events total\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete series" }));

    const remaining = useAppStore.getState().scheduledEvents;
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.id).toBe("solo-1");
  });

  it("shows the repeat section only for new events and hides it when editing", () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    useAppStore.setState({
      scheduledEvents: [
        { id: "g1", eventType: "GAME", startAt: future, createdAt: "", updatedAt: "" },
      ],
    });
    searchParamsMock.eventId = "g1";

    render(<EventForm />);

    expect(screen.queryByText("Every week")).toBeNull();
    expect(screen.queryByLabelText("Repeat on Tuesday")).toBeNull();
  });
});
