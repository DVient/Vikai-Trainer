import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { DEFAULT_ENGINE_THRESHOLDS, type EngineThresholds } from "../src/engine/autoregulation";
import { tapLight, tapSuccess } from "../src/lib/haptics";
import { buildExport } from "../src/lib/export";
import {
  DEFAULT_TEAM_COLORS,
  parseHexColor,
  type TeamColors,
} from "../src/lib/theme";
import { useAppStore } from "../src/stores/useAppStore";

/**
 * Settings — the app's configuration hub:
 * - Team colors (Phase 9.5): the athlete picks two team colors and the whole
 *   app repaints instantly — the secondary color becomes the screen
 *   background, the primary drives accents, buttons, and the header, and
 *   every text surface uses whichever team color is most visible on it.
 * - Plan adjustments (Phase 10): a sensitivity preset or fine-tuned engine
 *   thresholds, clamped to safe ranges on apply (SPEC §18).
 * - Your data (Phase 12, moved from the calendar): the whole local store as a
 *   JSON backup or a sectioned CSV through the OS share sheet.
 */

/** Sensitivity presets (Phase 10): the shipped default is "Balanced". */
const ENGINE_PRESETS: ReadonlyArray<{
  id: "protective" | "balanced" | "performance";
  label: string;
  caption: string;
  thresholds: EngineThresholds | null; // null = shipped defaults
}> = [
  {
    id: "protective",
    label: "Protective",
    caption: "Trims the plan sooner — favors full days of rest.",
    thresholds: {
      ...DEFAULT_ENGINE_THRESHOLDS,
      highSessionLoad: 700,
      highCumulative24hLoad: 1000,
      readinessScoreYellowMax: 6,
    },
  },
  {
    id: "balanced",
    label: "Balanced",
    caption: "The recommended fit for most athletes.",
    thresholds: null,
  },
  {
    id: "performance",
    label: "Performance",
    caption: "Trims the plan later — keeps more hard days.",
    thresholds: {
      ...DEFAULT_ENGINE_THRESHOLDS,
      highSessionLoad: 850,
      highCumulative24hLoad: 1300,
      readinessScoreYellowMax: 5,
    },
  },
];

interface NumberFieldProps {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
}

function NumberField({ label, hint, value, onChange }: NumberFieldProps) {
  return (
    <View className="gap-1">
      <Text className="text-sm font-bold text-strong">{label}</Text>
      <Text className="text-xs text-faint">{hint}</Text>
      <TextInput
        accessibilityLabel={label}
        className="h-12 rounded-lg border border-edge bg-edge-soft px-3 text-sm text-body"
        value={value}
        keyboardType="decimal-pad"
        autoCorrect={false}
        onChangeText={onChange}
      />
    </View>
  );
}

const SWATCHES: ReadonlyArray<{ name: string; hex: string }> = [
  { name: "Forest green", hex: "#228B22" },
  { name: "Navy", hex: "#001F3F" },
  { name: "Cardinal", hex: "#9B1B30" },
  { name: "Royal blue", hex: "#1D4ED8" },
  { name: "Purple", hex: "#5B21B6" },
  { name: "Maroon", hex: "#6B1F2E" },
  { name: "Gold", hex: "#D9A404" },
  { name: "Orange", hex: "#C2410C" },
  { name: "Black", hex: "#111111" },
  { name: "Gray", hex: "#4B5563" },
  { name: "Silver", hex: "#C0C0C0" },
  { name: "White", hex: "#FFFFFF" },
];

interface SlotProps {
  title: string;
  caption: string;
  value: string;
  onSelect: (hex: string) => void;
}

function ColorSlot({ title, caption, value, onSelect }: SlotProps) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  const applyDraft = () => {
    const normalized = draft.trim().startsWith("#") ? draft.trim() : `#${draft.trim()}`;
    if (draft.trim() === "") {
      setError("");
      return;
    }
    if (parseHexColor(normalized) === null) {
      setError("Use a hex color like #228B22 or 228B22");
      return;
    }
    setError("");
    setDraft("");
    tapSuccess();
    onSelect(normalized.toUpperCase());
  };

  return (
    <View className="rounded-2xl border border-edge bg-card p-4">
      <Text className="text-sm font-black text-strong">{title}</Text>
      <Text className="mt-0.5 text-xs text-faint">{caption}</Text>

      <View className="mt-3 flex-row flex-wrap gap-2">
        {SWATCHES.map((swatch) => {
          const isSelected = swatch.hex.toUpperCase() === value.toUpperCase();
          return (
            <Pressable
              key={swatch.hex}
              accessibilityRole="button"
              accessibilityLabel={`${title}: ${swatch.name}`}
              accessibilityState={{ selected: isSelected }}
              onPress={() => {
                tapLight();
                setError("");
                setDraft("");
                onSelect(swatch.hex);
              }}
              className={`h-12 w-12 items-center justify-center rounded-full border-2 ${
                isSelected ? "border-strong" : "border-edge"
              }`}
            >
              <View
                className="rounded-full"
                style={{ width: 36, height: 36, backgroundColor: swatch.hex }}
              />
            </Pressable>
          );
        })}
      </View>

      <View className="mt-3 flex-row items-center gap-2">
        <TextInput
          accessibilityLabel={`${title} custom hex`}
          className="h-12 min-w-[48px] flex-1 rounded-lg border border-edge bg-edge-soft px-3 text-sm text-body"
          placeholder="#228B22"
          placeholderTextColor="#94A3B8"
          value={draft}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={7}
          onChangeText={setDraft}
          onSubmitEditing={applyDraft}
          onBlur={applyDraft}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Apply custom ${title.toLowerCase()}`}
          onPress={applyDraft}
          className="h-12 min-w-[48px] items-center justify-center rounded-lg bg-accent px-4"
        >
          <Text className="text-sm font-black text-onaccent">Apply</Text>
        </Pressable>
      </View>
      {error !== "" ? <Text className="mt-1 text-xs text-shield">{error}</Text> : null}
    </View>
  );
}

/** Every tunable knob with its safe range (SPEC §18). */
type TunableKey =
  | "highSessionLoad"
  | "highCumulative24hLoad"
  | "readinessScoreYellowMax"
  | "carriedSorenessCarryDays"
  | "cnsModerateRatio"
  | "cnsSignificantRatio"
  | "cnsBaselineWindowDays"
  | "cnsMinBaselineDays"
  | "cnsMinTaps"
  | "cnsMaxTaps"
  | "cnsMaxTrialsPerDay";

const TUNABLE_FIELDS: ReadonlyArray<{
  key: TunableKey;
  label: string;
  hint: string;
  min: number;
  max: number;
  isRatio?: boolean;
}> = [
  {
    key: "highSessionLoad",
    label: "Big single-session load",
    hint: "Hardness × minutes for one session that triggers a lighter next day.",
    min: 100,
    max: 5000,
  },
  {
    key: "highCumulative24hLoad",
    label: "Big day total",
    hint: "Combined load across 24 hours that triggers a lighter next day.",
    min: 200,
    max: 8000,
  },
  {
    key: "readinessScoreYellowMax",
    label: "Low check-in score limit",
    hint: "Check-in scores at or below this keep the day from being fully green (0–9).",
    min: 0,
    max: 9,
  },
  {
    key: "carriedSorenessCarryDays",
    label: "Soreness carry-over days",
    hint: "How many days a post-session body map keeps shaping later workouts (0–7).",
    min: 0,
    max: 7,
  },
  {
    key: "cnsModerateRatio",
    label: "Tap test — 'slightly below' line",
    hint: "Today's taps ÷ baseline at or above this counts as fresh (0.5–1.0).",
    min: 0.5,
    max: 1,
    isRatio: true,
  },
  {
    key: "cnsSignificantRatio",
    label: "Tap test — 'well below' line",
    hint: "Below this ratio the day goes strongly lighter (0.5–1.0).",
    min: 0.5,
    max: 1,
    isRatio: true,
  },
  {
    key: "cnsBaselineWindowDays",
    label: "Tap test — baseline window",
    hint: "How many past days feed the personal baseline (3–60).",
    min: 3,
    max: 60,
  },
  {
    key: "cnsMinBaselineDays",
    label: "Tap test — days needed",
    hint: "Distinct test days required before comparisons start (1–14).",
    min: 1,
    max: 14,
  },
  {
    key: "cnsMinTaps",
    label: "Tap test — lowest valid count",
    hint: "Trials under this many taps don't count (5–300).",
    min: 5,
    max: 300,
  },
  {
    key: "cnsMaxTaps",
    label: "Tap test — highest valid count",
    hint: "Trials over this many taps don't count (5–300).",
    min: 5,
    max: 300,
  },
  {
    key: "cnsMaxTrialsPerDay",
    label: "Tap test — trials per day",
    hint: "How many attempts are allowed each day; the best one counts (1–10).",
    min: 1,
    max: 10,
  },
];

const THRESHOLD_KEYS = Object.keys(DEFAULT_ENGINE_THRESHOLDS) as (keyof EngineThresholds)[];

function sameThresholds(a: EngineThresholds, b: EngineThresholds): boolean {
  return THRESHOLD_KEYS.every((key) => a[key] === b[key]);
}

function draftFrom(t: EngineThresholds): Record<TunableKey, string> {
  const draft = {} as Record<TunableKey, string>;
  for (const field of TUNABLE_FIELDS) {
    draft[field.key] = String(t[field.key]);
  }
  return draft;
}

/** Parses a draft string and clamps it into the field's safe range. */
function clampDraft(field: (typeof TUNABLE_FIELDS)[number], raw: string): number {
  const parsed = Number(raw.trim().replace(",", "."));
  const value = Number.isFinite(parsed) ? parsed : field.min;
  const bounded = Math.min(field.max, Math.max(field.min, value));
  return field.isRatio === true ? bounded : Math.round(bounded);
}

export default function Settings() {
  const router = useRouter();
  const teamColors = useAppStore((state) => state.teamColors);
  const setTeamColors = useAppStore((state) => state.setTeamColors);
  const engineThresholds = useAppStore((state) => state.engineThresholds);
  const setEngineThresholds = useAppStore((state) => state.setEngineThresholds);
  const resetEngineThresholds = useAppStore((state) => state.resetEngineThresholds);

  const effectiveThresholds = engineThresholds ?? DEFAULT_ENGINE_THRESHOLDS;
  const [draft, setDraft] = useState<Record<TunableKey, string>>(() =>
    draftFrom(effectiveThresholds),
  );
  const [applied, setApplied] = useState(false);

  const update = (patch: Partial<TeamColors>) => {
    setTeamColors({ ...teamColors, ...patch });
  };

  const activePresetId =
    ENGINE_PRESETS.find((preset) =>
      preset.thresholds === null
        ? engineThresholds === null
        : engineThresholds !== null && sameThresholds(preset.thresholds, engineThresholds),
    )?.id ?? "custom";

  const applyPreset = (preset: (typeof ENGINE_PRESETS)[number]) => {
    tapSuccess();
    setApplied(false);
    if (preset.thresholds === null) {
      resetEngineThresholds();
      setDraft(draftFrom(DEFAULT_ENGINE_THRESHOLDS));
      return;
    }
    const next = { ...preset.thresholds };
    setEngineThresholds(next);
    setDraft(draftFrom(next));
  };

  const applyTuning = () => {
    const next: EngineThresholds = { ...effectiveThresholds };
    for (const field of TUNABLE_FIELDS) {
      next[field.key] = clampDraft(field, draft[field.key]);
    }
    // Keep the paired knobs in a sane order after clamping.
    next.cnsSignificantRatio = Math.min(next.cnsSignificantRatio, next.cnsModerateRatio);
    next.cnsMinTaps = Math.min(next.cnsMinTaps, next.cnsMaxTaps);
    setEngineThresholds(next);
    setDraft(draftFrom(next));
    setApplied(true);
    tapSuccess();
  };

  return (
    <ScrollView className="flex-1 bg-app" contentContainerClassName="w-full max-w-md self-center gap-4 p-4">
      <View className="rounded-2xl border-2 border-go-line bg-go-soft p-4">
        <Text className="text-lg font-black text-go">Team colors 🎨</Text>
        <Text className="mt-1 text-sm leading-5 text-body">
          Paint the app in your team colors — two colors and the whole app
          repaints as you tap. Text always picks whichever color is easiest to
          read on each surface.
        </Text>
      </View>

      <ColorSlot
        title="Primary color"
        caption="Accents, buttons, and the header."
        value={teamColors.primary}
        onSelect={(hex) => update({ primary: hex })}
      />

      <ColorSlot
        title="Secondary color"
        caption="The screen background."
        value={teamColors.secondary}
        onSelect={(hex) => update({ secondary: hex })}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Reset to team default"
        onPress={() => {
          tapSuccess();
          setTeamColors({ ...DEFAULT_TEAM_COLORS });
        }}
        className="h-12 min-w-[48px] items-center justify-center rounded-lg border-2 border-edge px-4"
      >
        <Text className="text-sm font-black text-body">Reset to white + forest green</Text>
      </Pressable>

      {/* ── Phase 10: plan-adjustment tuning ── */}
      <View className="rounded-2xl border-2 border-modulate-line bg-modulate-soft p-4">
        <Text className="text-lg font-black text-modulate">Plan adjustments 🎛️</Text>
        <Text className="mt-1 text-sm leading-5 text-body">
          These numbers decide when the app trims a training day. Balanced fits
          most athletes. Pick a preset, or fine-tune below — every value is
          clamped to a safe range when you apply.
        </Text>
      </View>

      <View className="gap-2">
        {ENGINE_PRESETS.map((preset) => {
          const selected = activePresetId === preset.id;
          return (
            <Pressable
              key={preset.id}
              accessibilityRole="button"
              accessibilityLabel={`Preset ${preset.label}`}
              accessibilityState={{ selected }}
              onPress={() => applyPreset(preset)}
              className={`min-h-[56px] rounded-xl border-2 p-3 ${
                selected ? "border-go-line bg-go-soft" : "border-edge bg-card"
              }`}
            >
              <Text className="text-sm font-black text-strong">
                {preset.label}{selected ? " ✓" : ""}
              </Text>
              <Text className="text-xs text-faint">{preset.caption}</Text>
            </Pressable>
          );
        })}
      </View>

      <View className="rounded-2xl border border-edge bg-card p-4 gap-4">
        <Text className="text-sm font-black text-strong">Fine-tune the numbers</Text>
        {TUNABLE_FIELDS.map((field) => (
          <NumberField
            key={field.key}
            label={field.label}
            hint={field.hint}
            value={draft[field.key]}
            onChange={(value) => {
              setDraft((current) => ({ ...current, [field.key]: value }));
              setApplied(false);
            }}
          />
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Apply tuning"
          onPress={applyTuning}
          className="h-12 items-center justify-center rounded-lg bg-accent px-4"
        >
          <Text className="text-sm font-black text-onaccent">Apply tuning</Text>
        </Pressable>
        {applied ? (
          <Text className="text-xs font-semibold text-go">
            Applied ✓ — today's plan already uses these numbers.
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reset plan adjustments to recommended defaults"
          onPress={() => {
            tapSuccess();
            setApplied(false);
            resetEngineThresholds();
            setDraft(draftFrom(DEFAULT_ENGINE_THRESHOLDS));
          }}
          className="h-12 min-w-[48px] items-center justify-center rounded-lg border-2 border-edge px-4"
        >
          <Text className="text-sm font-black text-body">Reset to recommended defaults</Text>
        </Pressable>
      </View>

      {/* ── Phase 12: data export (moved from the calendar screen) ──
          The share plumbing carries NATIVE modules (expo-file-system /
          expo-sharing). OTA updates can add JavaScript to an installed APK
          but never native code, so the imports stay dynamic: APKs built
          before those modules existed render this screen normally, and
          pressing export rejects lazily into a friendly note. */}
      <DataExportCard />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to home"
        onPress={() => {
          tapLight();
          if (router.canGoBack()) router.back();
          else router.navigate("/");
        }}
        className="mb-2 h-12 min-w-[48px] items-center justify-center rounded-lg bg-accent px-4"
      >
        <Text className="text-sm font-black text-onaccent">Done</Text>
      </Pressable>
    </ScrollView>
  );
}

/**
 * Your data (Phase 12): the whole local store as JSON (complete backup) or a
 * sectioned CSV (spreadsheet), delivered through the share sheet. Files land
 * in the cache dir; the athlete saves or sends them.
 */
function DataExportCard() {
  const [exportNote, setExportNote] = useState<string | null>(null);

  const shareExport = async (kind: "json" | "csv") => {
    setExportNote(null);
    try {
      const [{ File, Paths }, Sharing] = await Promise.all([
        import("expo-file-system"),
        import("expo-sharing"),
      ]);
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        setExportNote("Sharing isn't available on this device.");
        return;
      }
      const state = useAppStore.getState();
      const { json, csv, dateKey } = buildExport(
        {
          profile: state.profile,
          trainingObjective: state.trainingObjective,
          readinessInputs: state.readinessInputs,
          activityLogs: state.activityLogs,
          workoutLogs: state.workoutLogs,
          workoutProgress: state.workoutProgress,
          scheduledEvents: state.scheduledEvents,
          personalBests: state.personalBests,
          activePlan: state.activePlan,
          activeProgramId: state.activeProgramId,
        },
        new Date(),
      );
      const extension = kind === "json" ? "json" : "csv";
      const file = new File(Paths.cache, `vikai-export-${dateKey}.${extension}`);
      file.write(kind === "json" ? json : csv);
      await Sharing.shareAsync(file.uri, {
        mimeType: kind === "json" ? "application/json" : "text/csv",
        dialogTitle: "Export Vikai Trainer data",
      });
      tapSuccess();
    } catch {
      setExportNote("Sharing isn't available on this device.");
    }
  };

  return (
    <View className="rounded-2xl border border-edge bg-card p-4">
      <Text className="text-xs font-bold uppercase tracking-widest text-faint">
        Your data — everything stays on this phone
      </Text>
      <Text className="mt-1 text-xs text-faint">
        Take your records with you — a complete backup or a spreadsheet.
      </Text>
      <View className="mt-2 flex-row gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Export all data as a JSON backup"
          onPress={() => {
            void shareExport("json");
          }}
          className="h-12 flex-1 items-center justify-center rounded-xl border-2 border-edge bg-app"
        >
          <Text className="text-xs font-black text-body">⬇ JSON backup</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Export all data as a spreadsheet CSV"
          onPress={() => {
            void shareExport("csv");
          }}
          className="h-12 flex-1 items-center justify-center rounded-xl border-2 border-edge bg-app"
        >
          <Text className="text-xs font-black text-body">⬇ Spreadsheet (CSV)</Text>
        </Pressable>
      </View>
      {exportNote !== null ? (
        <Text className="mt-2 text-xs font-semibold text-shield">{exportNote}</Text>
      ) : null}
    </View>
  );
}
