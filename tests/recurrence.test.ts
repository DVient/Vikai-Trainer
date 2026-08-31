import { describe, expect, it } from "vitest";

import {
  MAX_RECURRENCE_WEEKS,
  expandRecurrence,
  normalizeWeekdays,
  parseWeeksInput,
  recurrenceSummary,
  weekdayOfIsoDate,
} from "../src/lib/recurrence";

describe("weekdayOfIsoDate", () => {
  it("computes weekdays from the date key only", () => {
    expect(weekdayOfIsoDate("2026-09-08")).toBe(2); // Tuesday
    expect(weekdayOfIsoDate("2026-09-12")).toBe(6); // Saturday
    expect(weekdayOfIsoDate("2026-09-13")).toBe(0); // Sunday
  });
});

describe("expandRecurrence", () => {
  it("expands two weekdays over six weeks into 12 ascending dates", () => {
    // The brand-spec example: Tue/Thu practice, 6 weeks, one submission.
    const dates = expandRecurrence("2026-09-12", [2, 4], 6);
    expect(dates).toHaveLength(12);
    expect(dates[0]).toBe("2026-09-15"); // first Tuesday after the start
    expect(dates[1]).toBe("2026-09-17");
    expect(dates[dates.length - 1]).toBe("2026-10-22");
    const sorted = [...dates].sort();
    expect(dates).toEqual(sorted);
  });

  it("includes the start date only when its weekday is selected", () => {
    // 2026-09-08 is a Tuesday; Tue+Thu includes it.
    expect(expandRecurrence("2026-09-08", [2, 4], 1)).toEqual(["2026-09-08", "2026-09-10"]);
    // Thursday only: the series starts at the first matching weekday.
    expect(expandRecurrence("2026-09-08", [4], 1)).toEqual(["2026-09-10"]);
  });

  it("produces one occurrence per selected weekday over a single week", () => {
    const allDays = expandRecurrence("2026-09-07", [0, 1, 2, 3, 4, 5, 6], 1);
    expect(allDays).toHaveLength(7);
  });

  it("returns nothing for empty selections or invalid input", () => {
    expect(expandRecurrence("2026-09-12", [], 6)).toEqual([]);
    expect(expandRecurrence("2026-09-12", [2, 4], 0)).toEqual([]);
    expect(expandRecurrence("not-a-date", [2], 2)).toEqual([]);
    expect(expandRecurrence("2026-09-12", [99], 2)).toEqual([]);
  });

  it("spans year boundaries correctly", () => {
    // Tue 2026-12-29, weekly on Tuesday, 2 weeks.
    expect(expandRecurrence("2026-12-29", [2], 2)).toEqual(["2026-12-29", "2027-01-05"]);
  });
});

describe("normalizeWeekdays", () => {
  it("dedupes, sorts Sun-first, and drops out-of-range picks", () => {
    expect(normalizeWeekdays([4, 2, 9, 2, -1])).toEqual([2, 4]);
    expect(normalizeWeekdays([])).toEqual([]);
  });
});

describe("parseWeeksInput", () => {
  it("accepts whole numbers within the cap", () => {
    expect(parseWeeksInput("6")).toBe(6);
    expect(parseWeeksInput(" 6 ")).toBe(6);
    expect(parseWeeksInput("1")).toBe(1);
    expect(parseWeeksInput(String(MAX_RECURRENCE_WEEKS))).toBe(MAX_RECURRENCE_WEEKS);
  });

  it("rejects junk, zero, fractions, and over-cap values", () => {
    expect(parseWeeksInput("abc")).toBeNull();
    expect(parseWeeksInput("")).toBeNull();
    expect(parseWeeksInput("0")).toBeNull();
    expect(parseWeeksInput("6.5")).toBeNull();
    expect(parseWeeksInput(String(MAX_RECURRENCE_WEEKS + 1))).toBeNull();
    expect(parseWeeksInput("-3")).toBeNull();
  });
});

describe("recurrenceSummary", () => {
  it("summarizes a series with first and last dates", () => {
    const dates = expandRecurrence("2026-09-12", [2, 4], 6);
    expect(recurrenceSummary(dates)).toBe("12 events · Tue, Sep 15 – Thu, Oct 22");
  });

  it("handles single and empty series", () => {
    expect(recurrenceSummary(["2026-09-15"])).toBe("1 event · Tue, Sep 15");
    expect(recurrenceSummary([])).toBe("No events yet");
  });
});
