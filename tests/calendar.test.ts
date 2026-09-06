import { describe, expect, it } from "vitest";

import {
  dayMarks,
  dayTimeline,
  formatDateLong,
  formatTimeOfDay,
  monthLabel,
  monthMarks,
  monthMatrix,
  plannedWorkoutEmoji,
  weekSchedule,
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
      { id: "e1", startAt: "2026-01-02T23:00:00.000Z", eventType: "GAME" as const },
      // 2:00 AM UTC on Jan 3 = still Jan 2 evening in New York.
      { id: "e2", startAt: "2026-01-03T02:00:00.000Z", eventType: "TEAM_PRACTICE" as const },
    ],
  };

  it("aggregates check-ins, activities, sessions, and events for the day", () => {
    const mark = dayMarks(sources, "2026-01-02", TZ);

    expect(mark).toEqual({
      checkedIn: true,
      activityCount: 2,
      workoutCompleted: false,
      hasEvent: true,
      isCompetition: true,
      plannedWorkout: false,
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

  it("treats every competition type as a competition day", () => {
    for (const eventType of ["OTHER_SPORTS_GAME", "ID_SESSION"] as const) {
      const mark = dayMarks(
        {
          readiness: [],
          activities: [],
          workoutLogs: [],
          events: [{ startAt: "2026-01-02T23:00:00.000Z", eventType }],
        },
        "2026-01-02",
        TZ,
      );
      expect(mark.isCompetition).toBe(true);
    }

    // Practices and camps are events, not competitions.
    const practice = dayMarks(
      {
        readiness: [],
        activities: [],
        workoutLogs: [],
        events: [{ startAt: "2026-01-02T23:00:00.000Z", eventType: "BASKETBALL_CAMP" }],
      },
      "2026-01-02",
      TZ,
    );
    expect(practice.hasEvent).toBe(true);
    expect(practice.isCompetition).toBe(false);
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
    events: [
      {
        id: "game-1",
        startAt: "2026-01-02T23:00:00.000Z",
        eventType: "GAME" as const,
        title: "Home opener",
      },
    ],
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
    expect(timeline[3]?.eventId).toBe("game-1");
  });

  it("includes notes on completed sessions", () => {
    const timeline = dayTimeline(sources, "2026-01-02", TZ);
    expect(timeline[1]?.text).toBe("Game Plan completed — Felt strong");
  });

  it("returns an empty list for quiet days", () => {
    expect(dayTimeline(sources, "2026-01-05", TZ)).toEqual([]);
  });
});

describe("planned workouts (Phase B)", () => {
  it("marks days listed as planned and skips the rest", () => {
    const sources = {
      readiness: [],
      activities: [],
      workoutLogs: [],
      events: [],
      plannedWorkoutDates: ["2026-01-05", "2026-01-06"],
    };

    expect(dayMarks(sources, "2026-01-05", TZ).plannedWorkout).toBe(true);
    expect(dayMarks(sources, "2026-01-06", TZ).plannedWorkout).toBe(true);
    expect(dayMarks(sources, "2026-01-07", TZ).plannedWorkout).toBe(false);
    // Absent list entirely ⇒ no planned marks (backward compatible).
    expect(
      dayMarks({ readiness: [], activities: [], workoutLogs: [], events: [] }, "2026-01-05", TZ)
        .plannedWorkout,
    ).toBe(false);
  });

  it("puts the planned workout first with an em-dash time slot", () => {
    const sources = {
      readiness: [{ localDate: "2026-01-05", recordedAt: "2026-01-05T13:02:00.000Z" }],
      activities: [],
      workoutLogs: [],
      events: [
        {
          id: "p1",
          startAt: "2026-01-05T23:00:00.000Z",
          eventType: "TEAM_PRACTICE" as const,
          title: "Team practice",
        },
      ],
    };

    const timeline = dayTimeline(sources, "2026-01-05", TZ, {
      label: "Strength + speed",
      detail: "Base template",
    });

    expect(timeline[0]).toEqual({
      time: "",
      emoji: "🏋️",
      text: "Planned: Strength + speed — Base template",
      sortKey: -1,
    });
    expect(timeline[1]?.time).toBe("8:02 AM"); // readiness still follows
  });

  it("picks the emoji from the day's focus label", () => {
    expect(plannedWorkoutEmoji("Strength + speed")).toBe("🏋️");
    expect(plannedWorkoutEmoji("Practice + upper primer")).toBe("🏀");
    expect(plannedWorkoutEmoji("Recovery & skills")).toBe("🧘");
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

describe("weekSchedule — the next-7-days Scheduled view", () => {
  const now = new Date("2026-09-12T14:00:00.000Z"); // Saturday, 10 AM ET
  const events = [
    {
      id: "far",
      eventType: "GAME" as const,
      startAt: "2026-10-15T23:00:00.000Z",
      seriesId: undefined,
    },
    {
      id: "near",
      eventType: "TEAM_PRACTICE" as const,
      startAt: "2026-09-15T22:00:00.000Z", // Tue Sep 15, 6 PM ET
      title: "Fall block",
      seriesId: "series-1",
    },
    {
      id: "past",
      eventType: "GAME" as const,
      startAt: "2026-09-01T22:00:00.000Z",
      seriesId: undefined,
    },
    {
      id: "broken",
      eventType: "OTHER" as const,
      startAt: "not-a-date",
      seriesId: undefined,
    },
  ];

  it("returns one row per day starting today, labeling the first two", () => {
    const week = weekSchedule(events, now, TZ);

    expect(week).toHaveLength(7);
    expect(week[0]).toMatchObject({ date: "2026-09-12", label: "Today" });
    expect(week[1]).toMatchObject({ date: "2026-09-13", label: "Tomorrow" });
    expect(week[6]).toMatchObject({ date: "2026-09-18", label: "Fri, Sep 18" });
  });

  it("buckets events into their local day with formatted times", () => {
    const week = weekSchedule(events, now, TZ);

    const tuesday = week.find((day) => day.date === "2026-09-15");
    expect(tuesday?.events).toHaveLength(1);
    expect(tuesday?.events[0]).toMatchObject({
      id: "near",
      time: "6:00 PM",
      text: "🏀 Team practice — Fall block",
    });
    // Far-future, past, and unparseable events are excluded everywhere.
    const withFar = week.flatMap((day) => day.events.map((event) => event.id));
    expect(withFar).not.toContain("far");
    expect(withFar).not.toContain("past");
    expect(withFar).not.toContain("broken");
  });

  it("carries the planned-workout focus per day via the callback", () => {
    const week = weekSchedule(events, now, TZ, {
      plannedLabelFor: (date) => (date === "2026-09-15" ? "Practice + upper primer" : undefined),
    });

    const tuesday = week.find((day) => day.date === "2026-09-15");
    expect(tuesday?.planned).toEqual({ emoji: "🏀", label: "Practice + upper primer" });
    expect(week[0]?.planned).toBeUndefined();
  });

  it("honors a custom window length and stays deterministic", () => {
    const three = weekSchedule(events, now, TZ, { days: 3 });
    expect(three.map((day) => day.date)).toEqual(["2026-09-12", "2026-09-13", "2026-09-14"]);

    expect(weekSchedule(events, now, TZ)).toEqual(weekSchedule(events, now, TZ));
  });

  it("rolls over month boundaries without shifting", () => {
    const monthEnd = new Date("2026-01-31T14:00:00.000Z");
    const week = weekSchedule([], monthEnd, TZ, { days: 7 });

    expect(week.map((day) => day.date)).toEqual([
      "2026-01-31",
      "2026-02-01",
      "2026-02-02",
      "2026-02-03",
      "2026-02-04",
      "2026-02-05",
      "2026-02-06",
    ]);
  });
});
