import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Phase 6.1 — Integration tests (FLOW 6.1).
 * Full workflow through REAL modules: store actions → engine evaluation →
 * workout scaling → log completion → local storage persistence. Only the
 * storage boundary (AsyncStorage) is mocked.
 */

const AsyncStorageMock = vi.hoisted(() => ({
  getItem: vi.fn<(key: string) => Promise<string | null>>(async () => null),
  setItem: vi.fn<(key: string, value: string) => Promise<void>>(async () => undefined),
  removeItem: vi.fn<(key: string) => Promise<void>>(async () => undefined),
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: AsyncStorageMock,
}));

import { toLocalDateString } from "../src/engine/autoregulation";
import { applyRestrictionsToBasePlan, hasConsecutiveHighStressDays } from "../src/engine/generator";
import { deriveEngineView } from "../src/lib/engine-bridge";
import { parseEventDateTime } from "../src/lib/eventForm";
import { buildSessionView } from "../src/lib/session";
import { ADULT_ATTENTION_MESSAGE } from "../src/lib/status";
import { DEFAULT_BASE_PLAN } from "../src/plans/basePlan";
import { useAppStore } from "../src/stores/useAppStore";
import { DEFAULT_ATHLETE_PROFILE } from "../src/config/defaults";
import {
  DEFAULT_OBJECTIVE,
  type EnergyAnchor,
  type JointStatus,
  type ReadinessInput,
  type SleepAnchor,
} from "../src/types";

const TIMEZONE = DEFAULT_ATHLETE_PROFILE.timezone;
const today = () => toLocalDateString(new Date(), TIMEZONE);

function makeCheckIn(
  localDate: string,
  anchors: { sleep: SleepAnchor; joint: JointStatus; energy: EnergyAnchor },
): ReadinessInput {
  const now = new Date().toISOString();
  return {
    id: `checkin-${localDate}`,
    localDate,
    timezone: TIMEZONE,
    recordedAt: now,
    createdAt: now,
    updatedAt: now,
    sleepAnchor: anchors.sleep,
    jointStatus: anchors.joint,
    energyAnchor: anchors.energy,
  };
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
  });
}

function derive() {
  return deriveEngineView(useAppStore.getState(), new Date());
}

function prescriptionOf(view: ReturnType<typeof derive>) {
  return applyRestrictionsToBasePlan(DEFAULT_BASE_PLAN, view.result.restrictions);
}

function modificationMap(entries: ReturnType<typeof prescriptionOf>) {
  return new Map(entries.map((entry) => [entry.component.id, entry.modification]));
}

beforeEach(() => {
  AsyncStorageMock.setItem.mockClear();
  resetStore();
});

describe("full workflow: check-in → engine → scaling → log → storage", () => {
  it("blocks GREEN on a fresh install and shows the unscaled base plan", () => {
    const view = derive();

    expect(view.hasCheckedInToday).toBe(false);
    expect(view.result.status).toBe("CHECKIN_REQUIRED");
    expect(view.result.requiresAdultAttention).toBe(false);

    const prescription = prescriptionOf(view);
    expect(modificationMap(prescription)).toEqual(
      new Map(DEFAULT_BASE_PLAN.map((component) => [component.id, "KEPT" as const])),
    );
  });

  it("goes GREEN after a good check-in and stays at full volume", () => {
    useAppStore.getState().saveDailyCheckIn({
      localDate: today(),
      timezone: TIMEZONE,
      recordedAt: new Date().toISOString(),
      sleepAnchor: "OVER_8_HRS",
      jointStatus: "NO_CONCERN",
      energyAnchor: "HIGH",
    });

    const view = derive();
    expect(view.result.status).toBe("GREEN");
    expect(view.result.reasons).toEqual(["NORMAL_READINESS"]);

    const prescription = prescriptionOf(view);
    const volumes = new Map(prescription.map((e) => [e.component.id, e.scaledVolume]));
    expect(volumes.get("primary-lower-squat")).toBe(4);
    expect(volumes.get("primary-upper-push")).toBe(4);
  });

  it("scales the workout for a game tomorrow and keeps the plan honest", () => {
    useAppStore.getState().saveDailyCheckIn({
      localDate: today(),
      timezone: TIMEZONE,
      recordedAt: new Date().toISOString(),
      sleepAnchor: "OVER_8_HRS",
      jointStatus: "NO_CONCERN",
      energyAnchor: "HIGH",
    });
    useAppStore.getState().scheduleEvent({
      eventType: "GAME",
      startAt: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString(),
    });

    const view = derive();
    expect(view.result.status).toBe("YELLOW");
    expect(view.result.reasons).toEqual(["UPCOMING_GAME"]);
    expect(view.result.restrictions.lowerBodyScale).toBe(0.5);
    expect(view.result.restrictions.upperBodyScale).toBe(0.7);
    expect(view.result.restrictions.plyometricsAllowed).toBe(true);
    expect(view.result.restrictions.highImpactAllowed).toBe(false);

    const byId = new Map(prescriptionOf(view).map((e) => [e.component.id, e]));
    // Primary lifts scale by region (§23 round + minimum-volume floor).
    expect(byId.get("primary-lower-squat")?.modification).toBe("REDUCED");
    expect(byId.get("primary-lower-squat")?.scaledVolume).toBe(2); // round(4 × 0.5)
    expect(byId.get("primary-upper-push")?.scaledVolume).toBe(3); // round(4 × 0.7)
    // High-impact conditioning is removed (sprints + COD), while the allowed
    // primer-day plyometrics survive REDUCED (SPEC §17: reduced neural primer).
    expect(byId.get("acceleration-sprints")?.modification).toBe("REMOVED");
    expect(byId.get("cod-drills")?.modification).toBe("REMOVED");
    expect(byId.get("explosive-jumps")?.modification).toBe("REDUCED");
    expect(byId.get("explosive-jumps")?.scaledVolume).toBe(2); // round(4 × 0.5)
    // Optional accessories strip first when their region is reduced.
    expect(byId.get("accessory-upper")?.modification).toBe("REMOVED");
    expect(byId.get("accessory-core")?.modification).toBe("REMOVED");
  });

  it("completes the day: logged activity + workout log land in local storage", () => {
    useAppStore.getState().saveDailyCheckIn({
      localDate: today(),
      timezone: TIMEZONE,
      recordedAt: new Date().toISOString(),
      sleepAnchor: "OVER_8_HRS",
      jointStatus: "NO_CONCERN",
      energyAnchor: "HIGH",
    });
    useAppStore.getState().scheduleEvent({
      eventType: "GAME",
      startAt: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString(),
    });
    useAppStore.getState().logActivity({
      activityDate: today(),
      timezone: TIMEZONE,
      activityType: "TEAM_PRACTICE",
      sessionRpe: 7,
      durationMinutes: 60,
      notes: "Practice felt manageable",
    });

    // 420 session load is under the 700 threshold — status unchanged.
    const view = derive();
    expect(view.result.reasons).toEqual(["UPCOMING_GAME"]);

    useAppStore.getState().recordWorkoutLog({
      activityDate: today(),
      notes: "Followed the scaled plan",
    });

    const persisted = AsyncStorageMock.setItem.mock.calls.at(-1);
    if (!persisted) throw new Error("expected a persistence write");
    const parsed = JSON.parse(persisted[1]) as {
      version: number;
      state: {
        readinessInputs: unknown[];
        activityLogs: unknown[];
        scheduledEvents: unknown[];
        workoutLogs: unknown[];
        notificationIdentifiers: { scheduleReminders: Record<string, string> };
      };
    };
    expect(parsed.version).toBe(1);
    expect(parsed.state.readinessInputs).toHaveLength(1);
    expect(parsed.state.activityLogs).toHaveLength(1);
    expect(parsed.state.scheduledEvents).toHaveLength(1);
    expect(parsed.state.workoutLogs).toHaveLength(1);
    expect(parsed.state.notificationIdentifiers).toEqual({ scheduleReminders: {} });
  });
});

describe("pain override workflow", () => {
  it("locks everything and demands adult attention when pain is reported", () => {
    useAppStore.getState().saveDailyCheckIn({
      localDate: today(),
      timezone: TIMEZONE,
      recordedAt: new Date().toISOString(),
      sleepAnchor: "OVER_8_HRS",
      jointStatus: "PAIN_CONCERN",
      energyAnchor: "HIGH",
      painLocation: "Right knee",
    });

    const view = derive();
    expect(view.result.status).toBe("RED");
    expect(view.result.reasons).toContain("PAIN_CONCERN");
    expect(view.result.requiresAdultAttention).toBe(true);
    expect(view.result.restrictions.lowerBodyScale).toBe(0);
    expect(view.result.restrictions.upperBodyScale).toBe(0);
    expect(view.result.restrictions.plyometricsAllowed).toBe(false);
    expect(view.result.restrictions.highImpactAllowed).toBe(false);
    // RED leaves the duration cap unset — all loading is locked at scale 0.
    expect(view.result.restrictions.maxTrainingDurationMinutes).toBeUndefined();
    expect(view.result.recoveryActions).toContain(
      "High-impact and training activity should be paused until the athlete has appropriate guidance.",
    );

    const prescription = prescriptionOf(view);
    expect(prescription).toHaveLength(DEFAULT_BASE_PLAN.length);
    expect(prescription.every((entry) => entry.modification === "REMOVED")).toBe(true);
  });
});

describe("stale data cannot unlock status (SPEC §27)", () => {
  it("ignores yesterday's check-in: status falls back to CHECKIN_REQUIRED", () => {
    const yesterday = toLocalDateString(new Date(Date.now() - 24 * 60 * 60 * 1000), TIMEZONE);
    useAppStore.getState().saveDailyCheckIn({
      localDate: yesterday,
      timezone: TIMEZONE,
      recordedAt: new Date().toISOString(),
      sleepAnchor: "OVER_8_HRS",
      jointStatus: "NO_CONCERN",
      energyAnchor: "HIGH",
    });

    const view = derive();
    expect(view.hasCheckedInToday).toBe(false);
    expect(view.result.status).toBe("CHECKIN_REQUIRED");
    // Not silently reduced either — the plan stays at unscaled baseline.
    const prescription = prescriptionOf(view);
    expect(prescription.every((entry) => entry.modification === "KEPT")).toBe(true);
  });
});

describe("adult-attention copy contract", () => {
  it("uses the exact non-medical callout everywhere it is required", () => {
    expect(ADULT_ATTENTION_MESSAGE).toBe(
      "An adult should check in with the athlete before any training today.",
    );
  });
});

describe("live session loop: check-offs, mid-session rescaling, finish", () => {
  it("freezes completed sets, re-scales the rest after a mid-session log, then finishes", () => {
    const day = today();

    // 1. Good check-in → GREEN, full volume.
    useAppStore.getState().saveDailyCheckIn({
      localDate: day,
      timezone: TIMEZONE,
      recordedAt: new Date().toISOString(),
      sleepAnchor: "OVER_8_HRS",
      jointStatus: "NO_CONCERN",
      energyAnchor: "HIGH",
    });
    let session = buildSessionView(prescriptionOf(derive()), useAppStore.getState().workoutProgress[day] ?? {});
    expect(session.remainingCount).toBe(9);

    // 2. Athlete checks off the squat (4 sets frozen).
    useAppStore.getState().toggleComponentDone(day, "primary-lower-squat", 4);
    session = buildSessionView(prescriptionOf(derive()), useAppStore.getState().workoutProgress[day] ?? {});
    expect(session.doneCount).toBe(1);
    expect(session.rows.find((row) => row.componentId === "primary-lower-squat")).toMatchObject({
      state: "done",
      sets: 4,
    });

    // 3. A heavy practice lands mid-session → engine re-scales the rest.
    useAppStore.getState().logActivity({
      activityDate: day,
      timezone: TIMEZONE,
      activityType: "TEAM_PRACTICE",
      sessionRpe: 10,
      durationMinutes: 90,
    });
    const midSession = buildSessionView(prescriptionOf(derive()), useAppStore.getState().workoutProgress[day] ?? {});
    // Completed work keeps credit even though the engine would scale it now.
    expect(midSession.rows.find((row) => row.componentId === "primary-lower-squat")).toMatchObject({
      state: "done",
      sets: 4,
    });
    // Remaining upper-body volume is reduced (4 × 0.7 = 3), not frozen at 4.
    expect(midSession.rows.find((row) => row.componentId === "primary-upper-push")).toMatchObject({
      state: "remaining",
      sets: 3,
    });
    expect(midSession.finishable).toBe(false);

    // 4. Athlete checks off everything that remains and finishes.
    const remaining = midSession.rows.filter((row) => row.state === "remaining");
    for (const row of remaining) {
      useAppStore.getState().toggleComponentDone(day, row.componentId, row.sets);
    }
    const complete = buildSessionView(prescriptionOf(derive()), useAppStore.getState().workoutProgress[day] ?? {});
    expect(complete.finishable).toBe(true);

    useAppStore.getState().recordWorkoutLog({ activityDate: day });
    expect(useAppStore.getState().workoutLogs).toHaveLength(1);
    expect(useAppStore.getState().workoutLogs[0]?.activityDate).toBe(day);
  });

  it("adds a camp to the schedule and the engine counts it as a high-stress day", () => {
    const yesterday = toLocalDateString(new Date(Date.now() - 24 * 60 * 60 * 1000), TIMEZONE);

    // Practice yesterday + a scheduled camp today = two high-stress days.
    // 09:00 local today always buckets to today's date, whatever the clock.
    useAppStore.getState().logActivity({
      activityDate: yesterday,
      timezone: TIMEZONE,
      activityType: "TEAM_PRACTICE",
      sessionRpe: 8,
      durationMinutes: 60,
    });
    const campStart = parseEventDateTime(today(), "09:00", TIMEZONE);
    if (!campStart.ok) throw new Error("expected a valid camp start");
    useAppStore.getState().scheduleEvent({
      eventType: "BASKETBALL_CAMP",
      startAt: campStart.iso,
    });

    const state = useAppStore.getState();
    expect(
      hasConsecutiveHighStressDays(
        state.activityLogs,
        state.scheduledEvents,
        new Date(),
        TIMEZONE,
      ),
    ).toBe(true);
  });

  it("carries a post-workout evening activity into the next workout's derivation", () => {
    const day = today();
    // Anchor at local noon of day D so D+1 derivation can't bucket oddly.
    const noon = parseEventDateTime(day, "12:00", TIMEZONE);
    if (!noon.ok) throw new Error("expected a valid noon anchor");
    const noonD = new Date(noon.iso);
    const nextDay = new Date(noonD.getTime() + 24 * 60 * 60 * 1000);

    useAppStore.setState({
      readinessInputs: [
        makeCheckIn(day, { sleep: "OVER_8_HRS", joint: "NO_CONCERN", energy: "HIGH" }),
      ],
    });

    // Baseline on day D: good anchors, nothing logged → nothing adjusted.
    const baseline = prescriptionOf(deriveEngineView(useAppStore.getState(), noonD));
    expect(baseline.every((entry) => entry.modification === "KEPT")).toBe(true);

    // A heavy session on day D (post-workout or not — the date window counts it).
    useAppStore.getState().logActivity({
      activityDate: day,
      timezone: TIMEZONE,
      activityType: "TEAM_PRACTICE",
      sessionRpe: 9,
      durationMinutes: 90, // load 810 ≥ highSessionLoad (700)
    });

    // Day D+1 check-in with the same good anchors — but the rolling 24h
    // workload now includes yesterday's load, so the plan scales down.
    useAppStore.setState({
      readinessInputs: [
        ...useAppStore.getState().readinessInputs,
        makeCheckIn(toLocalDateString(nextDay, TIMEZONE), {
          sleep: "OVER_8_HRS",
          joint: "NO_CONCERN",
          energy: "HIGH",
        }),
      ],
    });
    const next = prescriptionOf(deriveEngineView(useAppStore.getState(), nextDay));
    expect(next.some((entry) => entry.modification !== "KEPT")).toBe(true);
  });

  it("lets the training objective decide which volume is cut first", () => {
    const day = today();
    // Primer day (game in 20h): lower 0.5 / upper 0.7, plyos allowed — jump
    // mechanics survive, so goal-driven redistribution is observable.
    useAppStore.setState({
      readinessInputs: [
        makeCheckIn(day, { sleep: "OVER_8_HRS", joint: "NO_CONCERN", energy: "HIGH" }),
      ],
      scheduledEvents: [
        {
          id: "g1",
          eventType: "GAME",
          startAt: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString(),
          createdAt: "",
          updatedAt: "",
        },
      ],
    });

    const apply = () =>
      applyRestrictionsToBasePlan(DEFAULT_BASE_PLAN, derive().result.restrictions, {
        primaryGoals: useAppStore.getState().trainingObjective.primaryGoals,
      });
    const byIdOf = (list: ReturnType<typeof apply>) =>
      new Map(list.map((entry) => [entry.component.id, entry]));

    // Default objective (STRENGTH, EXPLOSIVENESS, COD): the jump block is a
    // goal-primary component → keeps the plain primer scale (4 × 0.5 → 2).
    const defaultView = byIdOf(apply());
    expect(defaultView.get("explosive-jumps")?.scaledVolume).toBe(2);

    // A SPEED-first objective drops EXPLOSIVENESS from the protected set:
    // the jump block takes the extra 0.5× cut (effective scale 0.25×), held
    // at 2 sets only by its minimum-volume maintenance floor.
    useAppStore.getState().setTrainingObjective({
      ...DEFAULT_OBJECTIVE,
      primaryGoals: ["SPEED"],
    });
    const speedView = byIdOf(apply());
    expect(speedView.get("explosive-jumps")?.modificationReason).toContain("0.25×");
    expect(speedView.get("explosive-jumps")?.scaledVolume).toBe(2); // min-volume floor
    expect(speedView.get("primary-lower-squat")?.scaledVolume).toBe(2);
  });
});
