import { describe, expect, it } from "vitest";

import {
  dayMarks,
  dayTimeline,
  formatDateLong,
  formatTimeOfDay,
  monthLabel,
  monthMarks,
  monthMatrix,
} from "../src/lib/calendar";

const TZ = "America/New_York";

describe("monthMatrix — Sunday-start calendar weeks", () => {
  it("pads January 2026 (starts on a Thursday) and ends on a full week", () => {
    const weeks = monthMatrix(2026, 1);

    expect(weeks[0]).toEqual([null, null, null, null, "2026-01-01", "2026-01-02", "2026-01-03"]);
    // 4 leading blanks + 31 days = exactly 5 weeks, Jan 31 lands on Saturday.
    expect(weeks.at(-1)).toEqual([
      "2026-01-25",
      "2026-01-26",
      "2026-01-27",
      "2026-01-28",
      "2026-01-29",
      "2026-01-30",
      "2026-01-31",
    ]);
    expect(weeks).toHaveLength(5);
  });

  it("handles leap and common Februaries", () => {
    expect(monthMatrix(2024, 2).at(-1)).toContain("2024-02-29");
    expect(monthMatrix(2023, 2).at(-1)).toContain("2023-02-28");
    expect(monthMatrix(2024, 2).flat().filter(Boolean)).toHaveLength(29);
    expect(monthMatrix(2023, 2).flat().filter(Boolean)).toHaveLength(28);
  });

  it("labels months readably", () => {
    expect(monthLabel(2026, 1)).toBe("January 2026");
    expect(monthLabel(2026, 12)).toBe("December 2026");
  });
});

describe("dayMarks — what happened on a day", () => {
  const sources = {
    readiness: [{ localDate: "2026-01-02" }],
    activities: [{ activityDate: "2026-01-02" }, { activityDate: "2026-01-02" }],
    workoutLogs: [{ activityDate: "2026-01-01" }],
    events: [
      // 6:00 PM local on Jan 2 in New York (23:00 UTC).
      { startAt: "2026-01-02T23:00:00.000Z", eventType: "GAME" },
      // 2:00 AM UTC on Jan 3 = still Jan 2 evening in New York.
      { startAt: "2026-01-03T02:00:00.000Z", eventType: "TEAM_PRACTICE" },
    ],
  };

  it("aggregates check-ins, activities, sessions, and events for the day", () => {
    const mark = dayMarks(sources, "2026-01-02", TZ);

    expect(mark).toEqual({
      checkedIn: true,
      activityCount: 2,
      workoutCompleted: false,
      hasEvent: true,
      isGame: true,
    });
  });

  it("buckets events by the athlete's timezone, not UTC", () => {
    // UTC says Jan 3, New York says Jan 2 evening — both land on Jan 2.
    const mark = dayMarks(sources, "2026-01-02", TZ);
    expect(mark.hasEvent).toBe(true);

    const jan3 = dayMarks(sources, "2026-01-03", TZ);
    expect(jan3.hasEvent).toBe(false);
  });

  it("marks the day with a completed session", () => {
    const mark = dayMarks(sources, "2026-01-01", TZ);
    expect(mark.workoutCompleted).toBe(true);
    expect(mark.checkedIn).toBe(false);
  });

  it("fills every real date of a month via monthMarks", () => {
    const weeks = monthMatrix(2026, 1);
    const marks = monthMarks(sources, weeks, TZ);

    expect(Object.keys(marks)).toHaveLength(31);
    expect(marks["2026-01-02"]?.checkedIn).toBe(true);
    expect(marks["2026-01-15"]?.activityCount).toBe(0);
  });
});

describe("dayTimeline — timestamped history for one day", () => {
  const sources = {
    readiness: [{ localDate: "2026-01-02", recordedAt: "2026-01-02T13:02:00.000Z" }],
    activities: [
      {
        activityDate: "2026-01-02",
        createdAt: "2026-01-02T20:45:00.000Z",
        activityType: "TEAM_PRACTICE" as const,
        sessionRpe: 7,
        durationMinutes: 60,
      },
    ],
    workoutLogs: [
      {
        activityDate: "2026-01-02",
        createdAt: "2026-01-02T19:10:00.000Z",
        notes: "Felt strong",
      },
    ],
    events: [{ startAt: "2026-01-02T23:00:00.000Z", eventType: "GAME", title: "Home opener" }],
  };

  it("sorts the day's entries chronologically with formatted local times", () => {
    const timeline = dayTimeline(sources, "2026-01-02", TZ);

    expect(timeline.map((entry) => entry.time)).toEqual([
      "8:02 AM", // readiness
      "2:10 PM", // workout log
      "3:45 PM", // activity
      "6:00 PM", // game (local)
    ]);
    expect(timeline[2]?.text).toContain("Hoops (practice) · RPE 7 · 60 min · load 420");
    expect(timeline[3]?.text).toBe("🏆 Game — Home opener");
  });

  it("includes notes on completed sessions", () => {
    const timeline = dayTimeline(sources, "2026-01-02", TZ);
    expect(timeline[1]?.text).toBe("Game Plan completed — Felt strong");
  });

  it("returns an empty list for quiet days", () => {
    expect(dayTimeline(sources, "2026-01-05", TZ)).toEqual([]);
  });
});

describe("time formatting", () => {
  it("formats clock times in the athlete's timezone", () => {
    expect(formatTimeOfDay("2026-01-02T18:30:00.000Z", TZ)).toBe("1:30 PM");
    expect(formatTimeOfDay("2026-01-02T00:15:00.000Z", "UTC")).toBe("12:15 AM");
  });

  it("is safe on invalid input", () => {
    expect(formatTimeOfDay("not-a-date", TZ)).toBe("");
  });

  it("formats date-only keys as short human labels", () => {
    expect(formatDateLong("2026-01-02")).toContain("Jan");
    expect(formatDateLong("2026-01-02")).toContain("2");
    expect(formatDateLong("2026-01-02")).toContain("Fri");
  });
});
