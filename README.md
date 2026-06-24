# OpenFit (Fitty)

OpenFit is an Expo and React Native app for people who want a clearer view of their Google Health data across iOS, Android, and web. The repository name is `fitty`, but the installed app name in `app.json` is `OpenFit`.

The app signs in with Google, reads Google Health API data, and turns it into a configurable health dashboard. It can show activity, sleep, heart, body, and nutrition metrics; keep home-screen widgets in sync; and, on iOS, manually export selected Google Health records into Apple Health.

## what the app does

OpenFit is built around four pieces:

- A Google Health dashboard with date ranges for today, 7 days, 14 days, 30 days, and 90 days.
- Configurable rings, cards, and widget metric slots, so the user can decide which metrics matter on the dashboard and on the home screen.
- Native widgets for iOS and Android that show the latest synced metric values outside the app.
- An iOS-only Apple Health export that writes Google Health weight, sleep, and workout records to HealthKit after the user starts the sync.

The app requests read-only Google scopes. It does not write data back to Google Health. The Apple Health flow is one-way:

```text
Google Health API -> OpenFit normalization and sync ledger -> Apple HealthKit
```

That export is intentionally limited. It supports weight, sleep, and workouts because those map cleanly to HealthKit records. It does not mirror steps, heart-rate streams, active energy streams, or distance totals yet because those are easier to duplicate or double count without a stronger import history.

## main features

- Google sign-in through OAuth, using the app's Expo Router API routes for config, callback, token exchange, and token refresh.
- Google Health reads for activity and fitness, profile, sleep, health metrics and measurements, and nutrition.
- Metric catalog for steps, calories, distance, floors, elevation, sedentary time, swim strokes, VO2, heart rate, HRV, oxygen saturation, respiratory rate, body metrics, nutrition, hydration, and sleep.
- Dashboard customization for ring metrics, goals, and visible metric cards.
- Snapshot caching so the dashboard can show recent data quickly while it refreshes.
- iOS widget support through `expo-widgets`.
- Android widget support through `react-native-android-widget`.
- Local Expo module in `modules/apple-health-sync` for HealthKit authorization and writes.
- HealthKit sync metadata and a small SecureStore ledger to avoid rewriting unchanged Apple Health records.
- Web support with Expo Router server output and Google OAuth API routes.

## project layout

```text
src/app                 Expo Router screens and API routes
src/app/index.tsx       Main health dashboard
src/app/settings.tsx    Account, widget, and Apple Health sync settings
src/app/api/google      OAuth config, callback, token, refresh, and session routes
src/components          Dashboard cards, rings, tabs, editors, and shared UI
src/lib                 Google Health, OAuth, widget, cache, prefs, and sync logic
src/widgets             iOS and Android widget renderers and task handlers
modules/apple-health-sync
                        Local Expo module that bridges to HealthKit on iOS
docs                    Notes for Google Health -> Apple Health sync behavior
app.json                Expo app config, bundle IDs, HealthKit entitlement, widgets
eas.json                EAS build profiles
```

The generated `ios/` and `android/` folders are not committed. Expo prebuild creates them when you run or build the native app.

## stack

- Expo SDK 56
- React 19.2.3
- React Native 0.85.3
- Expo Router
- Bun for dependency installation and scripts
- TypeScript
- Expo API routes for the Google OAuth server pieces
- HealthKit through a local Expo module on iOS

Expo SDK 56 requires a modern toolchain. The versioned Expo docs list Node.js 22.13.x as the minimum for SDK 56, React Native 0.85, React 19.2.3, Android SDK 36, and Xcode 26.4 or newer for iOS SDK builds.

## prerequisites

Install these before building from source:

- Git
- Bun
- Node.js 22.13.x or newer
- Xcode 26.4 or newer for iOS builds
- Android Studio with Android SDK 36 for Android builds
- An Expo account and EAS CLI if you want cloud builds
- A Google Cloud project with OAuth credentials that can request the Google Health scopes used by the app

For iOS HealthKit export, use a native iOS build. Expo Go can run parts of the JavaScript app, but it cannot include this repo's native HealthKit module or widget targets.

## install from source

Clone the repo and install dependencies:

```bash
git clone <repo-url>
cd Fitty
bun install
```

Create `.env.local` in the project root:

```bash
GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-web-client-secret
```

Optional values for native or deployed builds:

```bash
# Use a stable API origin instead of the local Metro origin.
EXPO_PUBLIC_API_BASE_URL=https://your-domain.example

# Force Google to return to a specific OAuth callback.
EXPO_PUBLIC_GOOGLE_REDIRECT_URI=https://your-domain.example/api/google/callback

# Override the native app return URI if you change the scheme.
EXPO_PUBLIC_GOOGLE_APP_RETURN_URI=fitty:/oauth

# Enable extra debug details in the UI.
EXPO_PUBLIC_DEBUG=1
```

When deploying the API routes, set the same OAuth values in the hosting environment. `.env.local` is only for local development.

## google oauth setup

Create a Web OAuth client in Google Cloud Console. Add every callback URI the app will use as an authorized redirect URI.

For local simulator development, add:

```text
http://localhost:8081/api/google/callback
```

For a deployed build, add:

```text
https://your-domain.example/api/google/callback
```

For native development on a physical device, use a stable callback URI. Google requires exact redirect URI matches, so LAN URLs like `http://192.168.x.x:8081/api/google/callback` only work if that exact URL is added to the OAuth client. In practice, it is usually cleaner to set `EXPO_PUBLIC_API_BASE_URL` and `EXPO_PUBLIC_GOOGLE_REDIRECT_URI` to a deployed or tunneled API origin.

The native app return URI is different from the Google redirect URI. Google redirects to `/api/google/callback`; that route then sends the user back into the app with `fitty:/oauth`.

## run the app

Start the Expo development server:

```bash
bun run start
```

Run web:

```bash
bun run web
```

Run iOS from source:

```bash
bun run ios
```

Run Android from source:

```bash
bun run android
```

`bun run ios` and `bun run android` compile native projects locally. If `ios/` or `android/` do not exist yet, Expo generates them from `app.json`, the local Expo module, and the configured plugins.

## native build notes

Use a native build for the full app:

- iOS HealthKit export depends on `modules/apple-health-sync`.
- iOS widgets depend on the `expo-widgets` config in `app.json`.
- Android widgets depend on `react-native-android-widget`.
- The app's generated native projects include the bundle ID/package `com.francescooddo.fitty`.

If native config changes and you want a clean generated project, run:

```bash
bunx expo prebuild --clean
```

Then build again:

```bash
bun run ios
# or
bun run android
```

Do not commit the generated `ios/` or `android/` folders unless the project intentionally switches away from the current generated-native-folder workflow.

## eas builds

The repo includes `eas.json` with three profiles:

- `development`: internal distribution with a development client
- `preview`: internal distribution
- `production`: store build with remote auto-incremented versions

Install or run EAS CLI with a version that satisfies `eas.json`:

```bash
bunx eas-cli@latest whoami
```

Build a preview binary:

```bash
bunx eas-cli@latest build --profile preview --platform ios
bunx eas-cli@latest build --profile preview --platform android
```

Build production binaries:

```bash
bunx eas-cli@latest build --profile production --platform ios
bunx eas-cli@latest build --profile production --platform android
```

Run the same EAS build process on your machine:

```bash
bunx eas-cli@latest build --profile production --platform ios --local
bunx eas-cli@latest build --profile production --platform android --local
```

The iOS production profile is configured for App Store Connect app ID `6779281959`. Release builds need the correct Apple and Google Play signing credentials.

If you use the `development` EAS profile, make sure the project includes `expo-dev-client`, because that profile is meant to produce a development-client build.

## checks

Run TypeScript:

```bash
bunx tsc --noEmit
```

Run lint:

```bash
bun run lint
```

Export the iOS JavaScript bundle:

```bash
bunx expo export --platform ios --output-dir dist/ios
```

Build artifacts, dependencies, native generated folders, and local env files are ignored by git.

## troubleshooting

`Missing GOOGLE_CLIENT_ID in .env.local`

The API route cannot see the OAuth environment variables. Check `.env.local` for local development, or the hosting provider's environment settings for deployed API routes.

`redirect_uri_mismatch`

Add the exact callback URI shown by the app to the Google OAuth Web client. The path should end in `/api/google/callback`.

Google sign-in works on web but not on a native device

The native app may be using a LAN or production API origin that is different from the web origin. Set `EXPO_PUBLIC_API_BASE_URL` and `EXPO_PUBLIC_GOOGLE_REDIRECT_URI` to a stable origin and add that callback to Google Cloud Console.

Apple Health export is unavailable

Apple Health sync only runs on iOS and needs a native build. It will not work as a real HealthKit bridge in Expo Go, on Android, or on web.

Widgets are empty or stale

Open the app, sign in with Google, then sync from the dashboard or settings. Widgets use the latest stored widget data, so they need at least one successful sync before they can show real values.

## references

- Expo SDK 56 docs: https://docs.expo.dev/versions/v56.0.0/
- Expo CLI docs: https://docs.expo.dev/more/expo-cli/
- EAS Build docs: https://docs.expo.dev/build/introduction/
- Google Health to Apple Health implementation notes: `docs/google-health-to-apple-health-sync.md`
