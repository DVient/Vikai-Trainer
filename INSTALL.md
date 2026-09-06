# Installing Vikai Trainer

There are only a handful of users, so there is no app store for this app.
Each phone installs it from a private link. **Android is live now. iPhone
support is prepared and can be switched on later** (see the last section).

---

## Android phones — install in about 5 minutes

Send the Android users this exact message (replace the link with the real
one from the latest build):

> **Install Vikai Trainer (basketball training app)**
> 1. Open this link on your phone: **[APK DOWNLOAD LINK]**
> 2. Tap **Download**. If a small banner says "this file might be harmful,"
>    choose **Download anyway** — it's our private app, not from the store.
> 3. Open the downloaded file (swipe down from the top of the screen and tap
>    it, or find it in your **Files/Downloads** app).
> 4. Your phone will ask once: **"Allow from this source"** (or "Install
>    unknown apps") → tap **Allow** / **Settings → Allow from this source**,
>    then go back.
> 5. Tap **Install**. Done — the green Vikai icon appears on your home
>    screen.
>
> First launch: the app asks permission to send **notifications** (practice
> reminders). Tap **Allow** — that's how reminders reach you.
>
> The app works completely offline. When we improve the app, it updates
> itself automatically the next time you open it — you never reinstall.

### Notes for the person sharing the link
- The link comes from `eas build -p android --profile preview`; every new
  APK build gets its own permanent URL on Expo's site. Share the newest one.
- A QR code makes it even easier: paste the link into any free QR generator
  and have people point their camera at it.
- If a user ever sees "App not installed," they most likely skipped step 4 —
  ask them to redo the download and allow the source.

---

## iPhone users — (later; prepared, not yet active)

Apple requires a paid developer account before an app can be installed on
anyone's iPhone — there is no way around it, even for 2 users. When that
account exists ($99/year, approval in 1–2 days), the whole switch-on is:

1. Enroll at developer.apple.com (the account owner does this once).
2. Build and upload:
   ```
   npx eas build -p ios --profile production
   npx eas submit -p ios --latest
   ```
3. In App Store Connect → **TestFlight** → add each iPhone user by **email**
   as a tester.
4. Users install the free **TestFlight** app from the App Store, tap the
   email invite, then tap **Install**. Three taps, nothing technical.

TestFlight builds expire after 90 days — re-run steps 2 when TestFlight
marks a build as expiring (the app keeps working until then).

---

## How updates reach installed phones

- **Everything app-logic related** (training plan, engine, screens) updates
  over the air: `npx eas update --branch production` (or the preview
  channel) — users get it at next app launch. No reinstall, no new link.
- **Native-level changes** (rare) need a new build: re-run
  `eas build`, share the new APK link (Android) or TestFlight build (iOS).
