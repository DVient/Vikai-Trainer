# VIKAI Trainer 🏀

Local-first basketball readiness and autoregulation for youth athletes — built with React Native (Expo).

> **🌐 Live preview:** once this repo is on GitHub, the web app is published automatically on every push to `main` at
> **`https://<your-username>.github.io/<repo-name>/`**
> One-time setup: repo **Settings → Pages → Build and deployment → Source: "GitHub Actions"**. The workflow (`.github/workflows/deploy-pages.yml`) builds the static export with the base path derived from the repo name, so deep links like `/plan` and `/workout` work on Pages too.

VIKAI builds each athlete's training day around *them*: how they slept, how their body feels, what's on the schedule, and what they've already done this week. Same effort, smarter placement — and it stays 100% on the device.

## What it does

- **3-Tap Check-In → Ready State** — three taps (sleep, body feel, energy) charge the Home "battery": **Full Send 🔥 100%**, **Power Save 🌙** (scaled sets), or **Shielded 🛡️ 0%**. GREEN can never display without today's check-in.
- **Daily Game Plan** — the generator maps the engine's restrictions onto a training template: high-load blocks scale down first, focus areas keep their work longest, and pain immediately shields the athlete (an adult check-in is requested — never a push-through).
- **Live check-offs** — check blocks off as you go; logging a practice mid-session re-scales the remaining volume in place. Completed blocks keep credit and stay undoable.
- **My Plan builder** — a preset persona (Jump higher, Get stronger, Faster first step, Two-way engine, All-round, or a skills-first focus) or a customized plan (up to 3 focus areas + 1–3 basketball skills, 4–12 weeks). Plans ramp +8%/week, deload every fourth week, taper the final week, and start at a level matched to recent training history.
- **Personal milestones** — every plan brings benchmark drills (jump touch, lane agility, spot shooting…) with fixed protocols; log attempts and track best-per-drill over time.
- **Practice Log & Calendar** — record activities before/after training (they shape volume), schedule games and practices, reschedule, and build recurring series. Game-proximity windows automatically protect fresh legs.
- **Reminders** — local check-in, fuel-up, and event notifications (no server push).

## Design principles

- **The engine never picks exercises.** The autoregulation engine computes restrictions only; the workout generator maps them onto plans, and the plan builder composes plans from a block library. Concerns stay decoupled.
- **Safety first.** A pain report sets RED, halts loading, and surfaces an adult-attention message. No diagnoses, no rehabilitation protocols, no clinical language anywhere in the UI.
- **Everything stays on your phone.** No accounts, no server, no analytics — data persists locally via AsyncStorage.
- **Built for teens.** Short sentences, game-like vocabulary, ≥48px touch targets throughout.

## Tech stack

| Layer      | Choice                                              |
| ---------- | --------------------------------------------------- |
| Framework  | React Native 0.86 · Expo SDK 57 · expo-router       |
| Styling    | NativeWind (Tailwind CSS)                           |
| State      | Zustand, persisted to AsyncStorage                  |
| Web        | react-native-web                                    |
| Testing    | Vitest (pure logic) + React Native Testing Library  |

## Project structure

```
app/               Expo Router screens (Home, check-in, workout, plan, calendar, …)
src/engine/        Pure autoregulation engine — restrictions only, fully deterministic
src/plans/         Block library, base plan, personas, plan builder, milestones
src/lib/           Presentation math (power, flow, session views, formatting)
src/components/    UI components (battery gauge, checklists, banners, …)
src/stores/        Zustand store + local persistence (SPEC storage schema)
src/services/      Notification pipeline (tracked IDs, no cancel-all)
tests/             Vitest + RNTL suites
```

## Getting started

Prerequisites: Node.js 20+ and pnpm.

```bash
pnpm install
pnpm run web        # run in the browser
# or
pnpm run android    # Android device/emulator
pnpm run ios        # iOS simulator
pnpm start          # Expo dev server
```

## Scripts

| Script             | What it does                    |
| ------------------ | ------------------------------- |
| `pnpm start`       | Expo dev server                 |
| `pnpm run web`     | Dev server for web              |
| `pnpm run android` | Dev server for Android          |
| `pnpm run ios`     | Dev server for iOS              |
| `pnpm typecheck`   | Strict TypeScript, no emit      |
| `pnpm test`        | Full Vitest suite (thread pool) |
| `pnpm run test:watch` | Vitest in watch mode         |

## Install on your Android phone

### Quick look — Expo Go (no setup)

1. Install **Expo Go** from the Play Store.
2. Run `pnpm start` on the PC and scan the QR code with the phone (same Wi-Fi).
3. The app runs live; code changes appear on reload.

Limits: the app only runs while the dev server runs, and Android notifications are restricted inside Expo Go.

### GitHub Pages preview (automatic on push)

Pushing to `main` deploys the static web build to GitHub Pages (workflow: `.github/workflows/deploy-pages.yml`). Enable it once under **Settings → Pages → Source: "GitHub Actions"**; the preview link is `https://<your-username>.github.io/<repo-name>/`. The base path is derived from the repository name at build time — no manual configuration needed.

### Install properly + future updates over the air (EAS)

One free Expo account (expo.dev), then:

```bash
pnpm exec eas login                        # interactive — your account
pnpm exec eas init                         # links this repo (writes projectId into app.json)
pnpm exec eas build -p android --profile preview   # cloud build → APK
```

`eas build` prints a QR code / download link: open it on the phone, allow
"install unknown apps" for the sideload, and install. The app then runs fully
standalone — local data, notifications, everything.

**Future updates:** after committing code changes,

```bash
pnpm exec eas update -p android --channel preview
```

publishes the new bundle; the installed app downloads it on its next launch —
no reinstall. Only changes to native modules need a new APK build (rerun the
`eas build` command above). This works because the app ships with
`expo-updates`, a `preview` channel, and an `appVersion` runtime policy —
any JS-level change ships over the air.

## Testing

The engine and plan domain are pure functions, so the core rules (RPE boundaries, game-proximity windows, restriction scaling, plan determinism) are covered by fast unit tests; screens are covered with React Native Testing Library — check-off flows, rescaling after mid-session logs, the plan builder reveal, and the completion loop.

```bash
pnpm test
```

## Safety & privacy

VIKAI is a training organizer, not a medical product. Pain is always a stop sign: the app pauses loading and asks for adult involvement — it never prescribes around injury. All athlete data lives on the device; nothing is uploaded, and there is no account system.
