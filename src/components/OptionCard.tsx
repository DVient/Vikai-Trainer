import { Pressable, Text } from "react-native";

interface OptionCardProps {
  label: string;
  selected: boolean;
  onSelect: () => void;
  /** Extra layout classes, e.g. "flex-1" or "w-[31%]". */
  className?: string;
}

/**
 * Selectable option card (SPEC §28): minimum 56px tall for accessible
 * touch targets (≥48x48px requirement), high-contrast selection state.
 */
export function OptionCard({ label, selected, onSelect, className = "" }: OptionCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onSelect}
      className={`min-h-[56px] items-center justify-center rounded-xl border-2 px-3 py-3 ${
        selected ? "border-sky-600 bg-sky-600" : "border-slate-300 bg-white"
      } ${className}`}
    >
      <Text
        className={`text-center text-sm font-semibold ${
          selected ? "text-white" : "text-slate-800"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
