import { Pressable, Text } from "react-native";

import { tapLight } from "../lib/haptics";

interface OptionCardProps {
  label: string;
  /** Optional big emoji rendered above the label (3-Tap Check-In). */
  emoji?: string;
  selected: boolean;
  onSelect: () => void;
  /** Extra layout classes, e.g. "flex-1" or "w-[31%]". */
  className?: string;
}

/**
 * Selectable option card (design refresh): minimum 64px tall, high-contrast
 * GO-green selection state, light haptic tick on tap — error-free input on a
 * shaky bus ride (≥48x48px requirement, we exceed it).
 */
export function OptionCard({ label, emoji, selected, onSelect, className = "" }: OptionCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={() => {
        tapLight();
        onSelect();
      }}
      className={`min-h-[64px] items-center justify-center rounded-2xl border-2 px-3 py-3 ${
        selected
          ? "border-green-500 bg-green-500/20"
          : "border-slate-700 bg-slate-800"
      } ${className}`}
    >
      {emoji !== undefined ? (
        <Text className="text-2xl leading-8">{emoji}</Text>
      ) : null}
      <Text
        className={`text-center text-sm font-semibold ${
          selected ? "text-green-300" : "text-slate-200"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
