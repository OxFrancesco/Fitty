# App Store Metadata Draft: en-US

## App Identity

- Name: `OpenFit: Activity Rings`
- Subtitle: `Health rings and widgets`
- Primary category: `Health & Fitness`
- Secondary category: `Utilities`
- Copyright: `2026 Francesco Oddo`
- Content rights: `Does not use third-party content` pending owner confirmation.

## URLs

- Support URL: `TODO_PUBLIC_SUPPORT_URL`
- Privacy Policy URL: `TODO_PUBLIC_PRIVACY_URL`
- Marketing URL: optional

## Keywords

```text
health,fitness,activity,widgets,rings,google health,apple health,sleep,weight,workouts
```

## Promotional Text

```text
Turn Google Health activity, sleep, and body metrics into a clear dashboard with configurable rings and home-screen widgets.
```

## Description

```text
OpenFit gives you a focused dashboard for Google Health data across iPhone, Android, and web. Sign in with Google, choose the metrics that matter to you, and keep activity rings, metric cards, and home-screen widgets aligned with your latest health snapshot.

Track the daily view or review longer ranges for activity, sleep, body, heart, and nutrition metrics. Customize the rings and cards on your dashboard so the most useful numbers stay visible.

On iPhone, OpenFit can also export selected Google Health records into Apple Health when you start the sync. The current export is intentionally limited to weight, sleep, and workouts to reduce duplicate-record risk.

Key features:
- Google Health sign-in and read-only health summaries
- Configurable activity rings and metric cards
- iOS and Android home-screen widgets
- Date ranges for today, 7 days, 14 days, 30 days, and 90 days
- Manual Google Health to Apple Health export for supported iOS records

OpenFit is a personal wellness utility. It does not provide medical advice, diagnosis, or treatment.
```

## What's New

```text
Initial App Store release.
```

## App Review Notes

```text
OpenFit signs in with Google to read Google Health API data using read-only scopes. The app shows a configurable health dashboard and home-screen widgets. On iOS, users can manually export supported Google Health weight, sleep, and workout records into Apple Health after granting HealthKit permissions.

The app does not provide medical advice, diagnosis, or treatment. The Apple Health export is one-way from Google Health to Apple Health and is user initiated.

Reviewer setup:
1. Use a Google account with access to Google Health API data, or use the demo account provided in App Review credentials.
2. Sign in with Google from the first screen.
3. Grant requested Google Health scopes.
4. To test Apple Health export, open Settings and start the Apple Health sync on a physical iOS device with HealthKit available.

TODO: Add demo account credentials or exact reviewer steps before submission.
```

## Age Rating Draft

Owner confirmation is required before entering these answers in App Store Connect.

- Health or wellness topics: `Yes`
- Medical or treatment information: `No`, if the app only displays personal wellness data and does not provide diagnosis, treatment, clinical recommendations, or medical instructions.
- Unrestricted web access: `No`, if no general browser is available inside the app.
- User generated content: `No`
- Messaging and chat: `No`
- Advertising: `No`, if no ad SDK or ad placements are added.
- Gambling, contests, loot boxes, alcohol/tobacco/drugs, weapons, profanity, sexual content, horror, and violence fields: `No`, based on the current app scope.

## App Privacy Draft

Confirm in App Store Connect before publishing.

- Data linked to the user: Google account identifiers such as email/profile may be used for account connection.
- Health and fitness data: Google Health data is fetched to display the dashboard and widgets; selected records can be written to Apple Health on iOS after user action.
- Tokens and preferences: OAuth tokens, dashboard preferences, widget data, and sync ledger entries are stored locally using platform storage.
- Third-party sharing: Google APIs are used for sign-in, token exchange, refresh, and health data access. Apple Health is used only when the user enables iOS export.
- Tracking: `No`, unless analytics, advertising, or cross-app tracking SDKs are added.
