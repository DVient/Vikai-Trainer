/**
 * VIKAI — Workout-relative activity attribution.
 *
 * Pure helpers that attribute a day's activity logs to the workout: logs
 * recorded at-or-before the day's workout completion are "pre" (they shaped
 * today's volume — the engine rescales the live session); logs recorded
 * after it are "post" (today's session is frozen — they feed the NEXT
 * workout's derivation through the engine's rolling date window).
 *
 * Pure and deterministic: no storage, no clock — every timestamp is provided
 * (AGENTS.md code quality). ISO strings compare lexicographically because
 * all persisted timestamps are `Date.prototype.toISOString` output.
 */

interface TimestampedLog {
  activityDate: string;
  /** ISO instant. Missing timestamps can't be attributed → treated as pre. */
  createdAt?: string;
}

/** Earliest workout-completion timestamp for a local date (undefined = not done). */
export function workoutDoneAt(
  workoutLogs: ReadonlyArray<{ activityDate: string; createdAt?: string }>,
  localDate: string,
): string | undefined {
  const stamps = workoutLogs
    .filter((entry) => entry.activityDate === localDate && entry.createdAt !== undefined)
    .map((entry) => entry.createdAt as string)
    .filter((iso) => Number.isFinite(new Date(iso).getTime()))
    .sort();
  return stamps[0];
}

/** True when the activity was logged after that day's workout completed. */
export function isPostWorkoutActivity(
  activity: { activityDate: string; createdAt?: string },
  doneAt: string | undefined,
): boolean {
  if (doneAt === undefined || activity.createdAt === undefined) return false;
  /*
   * Same-local-day is guaranteed by construction: `partitionActivities`
   * filters both sides to the caller's local date, and the local date is
   * NOT the UTC slice of these ISO instants (they can straddle UTC
   * midnight in the athlete's evening). Instant comparison is the
   * timezone-correct attribution.
   */
  return activity.createdAt > doneAt;
}

export interface ActivityPartition<T extends TimestampedLog = TimestampedLog> {
  /** Logged before today's workout finished (or the workout isn't done yet). */
  pre: T[];
  /** Logged after today's workout finished — they shape the next workout. */
  post: T[];
}

/** Splits a day's activity logs into pre-workout and post-workout groups. */
export function partitionActivities<T extends TimestampedLog>(
  activityLogs: ReadonlyArray<T>,
  workoutLogs: ReadonlyArray<{ activityDate: string; createdAt?: string }>,
  localDate: string,
): ActivityPartition<T> {
  const doneAt = workoutDoneAt(workoutLogs, localDate);
  const pre: T[] = [];
  const post: T[] = [];
  for (const activity of activityLogs) {
    if (activity.activityDate !== localDate) continue;
    if (isPostWorkoutActivity(activity, doneAt)) post.push(activity);
    else pre.push(activity);
  }
  return { pre, post };
}
