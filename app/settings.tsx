import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { tapLight, tapSuccess } from "../src/lib/haptics";
import {
  DEFAULT_TEAM_COLORS,
  parseHexColor,
  type TeamColors,
} from "../src/lib/theme";
import { useAppStore } from "../src/stores/useAppStore";

/**
 * Team Skin — the athlete picks two team colors and the whole app repaints
 * instantly: the secondary color becomes the screen background, the primary
 * color drives accents, buttons, and the header, and every text surface
 * automatically uses whichever team color is most visible on it (with a
 * black/white fallback when neither reads). White + forest green by default.
 */

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

export default function Settings() {
  const router = useRouter();
  const teamColors = useAppStore((state) => state.teamColors);
  const setTeamColors = useAppStore((state) => state.setTeamColors);

  const update = (patch: Partial<TeamColors>) => {
    setTeamColors({ ...teamColors, ...patch });
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
