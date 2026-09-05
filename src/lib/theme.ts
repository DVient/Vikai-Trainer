/**
 * VIKAI — Team-color theme engine (skin).
 *
 * Pure color math: the athlete picks two team colors; this module derives
 * every surface role the skin needs and picks the most visible team color
 * for text on each surface (WCAG 2.1 contrast), falling back to black/white
 * when neither team color is readable. No React, no storage, no engine.
 */

export interface TeamColors {
  /** Primary team color — accents, headers, buttons. */
  primary: string;
  /** Secondary team color — the screen background. */
  secondary: string;
}

export const DEFAULT_TEAM_COLORS: TeamColors = {
  primary: "#228B22", // forest green
  secondary: "#FFFFFF", // white
};

export interface RGB {
  r: number;
  g: number;
  b: number;
}

/** "#RGB"/"#RRGGBB" → channel triple; null for anything else. */
export function parseHexColor(hex: string): RGB | null {
  const text = hex.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(text)) {
    const r = Number.parseInt(text.slice(0, 2), 16);
    const g = Number.parseInt(text.slice(2, 4), 16);
    const b = Number.parseInt(text.slice(4, 6), 16);
    return { r, g, b };
  }
  if (/^[0-9a-fA-F]{3}$/.test(text)) {
    const r = Number.parseInt(`${text[0]}${text[0]}`, 16);
    const g = Number.parseInt(`${text[1]}${text[1]}`, 16);
    const b = Number.parseInt(`${text[2]}${text[2]}`, 16);
    return { r, g, b };
  }
  return null;
}

function toHex2(value: number): string {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
}

/** Channel triple → "#RRGGBB" (clamped). */
export function rgbToHex({ r, g, b }: RGB): string {
  return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
}

/** WCAG 2.1 relative luminance of an sRGB color (0 = black, 1 = white). */
export function relativeLuminance(color: RGB): number {
  const channels = [color.r, color.g, color.b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0);
}

/** WCAG 2.1 contrast ratio between two colors (1 … 21). */
export function contrastRatio(a: RGB, b: RGB): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

const BLACK: RGB = { r: 0, g: 0, b: 0 };
const WHITE: RGB = { r: 255, g: 255, b: 255 };

/**
 * Acceptance floor for a team color to carry text on a surface. WCAG 2.1
 * large-text AA (3:1) — the app's text is bold/large; below this the team
 * color is judged unreadable and black/white takes over. (Forest green on
 * white is 4.4:1 — visible, and must NOT be rejected by a 4.5 gate.)
 */
const VISIBLE_THRESHOLD = 3;

/**
 * The candidate with the best contrast on the background; when the best
 * team color still fails the visibility floor (both mid-tones), falls back
 * to black/white — whichever is more visible. This is the "fonts adapt to
 * the most visible color" rule.
 */
export function mostVisibleOn(
  backgroundHex: string,
  candidates: readonly string[],
  fallbacks: readonly string[] = ["#000000", "#FFFFFF"],
): string {
  const bg = parseHexColor(backgroundHex);
  if (bg === null) return fallbacks[0] ?? "#000000";

  let bestHex = "";
  let bestRatio = 0;
  for (const candidate of candidates) {
    const rgb = parseHexColor(candidate);
    if (rgb === null) continue;
    const ratio = contrastRatio(rgb, bg);
    if (ratio > bestRatio) {
      bestHex = candidate;
      bestRatio = ratio;
    }
  }
  if (bestRatio >= VISIBLE_THRESHOLD) return bestHex;

  // Neither team color reads on this surface — go to the fallbacks.
  let fallbackHex = "";
  let fallbackRatio = 0;
  for (const candidate of fallbacks) {
    const rgb = parseHexColor(candidate);
    if (rgb === null) continue;
    const ratio = contrastRatio(rgb, bg);
    if (ratio > fallbackRatio) {
      fallbackHex = candidate;
      fallbackRatio = ratio;
    }
  }
  return fallbackHex;
}

/** Linear blend of two hex colors; t = 0 → a, t = 1 → b. */
export function mixHex(aHex: string, bHex: string, t: number): string {
  const a = parseHexColor(aHex);
  const b = parseHexColor(bHex);
  if (a === null) return parseHexColor(bHex) !== null ? bHex : "#000000";
  if (b === null) return aHex;
  const clamped = Math.max(0, Math.min(1, t));
  return rgbToHex({
    r: a.r + (b.r - a.r) * clamped,
    g: a.g + (b.g - a.g) * clamped,
    b: a.b + (b.b - a.b) * clamped,
  });
}

/** Every skin role the screens consume (all hex strings). */
export interface StatusPalette {
  /** GO status — green family, shaded for the background. */
  go: string;
  /** MODULATE status — yellow family. */
  modulate: string;
  /** SHIELD status — red family. */
  shield: string;
  /** Chip backgrounds (the status hue tinted ~14% over the background). */
  goSoft: string;
  modulateSoft: string;
  shieldSoft: string;
  /** Chip borders (~50% mix). */
  goLine: string;
  modulateLine: string;
  shieldLine: string;
}

export interface ThemeRoles {
  /** Screen background — the secondary team color. */
  appBg: string;
  /** Card / raised surface — a subtle accent tint over the background. */
  card: string;
  /** Borders and solid soft controls (the old slate-700 role). */
  edge: string;
  /** Very soft control fill (the old slate-700/30 role). */
  edgeSoft: string;
  /** Mid control fill (the old slate-700/50 role). */
  edgeMid: string;
  /** Accent-tinted selection surface (the old green-500/20 role). */
  soft: string;
  /** Headline text — the most visible team color on the background. */
  strong: string;
  /** Body text. */
  body: string;
  /** Muted/secondary text. */
  muted: string;
  /** Primary accent — buttons, headers, selection (the primary team color). */
  accent: string;
  /** Text on the accent — the most visible team color on the accent. */
  onAccent: string;
  /** GO / MODULATE / SHIELD status hues, shaded for the background. */
  status: StatusPalette;
  /** True when the background is dark enough to need light status icons. */
  isDarkBackground: boolean;
}

/** Status hues for light backgrounds (dark, high-contrast shades). */
const STATUS_ON_LIGHT: StatusPalette = {
  go: "#166534",
  modulate: "#854D0E",
  shield: "#B91C1C",
  goSoft: "",
  modulateSoft: "",
  shieldSoft: "",
  goLine: "",
  modulateLine: "",
  shieldLine: "",
};

/** Status hues for dark backgrounds (light, high-contrast shades). */
const STATUS_ON_DARK: StatusPalette = {
  go: "#4ADE80",
  modulate: "#FDE047",
  shield: "#F87171",
  goSoft: "",
  modulateSoft: "",
  shieldSoft: "",
  goLine: "",
  modulateLine: "",
  shieldLine: "",
};

function statusForBackground(isDark: boolean, appBg: string): StatusPalette {
  const base = isDark ? STATUS_ON_DARK : STATUS_ON_LIGHT;
  return {
    go: base.go,
    modulate: base.modulate,
    shield: base.shield,
    goSoft: mixHex(appBg, base.go, 0.14),
    modulateSoft: mixHex(appBg, base.modulate, 0.14),
    shieldSoft: mixHex(appBg, base.shield, 0.14),
    goLine: mixHex(appBg, base.go, 0.5),
    modulateLine: mixHex(appBg, base.modulate, 0.5),
    shieldLine: mixHex(appBg, base.shield, 0.5),
  };
}

/** Derives the full skin from the athlete's two team colors. */
export function themeRoles(primary: string, secondary: string): ThemeRoles {
  const primaryHex = parseHexColor(primary) !== null ? primary : DEFAULT_TEAM_COLORS.primary;
  const secondaryHex =
    parseHexColor(secondary) !== null ? secondary : DEFAULT_TEAM_COLORS.secondary;
  const team = [primaryHex, secondaryHex];

  const strong = mostVisibleOn(secondaryHex, team);
  const accent = primaryHex;
  const isDarkBackground = relativeLuminance(parseHexColor(secondaryHex) ?? WHITE) < 0.25;
  return {
    appBg: secondaryHex,
    card: mixHex(secondaryHex, accent, 0.06),
    edge: mixHex(secondaryHex, strong, 0.3),
    edgeSoft: mixHex(secondaryHex, strong, 0.12),
    edgeMid: mixHex(secondaryHex, strong, 0.2),
    soft: mixHex(secondaryHex, accent, 0.18),
    strong,
    body: mixHex(strong, secondaryHex, 0.1),
    muted: mixHex(strong, secondaryHex, 0.4),
    accent,
    onAccent: mostVisibleOn(accent, [secondaryHex, primaryHex]),
    status: statusForBackground(isDarkBackground, secondaryHex),
    isDarkBackground,
  };
}
