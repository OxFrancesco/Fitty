# OpenFit Store Release Checklist

Generated: 2026-06-26

## App Identity

- Expo project: `@avg_francesco/Fitty`
- Expo project ID: `249804cd-24fd-4b3b-905d-bace66854ef5`
- Installed app name: `OpenFit`
- App Store name: `OpenFit: Activity Rings`
- iOS bundle ID: `com.francescooddo.fitty`
- Android package: `com.francescooddo.fitty`
- App version: `1.0.0`

## Current iOS State

- App Store Connect app ID: `6779281959`
- SKU: `OPENFIT20260611`
- Latest valid ASC build: `1.0.0` build `6`
- Latest EAS iOS store build: `958ce1b0-0e7e-4e51-abeb-42b7f7a2da8d`
- Version state: `PREPARE_FOR_SUBMISSION`
- Review state: `NOT_SUBMITTED`

`asc validate` reported these blocking issues on 2026-06-26:

- Description, keywords, support URL, copyright, and primary category are missing.
- App Review contact details are missing.
- Content rights declaration is unset.
- No build is attached to the App Store version.
- App availability is missing.
- Screenshot sets are missing.
- Age rating answers are missing.
- Privacy policy URL is empty.
- App Privacy state still needs manual confirmation in App Store Connect.

## Current Android State

- There is no successful Android production EAS build yet.
- The latest Android EAS build is a canceled preview build: `e60db07a-2c95-448b-8a6c-ddfd9558acd3`.
- The Google Play developer CLI (`gpd`) is not installed on this machine.
- Google Play API submission needs a Play Console service account and usually requires the first AAB upload to be completed manually in Play Console before API submissions work.
- `eas.json` now has an Android production submit profile targeting the internal track with draft review behavior.

## Owner Inputs Needed

- Public support URL.
- Public privacy policy URL.
- App Review contact first name, last name, email, and phone.
- Apple demo account or review instructions for a Google Health test account.
- Screenshots for required App Store and Google Play device classes.
- App Store age rating answers, especially health/wellness and medical-information fields.
- Apple content rights declaration.
- Google Play Console access, package creation, and service account JSON or EAS-managed Play credentials.
- Google Play App content declarations: Data safety, Health apps, Ads, Target audience, Content rating, and Privacy policy.
- Confirmation on whether Sign in with Apple is required or whether the Google OAuth flow qualifies as data-source authorization for Google Health.

## Recommended Publish Sequence

1. Freeze the release branch and run local lint/tests.
2. Host the support and privacy policy pages from `store/legal`.
3. Generate store screenshots from the production build, not from Expo Go.
4. Build Android production AAB:

```bash
npx eas-cli@latest build --platform android --profile production
```

5. Create the Google Play app with package `com.francescooddo.fitty`.
6. Upload the first Android AAB manually in Play Console if the API has not been used for this app before.
7. Configure Play Console service account access for EAS Submit.
8. Submit Android to internal testing first:

```bash
npx eas-cli@latest submit --platform android --profile production --latest
```

9. Complete App Store Connect metadata, attach build `6` or a newer build, and rerun:

```bash
asc validate --app 6779281959 --platform IOS --output table
asc review doctor --app 6779281959 --output table
```

10. Submit iOS for App Review only after validation is clean and App Privacy has been confirmed in the App Store Connect UI.
11. Promote Google Play from internal testing to closed/open/production only after Data safety and Health apps declarations are accepted.

## Submission Guardrails

- Do not mark the app as medical advice, diagnosis, or treatment.
- Do not claim two-way health sync. The current Apple Health flow is Google Health to Apple Health only.
- Do not declare that no data is collected until the deployed API hosting logs and OAuth token handling are verified.
- Do not submit to production review until screenshot, privacy, support, age rating, and data safety inputs are complete.
