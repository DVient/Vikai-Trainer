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
          ? "border-accent bg-soft"
          : "border-edge bg-card"
      } ${className}`}
    >
      {emoji !== undefined ? (
        <Text className="text-2xl leading-8">{emoji}</Text>
      ) : null}
      <Text
        className={`text-center text-sm font-semibold ${
          selected ? "text-go" : "text-body"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
