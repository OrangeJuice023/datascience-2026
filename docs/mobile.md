# SIGMA mobile

The Expo client for the SIGMA API. It is a read-only consumer: it renders
what the API returns and adds no numbers of its own. Every screen states
whether the data behind it is **live**, **demo** (simulated), **not
connected** or **unavailable**, and the screens that show a model or a
prototype module say so in the same breath as the number.

| | |
| --- | --- |
| Location | [`mobile/`](../mobile/) |
| Expo SDK | 58 |
| Entry point | `expo-router/entry` (`mobile/src/app/`) |
| API | [`docs/api.md`](api.md) — `/api/v1` served by the Next.js app in `web/` |
| Shared contracts | [`packages/sigma-contracts`](../packages/sigma-contracts/) (types only) |

## Screens

| Route | What it shows |
| ----- | ------------- |
| `src/app/index.tsx` | Overview: coverage, data freshness, signal status, ACCESS summary, the API address in use, and a link to the source and transparency notes. |
| `src/app/dengue.tsx` | Historical national observations, the trend chart, the coverage window, and the signal panel. While no anomaly model is connected the signal panel says `not_connected` — it does not show zero. |
| `src/app/access.tsx` | Medication-access indicators per area and medicine, with the demo labelling and the distinction between presence, coverage and access. |
| `src/app/policy.tsx` | The policy module, the evidence summary, the AI disclosure, and the Policy Copilot conversation. |
| `src/app/settings.tsx` | The API address, a health check, and the provenance of the data the app is showing. |

## Sigi, the mascot

Sigi is the Philippine maya-inspired bird companion for SIGMA. The artwork is
generated, not drawn by hand: `web/scripts/generate-sigi-mascot.py` renders
every state from one parametric pixel-art model and writes the platform
copies, so the character is consistent by construction and the whole set is
reproducible with one command.

```bash
python web/scripts/generate-sigi-mascot.py
python scripts/validate-sigi-assets.py
```

| State | Frames | What it means |
| ----- | ------ | ------------- |
| `idle` | 6 | Waiting |
| `greeting` | 10 | Welcoming (used on the splash) |
| `listening` | 8 | The user is composing a message |
| `thinking` | 10 | A request is genuinely in flight |
| `responding` | 8 | A reply is on screen |
| `insight` | 10 | A supported result is available |
| `unavailable` | 8 | The capability is not connected to a source |
| `error` | 8 | A request actually failed |
| `success` | 8 | An action actually completed |

Each animation is 128×128, drawn on a 64×64 logical grid and scaled with
nearest-neighbour so every edge stays crisp. The palette is the app palette:
ink `#22231F`, olive `#747D59`, cream `#FFFCF5`, terracotta `#B66D4D` and
cobalt `#2468C9`.

**The rule that matters:** the mascot states what the *app* is doing, never
what the *data* means. There is no "outbreak" pose. A failed request shows the
concerned pose, a source that is not connected shows the puzzled pose, and
every mascot on screen is accompanied by a sentence that carries the actual
meaning. `sigiStateForData` in both clients encodes that mapping, and it is
covered by tests.

Reduced motion is honoured on both platforms: the web client listens to
`prefers-reduced-motion` and the mobile client to the system
"reduce motion" setting, and both fall back to the static still frame.

## Design system

The tokens live in `mobile/src/constants/theme.ts`; every screen reads them
through `useTheme()`, so there is one place to change a colour.

| Token | Light | Meaning |
| ----- | ----- | ------- |
| `background` | `#F4F0E6` | The page: warm paper |
| `backgroundElement` | `#FFFCF5` | Cards and sheets: warm surface |
| `text` | `#22231F` | Primary ink |
| `textSecondary` | `#6F706B` | Muted text, on a card |
| `textSecondaryStrong` | `#5F605B` | Muted text straight on the paper |
| `border` | `#DAD3C6` | Fine borders and hairlines |
| `accent` | `#2468C9` | SIGMA cobalt: actions and links |
| `backgroundSelected` / `accentSoft` | `#E8E1D5` | Muted wash: selected rows, tinted fills |
| `live` | `#747D59` | Olive: data from a connected source |
| `demo` | `#B66D4D` | Terracotta: simulated data |
| `notConnected` | `#627B8B` | Slate blue: a capability with no source |
| `unavailable` | `#8A3A28` | A capability with no data right now |

The four status colours also have darker `…Text` steps
(`liveText`, `demoText`, `notConnectedText`, `unavailableText`). The status
hues are used for dots, rules and fills; when the colour carries words, the
darker step of the same hue is used, so a 12px label still clears the 4.5:1
contrast ratio. Muted text is 4.4:1 on the paper background and 4.9:1 on a
card, which is why the smaller text that sits directly on the page uses the
stronger step.

Headings are set in the display serif (`Type.display`, `Type.title`); body
copy stays in the system sans, and figures use tabular numerals
(`Type.numeric`) so a column of numbers lines up and a changing digit does
not shift the ones beside it.

## Running it locally

```bash
cd mobile
npm install
npm start
```

Press `a` for an Android emulator, `i` for the iOS simulator, or scan the QR
code with Expo Go. The app needs an API to talk to, so start the web server
first (`cd web && npm run dev`).

### Pointing the app at the API

The base URL is a setting, not a constant, and the app always shows the
address it is using. It resolves in this order:

1. The value saved in **Settings** (stored on the device).
2. `EXPO_PUBLIC_API_BASE_URL` baked into the build.
3. A platform-appropriate localhost default.

| Where the app runs | Address to use |
| ------------------ | -------------- |
| Android emulator | `http://10.0.2.2:3000/api/v1` — `localhost` there means the emulator itself |
| iOS simulator | `http://localhost:3000/api/v1` |
| Physical phone (same Wi-Fi) | `http://<host-LAN-IP>:3000/api/v1` |
| Deployed API | `https://<host>/api/v1` |

To bake a different default into a build:

```bash
EXPO_PUBLIC_API_BASE_URL=https://api.example.org/api/v1 npm start
```

`EXPO_PUBLIC_*` values are inlined into the JavaScript bundle at build time.
Only the API address may be set that way. **No provider key, token or
credential may ever be placed in an `EXPO_PUBLIC_*` variable or in the app
source.** The Policy Copilot is reached through the server-side
`POST /api/v1/chat` route; the model provider's key never leaves the server.

CORS matters only for the web build of the app. A native build is not subject
to the browser's same-origin policy, so the API does not need a CORS allow-list
for Android or iOS.

## EAS builds

### Before the first build

1. **An Expo account.** `eas` authenticates against expo.dev; a free account
   is enough for internal distribution builds. This project is linked to
   `@gervi/sigma-mobile`; the project id is in `mobile/app.json` under
   `expo.extra.eas.projectId`.
2. **Link a project** (only needed for a project that is not linked yet).

   ```bash
   cd mobile
   npx eas-cli@latest login
   npx eas-cli@latest init --account <account> --non-interactive
   ```

   `eas init` writes the project id into `mobile/app.json` under
   `expo.extra.eas.projectId` and records the owning account in
   `expo.owner`.

3. **Set the application identifier.** `ios.bundleIdentifier` and
   `android.package` are both `org.sigma.mobile`. Change them in
   `mobile/app.json` to the reverse-DNS identifier of the organization that
   owns the account, for example `com.yourorg.sigma`. Android refuses to
   install an update whose package differs from the installed one, so this
   should be decided before the first build rather than after.

### Profiles

`mobile/eas.json` defines three profiles:

| Profile | Android | iOS | Purpose |
| ------- | ------- | --- | ------- |
| `development` | Debug APK (`:app:assembleDebug`) | Simulator | Daily development on a device |
| `preview` | **APK** (internal distribution) | TestFlight | Sharing a build with reviewers |
| `production` | Store build (`autoIncrement`) | Store build | Release (not configured here) |

The `preview` profile bakes in an API address
(`EXPO_PUBLIC_API_BASE_URL=http://10.60.102.14:3000/api/v1`) that points at a
development machine on the local network, because the SIGMA API is not
deployed anywhere public. On a phone that is on the same network it works
with the web server running; anywhere else, open **Settings** in the app and
enter an address the phone can reach. The address in use is always shown on
the Overview screen.

Android signing is handled by EAS: the upload keystore is generated and held
in Expo's credential store, so no key material is in this repository. The
`mobile/.gitignore` also excludes `*.jks`, `*.keystore` and `*.p12`, so a
keystore that ever lands on a developer machine is not committed by accident.

### Building an internal-preview APK

The most recent internal-preview build:

```
https://expo.dev/artifacts/eas/Vu5N2klO31pLXuiWY9G__is3uTkUkOHs_ueC-v-7pxk.apk
```

Build it again with:

```bash
cd mobile
npx eas-cli@latest build --platform android --profile preview
```

The command uploads the project to Expo's build servers, where Gradle
produces the APK; the finished file is downloadable from the URL the command
prints, and EAS emails a link. Installing it on a phone:

```bash
# after downloading the APK
adb install -a app-release.apk
```

or copy the APK to the phone and open it (Android asks for permission to
install from an unknown source).

What is uploaded: the contents of `mobile/`, minus everything `mobile/.gitignore`
excludes — `node_modules/`, `.expo/`, the native `android/` and `ios/`
directories, and any keystore. No key material and no environment file is
uploaded, because none of them exist in the project directory.

Two things to settle before a build that other people will run:

- **The API address.** `EXPO_PUBLIC_API_BASE_URL` is inlined at build time.
  A build without it falls back to the localhost default, which is correct on
  a simulator and useless on a phone. The `preview` profile sets it to a
  development machine on the local network; for any other target, set it with
  `eas env:create --environment preview --name EXPO_PUBLIC_API_BASE_URL
  --value https://<host>/api/v1 --visibility plaintext`.
- **Cleartext traffic.** `expo-build-properties` currently sets
  `android.usesCleartextTraffic`, which is what lets the app reach a
  plain-HTTP API on a local network. If the API is always served over HTTPS,
  remove that plugin block from `mobile/app.json` before a release build, so
  the release refuses cleartext traffic.

## Checks

```bash
cd mobile
npm run typecheck   # tsc --noEmit
npm run lint        # expo lint
npm run test        # vitest run — API client and settings tests
npx expo config --type public     # resolves and validates app.json
npx expo-doctor@latest             # dependency and config compatibility
npx expo export --platform android # Metro bundle, without a device
```

`npm run test` covers the API client (error mapping, envelope handling,
network and timeout failures) and the API-address settings (validation,
normalisation, storage). There is no device or emulator test suite, and no
claim is made about behaviour on real hardware beyond what the bundle check
covers.

## Known limitations and production prerequisites

- **The API is not deployed.** A phone can only reach the API over the
  network — a local server on the same Wi-Fi, or a deployed one. There is no
  public SIGMA API yet.
- **The application identifier is a placeholder.** `org.sigma.mobile` is
  stable and installable, but it is not the reverse-DNS identifier of an
  organization. Android will not install an update over an app with a
  different package, so change it before any wider release.
- **The anomaly engine is not connected.** The EARS pipeline lives in the
  Python data track and is not served by the API, so the app shows
  `not_connected` and no anomaly values.
- **ACCESS data is simulated.** The API labels it `demo` and the app repeats
  that label.
- **The copilot needs a server-side provider key.** Without one the API
  refuses chat requests with `not_configured`; the app shows that refusal
  rather than an invented answer.
- **No authentication.** The API is read-only and serves public or simulated
  data, but it has no accounts, no sessions and no per-user quota. The chat
  route is the one endpoint that costs money, and it is protected by limits
  and a timeout rather than by a durable rate limiter.
- **No device testing.** The build is verified as a build: it compiles, it
  signs, it installs. Nobody has run it on a handset yet, and the app's
  behaviour on a real device has not been observed.
