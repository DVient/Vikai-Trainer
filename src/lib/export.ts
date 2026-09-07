/**
 * VIKAI — Data export (Phase 9.12).
 *
 * Turns the local store into two athlete-owned artifacts:
 *  - JSON: the complete, restore-grade backup of every input the app holds.
 *  - CSV: one spreadsheet-friendly file with a section per table.
 *
 * Pure and deterministic: no storage, no clock — the export instant is
 * injected, tables are sorted by date, and every persisted field is
 * included verbatim. The share-sheet wiring (file system + share dialog)
 * lives in the screen; this module only builds strings.
 */

import type {
  ActivityLog,
  AthleteProfile,
  BuiltPlan,
  PersonalBest,
  ReadinessInput,
  ScheduledEvent,
  TrainingObjective,
  WorkoutLog,
} from "../types";

export interface ExportSourceState {
  profile: AthleteProfile;
  trainingObjective: TrainingObjective;
  readinessInputs: readonly ReadinessInput[];
  activityLogs: readonly ActivityLog[];
  workoutLogs: readonly WorkoutLog[];
  workoutProgress: Record<string, Record<string, { componentId: string; sets: number; completedAt: string }>>;
  scheduledEvents: readonly ScheduledEvent[];
  personalBests: readonly PersonalBest[];
  activePlan: BuiltPlan | null;
}

export interface BuiltExport {
  /** Canonical JSON — every slice, pretty-printed, stable key order. */
  json: string;
  /** Sectioned CSV — Excel/Sheets friendly, one block per table. */
  csv: string;
  /** Date-only key for the export instant (used in the file name). */
  dateKey: string;
}

/** CSV field escaping (RFC 4180): quote when needed, double inner quotes. */
function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function csvRow(cells: ReadonlyArray<string | number | undefined>): string {
  return cells.map((cell) => csvField(cell === undefined ? "" : String(cell))).join(",");
}

const LIST_JOIN = "|";

function listValue(values: ReadonlyArray<string> | undefined): string {
  return values === undefined ? "" : values.join(LIST_JOIN);
}

function byDateThenCreated(
  a: { activityDate?: string; localDate?: string; startAt?: string; createdAt: string },
  b: { activityDate?: string; localDate?: string; startAt?: string; createdAt: string },
): number {
  const dateA = a.activityDate ?? a.localDate ?? a.startAt ?? "";
  const dateB = b.activityDate ?? b.localDate ?? b.startAt ?? "";
  if (dateA !== dateB) return dateA < dateB ? -1 : 1;
  return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
}

interface CsvSection {
  title: string;
  header: ReadonlyArray<string>;
  rows: ReadonlyArray<ReadonlyArray<string | number | undefined>>;
}

function csvSections(state: ExportSourceState): ReadonlyArray<CsvSection> {
  const checkIns = [...state.readinessInputs].sort(byDateThenCreated);
  const activities = [...state.activityLogs].sort(byDateThenCreated);
  const sessions = [...state.workoutLogs].sort(byDateThenCreated);
  const events = [...state.scheduledEvents].sort(byDateThenCreated);
  const benchmarks = [...state.personalBests]
    .sort((a, b) => (a.activityDate === b.activityDate ? (a.recordedAt < b.recordedAt ? -1 : 1) : a.activityDate < b.activityDate ? -1 : 1));
  const blocksDone = Object.entries(state.workoutProgress)
    .flatMap(([date, day]) => Object.values(day).map((entry) => ({ date, ...entry })))
    .sort((a, b) => (a.date === b.date ? (a.completedAt < b.completedAt ? -1 : 1) : a.date < b.date ? -1 : 1));

  return [
    {
      title: "CHECK-INS",
      header: ["date", "sleep", "joints", "energy", "soreAreas", "painLocation", "painDescription", "recordedAt"],
      rows: checkIns.map((entry) => [
        entry.localDate,
        entry.sleepAnchor,
        entry.jointStatus,
        entry.energyAnchor,
        listValue(entry.soreAreas),
        entry.painLocation ?? "",
        entry.painDescription ?? "",
        entry.recordedAt,
      ]),
    },
    {
      title: "ACTIVITIES",
      header: ["date", "type", "effortOf10", "minutes", "load", "notes", "createdAt"],
      rows: activities.map((entry) => [
        entry.activityDate,
        entry.activityType,
        entry.sessionRpe,
        entry.durationMinutes,
        entry.sessionRpe !== undefined && entry.durationMinutes !== undefined
          ? entry.sessionRpe * entry.durationMinutes
          : undefined,
        entry.notes ?? "",
        entry.createdAt,
      ]),
    },
    {
      title: "SESSIONS",
      header: ["date", "notes", "soreAreasAfter", "createdAt"],
      rows: sessions.map((entry) => [
        entry.activityDate,
        entry.notes ?? "",
        listValue(entry.soreAreasAfter),
        entry.createdAt,
      ]),
    },
    {
      title: "BLOCKS DONE",
      header: ["date", "component", "sets", "completedAt"],
      rows: blocksDone.map((entry) => [entry.date, entry.componentId, entry.sets, entry.completedAt]),
    },
    {
      title: "EVENTS",
      header: ["startAt", "type", "title", "endAt", "createdAt"],
      rows: events.map((entry) => [
        entry.startAt,
        entry.eventType,
        entry.title ?? "",
        entry.endAt ?? "",
        entry.createdAt,
      ]),
    },
    {
      title: "BENCHMARKS",
      header: ["date", "drill", "value", "recordedAt"],
      rows: benchmarks.map((entry) => [
        entry.activityDate,
        entry.drillId,
        entry.value,
        entry.recordedAt,
      ]),
    },
  ];
}

function buildCsv(state: ExportSourceState): string {
  const lines: string[] = ["Vikai Trainer data export", ""];
  for (const section of csvSections(state)) {
    lines.push(`# ${section.title}`);
    lines.push(csvRow(section.header));
    for (const row of section.rows) lines.push(csvRow(row));
    lines.push("");
  }
  return lines.join("\r\n");
}

function buildJson(state: ExportSourceState, exportedAt: string): string {
  const payload = {
    exportedAt,
    app: "Vikai Trainer",
    schema: "vikai-export/1",
    profile: state.profile,
    trainingObjective: state.trainingObjective,
    readinessInputs: [...state.readinessInputs].sort(byDateThenCreated),
    activityLogs: [...state.activityLogs].sort(byDateThenCreated),
    workoutLogs: [...state.workoutLogs].sort(byDateThenCreated),
    workoutProgress: state.workoutProgress,
    scheduledEvents: [...state.scheduledEvents].sort(byDateThenCreated),
    personalBests: [...state.personalBests].sort(
      (a, b) => (a.activityDate === b.activityDate ? (a.recordedAt < b.recordedAt ? -1 : 1) : a.activityDate < b.activityDate ? -1 : 1),
    ),
    activePlan: state.activePlan,
  };
  return JSON.stringify(payload, null, 2);
}

/** Builds both artifacts. `now` is injected — pure like the engine bridge. */
export function buildExport(state: ExportSourceState, now: Date): BuiltExport {
  const exportedAt = now.toISOString();
  const dateKey = exportedAt.slice(0, 10);
  return { json: buildJson(state, exportedAt), csv: buildCsv(state), dateKey };
}
