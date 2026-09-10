import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { tapLight, tapSuccess } from "../lib/haptics";

/**
 * App version & updates card (Phase 9.15) — makes the running bundle
 * visible and the newest one forceable. Expo's automatic OTA only applies
 * a fetched update on the next cold start, which made "is the fix actually
 * on my phone?" undecidable from the couch. This card answers it: it shows
 * the exact version/build, whether the current session runs the embedded
 * bundle or a published update (and its date), and offers a manual
 * check → download → restart flow so the new bundle applies immediately.
 *
 * Same OTA-safe pattern as the export card: both native modules ship in
 * every APK since 9.11, but the imports stay dynamic and guarded — an old
 * binary degrades to a one-line note instead of crashing the screen.
 */

interface UpdatesModule {
  updateId: string | null;
  channel: string | null;
  runtimeVersion: string | null;
  isEmbeddedLaunch: boolean;
  createdAt: Date | null;
  checkForUpdateAsync: () => Promise<{ isAvailable: boolean }>;
  fetchUpdateAsync: () => Promise<{ isNew: boolean }>;
  reloadAsync: () => Promise<void>;
}

interface AppVersionInfo {
  version: string | null;
  build: string | null;
  updates: UpdatesModule;
}

type CheckPhase = "idle" | "checking" | "ready" | "latest";

interface CardState {
  info: AppVersionInfo | null;
  unavailable: boolean;
}

function shortId(id: string | null): string | undefined {
  return id !== null && id.length >= 8 ? id.slice(0, 8) : undefined;
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function VersionCard() {
  const [state, setState] = useState<CardState>({ info: null, unavailable: false });
  const [phase, setPhase] = useState<CheckPhase>("idle");
  const [errorNote, setErrorNote] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [updates, constants] = await Promise.all([
          import("expo-updates"),
          import("expo-constants"),
        ]);
        if (!alive) return;
        setState({
          info: {
            version: constants.default.nativeApplicationVersion ?? null,
            build: constants.default.nativeBuildVersion ?? null,
            updates: updates as UpdatesModule,
          },
          unavailable: false,
        });
      } catch {
        if (alive) setState({ info: null, unavailable: true });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const checkForUpdate = async () => {
    if (state.info === null) return;
    tapLight();
    setErrorNote(null);
    setPhase("checking");
    try {
      const { updates } = state.info;
      const result = await updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        setPhase("latest");
        return;
      }
      await updates.fetchUpdateAsync();
      tapSuccess();
      setPhase("ready");
    } catch {
      setPhase("idle");
      setErrorNote("Couldn't check for updates right now — try again later.");
    }
  };

  const applyUpdate = async () => {
    if (state.info === null) return;
    try {
      await state.info.updates.reloadAsync();
    } catch {
      setErrorNote("Restart didn't work — close and reopen the app instead.");
    }
  };

  const info = state.info;
  const runningLine =
    info === null
      ? null
      : info.updates.isEmbeddedLaunch
        ? "Running the app as installed."
        : info.updates.createdAt !== null
          ? `Running an update published ${dateKey(info.updates.createdAt)}.`
          : "Running a downloaded update.";

  return (
    <View className="rounded-2xl border border-edge bg-card p-4">
      <Text className="text-xs font-bold uppercase tracking-widest text-faint">
        App version &amp; updates
      </Text>

      {state.unavailable ? (
        <Text className="mt-2 text-sm text-body">
          Updates aren't available on this install.
        </Text>
      ) : info === null ? (
        <Text className="mt-2 text-sm text-faint">Reading version…</Text>
      ) : (
        <>
          <Text className="mt-2 text-sm font-bold text-strong">
            Version {info.version ?? "?"}
            {info.build !== null ? ` (build ${info.build})` : ""}
          </Text>
          {runningLine !== null ? (
            <Text className="text-sm text-body">{runningLine}</Text>
          ) : null}
          <Text className="mt-1 text-xs text-faint">
            Runtime {info.updates.runtimeVersion ?? "?"}
            {info.updates.channel !== null ? ` · channel ${info.updates.channel}` : ""}
            {shortId(info.updates.updateId) !== undefined
              ? ` · update ${shortId(info.updates.updateId)}…`
              : ""}
          </Text>

          {phase === "ready" ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Restart to apply the downloaded update"
              onPress={() => {
                void applyUpdate();
              }}
              className="mt-3 h-12 items-center justify-center rounded-xl border-2 border-go-line bg-go-soft"
            >
              <Text className="text-sm font-black text-go">Restart to apply ✨</Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Check for update now"
              onPress={() => {
                void checkForUpdate();
              }}
              className="mt-3 h-12 items-center justify-center rounded-xl border-2 border-edge bg-card"
            >
              <Text className="text-sm font-bold text-strong">
                {phase === "checking" ? "Checking…" : "Check for update now"}
              </Text>
            </Pressable>
          )}

          {phase === "latest" ? (
            <Text className="mt-2 text-sm font-semibold text-go">
              You're on the latest version.
            </Text>
          ) : null}
          {errorNote !== null ? (
            <Text className="mt-2 text-xs font-semibold text-shield">{errorNote}</Text>
          ) : null}
        </>
      )}
    </View>
  );
}
