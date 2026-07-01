# Google Play Listing Draft: en-US

## Main Listing

- App name: `OpenFit: Activity Rings`
- Short description:

```text
Activity rings, widgets, and Google Health insights in one dashboard.
```

- Full description:

```text
OpenFit turns Google Health data into a clear, configurable dashboard for activity, sleep, body, heart, and nutrition metrics.

Sign in with Google, choose the metrics you care about, and review your latest health snapshot across today, 7 days, 14 days, 30 days, and 90 days. Configure activity rings, metric cards, and Android home-screen widgets so the numbers you check most often are always easy to find.

OpenFit is built for personal wellness tracking:
- Read-only Google Health summaries
- Configurable rings and metric cards
- Android home-screen widgets
- Sleep, activity, body, heart, and nutrition views
- iOS-only manual export from Google Health to Apple Health for supported records

OpenFit is not a medical app and does not provide medical advice, diagnosis, or treatment.
```

## What's New

```text
Initial Google Play release.
```

## Graphics Needed

- App icon: already configured in `app.json`.
- Feature graphic: required for many Play Store surfaces. Create a 1024 x 500 PNG.
- Phone screenshots: required. Capture from the production Android build.
- Tablet screenshots: optional unless tablet support is promoted.

## Play Console App Content Draft

Owner confirmation is required before entering these answers in Play Console.

- App category: `Health & Fitness`
- Contains ads: `No`, if no ad SDK or ad placements are added.
- Target audience: likely adults or general audience, pending owner choice.
- Health apps declaration: personal wellness and fitness data display. Do not claim clinical, diagnostic, emergency, or treatment use.
- Content rating: should align with non-medical wellness utility, with no violence, sexual content, gambling, or user-generated content.
- Privacy policy: required because the app accesses health data and Google account data.

## Data Safety Draft

Do not submit this section until deployed API logging and token handling are verified.

Based on the current source:

- Google account data may include email/profile identifiers from Google sign-in.
- Health and fitness data is fetched from Google Health APIs to display metrics and widgets.
- OAuth tokens are stored locally on device using SecureStore on native platforms and localStorage on web.
- Dashboard preferences, widget data, cached health snapshots, and Apple Health sync ledger entries are stored locally.
- Server API routes exchange and refresh OAuth tokens with Google. Verify hosting logs do not retain OAuth request bodies, tokens, or health data.
- Health data is not intentionally sold or shared for advertising.
- Apple Health export is user initiated and writes only supported weight, sleep, and workout records on iOS.

Suggested Play Data safety posture after verification:

- Data collected: account identifiers if the deployed API or backend stores/logs them; otherwise disclose as handled for app functionality.
- Data shared: Google APIs for sign-in and health access; Apple Health on iOS only at user direction. No advertising or analytics sharing unless added later.
- Security practices: disclose encrypted transit, local secure storage for tokens, and user-initiated sign-out/data removal if implemented and tested.
