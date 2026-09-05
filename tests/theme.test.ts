import { describe, expect, it } from "vitest";

import {
  contrastRatio,
  DEFAULT_TEAM_COLORS,
  mixHex,
  mostVisibleOn,
  parseHexColor,
  relativeLuminance,
  rgbToHex,
  themeRoles,
} from "../src/lib/theme";

/**
 * Phase C — team-color skin math: two team colors in, every surface role
 * out, with fonts picking the most visible team color per surface and a
 * black/white fallback when neither team color reads.
 */

describe("hex parsing", () => {
  it("accepts 3- and 6-digit hex with or without #", () => {
    expect(parseHexColor("#228B22")).toEqual({ r: 0x22, g: 0x8b, b: 0x22 });
    expect(parseHexColor("228B22")).toEqual({ r: 0x22, g: 0x8b, b: 0x22 });
    expect(parseHexColor("#F00")).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("rejects anything else", () => {
    expect(parseHexColor("green")).toBeNull();
    expect(parseHexColor("#12345")).toBeNull();
    expect(parseHexColor("")).toBeNull();
  });

  it("round-trips through rgbToHex", () => {
    expect(rgbToHex(parseHexColor("#228B22") ?? { r: 0, g: 0, b: 0 })).toBe("#228b22");
  });
});

describe("WCAG contrast", () => {
  it("anchors black, white, and the 21:1 maximum", () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0);
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5);
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 1);
  });

  it("scores forest green on white just above the visibility floor", () => {
    const green = parseHexColor(DEFAULT_TEAM_COLORS.primary) ?? { r: 0, g: 0, b: 0 };
    const white = parseHexColor(DEFAULT_TEAM_COLORS.secondary) ?? { r: 0, g: 0, b: 0 };
    const ratio = contrastRatio(green, white);
    expect(ratio).toBeGreaterThan(3);
    expect(ratio).toBeLessThan(4.5);
  });
});

describe("mostVisibleOn — the font rule", () => {
  it("picks the more visible team color on the surface", () => {
    // Navy beats white on a white background.
    expect(mostVisibleOn("#FFFFFF", ["#001F3F", "#FFFFFF"])).toBe("#001F3F");
    // White beats navy on a navy background.
    expect(mostVisibleOn("#001F3F", ["#001F3F", "#FFFFFF"])).toBe("#FFFFFF");
  });

  it("keeps forest green as text on white (above the 3:1 floor)", () => {
    expect(mostVisibleOn("#FFFFFF", ["#228B22", "#FFFFFF"])).toBe("#228B22");
  });

  it("falls back to black/white when both team colors are mid-tone", () => {
    const picked = mostVisibleOn("#888888", ["#777777", "#999999"]);
    expect(["#000000", "#FFFFFF"]).toContain(picked);
  });

  it("handles unparseable input without throwing", () => {
    expect(mostVisibleOn("nope", ["#228B22"])).toBe("#000000");
  });
});

describe("mixHex", () => {
  it("blends linearly and clamps t", () => {
    expect(mixHex("#000000", "#FFFFFF", 0.5)).toBe("#808080");
    expect(mixHex("#000000", "#FFFFFF", 0)).toBe("#000000");
    expect(mixHex("#000000", "#FFFFFF", 1)).toBe("#ffffff");
    expect(mixHex("#000000", "#FFFFFF", 7)).toBe("#ffffff");
  });
});

describe("themeRoles — the skin", () => {
  it("defaults to the white + forest green skin with auto-contrast fonts", () => {
    const roles = themeRoles(DEFAULT_TEAM_COLORS.primary, DEFAULT_TEAM_COLORS.secondary);

    expect(roles.appBg).toBe("#FFFFFF"); // white background
    expect(roles.accent).toBe("#228B22"); // forest green accents
    expect(roles.strong).toBe("#228B22"); // green text on white — most visible team color
    expect(roles.onAccent).toBe("#FFFFFF"); // white text on green buttons
    expect(roles.isDarkBackground).toBe(false);
    // Cards are a subtle green tint over white; borders a touch stronger.
    expect(roles.card).toMatch(/^#/);
    expect(roles.edge).not.toBe(roles.card);
    // Status hues stay green/yellow/red but shade darker on a light skin.
    expect(roles.status.go).toBe("#166534");
    expect(roles.status.modulate).toBe("#854D0E");
    expect(roles.status.shield).toBe("#B91C1C");
    expect(roles.status.goSoft).toMatch(/^#/);
  });

  it("shades status colors lighter on a dark skin", () => {
    const roles = themeRoles("#228B22", "#0F172A");

    expect(roles.isDarkBackground).toBe(true);
    expect(roles.status.go).toBe("#4ADE80");
    expect(roles.status.modulate).toBe("#FDE047");
    expect(roles.status.shield).toBe("#F87171");
  });

  it("flips text to the visible color when the background is the dark color", () => {
    const roles = themeRoles("#FFFFFF", "#001F3F"); // white accents on navy

    expect(roles.appBg).toBe("#001F3F");
    expect(roles.strong).toBe("#FFFFFF"); // white text on navy
    expect(roles.accent).toBe("#FFFFFF");
    expect(roles.onAccent).toBe("#001F3F"); // navy text on the white accent
    expect(roles.isDarkBackground).toBe(true);
  });

  it("never produces unreadable text for two dark team colors", () => {
    const roles = themeRoles("#001F3F", "#1A1A2E");

    expect(roles.strong).toBe("#FFFFFF"); // fallback wins
    expect(roles.onAccent).toBe("#FFFFFF");
  });

  it("falls back to the defaults for invalid hex", () => {
    const roles = themeRoles("not-a-color", "also-bad");

    expect(roles.appBg).toBe(DEFAULT_TEAM_COLORS.secondary);
    expect(roles.accent).toBe(DEFAULT_TEAM_COLORS.primary);
    expect(roles.strong).toBe(DEFAULT_TEAM_COLORS.primary);
  });
});
