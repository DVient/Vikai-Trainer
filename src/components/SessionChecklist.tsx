import { Pressable, Text, View } from "react-native";

import { BASE_PLAN_TITLES } from "../plans/basePlan";
import { tapLight } from "../lib/haptics";
import type { SessionRow, SessionView } from "../lib/session";

/**
 * The checkable Game Plan list (live session cockpit) — shared by the Home
 * hub and the /workout detail screen so check-off state is identical
 * everywhere. Remaining rows carry the engine's CURRENT scaled volume;
 * checking one freezes what was actually done. Engine-removed rows render
 * dimmed in their own group and never need an action.
 */

interface SessionChecklistProps {
  view: SessionView;
  /** Dim the checkboxes while the workout log is recorded (read-only recap). */
  finished: boolean;
  onToggle: (componentId: string, sets: number) => void;
}

export function SessionChecklist({ view, finished, onToggle }: SessionChecklistProps) {
  const remaining = view.rows.filter((row) => row.state === "remaining");
  const done = view.rows.filter((row) => row.state === "done");
  const skipped = view.rows.filter((row) => row.state === "skipped");

  return (
    <View className="gap-2">
      {remaining.map((row) => (
        <ChecklistRow
          key={row.componentId}
          row={row}
          onToggle={finished ? undefined : onToggle}
        />
      ))}
      {done.length > 0 ? (
        <View className="gap-2">
          {done.map((row) => (
            <ChecklistRow
              key={row.componentId}
              row={row}
              onToggle={finished ? undefined : onToggle}
            />
          ))}
        </View>
      ) : null}
      {skipped.length > 0 ? (
        <View className="gap-2 rounded-xl border border-dashed border-slate-700 p-2">
          <Text className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Adjusted out today
          </Text>
          {skipped.map((row) => (
            <View key={row.componentId} className="flex-row items-center gap-2 px-1 py-1.5">
              <Text className="text-base opacity-50">•</Text>
              <Text className="flex-1 text-sm text-slate-500">
                {BASE_PLAN_TITLES[row.componentId]}
              </Text>
              <Text className="text-xs text-slate-600">Not part of today's plan</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ChecklistRow({
  row,
  onToggle,
}: {
  row: SessionRow;
  onToggle?: (componentId: string, sets: number) => void;
}) {
  const done = row.state === "done";

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={`Toggle ${BASE_PLAN_TITLES[row.componentId]}`}
      disabled={onToggle === undefined}
      onPress={() => {
        if (onToggle === undefined) return;
        tapLight();
        onToggle(row.componentId, row.sets);
      }}
      className={`min-h-[56px] flex-row items-center gap-3 rounded-xl border-2 px-3 py-3 ${
        done ? "border-green-500/40 bg-green-500/10" : "border-slate-700 bg-slate-800"
      }`}
    >
      <View
        className={`items-center justify-center rounded-md border-2 ${
          done ? "border-green-500 bg-green-500" : "border-slate-500"
        }`}
        // Decorative checkbox indicator (the whole row is the touch target).
        style={{ width: 28, height: 28 }}
      >
        {done ? <Text className="text-sm font-black text-slate-950">✓</Text> : null}
      </View>
      <View className="flex-1">
        <Text
          className={`text-sm font-bold ${done ? "text-slate-400 line-through" : "text-slate-50"}`}
        >
          {BASE_PLAN_TITLES[row.componentId]}
        </Text>
        <Text className={`text-xs ${done ? "text-green-300" : "text-slate-400"}`}>
          {setsText(row)}
        </Text>
      </View>
      {!done && row.modification === "REDUCED" ? (
        <View className="rounded-full bg-yellow-500/20 px-2 py-1">
          <Text className="text-xs font-bold text-yellow-300">Scale down</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function setsText(row: SessionRow): string {
  if (row.state === "done") return `You did ${row.sets} ${row.sets === 1 ? "set" : "sets"}`;
  if (row.modification === "REDUCED") return `${row.baseSets} → ${row.sets} sets`;
  return `${row.sets} ${row.sets === 1 ? "set" : "sets"}`;
}
