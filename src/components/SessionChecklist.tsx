import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { BASE_PLAN_TITLES } from "../plans/basePlan";
import { exerciseDetailsFor, type ComponentDetail } from "../plans/fall2026";
import { tapLight } from "../lib/haptics";
import type { SessionRow, SessionView } from "../lib/session";
import { ExerciseDetailList } from "./ExerciseDetailList";

/**
 * The checkable Game Plan list (live session cockpit) — shared by the Home
 * hub and the /workout detail screen so check-off state is identical
 * everywhere. Remaining rows carry the engine's CURRENT scaled volume;
 * checking one freezes what was actually done. Engine-removed rows render
 * dimmed in their own group and never need an action. Every row expands to
 * "See the work": the real exercises, prescriptions, cues, and video links
 * from the season plan (the engine still owns all scaling decisions).
 */

interface SessionChecklistProps {
  view: SessionView;
  /** Dim the checkboxes while the workout log is recorded (read-only recap). */
  finished: boolean;
  /** Local date used to resolve the season plan's exercise detail. */
  localDate: string;
  onToggle: (componentId: string, sets: number) => void;
}

export function SessionChecklist({ view, finished, localDate, onToggle }: SessionChecklistProps) {
  const remaining = view.rows.filter((row) => row.state === "remaining");
  const done = view.rows.filter((row) => row.state === "done");
  const skipped = view.rows.filter((row) => row.state === "skipped");

  return (
    <View className="gap-2">
      {remaining.map((row) => (
        <ChecklistRow
          key={row.componentId}
          row={row}
          localDate={localDate}
          onToggle={finished ? undefined : onToggle}
        />
      ))}
      {done.length > 0 ? (
        <View className="gap-2">
          {done.map((row) => (
            <ChecklistRow
              key={row.componentId}
              row={row}
              localDate={localDate}
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
            <ChecklistRow key={row.componentId} row={row} localDate={localDate} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ChecklistRow({
  row,
  localDate,
  onToggle,
}: {
  row: SessionRow;
  localDate: string;
  onToggle?: (componentId: string, sets: number) => void;
}) {
  const title = BASE_PLAN_TITLES[row.componentId] ?? row.componentId;
  const detail = exerciseDetailsFor(row.componentId, localDate);
  const done = row.state === "done";
  const locked = onToggle === undefined;

  return (
    <View
      className={`overflow-hidden rounded-xl border-2 ${
        done ? "border-green-500/40 bg-green-500/10" : "border-slate-700 bg-slate-800"
      }`}
    >
      <Pressable
        accessibilityRole={locked ? undefined : "checkbox"}
        accessibilityState={locked ? undefined : { checked: done }}
        accessibilityLabel={`Toggle ${title}`}
        disabled={locked}
        onPress={() => {
          if (onToggle === undefined) return;
          tapLight();
          onToggle(row.componentId, row.sets);
        }}
        className={`flex-row items-center gap-3 px-3 py-3 ${locked ? "" : "min-h-[56px]"}`}
      >
        {locked ? (
          <Text className="text-base opacity-50">•</Text>
        ) : (
          <View
            className={`items-center justify-center rounded-md border-2 ${
              done ? "border-green-500 bg-green-500" : "border-slate-500"
            }`}
            // Decorative checkbox indicator (the whole row is the touch target).
            style={{ width: 28, height: 28 }}
          >
            {done ? <Text className="text-sm font-black text-slate-950">✓</Text> : null}
          </View>
        )}
        <View className="flex-1">
          <Text
            className={`text-sm font-bold ${done ? "text-slate-400 line-through" : "text-slate-50"}`}
          >
            {title}
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

      {detail !== undefined ? (
        <ExpandableWork
          rowKey={row.componentId}
          title={title}
          detail={detail}
          locked={locked}
          reduced={row.modification === "REDUCED"}
        />
      ) : null}
    </View>
  );
}

/**
 * "See the work" expander + exercise detail panel. Its own element so the
 * check-off toggle and the expander never fight for the same tap.
 */
function ExpandableWork({
  rowKey,
  title,
  detail,
  locked,
  reduced,
}: {
  rowKey: string;
  title: string;
  detail: ComponentDetail;
  locked: boolean;
  reduced: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!expanded) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`See the work: ${title}`}
        onPress={() => {
          tapLight();
          setExpanded(true);
        }}
        className="min-h-[48px] flex-row items-center gap-2 border-t border-slate-700/60 px-3 py-2"
      >
        <Text className={`text-xs font-bold ${locked ? "text-slate-500" : "text-green-300"}`}>
          See the work
        </Text>
        <Text className="text-xs text-slate-500">▸</Text>
      </Pressable>
    );
  }

  return (
    <View className="border-t border-slate-700/60 p-3">
      <Text className={`text-xs font-semibold ${locked ? "text-slate-500" : "text-green-300"}`}>
        {locked
          ? "Not part of today's plan — study it anyway."
          : reduced
            ? "Volume scaled — keep the weight, drop the extra sets."
            : detail.exercises.length > 0
              ? "Full prescription today — quality over quantity."
              : "Nothing heavy here today."}
      </Text>
      <View className="mt-2">
        <ExerciseDetailList detail={detail} />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Hide the work: ${title}`}
        onPress={() => {
          tapLight();
          setExpanded(false);
        }}
        className="mt-2 h-12 flex-row items-center justify-center rounded-lg bg-slate-700/50"
      >
        <Text className="text-xs font-bold text-slate-300">Hide the work ▴</Text>
      </Pressable>
    </View>
  );
}

function setsText(row: SessionRow): string {
  if (row.state === "skipped") return "Not part of today's plan";
  if (row.state === "done") return `You did ${row.sets} ${row.sets === 1 ? "set" : "sets"}`;
  if (row.modification === "REDUCED") return `${row.baseSets} → ${row.sets} sets`;
  return `${row.sets} ${row.sets === 1 ? "set" : "sets"}`;
}
