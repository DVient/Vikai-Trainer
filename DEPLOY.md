# Install Vikai Trainer on a Phone (with Fueling Reminders)

Vikai Trainer's reminders — the 3:30 PM "Fuel Up 🍎", the 8:00 AM check-in, the 8:30 PM
"Log Today's Sweat 🏀", and pre-game reminders — are **scheduled local
notifications**. The phone's own scheduler fires them even when the app is
closed and there is no internet. No push server, no accounts-in-the-cloud:
that is deliberate (client-only architecture, SPEC §34).

---

## Path 1 — Try it today (Expo Go, ~2 minutes, no build)

1. Install **Expo Go** from the Play Store / App Store on the phone.
2. On the laptop, from this repo:
   ```
   pnpm exec expo start --tunnel
   ```
   (`--tunnel` works across networks; drop it if the phone and laptop share
   Wi-Fi.)
3. Scan the QR code with the phone camera (Android: from inside Expo Go).
4. Vikai Trainer opens in Expo Go. On first launch, Android asks for **notification
   permission — tap Allow**.

Good for: reviewing the app, testing the flow. The reminders carry Expo's
icon and Expo Go must stay installed. For the daily-carry install, use Path 2.

## Path 2 — Daily-carry install (Android APK via EAS Build, recommended)

One-time setup:

1. Create a free account at https://expo.dev and log in from this repo:
   ```
   npm install -g eas-cli
   eas login
   ```
2. Initialize the project (accept the defaults):
   ```
   eas init
   ```
   (This writes the project ID into `app.json`.)

Build the installable APK:

```
eas build -p android --profile preview
```

When the cloud build finishes (~10–20 min) it shows a QR code and link:

3. Open the link on the phone and download the APK.
4. Android will ask to allow **"Install unknown apps"** for the browser —
   allow it once, then install.
5. Launch Vikai Trainer → allow **Notifications** when asked.
6. Verify: with Vikai Trainer fully closed, wait for a reminder slot (3:30 PM
   "Fuel Up 🍎", 8:30 PM "Log Today's Sweat 🏀", or the morning check-in) —
   it should appear as a heads-up banner. The Home screen shows
   "🔔 Reminders on — Fuel Up 3:30 PM".

Recommended on the phone: **App info → Battery → Unrestricted** (Samsung and
Xiaomi in particular delay alarms for battery-optimized apps).

## Path 3 — iPhone (later)

Expo Go (Path 1) works today. A standalone iOS install needs an Apple
Developer account ($99/yr):

```
eas build -p ios --profile production   # → TestFlight
```

## What's inside the app for this

- `app.json` — Android/iOS identity (`com.kaivic.vikaitrainer`), notification
  permissions (`POST_NOTIFICATIONS`, `USE_EXACT_ALARM` for exact 3:30 PM
  delivery, `VIBRATE`, `RECEIVE_BOOT_COMPLETED`), branded icon/splash,
  green `#22C55E` notification accent.
- `eas.json` — `preview` profile builds a sideloadable **APK**; `production`
  builds a store `.aab`.
- `src/services/notifications.ts` — the reminder pipeline: HIGH-importance
  Android channel (heads-up + vibration), identifier-tracked scheduling
  (never a bulk cancel), per-event lead reminders for games/practices.
- Home chip — shows "Reminders on/off" and offers the tap-to-enable path.

## Changing reminder times

Defaults live in `src/services/notifications.ts`
(`DEFAULT_FUEL_REMINDER_TIME`, `DEFAULT_CHECKIN_REMINDER_TIME`,
`DEFAULT_ACTIVITY_LOG_REMINDER_TIME`). After changing one, clear the
affected slot in the app (or reinstall) so the first-run scheduler
re-arms it.
