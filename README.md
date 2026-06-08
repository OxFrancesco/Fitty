# Fitty

Fitty is an Expo app that signs in with Google and reads Google Health data such as steps, calories, activity, distance, exercise, sleep, profile, and health metrics.

## Setup

Create `.env.local` with your Google OAuth Web client credentials:

```bash
GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-web-client-secret
```

In Google Cloud Console, add this Web OAuth authorized redirect URI for local simulator testing:

```text
http://localhost:8081/api/google/callback
```

## Run

```bash
bun install
bunx expo start
```

For iOS simulator:

```bash
bunx expo run:ios
```

## Checks

```bash
bunx tsc --noEmit
bunx expo export --platform ios --output-dir dist/ios
```

`dist`, native generated folders, dependencies, and local env files are ignored by git.
