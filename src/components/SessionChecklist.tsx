import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { BASE_PLAN_TITLES } from "../plans/basePlan";
import { libraryBlockById } from "../plans/library";
import { exerciseDetailsFor, type ComponentDetail } from "../plans/fall2026";
import { tapLight } from "../lib/haptics";
import type { SessionRow, SessionView } from "../lib/session";
import { ExerciseDetailList } from "./ExerciseDetailList";

/**
 * The checkable Game Plan list (live session cockpit) — shared by the Home
 * hub and the /workout detail screen so check-off state is identical
 * everywhere. Remaining rows carry the engine's CURRENT scaled volume;
 * checking one freezes what was actually done, and a second tap undoes a
 * mistaken check-off (before or after finishing — the workout log itself
 * stays immutable). Engine-removed rows render dimmed in their own group
 * and never need an action. Every row expands to "See the work": the real
 * exercises, prescriptions, cues, and video links from the season plan
 * (the engine still owns all scaling decisions).
 */

interface SessionChecklistProps {
  view: SessionView;
  /** Local date used to resolve the season plan's exercise detail. */
  localDate: string;
  onToggle: (componentId: string, sets: number) => void;
  /**
   * Optional detail resolver: built plans rotate through their block
   * library's exercise pools; the default (fall2026 season plan) applies
   * when omitted.
   */
  resolveDetail?: (componentId: string) => ComponentDetail | undefined;
}

export function SessionChecklist({ view, localDate, onToggle, resolveDetail }: SessionChecklistProps) {
  const remaining = view.rows.filter((row) => row.state === "remaining");
  const done = view.rows.filter((row) => row.state === "done");
  const skipped = view.rows.filter((row) => row.state === "skipped");
  const resolve = resolveDetail ?? ((componentId: string) => exerciseDetailsFor(componentId, localDate));

  return (
    <View className="gap-2">
      {remaining.map((row) => (
        <ChecklistRow
          key={row.componentId}
          row={row}
          resolveDetail={resolve}
          onToggle={onToggle}
        />
      ))}
      {done.length > 0 ? (
        <View className="gap-2">
          {done.map((row) => (
            <ChecklistRow
              key={row.componentId}
              row={row}
              resolveDetail={resolve}
              onToggle={onToggle}
            />
          ))}
        </View>
      ) : null}
      {skipped.length > 0 ? (
        <View className="gap-2 rounded-xl border border-dashed border-edge p-2">
          <Text className="text-xs font-bold uppercase tracking-widest text-faint">
            Adjusted out today
          </Text>
          {skipped.map((row) => (
            <ChecklistRow key={row.componentId} row={row} resolveDetail={resolve} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ChecklistRow({
  row,
  resolveDetail,
  onToggle,
}: {
  row: SessionRow;
  resolveDetail: (componentId: string) => ComponentDetail | undefined;
  onToggle?: (componentId: string, sets: number) => void;
}) {
  const title =
    BASE_PLAN_TITLES[row.componentId] ?? libraryBlockById(row.componentId)?.title ?? row.componentId;
  const detail = resolveDetail(row.componentId);
  const done = row.state === "done";
  const locked = onToggle === undefined;

  return (
    <View
      className={`overflow-hidden rounded-xl border-2 ${
        done ? "border-go-line bg-go-soft" : "border-edge bg-card"
      }`}
    >
      <Pressable
        accessibilityRole={locked ? undefined : "checkbox"}
        accessibilityState={locked ? undefined : { checked: done }}
        accessibilityLabel={`Toggle ${title}`}
        accessibilityHint={done ? "Activate to undo this block" : undefined}
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
              done ? "border-accent bg-accent" : "border-edge"
            }`}
            // Decorative checkbox indicator (the whole row is the touch target).
            style={{ width: 28, height: 28 }}
          >
            {done ? <Text className="text-sm font-black text-onaccent">✓</Text> : null}
          </View>
        )}
        <View className="flex-1">
          <Text
            className={`text-sm font-bold ${done ? "text-faint line-through" : "text-strong"}`}
          >
            {title}
          </Text>
          <Text className={`text-xs ${done ? "text-go" : "text-faint"}`}>
            {setsText(row)}
          </Text>
        </View>
        {!done && row.modification === "REDUCED" ? (
          <View className="rounded-full bg-modulate-soft px-2 py-1">
            <Text className="text-xs font-bold text-modulate">Scale down</Text>
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
          setsScale={
            row.modification === "REDUCED" && row.baseSets > 0
              ? row.sets / row.baseSets
              : undefined
          }
          scaledSets={row.modification === "REDUCED" ? row.sets : undefined}
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
  setsScale,
  scaledSets,
}: {
  rowKey: string;
  title: string;
  detail: ComponentDetail;
  locked: boolean;
  reduced: boolean;
  /** Block scaling ratio on REDUCED rows — scales each prescription. */
  setsScale?: number;
  /** The engine's scaled set target on REDUCED rows — for the intro line. */
  scaledSets?: number;
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
        className="min-h-[48px] flex-row items-center gap-2 border-t border-edge px-3 py-2"
      >
        <Text className={`text-xs font-bold ${locked ? "text-faint" : "text-go"}`}>
          See the work
        </Text>
        <Text className="text-xs text-faint">▸</Text>
      </Pressable>
    );
  }

  return (
    <View className="border-t border-edge p-3">
      <Text className={`text-xs font-semibold ${locked ? "text-faint" : "text-go"}`}>
        {locked
          ? "Not part of today's plan — study it anyway."
          : reduced && scaledSets !== undefined
            ? `Volume scaled — do ${scaledSets} ${scaledSets === 1 ? "set" : "sets"} of each exercise; keep the weight.`
            : detail.exercises.length > 0
              ? "Full prescription today — quality over quantity."
              : "Nothing heavy here today."}
      </Text>
      <View className="mt-2">
        <ExerciseDetailList detail={detail} setsScale={setsScale} />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Hide the work: ${title}`}
        onPress={() => {
          tapLight();
          setExpanded(false);
        }}
        className="mt-2 h-12 flex-row items-center justify-center rounded-lg bg-edge-mid"
      >
        <Text className="text-xs font-bold text-body">Hide the work ▴</Text>
      </Pressable>
    </View>
  );
}

function setsText(row: SessionRow): string {
  if (row.state === "skipped") return "Not part of today's plan";
  if (row.state === "done") {
    return `You did ${row.sets} ${row.sets === 1 ? "set" : "sets"} · tap to undo`;
  }
  if (row.modification === "REDUCED") return `${row.baseSets} → ${row.sets} sets`;
  return `${row.sets} ${row.sets === 1 ? "set" : "sets"}`;
}
