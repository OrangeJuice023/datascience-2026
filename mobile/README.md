# SIGMA mobile

The Expo client for the SIGMA API. It is read-only: it renders the same
records as the web client, with the same provenance rules, and adds nothing
that is not in the API response.

The app never decides what a number means on its own. Every screen states
whether the data behind it is **live**, **demo** (simulated), **not
connected**, or **unavailable**, and the screens that show a model or a
prototype module say so in the same breath as the number.

## Requirements

- Node.js 20+ and npm
- The SIGMA web API running (see `web/`)
- For native builds: an Expo account, and the Android SDK / Xcode as needed
- JDK 17 for local Android Gradle builds (`JAVA_HOME` pointing at a JDK 17
  install; the JRE 8 that ships on some Windows machines is too old for
  Gradle)

## Run it

```bash
npm install
npm start
```

Then press `a` for an Android emulator, `i` for the iOS simulator, or scan
the QR code with Expo Go.

The app needs an API to talk to. The default is
`http://localhost:3000/api/v1`, which is the web dev server. On an Android
emulator the host machine is `10.0.2.2`, not `localhost`; on a physical
device use the host's LAN address. The address is editable in the app under
**Settings**, and is shown on the Overview screen so it is never a guess.

To bake a different default into a build, set `EXPO_PUBLIC_API_BASE_URL`
(see `.env.example`).

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.20:3000/api/v1 npm start
```

## Checks

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # expo lint
```

## EAS builds

`eas.json` defines three profiles:

| Profile       | What it produces                                                    |
| ------------- | ------------------------------------------------------------------- |
| `development` | A development client, Android as an APK, iOS for the simulator      |
| `preview`     | An internal distribution build (APK on Android, TestFlight on iOS)   |
| `production`  | A store build, with the version auto-incremented                   |

```bash
npx eas-cli@latest init          # once per project: links the Expo project
npx eas-cli@latest build --profile preview --platform all
npx eas-cli@latest build --profile production --platform all
```

Before the first build, two things in `app.json` need to match the Expo
account that owns the project:

- `ios.bundleIdentifier` and `android.package` are both `org.sigma.mobile`.
  Change them to the reverse-DNS identifier of your organization, for
  example `com.yourorg.sigma`.
- `eas init` writes the project id into `app.json` under `expo.extra.eas`.

Cleartext HTTP is off by default (`app.json`). `app.config.js` turns it on
(Android `usesCleartextTraffic`, iOS `NSAllowsLocalNetworking`) only for the EAS
`development` profile and for local `expo run` builds, so a development build
can reach a plain-HTTP API on localhost or the LAN. Preview and production
builds point at `https://datascience-2026.vercel.app/api/v1` (`eas.json`) and
refuse cleartext.

## Layout

```
src/
  api/          The API client, the base-URL setting, and typed endpoints
  app/          expo-router routes: one file per tab
  components/   Shared building blocks (cards, status pills, charts)
  constants/    Colors, spacing, and the data-status palette
  hooks/        useResource (loading/error/data) and theme helpers
  state/        The API-address context shared by every screen
```

The API request and response types come from
`packages/sigma-contracts`, shared with the web client. They are imported
with `import type` only, so the package is never bundled into the app.

## Icons

The app icon set is generated from one vector mark:

```bash
npm run icons
```

The script needs `sharp`, which lives in `web/`. The generated PNGs are
committed, so this only needs to run when the mark changes.
