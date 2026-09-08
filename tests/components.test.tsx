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
  canGoBack: vi.fn<() => boolean>(() => true),
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

// expo-notifications surface used by the reminder pipeline under test.
const notificationsSpy = vi.hoisted(() => ({
  schedule: vi.fn<(request: unknown) => Promise<string>>(async () => "notif-id-1"),
  cancel: vi.fn<(id: string) => Promise<void>>(async () => undefined),
}));

// Phase 9.12 export — capture what the share sheet would deliver. (The
// missing-native-module simulation lives in export-crash-guard.test.tsx,
// where the throwing vi.mock factory can't be cached by earlier tests.)
const sharingSpy = vi.hoisted(() => ({
  shareAsync: vi.fn<(uri: string, options?: unknown) => Promise<void>>(async () => undefined),
  isAvailableAsync: vi.fn<() => Promise<boolean>>(async () => true),
}));
const fileWrites = vi.hoisted(() => ({
  list: [] as Array<{ uri: string; content: string }>,
}));

vi.mock("expo-file-system", () => ({
  Paths: { cache: { uri: "file:///cache/" } },
  File: class {
    uri: string;
    constructor(base: { uri: string }, name: string) {
      this.uri = `${base.uri}${name}`;
    }
    write(content: string): void {
      fileWrites.list.push({ uri: this.uri, content });
    }
  },
}));

vi.mock("expo-sharing", () => ({
  shareAsync: sharingSpy.shareAsync,
  isAvailableAsync: sharingSpy.isAvailableAsync,
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: AsyncStorageMock,
}));

vi.mock("expo-haptics", () => hapticsMock);

// ReminderStatusChip + event-form reminder sync import expo-notifications;
// keep web tests hermetic with a full service surface.
vi.mock("expo-notifications", () => ({
  getPermissionsAsync: vi.fn(async () => ({ granted: false, canAskAgain: true })),
  requestPermissionsAsync: vi.fn(async () => ({ granted: true, canAskAgain: false })),
  scheduleNotificationAsync: notificationsSpy.schedule,
  cancelScheduledNotificationAsync: notificationsSpy.cancel,
  setNotificationChannelAsync: vi.fn(async () => undefined),
  setNotificationHandler: vi.fn(() => undefined),
  SchedulableTriggerInputTypes: { DAILY: "daily", DATE: "date" },
  AndroidImportance: { DEFAULT: 5, HIGH: 6 },
}));

// Captures per-screen <Stack.Screen options={...}> so header wiring
// (headerRight buttons) is assertable — jsdom never renders native headers.
const stackScreenOptionsSpy = vi.hoisted(() => vi.fn<(options: unknown) => void>(() => undefined));

vi.mock("expo-router", () => ({
  useRouter: () => routerMock,
  useLocalSearchParams: () => searchParamsMock,
  Link: () => null,
  Stack: {
    Screen: (props: { options?: unknown }) => {
      stackScreenOptionsSpy(props.options);
      return null;
    },
  },
}));

const searchParamsMock = vi.hoisted(() => ({
  eventId: undefined as string | undefined,
  date: undefined as string | undefined,
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
  // Hermetic video-link clicks: never open a real browser in tests.
  mod.Linking = { openURL: linkingOpenSpy };
  return mod;
});

import type { ReactElement } from "react";

import Index from "../app/index";
import About from "../app/about";
import Plan from "../app/plan";
import CheckIn from "../app/checkin";
import PracticeLog from "../app/practice-log";
import Workout from "../app/workout";
import History from "../app/history";
import EventForm from "../app/event-form";
import { HeaderBack } from "../src/components/HeaderBack";
import Settings from "../app/settings";
import { DEFAULT_ATHLETE_PROFILE } from "../src/config/defaults";
import { toLocalDateString } from "../src/engine/autoregulation";
import { monthLabel } from "../src/lib/calendar";
import { prefillFromIso } from "../src/lib/eventForm";
import { ACTIVITY_TYPE_LABELS } from "../src/lib/format";
import { ADULT_ATTENTION_MESSAGE } from "../src/lib/status";
import { DEFAULT_TEAM_COLORS } from "../src/lib/theme";
import { useAppStore } from "../src/stores/useAppStore";
import {
  DEFAULT_BASE_PLAN,
} from "../src/plans/basePlan";
import {
  DEFAULT_OBJECTIVE,
  type EnergyAnchor,
  type JointStatus,
  type ReadinessInput,
  type SleepAnchor,
  type SoreArea,
} from "../src/types";

const TIMEZONE = DEFAULT_ATHLETE_PROFILE.timezone;

function localDate(offsetDays: number): string {
  return toLocalDateString(new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000), TIMEZONE);
}

function makeCheckIn(
  day: string,
  anchors: {
    sleep: SleepAnchor;
    joint: JointStatus;
    energy: EnergyAnchor;
    soreAreas?: readonly SoreArea[];
  },
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
    ...(anchors.soreAreas !== undefined ? { soreAreas: anchors.soreAreas } : {}),
  };
}

const GOOD_ANCHORS = { sleep: "OVER_8_HRS", joint: "NO_CONCERN", energy: "HIGH" } as const;
const PAIN_ANCHORS = { sleep: "OVER_8_HRS", joint: "PAIN_CONCERN", energy: "HIGH" } as const;

/**
 * Re-clocks the frozen fake Date to Tuesday 2026-01-06 — a pre-season FULL
 * (high) day under the week structure. Tests that exercise full-template
 * blocks (the squat, the speed stack) re-clock; Monday/Wednesday/Friday are
 * pre-season LOW days and Sunday is recovery.
 */
function reClockToFullDay(): void {
  vi.setSystemTime(new Date("2026-01-06T15:00:00.000Z"));
}

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
    activePlan: null,
    personalBests: [],
    teamColors: DEFAULT_TEAM_COLORS,
    backfillNudgesDismissed: [],
  });
  searchParamsMock.eventId = undefined;
  searchParamsMock.date = undefined;
  sharingSpy.shareAsync.mockClear();
  sharingSpy.isAvailableAsync.mockClear();
  sharingSpy.isAvailableAsync.mockResolvedValue(true);
  fileWrites.list.length = 0;
}

beforeEach(() => {
  // Freeze the clock on Monday, Jan 5 2026 — a full-template weekday — so
  // the weekday-structured default plan is deterministic in every test.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-01-05T15:00:00.000Z"));
  resetStore();
  routerMock.navigate.mockClear();
  routerMock.replace.mockClear();
  routerMock.back.mockClear();
  routerMock.canGoBack.mockReturnValue(true);
  linkingOpenSpy.mockClear();
  stackScreenOptionsSpy.mockClear();
  notificationsSpy.schedule.mockClear();
  notificationsSpy.cancel.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
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
    expect(screen.getByText("100%")).toBeTruthy();
    expect(screen.getByText("Full Send")).toBeTruthy();
    expect(screen.getByText("🔥 2-day streak")).toBeTruthy();
    // The battery alone carries the engine state on Home — no status banner.
    expect(screen.queryByText("GO 🟢")).toBeNull();
    // The Game Plan summary opens the full session on /workout.
    expect(screen.getByText("Today's Game Plan")).toBeTruthy();
    expect(screen.getByText("0/5 checked off")).toBeTruthy(); // pre-season Monday = low day
    expect(screen.getByLabelText("Open today's session")).toBeTruthy();
    expect(screen.queryByText(ADULT_ATTENTION_MESSAGE)).toBeNull();
  });

  it("keeps the battery full when only a body part is sore (Phase 9.8)", () => {
    useAppStore.setState({
      readinessInputs: [
        makeCheckIn(localDate(0), { ...GOOD_ANCHORS, soreAreas: ["ARM"] }),
      ],
    });

    render(<Index />);

    // One sore arm is block-targeted: the day itself is GREEN — full battery,
    // no Power Save recoloring. The sore line carries the signal instead.
    expect(screen.getByText("100%")).toBeTruthy();
    expect(screen.getByText("Full Send")).toBeTruthy();
    expect(screen.queryByText("Power Save")).toBeNull();
    expect(screen.getByText(/Sore today: Arm — those blocks are scaled\./)).toBeTruthy();
  });

  it("never shows GO without today's check-in (SPEC §27) — battery asks for a charge", () => {
    useAppStore.setState({ readinessInputs: [makeCheckIn(localDate(-1), GOOD_ANCHORS)] });

    render(<Index />);

    // The battery alone carries the state on Home — neutral charge prompt.
    expect(screen.queryByText("GO 🟢")).toBeNull();
    expect(screen.getByText("?")).toBeTruthy();
    expect(screen.getByText("Tap to charge")).toBeTruthy();
    expect(screen.getByText("Check-in pending")).toBeTruthy();
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

    // The battery alone carries the state — Shielded at 0%, no banner.
    expect(screen.getByText("0%")).toBeTruthy();
    expect(screen.getByText("Shielded")).toBeTruthy();
    expect(screen.queryByText("SHIELD 🔴")).toBeNull();
    // The safety message appears exactly once, right under the battery.
    expect(screen.getAllByText(ADULT_ATTENTION_MESSAGE)).toHaveLength(1);
    // The full checklist moved to /workout; Home shows the summary card
    // with everything adjusted out.
    expect(screen.queryByText("Adjusted out today")).toBeNull();
    expect(screen.getByText(/5 blocks adjusted out today/)).toBeTruthy();
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

    // The Game Plan summary card is the route into the full session.
    fireEvent.click(screen.getByLabelText("Open today's session"));
    expect(routerMock.navigate).toHaveBeenCalledWith("/workout");

    fireEvent.click(screen.getByText("Calendar"));
    expect(routerMock.navigate).toHaveBeenCalledWith("/history");

    fireEvent.click(screen.getByText(/-day streak/));
    expect(routerMock.navigate).toHaveBeenCalledWith("/history");
  });
});

describe("game plan session screen — check-offs and mid-session rescaling", () => {
  it("checks off a component: persists progress and freezes the completed sets", () => {
    reClockToFullDay(); // the squat lives on pre-season high days (Tue/Thu/Sat)
    useAppStore.setState({ readinessInputs: [makeCheckIn(localDate(0), GOOD_ANCHORS)] });

    render(<Workout />);

    fireEvent.click(screen.getByLabelText("Toggle Squat pattern strength"));

    const day = useAppStore.getState().workoutProgress[localDate(0)];
    expect(day?.["primary-lower-squat"]).toMatchObject({ sets: 4 });
    expect(screen.getByText("You did 4 sets · tap to undo")).toBeTruthy();
    // Finish only appears once NOTHING remains to check off.
    expect(screen.queryByLabelText("Finish workout")).toBeNull();
  });

  it("undoes a mistaken check-off and re-checks at the current volume", () => {
    reClockToFullDay();
    useAppStore.setState({ readinessInputs: [makeCheckIn(localDate(0), GOOD_ANCHORS)] });

    render(<Workout />);

    // Mistake: check the squat, then undo it via the advertised affordance.
    fireEvent.click(screen.getByLabelText("Toggle Squat pattern strength"));
    expect(screen.getByText("You did 4 sets · tap to undo")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Toggle Squat pattern strength"));
    expect(screen.getAllByText("4 sets").length).toBeGreaterThanOrEqual(1);
    expect(useAppStore.getState().workoutProgress[localDate(0)]?.["primary-lower-squat"]).toBeUndefined();

    // Re-check: the block freezes again (still at the current scaled volume).
    fireEvent.click(screen.getByLabelText("Toggle Squat pattern strength"));
    expect(useAppStore.getState().workoutProgress[localDate(0)]?.["primary-lower-squat"]).toMatchObject({
      sets: 4,
    });
  });

  it("allows correcting check-offs after the session is finished", () => {
    reClockToFullDay(); // the GREEN-flow correction expects the squat present
    useAppStore.setState({ readinessInputs: [makeCheckIn(localDate(0), PAIN_ANCHORS)] });

    render(<Workout />);

    // RED day — everything adjusted out, so the session is finishable. The
    // two-step Finish still logs without body notes on the skip path.
    fireEvent.click(screen.getByLabelText("Finish workout"));
    fireEvent.click(screen.getByRole("button", { name: "Close session without body notes" }));
    expect(screen.getByText(/Session complete 🎉/)).toBeTruthy();

    // GREEN flow correction: a finished session where the athlete notices a
    // mistaken check-off. Seed a good-day prescription with the squat done.
    act(() => {
      useAppStore.setState({ readinessInputs: [makeCheckIn(localDate(0), GOOD_ANCHORS)] });
      useAppStore.setState({
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
    });

    // The workout log exists, yet the mistaken check-off can still be undone.
    expect(screen.getByText("You did 4 sets · tap to undo")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Toggle Squat pattern strength"));
    expect(
      useAppStore.getState().workoutProgress[localDate(0)]?.["primary-lower-squat"],
    ).toBeUndefined();
    expect(screen.getAllByText("4 sets").length).toBeGreaterThanOrEqual(1);
    // The log itself is untouched — one record, still complete.
    expect(useAppStore.getState().workoutLogs).toHaveLength(1);
    expect(screen.getByText(/Session complete 🎉/)).toBeTruthy();
  });

  it("re-scales remaining rows after an activity log lands mid-session", () => {
    reClockToFullDay();
    useAppStore.setState({ readinessInputs: [makeCheckIn(localDate(0), GOOD_ANCHORS)] });

    render(<Workout />);

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

  it("finishes the workout from the Home summary card on a RED day", () => {
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

    // The game is reachable from the Today timeline and the week list.
    const gameRows = screen.getAllByLabelText("Edit event: 🏆 Game — Home opener");
    const gameRow = gameRows[0];
    if (!gameRow) throw new Error("expected an editable game row");
    fireEvent.click(gameRow);
    expect(routerMock.navigate).toHaveBeenCalledWith("/event-form?eventId=g1");
  });

  it("shows the empty-state message for days without records", () => {
    render(<History />);

    // Jump to the previous month — nothing is logged there.
    fireEvent.click(screen.getByLabelText("Previous month"));
    const firstDay = screen.getAllByLabelText(/^Day \d{4}-/)[0];
    if (!firstDay) throw new Error("expected calendar day cells");
    fireEvent.click(firstDay);

    // The chosen day's contents render inside the Scheduled card.
    expect(
      screen.getByText("Nothing scheduled or logged for this day."),
    ).toBeTruthy();
  });

  it("defaults the Scheduled section to the next 7 days", () => {
    useAppStore.setState({
      scheduledEvents: [
        {
          id: "p1",
          eventType: "TEAM_PRACTICE",
          startAt: "2026-01-07T23:00:00.000Z", // Wed Jan 7, 6 PM ET
          title: "Team practice",
          createdAt: "",
          updatedAt: "",
        },
        {
          id: "far",
          eventType: "GAME",
          startAt: "2026-02-15T23:00:00.000Z", // far beyond the 7-day window
          title: "Away game",
          createdAt: "",
          updatedAt: "",
        },
      ],
    });

    render(<History />);

    // Week rows: Today / Tomorrow labels, then formatted day labels.
    expect(screen.getAllByText("Today").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Tomorrow")).toBeTruthy();
    expect(screen.getByText("Wed, Jan 7")).toBeTruthy();
    expect(screen.getByText("Thu, Jan 8")).toBeTruthy(); // a quiet day still shows

    // Every day carries its planned focus from the weekday template.
    // January is pre-season: Mon/Wed/Fri low, Tue/Thu/Sat high.
    expect(screen.getAllByText("Planned: Strength + speed").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Planned: Skills + tempo primer").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Planned: Recovery & skills")).toBeTruthy();

    // The Wednesday practice sits under its day with its local time.
    expect(screen.getByText("🏀 Team practice — Team practice")).toBeTruthy();
    expect(screen.getByText("6:00 PM")).toBeTruthy();

    // Events beyond the window stay off the week list.
    expect(screen.queryByText(/Away game/)).toBeNull();
  });

  it("shows the chosen day's contents in the Scheduled card, with a way back", () => {
    useAppStore.setState({
      scheduledEvents: [
        {
          id: "g1",
          eventType: "GAME",
          startAt: "2026-01-09T23:00:00.000Z", // Fri Jan 9, 6 PM ET
          title: "Rivalry night",
          createdAt: "",
          updatedAt: "",
        },
      ],
    });

    render(<History />);

    // Default view is the week list — the Friday game is inside the window.
    expect(screen.getByText("Fri, Jan 9")).toBeTruthy();

    // Choose Friday the 9th: its contents land in the Scheduled card.
    fireEvent.click(screen.getByLabelText("Day 2026-01-09"));
    expect(screen.getByText("Fri, Jan 9")).toBeTruthy(); // sub-header + week label
    expect(screen.getByText("🏆 Game — Rivalry night")).toBeTruthy();
    expect(
      screen.getAllByText("Planned: Skills + tempo primer — Base template").length,
    ).toBeGreaterThanOrEqual(1); // Friday is a pre-season low day; Monday matches

    // Back to the default week view.
    fireEvent.click(screen.getByLabelText("Show next 7 days"));
    expect(screen.getByText("Tomorrow")).toBeTruthy();
    expect(screen.getByText("🏆 Game — Rivalry night")).toBeTruthy();
  });

  it("shows the planned workout for today and future days (Phase B)", () => {
    useAppStore.setState({
      scheduledEvents: [
        {
          id: "p1",
          eventType: "TEAM_PRACTICE",
          startAt: "2026-01-07T23:00:00.000Z", // Wed Jan 7, 6 PM ET
          title: "Team practice",
          createdAt: "",
          updatedAt: "",
        },
      ],
    });

    render(<History />);

    // Today (frozen Monday, pre-season low day) — the low-day template runs.
    expect(
      screen.getAllByText("Planned: Skills + tempo primer — Base template").length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Planned workout")).toBeTruthy();

    // Wednesday (pre-season low day) — skills + tempo primer planned.
    fireEvent.click(screen.getByLabelText("Day 2026-01-07"));
    expect(
      screen.getAllByText("Planned: Skills + tempo primer — Base template").length,
    ).toBeGreaterThanOrEqual(1); // Today card (Monday) + chosen Wednesday
    // The practice shows in the chosen-day timeline inside the Scheduled card.
    expect(screen.getAllByText(/Team practice/).length).toBeGreaterThanOrEqual(1);

    // Sunday — recovery-only plan.
    fireEvent.click(screen.getByLabelText("Day 2026-01-11"));
    expect(screen.getByText("Planned: Recovery & skills — Base template")).toBeTruthy();
  });
});

describe("team skin settings (app/settings, Phase C)", () => {
  it("wires a gear button into the Home header pointing at the skin settings", () => {
    render(<Index />);

    // The header button is declared via <Stack.Screen options={{ headerRight }}>
    // — the spy captures it because jsdom never renders the native header.
    const headerEntry = stackScreenOptionsSpy.mock.calls
      .map((call) => call[0] as { headerRight?: () => ReactElement })
      .find((options) => typeof options?.headerRight === "function");
    expect(headerEntry).toBeDefined();

    render((headerEntry?.headerRight ?? (() => null))());
    fireEvent.click(screen.getByLabelText("Team skin settings"));
    expect(routerMock.navigate).toHaveBeenCalledWith("/settings");
  });

  it("repaints instantly from swatches and custom hex, with reset", () => {
    render(<Settings />);

    // Swatch taps apply immediately.
    fireEvent.click(screen.getByLabelText("Primary color: Navy"));
    expect(useAppStore.getState().teamColors.primary).toBe("#001F3F");
    fireEvent.click(screen.getByLabelText("Secondary color: Forest green"));
    expect(useAppStore.getState().teamColors.secondary).toBe("#228B22");

    // Custom hex accepts 6-digit values without the # too.
    const input = screen.getByLabelText("Primary color custom hex");
    fireEvent.change(input, { target: { value: "9B1B30" } });
    fireEvent.click(screen.getByLabelText("Apply custom primary color"));
    expect(useAppStore.getState().teamColors.primary).toBe("#9B1B30");

    // Invalid hex shows the hint and changes nothing.
    fireEvent.change(input, { target: { value: "zzz" } });
    fireEvent.click(screen.getByLabelText("Apply custom primary color"));
    expect(screen.getByText(/Use a hex color like #228B22/)).toBeTruthy();
    expect(useAppStore.getState().teamColors.primary).toBe("#9B1B30");

    // Reset restores the white + forest green default.
    fireEvent.click(screen.getByLabelText("Reset to team default"));
    expect(useAppStore.getState().teamColors).toEqual(DEFAULT_TEAM_COLORS);
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

describe("check-in body map (Phase 7)", () => {
  it("is hidden entirely on the pain path — the §16 override owns that day", () => {
    render(<CheckIn />);

    fireEvent.click(screen.getByText("Sharp pain"));

    expect(screen.queryByText("Optional — Body map 🗺️")).toBeNull();
  });

  it("stays optional: saving without flags stores no soreAreas", () => {
    render(<CheckIn />);

    fireEvent.click(screen.getByText("8h+"));
    fireEvent.click(screen.getByText("Zero pain"));
    fireEvent.click(screen.getByText("Hyped"));
    fireEvent.click(screen.getByRole("button", { name: "Save check-in" }));

    const saved = useAppStore.getState().readinessInputs[0];
    expect(saved?.jointStatus).toBe("NO_CONCERN");
    expect(saved?.soreAreas).toBeUndefined();
  });

  it("steps region → areas, persists flags, and shows the summary", () => {
    render(<CheckIn />);

    // Step 1: region cards. Step 2: area chips inside the flagged region.
    fireEvent.click(screen.getByRole("button", { name: "Legs" }));
    expect(screen.getByText("What's sore in the legs?")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Quad" }));
    expect(screen.getByRole("button", { name: "Quad flagged as sore" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Calf" }));
    expect(screen.getByText("Sore today: Quad, Calf")).toBeTruthy();

    fireEvent.click(screen.getByText("8h+"));
    fireEvent.click(screen.getByText("Zero pain"));
    fireEvent.click(screen.getByText("Hyped"));
    fireEvent.click(screen.getByRole("button", { name: "Save check-in" }));

    const saved = useAppStore.getState().readinessInputs[0];
    expect(saved?.soreAreas).toEqual(["QUAD", "CALF"]);
  });

  it("clears a region's flags when the region is collapsed", () => {
    render(<CheckIn />);

    fireEvent.click(screen.getByRole("button", { name: "Legs" }));
    fireEvent.click(screen.getByRole("button", { name: "Quad" }));
    expect(screen.getByText("Sore today: Quad")).toBeTruthy();

    // Collapse the region — state never lingers behind a closed step.
    fireEvent.click(screen.getByRole("button", { name: "Legs" }));
    expect(screen.queryByText("Sore today: Quad")).toBeNull();
    expect(screen.queryByRole("button", { name: "Quad" })).toBeNull();

    fireEvent.click(screen.getByText("8h+"));
    fireEvent.click(screen.getByText("Zero pain"));
    fireEvent.click(screen.getByText("Hyped"));
    fireEvent.click(screen.getByRole("button", { name: "Save check-in" }));

    expect(useAppStore.getState().readinessInputs[0]?.soreAreas).toBeUndefined();
  });
});

describe("post-session body map at Finish (Phase 8.1)", () => {
  function fullyCheckedProgress(): Record<string, Record<string, { componentId: string; sets: number; completedAt: string }>> {
    const day: Record<string, { componentId: string; sets: number; completedAt: string }> = {};
    for (const component of DEFAULT_BASE_PLAN) {
      day[component.id] = { componentId: component.id, sets: 2, completedAt: "" };
    }
    return { [localDate(0)]: day };
  }

  it("reveals the body map on Finish and saves sore areas into the workout log", () => {
    useAppStore.setState({
      readinessInputs: [makeCheckIn(localDate(0), GOOD_ANCHORS)],
      workoutProgress: fullyCheckedProgress(),
    });

    render(<Workout />);

    // Step 1: the Finish CTA only opens the body map — nothing is logged yet.
    fireEvent.click(screen.getByRole("button", { name: "Finish workout" }));
    expect(
      screen.getByText("Before you close the session — how does the body feel? 🗺️"),
    ).toBeTruthy();
    expect(useAppStore.getState().workoutLogs).toHaveLength(0);

    // Step 2: flag a sore area and close.
    fireEvent.click(screen.getByRole("button", { name: "Legs" }));
    fireEvent.click(screen.getByRole("button", { name: "Quad" }));
    fireEvent.click(screen.getByRole("button", { name: "Save and close session" }));

    const logs = useAppStore.getState().workoutLogs;
    expect(logs).toHaveLength(1);
    expect(logs[0]?.activityDate).toBe(localDate(0));
    expect(logs[0]?.soreAreasAfter).toEqual(["QUAD"]);
    expect(routerMock.navigate).toHaveBeenCalledWith("/practice-log");
  });

  it("closes without notes when the athlete skips the body map", () => {
    useAppStore.setState({
      readinessInputs: [makeCheckIn(localDate(0), GOOD_ANCHORS)],
      workoutProgress: fullyCheckedProgress(),
    });

    render(<Workout />);

    fireEvent.click(screen.getByRole("button", { name: "Finish workout" }));
    fireEvent.click(screen.getByRole("button", { name: "Close session without body notes" }));

    const logs = useAppStore.getState().workoutLogs;
    expect(logs).toHaveLength(1);
    expect(logs[0]?.soreAreasAfter).toBeUndefined();
  });

  it("shows the soreness visibility line on the session screen", () => {
    useAppStore.setState({
      readinessInputs: [makeCheckIn(localDate(0), { ...GOOD_ANCHORS, soreAreas: ["QUAD", "CALF"] })],
    });

    render(<Workout />);

    expect(
      screen.getByText(/Sore today: Quad, Calf — blocks targeting them are scaled/),
    ).toBeTruthy();
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

    // Gauge prompts for the 3-tap check-in.
    expect(screen.getByText("Tap to charge")).toBeTruthy();
    expect(screen.getByText(/unscaled base plan/i)).toBeTruthy();
    expect(screen.queryAllByText("Not part of today's plan")).toHaveLength(0);
  });

  it("renders the RED prescription: everything locked for joint shielding", () => {
    useAppStore.setState({ readinessInputs: [makeCheckIn(localDate(0), PAIN_ANCHORS)] });

    render(<Workout />);

    expect(screen.getByText("SHIELD 🔴")).toBeTruthy();
    expect(screen.getByText("0%")).toBeTruthy();
    expect(screen.getByText("Shielded")).toBeTruthy();
    expect(screen.getAllByText("Not part of today's plan")).toHaveLength(5); // pre-season Monday low day
    expect(screen.getByText(/were adjusted out today/)).toBeTruthy();
    // The banner carries the safety message now — exactly once.
    expect(screen.getAllByText(ADULT_ATTENTION_MESSAGE)).toHaveLength(1);
  });

  it("shares check-off state with Home and finishes the session", () => {
    reClockToFullDay(); // the seeded squat progress needs a full-template day
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
    expect(screen.getByText("You did 4 sets · tap to undo")).toBeTruthy();

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
    reClockToFullDay(); // primer-day geometry needs a full-template day
    useAppStore.setState({
      readinessInputs: [makeCheckIn(localDate(0), GOOD_ANCHORS)],
      scheduledEvents: [
        { id: "g1", eventType: "GAME", startAt: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString(), createdAt: "", updatedAt: "" },
      ],
    });

    render(<Workout />);

    expect(screen.getByText("MODULATE 🟡")).toBeTruthy();
    expect(screen.getByText("50%")).toBeTruthy();
    expect(screen.getByText("Power Save")).toBeTruthy();
    // Primary lower scales (4 × 0.5 = 2) — and the allowed primer-day
    // jump mechanics scale the same way (4 × 0.5 = 2), per SPEC §17.
    expect(screen.getAllByText("4 → 2 sets").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("4 → 3 sets")).toBeTruthy();
    // Sprints, COD, and optionals are adjusted out for game prep.
    expect(screen.getByText("Adjusted out today")).toBeTruthy();
    expect(screen.getByText(/were adjusted out today/)).toBeTruthy();
  });

  it("scales the sore arm's work while the battery stays green (Phase 9.8)", () => {
    useAppStore.setState({
      readinessInputs: [
        makeCheckIn(localDate(0), { ...GOOD_ANCHORS, soreAreas: ["ARM"] }),
      ],
    });

    render(<Workout />);

    // Green day, dialed-down arm work: the primary upper push (partial ARM
    // overlap) scales to 0.6×; the optional upper accessory strips entirely;
    // everything non-arm runs as planned at full volume.
    expect(screen.getByText("100%")).toBeTruthy();
    expect(screen.getByText("Full Send")).toBeTruthy();
    expect(screen.getByText("4 → 2 sets")).toBeTruthy(); // primary-upper-push
    expect(screen.getByText(/1 block was adjusted out today/)).toBeTruthy(); // accessory-upper strips (optional)
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
    expect(screen.getByText("Practice nights: Tuesday, Wednesday & Thursday.")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("See the work: Squat pattern strength"));

    expect(screen.getAllByText("Trap Bar Deadlift").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("3 × 5").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Dumbbell RDL")).toBeTruthy();
    expect(screen.getByText(/Saturday is your primary strength day/)).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Watch form: Trap Bar Deadlift"));
    // Phase 9.10 — curated specific video, never a search page.
    expect(linkingOpenSpy).toHaveBeenCalledWith(
      expect.stringContaining("youtube.com/watch?v="),
    );
    expect(screen.getAllByText("Needs internet").length).toBeGreaterThanOrEqual(1);
  });

  it("explains engine scaling inside the expanded block", () => {
    useAppStore.setState({
      readinessInputs: [makeCheckIn(localDate(0), GOOD_ANCHORS)],
      scheduledEvents: [
        { id: "g1", eventType: "GAME", startAt: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString(), createdAt: "", updatedAt: "" },
      ],
    });

    render(<Workout />);

    expect(screen.getAllByText("4 → 2 sets").length).toBeGreaterThanOrEqual(1);
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
    expect(screen.getByText("Before the session — already shaped that day")).toBeTruthy();
    expect(screen.getByText("After the session — shapes the next workout")).toBeTruthy();
  });
});

describe("editable entries: scheduled list, reschedule resync, activity edit", () => {
  it("lists upcoming commitments on the Calendar and opens the editor from one list", () => {
    const future = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    useAppStore.setState({
      scheduledEvents: [
        {
          id: "p1",
          eventType: "TEAM_PRACTICE",
          startAt: future,
          title: "Fall block",
          seriesId: "series-1",
          createdAt: "",
          updatedAt: "",
        },
      ],
    });

    render(<History />);

    // One list, regardless of which day the grid shows.
    expect(screen.getByText("Scheduled — tap to change time or day")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Edit event: 🏀 Team practice — Fall block"));
    expect(routerMock.navigate).toHaveBeenCalledWith("/event-form?eventId=p1");
  });

  it("moves the reminder when a future event is rescheduled", async () => {
    const future = new Date(Date.now() + 48 * 60 * 60 * 1000);
    useAppStore.setState({
      scheduledEvents: [
        {
          id: "p1",
          eventType: "TEAM_PRACTICE",
          startAt: future.toISOString(),
          createdAt: "",
          updatedAt: "",
        },
      ],
      // A reminder for the OLD time is already armed and tracked.
      notificationIdentifiers: { scheduleReminders: { p1: "old-notif-id" } },
    });
    searchParamsMock.eventId = "p1";

    render(<EventForm />);

    const newDay = new Date(Date.now() + 96 * 60 * 60 * 1000);
    const prefill = prefillFromIso(newDay.toISOString(), TIMEZONE);
    fireEvent.change(screen.getByPlaceholderText("2026-01-15"), {
      target: { value: prefill.dateText },
    });
    fireEvent.change(screen.getByPlaceholderText("18:00"), {
      target: { value: prefill.timeText },
    });
    // The reminder resync is fire-and-forget async — wait for it to land.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save event" }));
    });
    await waitFor(() => expect(notificationsSpy.schedule).toHaveBeenCalled());

    const events = useAppStore.getState().scheduledEvents;
    expect(events).toHaveLength(1);
    expect(events[0]?.startAt.startsWith(newDay.toISOString().slice(0, 10))).toBe(true);
    // The reminder re-arms at the new instant (stale one cancelled first).
    expect(notificationsSpy.cancel).toHaveBeenCalled();
    expect(notificationsSpy.schedule).toHaveBeenCalled();
    expect(notificationsSpy.schedule.mock.calls[0]?.[0]).toMatchObject({
      content: { title: "Vikai Trainer schedule reminder" },
    });
  });

  it("edits today's activity entries in place without duplicating", () => {
    render(<PracticeLog />);

    fireEvent.change(screen.getByDisplayValue("60"), { target: { value: "45" } });
    fireEvent.click(screen.getByText("Save activity"));
    const first = useAppStore.getState().activityLogs[0];

    // Tap ✎ on the saved entry → form prefills → save updates the record.
    fireEvent.click(screen.getByLabelText(/Edit 🏀 Hoops \(practice\) entry/));
    expect(screen.getByText("Save changes")).toBeTruthy();
    expect(screen.getByDisplayValue("45")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Effort 9 of 10"));
    fireEvent.change(screen.getByDisplayValue("45"), { target: { value: "75" } });
    fireEvent.click(screen.getByText("Save changes"));

    const entries = useAppStore.getState().activityLogs;
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ id: first?.id, sessionRpe: 9, durationMinutes: 75 });
    // Edit mode exits; the add-form is back.
    expect(screen.getByText("Save activity")).toBeTruthy();
  });
});

describe("about screen — the teen-friendly app tour", () => {
  it("wires a question-mark button into the Home header pointing at the tour", () => {
    render(<Index />);

    // The header button is declared via <Stack.Screen options={{ headerRight }}>
    // — the spy captures it because jsdom never renders the native header.
    const headerEntry = stackScreenOptionsSpy.mock.calls
      .map((call) => call[0] as { headerRight?: () => ReactElement })
      .find((options) => typeof options?.headerRight === "function");
    expect(headerEntry).toBeDefined();

    // Render the header button the way the native header would, then tap it.
    render((headerEntry?.headerRight ?? (() => null))());
    fireEvent.click(screen.getByLabelText("How this app works"));
    expect(routerMock.navigate).toHaveBeenCalledWith("/about");
  });

  it("outlines the purpose, flow, levels, features, and rules in plain language", () => {
    render(<About />);

    // Hero — the purpose.
    expect(screen.getByText("Your pocket training coach 🏀")).toBeTruthy();
    expect(
      screen.getByText(/builds your workout day around YOU/),
    ).toBeTruthy();

    // The three-step flow mirrors the Home steppers.
    expect(screen.getByText("Your day in three taps")).toBeTruthy();
    expect(screen.getByText(/Check in — sleep, body feel, energy/)).toBeTruthy();
    expect(screen.getByText(/BEFORE your workout shapes today/)).toBeTruthy();
    expect(screen.getByText(/Tap again to undo/)).toBeTruthy();

    // The three power levels, using the app's own vocabulary.
    expect(screen.getByText("How the plan adapts")).toBeTruthy();
    expect(screen.getByText(/Full Send 🔥 — you're charged/)).toBeTruthy();
    expect(screen.getByText(/Power Save 🌙 — short sleep/)).toBeTruthy();
    expect(screen.getByText(/SHIELD 🔴 — your body says stop/)).toBeTruthy();
    expect(screen.getByText(/Keep the weight, drop the extra sets/)).toBeTruthy();

    // The feature tour covers everything built so far.
    expect(screen.getByText("What's inside")).toBeTruthy();
    expect(screen.getByText(/Ready State — the battery/)).toBeTruthy();
    expect(screen.getByText(/Game Plan — today's plan with live check-offs/)).toBeTruthy();
    expect(screen.getByText(/My Plan — build a plan around your goal/)).toBeTruthy();
    expect(screen.getByText(/Personal milestones — every plan brings its benchmark drills/)).toBeTruthy();
    expect(screen.getByText(/Practice Log — record what you did/)).toBeTruthy();
    expect(screen.getByText(/Calendar — your past and future/)).toBeTruthy();
    expect(screen.getByText(/Reminders — fuel-up and check-in nudges/)).toBeTruthy();

    // The rules: safety + privacy in teen language.
    expect(screen.getByText("The rules it lives by")).toBeTruthy();
    expect(screen.getByText(/Pain is a stop sign — never a push-through/)).toBeTruthy();
    expect(screen.getByText(/Everything stays on your phone/)).toBeTruthy();

    // Footer.
    expect(screen.getByText(/play long — not just hard/)).toBeTruthy();
  });
});

describe("my plan — build, milestones, completion loop", () => {
  it("opens from Home and builds a plan from a persona", () => {
    render(<Index />);

    fireEvent.click(screen.getByLabelText("Open my plan"));
    expect(routerMock.navigate).toHaveBeenCalledWith("/plan");
  });

  it("walks the build flow: preset mode → persona → weeks → build", () => {
    render(<Plan />);

    // Neither path's options show until a mode is chosen.
    expect(screen.queryByLabelText("Focus: Jump higher")).toBeNull();
    expect(screen.queryByLabelText("Goal Speed")).toBeNull();

    fireEvent.click(screen.getByLabelText("Preset plan"));
    fireEvent.click(screen.getByLabelText("Focus: Jump higher"));
    // Persona preset suggests 8 weeks; the value shows in the stepper.
    expect(screen.getByText("8 weeks")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Build my plan"));

    const plan = useAppStore.getState().activePlan;
    expect(plan?.personaId).toBe("JUMP_HIGHER");
    expect(plan?.periodWeeks).toBe(8);
    // The active view appears with today's blocks and the milestone drills.
    expect(screen.getByText(/Building · Week 1 of 8/)).toBeTruthy();
    expect(screen.getByText("Personal milestones")).toBeTruthy();
    expect(screen.getByText("Standing jump touch")).toBeTruthy();
  });

  it("supports the custom-goals path with up to 3 picks and a required skill", () => {
    render(<Plan />);

    fireEvent.click(screen.getByLabelText("Customized plan"));
    fireEvent.click(screen.getByLabelText("Goal Speed"));
    fireEvent.click(screen.getByLabelText("Goal Acceleration"));
    fireEvent.click(screen.getByLabelText("Goal Strength"));
    // A 4th pick is a no-op — the cap is three.
    fireEvent.click(screen.getByLabelText("Goal Explosive"));
    expect(screen.getByText("3 of 3 picked — tap a goal again to remove it.")).toBeTruthy();

    // Skills are required: building without one is blocked with guidance.
    fireEvent.click(screen.getByLabelText("Build my plan"));
    expect(useAppStore.getState().activePlan).toBeNull();
    expect(screen.getByText(/Customized plans need 1–3 basketball skills/)).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Skill Shooting"));
    fireEvent.click(screen.getByLabelText("Build my plan"));

    const plan = useAppStore.getState().activePlan;
    expect(plan?.primaryGoals).toEqual(["SPEED", "ACCELERATION", "STRENGTH"]);
    // The chosen skill leads the built plan.
    expect(plan?.components[0]?.id).toBe("skill-shooting");
  });

  it("caps skill picks at three with a live counter", () => {
    render(<Plan />);

    fireEvent.click(screen.getByLabelText("Customized plan"));
    fireEvent.click(screen.getByLabelText("Skill Shooting"));
    fireEvent.click(screen.getByLabelText("Skill Ball-handling"));
    fireEvent.click(screen.getByLabelText("Skill Finishing"));
    fireEvent.click(screen.getByLabelText("Skill Passing & reads"));

    expect(screen.getByText("3 of 3 picked — customized plans need at least one skill.")).toBeTruthy();
  });

  it("expanding the preset personas pushes the Customized card down", () => {
    render(<Plan />);

    const customized = screen.getByText("Customized plan 🎯");
    fireEvent.click(screen.getByLabelText("Preset plan"));
    const firstPersona = screen.getByLabelText("Focus: Jump higher");

    // DOM order: the persona list now sits BEFORE the Customized card.
    const position = customized.compareDocumentPosition(firstPersona);
    expect(position & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });

  it("switching build modes clears the other path's selection", () => {
    render(<Plan />);

    fireEvent.click(screen.getByLabelText("Preset plan"));
    fireEvent.click(screen.getByLabelText("Focus: Jump higher"));
    fireEvent.click(screen.getByLabelText("Customized plan"));

    // Persona selection is gone; building without goals is blocked.
    fireEvent.click(screen.getByLabelText("Build my plan"));
    expect(useAppStore.getState().activePlan).toBeNull();
    expect(screen.getByText(/Choose Preset or Customized/)).toBeTruthy();
  });

  it("offers Reset to default plan once a plan is saved", () => {
    useAppStore.setState({
      activePlan: {
        id: "plan-1",
        startDate: localDate(0),
        periodWeeks: 8,
        primaryGoals: ["EXPLOSIVENESS", "STRENGTH"],
        personaId: "JUMP_HIGHER",
        startScale: 0.75,
        components: [],
      },
    });

    render(<Plan />);

    fireEvent.click(screen.getByLabelText("Reset to default plan"));
    expect(useAppStore.getState().activePlan).toBeNull();
    // Back to the build form — the default template is live on Home.
    expect(screen.getByText("Build my training plan 🎯")).toBeTruthy();
  });

  it("rebuild pre-fills the saved plan's mode and selections", () => {
    useAppStore.setState({
      activePlan: {
        id: "plan-2",
        startDate: localDate(0),
        periodWeeks: 6,
        primaryGoals: ["SPEED", "ACCELERATION"],
        personaId: undefined,
        startScale: 1,
        components: [
          {
            id: "skill-shooting",
            type: "EXPLOSIVENESS",
            stress: "LOW",
            priority: 1,
            baseVolume: 3,
            optional: false,
            bodyRegion: "FULL",
            estimatedMinutes: 12,
          },
        ],
      },
    });

    render(<Plan />);

    fireEvent.click(screen.getByLabelText("Rebuild plan"));
    // Custom mode revealed with the saved goals AND skills seeded (cap 3).
    expect(screen.getByText("Pick your focus (up to 3)")).toBeTruthy();
    expect(screen.getByText("2 of 3 picked — tap a goal again to remove it.")).toBeTruthy();
    expect(screen.getByText("1 of 3 picked — customized plans need at least one skill.")).toBeTruthy();
    expect(screen.getByText("6 weeks")).toBeTruthy();
  });

  it("logs a milestone result and shows the best", () => {
    useAppStore.setState({
      activePlan: {
        id: "plan-1",
        startDate: localDate(0),
        periodWeeks: 8,
        primaryGoals: ["EXPLOSIVENESS", "STRENGTH"],
        personaId: "JUMP_HIGHER",
        startScale: 0.75,
        components: [],
      },
    });

    render(<Plan />);

    fireEvent.click(screen.getByLabelText("Log result: Standing jump touch"));
    fireEvent.change(screen.getByPlaceholderText("Result (cm)"), { target: { value: "42" } });
    fireEvent.click(screen.getByLabelText("Save Standing jump touch result"));

    const attempts = useAppStore.getState().personalBests;
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({ drillId: "jump-touch", value: 42 });
    expect(screen.getByText("Best: 42 cm")).toBeTruthy();
  });

  it("shows the ended recap on the plan screen when the period is over", () => {
    useAppStore.setState({
      activePlan: {
        id: "plan-1",
        startDate: localDate(-35), // five weeks ago — a 4-week period is over
        periodWeeks: 4,
        primaryGoals: ["STRENGTH"],
        personaId: "GET_STRONGER",
        startScale: 1,
        components: [],
      },
    });

    render(<Plan />);

    expect(screen.getByText(/Period complete 🎉/)).toBeTruthy();
    expect(screen.getByText(/Week 5 of 4|Complete/)).toBeTruthy();
  });

  it("prompts for a new goal on Home when the plan has ended", () => {
    useAppStore.setState({
      activePlan: {
        id: "plan-1",
        startDate: localDate(-35), // five weeks ago — a 4-week period is over
        periodWeeks: 4,
        primaryGoals: ["STRENGTH"],
        personaId: "GET_STRONGER",
        startScale: 1,
        components: [],
      },
    });

    render(<Index />);

    expect(screen.getByText(/plan is complete 🎉/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Set a new goal"));
    expect(routerMock.navigate).toHaveBeenCalledWith("/plan");

    // "Reset to default plan" clears back to the default template.
    fireEvent.click(screen.getByLabelText("Reset to default plan"));
    expect(useAppStore.getState().activePlan).toBeNull();
  });

  it("derives the cockpit prescription from the active plan", () => {
    useAppStore.setState({
      readinessInputs: [makeCheckIn(localDate(0), GOOD_ANCHORS)],
      activePlan: {
        id: "plan-1",
        startDate: localDate(0),
        periodWeeks: 8,
        primaryGoals: ["SPEED"],
        personaId: "FASTER_FIRST_STEP",
        startScale: 1,
        components: [
          {
            id: "acceleration-sprints",
            type: "SPEED",
            stress: "HIGH",
            priority: 1,
            baseVolume: 3,
            optional: false,
            bodyRegion: "FULL",
            estimatedMinutes: 8,
          },
          {
            id: "mobility-recovery",
            type: "RECOVERY",
            stress: "RECOVERY",
            priority: 2,
            baseVolume: 1,
            optional: false,
            bodyRegion: "FULL",
            estimatedMinutes: 5,
          },
        ],
      },
    });

    render(<Index />);

    // The speed-first plan leads with the sprint block; the squat block
    // from the default template is nowhere in today's prescription.
    expect(screen.getByText(/Building · Week 1 of 8/)).toBeTruthy();
    expect(screen.queryByLabelText("Toggle Squat pattern strength")).toBeNull();
  });
});

describe("header back control — every sub-page can be exited", () => {
  it("goes back one level when history exists", () => {
    routerMock.canGoBack.mockReturnValue(true);
    render(<HeaderBack />);

    fireEvent.click(screen.getByLabelText("Go back"));
    expect(routerMock.back).toHaveBeenCalled();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it("falls back to Home when there is no history (fresh deep-load)", () => {
    routerMock.canGoBack.mockReturnValue(false);
    render(<HeaderBack />);

    fireEvent.click(screen.getByLabelText("Go back"));
    expect(routerMock.replace).toHaveBeenCalledWith("/");
    expect(routerMock.back).not.toHaveBeenCalled();
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

describe("missed-day backfill (Phase 9.12)", () => {
  it("practice-log ?date= past day: header, dated entry, body map, block check-offs", () => {
    const yesterday = localDate(-1); // 2026-01-04, Sunday (recovery role)
    searchParamsMock.date = yesterday;
    useAppStore
      .getState()
      .logActivity({
        activityDate: yesterday,
        timezone: TIMEZONE,
        activityType: "TEAM_PRACTICE",
        sessionRpe: 7,
        durationMinutes: 60,
      });
    useAppStore.getState().recordWorkoutLog({ activityDate: yesterday });

    render(<PracticeLog />);

    expect(screen.getByText(/Updating Sun, Jan 4/)).toBeTruthy();

    // A new entry lands on the BACKFILL date, not today.
    fireEvent.change(screen.getByDisplayValue("60"), { target: { value: "45" } });
    fireEvent.click(screen.getByText("Save activity"));
    const added = useAppStore.getState().activityLogs.at(-1);
    expect(added?.activityDate).toBe(yesterday);
    expect(useAppStore.getState().activityLogs).toHaveLength(2);

    // Post-session body map edits yesterday's session record.
    expect(screen.getByText("After that session, how did the body feel?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Legs" }));
    fireEvent.click(screen.getByRole("button", { name: "Quad" }));
    const stored = useAppStore.getState().workoutLogs[0];
    expect(stored?.soreAreasAfter).toEqual(["QUAD"]);

    // Block check-offs land on the backfill date's progress record.
    fireEvent.click(screen.getByLabelText(/Check off .*Ball-handling/i));
    const progress = useAppStore.getState().workoutProgress[yesterday];
    expect(Object.keys(progress ?? {}).length).toBeGreaterThanOrEqual(1);

    // Done returns to the calendar (back navigation), not replace to home.
    fireEvent.click(screen.getByText("Done — back to the calendar"));
    expect(routerMock.back).toHaveBeenCalled();
  });

  it("blocks that day use the recovery-role plan (no leg lifting on Sunday)", () => {
    const yesterday = localDate(-1);
    searchParamsMock.date = yesterday;
    render(<PracticeLog />);

    expect(screen.getByText("Blocks that day — check off what you finished")).toBeTruthy();
    expect(screen.queryByText(/Squat pattern strength/i)).toBeNull();
    expect(screen.getByLabelText(/Check off .*Ball-handling/i)).toBeTruthy();
  });

  it("practice-log without a date keeps the today flow (no backfill header)", () => {
    render(<PracticeLog />);
    expect(screen.queryByText(/Updating /)).toBeNull();
    expect(screen.getByText("What did you do?")).toBeTruthy();
  });

  it("calendar: a past day offers 'Update this day' and routes to the editor", () => {
    render(<History />);

    fireEvent.click(screen.getByLabelText("Day 2026-01-04"));
    const button = screen.getByLabelText("Update the day Sun, Jan 4");
    fireEvent.click(button);
    expect(routerMock.navigate).toHaveBeenCalledWith("/practice-log?date=2026-01-04");
  });

  it("home: nudges when yesterday is empty, dismisses per date, hides when logged", () => {
    render(<Index />);
    expect(screen.getByText("Did anything happen yesterday?")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Dismiss the missed-day reminder"));
    expect(useAppStore.getState().backfillNudgesDismissed).toEqual([localDate(-1)]);

    // Logged yesterday ⇒ no nudge even after a reset of dismissals.
    useAppStore.setState({ backfillNudgesDismissed: [] });
    useAppStore.getState().logActivity({
      activityDate: localDate(-1),
      timezone: TIMEZONE,
      activityType: "OTHER",
      sessionRpe: 5,
      durationMinutes: 30,
    });
    render(<Index />);
    expect(screen.queryByText("Did anything happen yesterday?")).toBeNull();
  });

  it("exports the JSON backup and CSV through the share sheet", async () => {
    useAppStore.getState().logActivity({
      activityDate: localDate(0),
      timezone: TIMEZONE,
      activityType: "TEAM_PRACTICE",
      sessionRpe: 6,
      durationMinutes: 60,
    });

    render(<History />);

    fireEvent.click(screen.getByLabelText("Export all data as a JSON backup"));
    await waitFor(() => expect(sharingSpy.shareAsync).toHaveBeenCalledTimes(1));
    const [jsonUri, jsonOptions] = sharingSpy.shareAsync.mock.calls[0] as [string, { mimeType: string }];
    expect(jsonUri).toContain("vikai-export-2026-01-05.json");
    expect(jsonOptions.mimeType).toBe("application/json");
    const written = fileWrites.list.at(-1);
    expect(JSON.parse(written?.content ?? "{}")).toMatchObject({ schema: "vikai-export/1" });

    fireEvent.click(screen.getByLabelText("Export all data as a spreadsheet CSV"));
    await waitFor(() => expect(sharingSpy.shareAsync).toHaveBeenCalledTimes(2));
    const [csvUri, csvOptions] = sharingSpy.shareAsync.mock.calls[1] as [string, { mimeType: string }];
    expect(csvUri).toContain("vikai-export-2026-01-05.csv");
    expect(csvOptions.mimeType).toBe("text/csv");
    const csvContent = fileWrites.list.at(-1)?.content ?? "";
    expect(csvContent).toContain("# ACTIVITIES");
    expect(csvContent).toContain("TEAM_PRACTICE,6,60,360");
  });

  it("explains itself when the share sheet is unavailable", async () => {
    sharingSpy.isAvailableAsync.mockResolvedValue(false);
    render(<History />);

    fireEvent.click(screen.getByLabelText("Export all data as a spreadsheet CSV"));
    await waitFor(() =>
      expect(screen.getByText("Sharing isn't available on this device.")).toBeTruthy(),
    );
    expect(sharingSpy.shareAsync).not.toHaveBeenCalled();
  });
});
