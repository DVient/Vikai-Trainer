import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { OptionCard } from "./OptionCard";
import { soreAreaLabel, SORE_REGIONS } from "../lib/bodyMap";
import { tapLight } from "../lib/haptics";
import type { SoreArea, SoreRegion } from "../types";

/**
 * Body-map soreness input (Phase 7): the app leads the discussion — region
 * cards first (default = 💪 everything feels good, zero added friction),
 * area chips only for flagged regions. Collapsing a region clears its
 * flags; the selected areas always live with the parent screen so the
 * surrounding form owns persistence.
 *
 * Shared by the daily check-in (Phase 7) and the post-session Finish flow
 * (Phase 8: the same stepper prices TOMORROW's workout).
 */
interface BodyMapProps {
  /** Currently flagged areas (owned by the parent form). */
  areas: readonly SoreArea[];
  /** Full replacement after any region/area toggle or region clear. */
  onAreasChange: (areas: SoreArea[]) => void;
  /** Section heading (defaults to the daily check-in wording). */
  heading?: string;
  /** One-line explainer under the heading. */
  note?: string;
}

export function BodyMap({ areas, onAreasChange, heading = "Optional — Body map 🗺️", note = "Flag sore spots and Vikai scales just those blocks today — not the whole day. Skip if everything feels good. 💪" }: BodyMapProps) {
  const [openRegions, setOpenRegions] = useState<SoreRegion[]>([]);

  const toggleRegion = (region: SoreRegion) => {
    tapLight();
    const wasOpen = openRegions.includes(region);
    setOpenRegions((prev) =>
      wasOpen ? prev.filter((entry) => entry !== region) : [...prev, region],
    );
    if (wasOpen) {
      // Collapsing a region clears its flagged areas — state never lingers.
      const regionAreaIds = (
        SORE_REGIONS.find((entry) => entry.id === region)?.areas ?? []
      ).map((area) => area.id);
      onAreasChange(areas.filter((area) => !regionAreaIds.includes(area)));
    }
  };

  const toggleArea = (area: SoreArea) => {
    tapLight();
    onAreasChange(
      areas.includes(area)
        ? areas.filter((entry) => entry !== area)
        : [...areas, area],
    );
  };

  return (
    <View className="gap-2">
      <Text className="text-sm font-bold text-slate-100">{heading}</Text>
      <Text className="text-xs text-slate-400">{note}</Text>
      <View className="flex-row gap-2">
        {SORE_REGIONS.map((region) => (
          <OptionCard
            key={region.id}
            emoji={region.emoji}
            label={region.label}
            selected={openRegions.includes(region.id)}
            onSelect={() => toggleRegion(region.id)}
            className="flex-1"
          />
        ))}
      </View>
      {openRegions.map((region) => {
        const option = SORE_REGIONS.find((entry) => entry.id === region);
        if (option === undefined) return null;
        return (
          <View
            key={region}
            className="rounded-2xl border border-slate-700 bg-slate-800 p-3 gap-2"
          >
            <Text className="text-xs font-semibold text-slate-300">
              What's sore in the {option.label.toLowerCase()}?
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {option.areas.map((area) => (
                <AreaChip
                  key={area.id}
                  emoji={area.emoji}
                  label={area.label}
                  selected={areas.includes(area.id)}
                  onPress={() => toggleArea(area.id)}
                />
              ))}
            </View>
          </View>
        );
      })}
      {areas.length > 0 ? (
        <Text className="text-xs text-slate-400">
          Sore today: {areas.map(soreAreaLabel).join(", ")}
        </Text>
      ) : null}
    </View>
  );
}

/** ≥48px tappable sore-area chip (second step of the body map). */
function AreaChip({
  emoji,
  label,
  selected,
  onPress,
}: {
  emoji: string;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label} ${selected ? "flagged as sore" : ""}`.trim()}
      onPress={onPress}
      className={`h-12 flex-row items-center gap-1.5 rounded-full border-2 px-4 ${
        selected ? "border-amber-400 bg-amber-400/20" : "border-slate-600 bg-slate-900"
      }`}
    >
      <Text className="text-base">{emoji}</Text>
      <Text className={`text-sm font-semibold ${selected ? "text-amber-300" : "text-slate-300"}`}>
        {label}
      </Text>
    </Pressable>
  );
}
