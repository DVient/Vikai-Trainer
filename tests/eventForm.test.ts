import { describe, expect, it } from "vitest";

import {
  isEventEditable,
  parseEventDateTime,
  prefillFromIso,
} from "../src/lib/eventForm";

const TZ = "America/New_York";

describe("parseEventDateTime — athlete-typed date + wall-clock time", () => {
  it("converts a local date/time into the correct UTC instant", () => {
    // 6:00 PM in New York on Jan 15 = 23:00 UTC (EST, UTC-5).
    const result = parseEventDateTime("2026-01-15", "18:00", TZ);

    expect(result).toEqual({ ok: true, iso: "2026-01-15T23:00:00.000Z" });
  });

  it("handles the summer offset", () => {
    // 6:00 PM in New York on Jul 15 = 22:00 UTC (EDT, UTC-4).
    const result = parseEventDateTime("2026-07-15", "18:00", TZ);

    expect(result).toEqual({ ok: true, iso: "2026-07-15T22:00:00.000Z" });
  });

  it("rejects malformed dates and times with readable errors", () => {
    expect(parseEventDateTime("15/01/2026", "18:00", TZ)).toMatchObject({
      ok: false,
    });
    expect(parseEventDateTime("2026-01-15", "6 PM", TZ)).toMatchObject({ ok: false });
    expect(parseEventDateTime("2026-13-01", "18:00", TZ)).toMatchObject({ ok: false });
    expect(parseEventDateTime("2026-02-30", "18:00", TZ)).toMatchObject({ ok: false });
    expect(parseEventDateTime("2026-01-15", "24:30", TZ)).toMatchObject({ ok: false });
  });

  it("accepts midnight and single-digit hours", () => {
    expect(parseEventDateTime("2026-01-15", "0:30", TZ)).toMatchObject({ ok: true });
    expect(parseEventDateTime("2026-01-15", "00:00", TZ)).toMatchObject({ ok: true });
  });

  it("is tolerant of stray whitespace", () => {
    expect(parseEventDateTime(" 2026-01-15 ", " 18:00 ", TZ)).toMatchObject({ ok: true });
  });
});

describe("prefillFromIso — edit mode", () => {
  it("round-trips an instant back into form fields", () => {
    const parsed = parseEventDateTime("2026-01-15", "18:00", TZ);
    if (!parsed.ok) throw new Error("expected valid parse");

    expect(prefillFromIso(parsed.iso, TZ)).toEqual({
      dateText: "2026-01-15",
      timeText: "18:00",
    });
  });
});

describe("isEventEditable — past events lock", () => {
  it("is editable in the future and locked in the past", () => {
    const now = new Date("2026-01-10T12:00:00.000Z");

    expect(isEventEditable("2026-01-15T23:00:00.000Z", now)).toBe(true);
    expect(isEventEditable("2026-01-05T23:00:00.000Z", now)).toBe(false);
    expect(isEventEditable("not-a-date", now)).toBe(false);
  });
});
