# Google Health to Apple Health Sync

Last verified: 2026-06-24

This document narrows the first implementation to one-way sync:

```text
Google Health API -> Fitty normalization + sync ledger -> Apple HealthKit
```

Do not implement Apple Health -> Google Health in the first phase. The first phase should only mirror selected Google Health data into Apple Health and should never write anything back to Google.

## Current App Context

Fitty already signs in with Google and reads Google Health API data through OAuth:

- `src/lib/google-health.ts` defines Google Health read scopes.
- `GOOGLE_HEALTH_BASE_URL` points at `https://health.googleapis.com/v4`.
- Current app code is display-oriented. It fetches rollups and summaries, which is not enough by itself for reliable Apple Health writes.

Apple Health writes require HealthKit access inside the iOS app. There is no Apple Health cloud API that can be called from a backend to write a user's Health database. Because Fitty is an Expo SDK 56 app, this requires native iOS code. The current app now uses a small local Expo module for this bridge, so the feature must run in a rebuilt iOS development build or App Store/TestFlight build. It will not work in Expo Go.

## Implemented In This Repo

The first implementation is a manual, one-way iOS export from Google Health into Apple Health.

- `modules/apple-health-sync` contains the local Expo module that requests HealthKit authorization and writes HealthKit samples/workouts.
- `src/lib/google-health.ts` now includes raw Google data point readers and normalization for weight, exercise, and sleep.
- `src/lib/apple-health-sync.ts` orchestrates the Google -> Apple flow, batches HealthKit writes, and stores the MVP ledger.
- `src/app/settings.tsx` exposes an iOS-only Apple Health export action.
- `app.json` includes the HealthKit entitlement and usage strings that are applied to generated native projects.

Current supported write types:

| Google Health type | Apple Health target | Status |
| --- | --- | --- |
| `weight` | `HKQuantityTypeIdentifierBodyMass` | Implemented |
| `sleep` | `HKCategoryTypeIdentifierSleepAnalysis` | Implemented as conservative asleep intervals |
| `exercise` | `HKWorkout` | Implemented with conservative workout type mapping |

The implementation intentionally skips steps, heart-rate streams, standalone active energy, and standalone distance in the first pass. Those streams are either high-volume or easy to double count without a stronger ledger and UX.

## Phase 1 Product Goals

1. Let the user connect Apple Health and explicitly start or enable "Sync Google Health to Apple Health."
2. Read selected data types from Google Health API.
3. Normalize Google records into a platform-neutral shape.
4. Write corresponding HealthKit samples or workouts to Apple Health.
5. Store a durable sync ledger so repeated syncs update or skip existing HealthKit records instead of creating duplicates.
6. Provide basic status: enabled data types, last sync time, records written, records skipped, and sync errors.

## Phase 1 Non-Goals

- No Apple Health -> Google Health writes.
- No Google write scopes.
- No editing or deleting Google Health data.
- No blind copying of daily step totals into Apple Health.
- No medical records support.
- No claim of real-time sync. iOS background execution and Apple Health writes are device-gated.

## Recommended First Data Types

Start with data types that map cleanly to individual HealthKit samples and have low duplicate risk.

| Priority | Google Health data type | HealthKit target | Direction | Notes |
| --- | --- | --- | --- | --- |
| 1 | `weight` | `HKQuantityTypeIdentifierBodyMass` | Google -> Apple | Good MVP type. Single timestamped samples. |
| 1 | `exercise` | `HKWorkout` plus optional related samples | Google -> Apple | Requires careful activity type mapping. |
| 1 | `sleep` | `HKCategoryTypeIdentifierSleepAnalysis` | Google -> Apple | Map intervals and sleep stage/summary fields conservatively. |
| 2 | `heart-rate` | `HKQuantityTypeIdentifierHeartRate` | Google -> Apple | Raw samples can be numerous. Page and batch carefully. |
| 2 | `active-energy-burned` | `HKQuantityTypeIdentifierActiveEnergyBurned` | Google -> Apple | Write intervals only when the source interval is clear. |
| 2 | `distance` | distance quantity type by activity context | Google -> Apple | Prefer workout-associated distance when possible. |
| Later | `steps` | `HKQuantityTypeIdentifierStepCount` | Google -> Apple | High duplicate risk. Avoid for MVP unless using raw non-overlapping intervals and source metadata. |

For MVP, prefer `weight`, `exercise`, and `sleep`. Add high-volume sample streams after idempotency and pagination are proven.

## Required Native iOS Work

Implemented through `modules/apple-health-sync`.

The HealthKit access layer needs these capabilities:

1. Check `HKHealthStore.isHealthDataAvailable()`.
2. Request authorization for the exact data types being mirrored.
3. Save HealthKit samples/workouts.
4. Use HealthKit sync metadata on every mirrored sample:
   - `HKMetadataKeySyncIdentifier`
   - `HKMetadataKeySyncVersion`
5. Return saved HealthKit UUIDs or enough result detail to update the sync ledger.
6. Expose explicit delete support only for Fitty-owned mirrored samples, and only after the product defines deletion UX.

Expo-specific implementation choices:

1. Prefer a small custom Expo module if existing HealthKit bridges are stale against React Native `0.85`.
2. If using a third-party bridge, verify it supports Expo SDK 56 / React Native `0.85` before installing.
3. Add HealthKit entitlement and Info.plist usage strings through app config or a config plugin.
4. Rebuild the native app with `bunx expo run:ios` or an EAS development build. Do not test this in Expo Go.

Implemented iOS config additions:

```json
{
  "expo": {
    "ios": {
      "entitlements": {
        "com.apple.developer.healthkit": true
      },
      "infoPlist": {
        "NSHealthShareUsageDescription": "OpenFit uses Apple Health permissions for synced health records you choose to export.",
        "NSHealthUpdateUsageDescription": "OpenFit writes selected Google Health weight, sleep, and workout records to Apple Health when you start an export."
      }
    }
  }
}
```

The exact entitlement shape has been applied to the generated iOS project and validated with a simulator build.

## Google API Work

The one-way phase can use the existing Google read-only scopes. Do not add write scopes until the later two-way phase.

Current display code uses rollups and limited summary reads. Apple Health mirroring needs raw data points because HealthKit writes should represent specific samples, intervals, sessions, or workouts.

Add Google readers that:

1. Fetch raw data points per type through `users/me/dataTypes/{dataType}/dataPoints`.
2. Use filter windows by physical or civil time depending on the data type.
3. Follow `nextPageToken`.
4. Respect page-size limits, especially `exercise` and `sleep`.
5. Preserve the Google `DataPoint.name`, `dataSource`, interval/sample time, units, and original payload hash.

Example reader responsibilities:

```text
readGoogleWeightPoints(start, end) -> CanonicalHealthRecord[]
readGoogleExercisePoints(start, end) -> CanonicalHealthRecord[]
readGoogleSleepPoints(start, end) -> CanonicalHealthRecord[]
```

## Normalized Record Model

Create a normalized model before writing to HealthKit. Keep this separate from UI metric models.

```ts
type CanonicalHealthRecord = {
  id: string;                 // stable internal ID, derived from Google DataPoint.name
  type: HealthRecordType;      // weight, workout, sleep, heartRate, activeEnergy, distance
  source: 'google-health';
  sourceId: string;            // Google DataPoint.name
  sourceDataType: string;      // Google kebab-case data type
  startTime?: string;
  endTime?: string;
  sampleTime?: string;
  timezone?: string;
  value?: number;
  unit?: string;
  payloadHash: string;         // stable hash of normalized meaningful fields
  raw: unknown;
};
```

Keep the normalized model strict. Unit conversion and activity mapping should happen before records reach the HealthKit writer.

## Sync Ledger

A durable ledger is required. Without it, repeated syncs will duplicate Apple Health entries or make deletion handling impossible.

Current MVP storage: `expo-secure-store` ledger entries keyed by a deterministic hash of the Google source ID. Each entry stores the source payload hash, HealthKit sync version, and last sync timestamp. This is sufficient for the current manual export because it stores no raw health payloads and prevents unchanged records from being rewritten.

Recommended future storage before broad data-type support or two-way sync: SQLite through `expo-sqlite` or native SQLite/Core Data behind the HealthKit module. Do not keep expanding SecureStore into a large health-record index.

Minimum future table:

| Column | Purpose |
| --- | --- |
| `id` | Internal ledger row ID. |
| `direction` | `google_to_apple`. |
| `record_type` | Normalized record type. |
| `google_data_point_name` | Source Google record identifier. |
| `google_payload_hash` | Detects source changes. |
| `healthkit_sync_identifier` | Stable HealthKit sync identifier. |
| `healthkit_sync_version` | Monotonic version written to HealthKit. |
| `healthkit_uuid` | Saved HealthKit UUID when available. |
| `first_synced_at` | First successful write. |
| `last_synced_at` | Last successful write/update. |
| `last_seen_at` | Last time the Google record was seen. |
| `status` | `synced`, `stale`, `failed`, `deleted`. |
| `last_error` | Last write or mapping error. |

HealthKit sync identifiers should be deterministic:

```text
fitty.google-health.<data-type>.<stable-google-id>
```

If a Google record changes, keep the same HealthKit sync identifier and increment `HKMetadataKeySyncVersion`. HealthKit uses that metadata to avoid duplicate samples and apply newer versions.

## One-Way Sync Algorithm

### Initial Sync

1. User connects Google, using existing OAuth flow.
2. User connects Apple Health and grants write access for selected data types.
3. User enables Google -> Apple sync.
4. App selects an import window. Start with the last 30 or 90 days.
5. For each enabled data type:
   - Fetch Google raw data points with pagination.
   - Normalize records.
   - Validate required fields and units.
   - Look up each record in the ledger.
   - If unseen, write to HealthKit with sync identifier version `1`.
   - If seen and payload hash is unchanged, skip.
   - If seen and payload hash changed, increment sync version and save the replacement sample/workout.
   - Update ledger status.
6. Show a sync summary.

### Incremental Sync

Run on:

- App foreground.
- Manual "Sync now."
- Opportunistic iOS background refresh, if available.
- Future server webhook notification that marks a Google data type/window as dirty.

Flow:

1. Determine the last successful sync window per data type.
2. Re-read a small overlap window, for example the previous 24 to 72 hours, to catch delayed source updates.
3. Process records through the same ledger algorithm.
4. Mark records not seen in a full rescan as `stale`, but do not delete them by default.

### Deletions

Google Health API reads may not give enough client-side deletion context for every product case. Default behavior for phase 1:

1. Do not automatically delete Apple Health samples just because a Google record is missing from a partial sync.
2. During a full user-requested rescan, mark previously mirrored records as `stale` if they are no longer present.
3. Add a separate "Remove OpenFit mirrored Apple Health data" action that deletes only records with Fitty sync identifiers.
4. Add automatic deletion later only if the UX clearly reflects user intent.

## Data Mapping Notes

### Weight

- Google `weight` sample -> `HKQuantitySample` body mass.
- Convert grams/kilograms as needed.
- Use sample time as HealthKit start and end.
- Good first implementation target.

### Exercise

- Google `exercise` session -> `HKWorkout`.
- Map Google exercise types to `HKWorkoutActivityType`.
- Preserve start/end time and active duration.
- Add distance/energy samples only when they are present and confidently tied to the workout.
- Avoid route/GPS sync in phase 1 unless location consent and mapping are explicitly implemented.

### Sleep

- Google `sleep` session -> HealthKit sleep analysis category samples.
- Preserve start/end.
- If detailed stages are unavailable or ambiguous, write conservative asleep/in-bed samples rather than invented stages.
- Treat naps as sleep sessions only when Google marks them or the existing app heuristic classifies them confidently.

### Steps

Do not include steps in the first write release. Steps are easy to double count because both ecosystems reconcile data from phones, watches, and third-party apps.

When steps are added later:

- Prefer raw non-overlapping intervals, not daily rollups.
- Use source metadata and deterministic sync identifiers.
- Never write a daily rollup if the same device data may already exist in Apple Health through another app.
- Add a warning in the UI that mirrored steps can affect Apple Health totals.

## UI Requirements

Current UI:

- Dashboard Apple Health section on iOS.
- Manual "Export" action.
- Current export state and latest result.
- Fixed import window based on the selected dashboard range.

Future settings UI:

- Apple Health connection status.
- Google -> Apple sync toggle.
- Per-type toggles.
- Import window: 7, 30, 90 days.
- Last sync time.
- Last sync result.
- "Sync now" button.
- "Remove OpenFit mirrored Apple Health data" button, behind confirmation.

Keep the permission copy concrete. Tell the user exactly which data types will be written to Apple Health and that Fitty will not write anything to Google in this phase.

## Privacy and Policy Requirements

1. Update privacy policy before release to describe:
   - Google Health data read from the user's Google account.
   - Apple Health data written to the user's device.
   - Local sync ledger storage.
   - User controls for disabling sync and removing mirrored records.
2. Keep OAuth scopes minimal. Phase 1 only needs Google read scopes.
3. Request HealthKit write/share permission only for enabled data types.
4. If requesting HealthKit read permission, explain that it is used to verify mirrored records and prevent duplicates.

## Implementation Sequence

Completed:

1. Confirmed one-way-only product scope and initial data types.
2. Added a custom Expo HealthKit module.
3. Added iOS HealthKit entitlement and usage strings.
4. Added a minimal durable ledger for the manual export.
5. Added normalized Google Health records for `weight`, `exercise`, and `sleep`.
6. Added Google raw data readers with pagination.
7. Added HealthKit writer methods for those same types.
8. Implemented `syncGoogleHealthToAppleHealth`.
9. Added an iOS-only manual export UI.

Remaining before release:

1. Test on a real iPhone with real Google Health records and Apple Health permissions.
2. Add per-type toggles and an explicit sync settings screen.
3. Add foreground incremental sync.
4. Add deletion/removal UX for Fitty-owned mirrored samples.
5. Migrate the ledger to SQLite/Core Data before adding high-volume streams or two-way sync.
6. Add focused mapping/idempotency tests.

## Validation Checklist

- Running the same sync twice does not duplicate Apple Health records.
- Updating a Google source record increments HealthKit sync version and updates the Apple Health sample.
- Permission denial leaves sync disabled and does not crash.
- Each data type can be enabled or disabled independently.
- Time zones are preserved or converted consistently.
- Units are converted exactly once.
- Large result sets paginate correctly.
- App restart preserves ledger state.
- Removing mirrored data only deletes Fitty-owned HealthKit samples.
- Expo Go is not used for validation.

## Later: Two-Way Sync Plan

Two-way sync should be a second phase after one-way idempotency is proven.

The target architecture becomes:

```text
Google Health API <-> Fitty sync ledger <-> Apple HealthKit
```

### Additional Requirements

1. Add Google write scopes only for selected data types:
   - `googlehealth.activity_and_fitness.writeonly`
   - `googlehealth.sleep.writeonly`
   - `googlehealth.health_metrics_and_measurements.writeonly`
   - others only when a feature requires them.
2. Add HealthKit read support with anchored queries:
   - `HKAnchoredObjectQuery` for inserted/deleted samples.
   - Store anchors per HealthKit sample type.
3. Add Google create/patch/delete support for app-owned Google Health data points.
4. Extend the ledger with ownership and source fields:
   - `origin_platform`: `google` or `apple`.
   - `google_owned_by_fitty`: boolean.
   - `healthkit_owned_by_fitty`: boolean.
   - `last_source_update_at`.
   - `conflict_state`.

### Loop Prevention

Two-way sync must skip records written by Fitty itself:

- When reading HealthKit, ignore samples with Fitty `HKMetadataKeySyncIdentifier`.
- When reading Google, ignore data points whose source/application identifies Fitty as the writer.
- Keep deterministic IDs on both sides.

### Conflict Rules

Start conservative:

1. Fitty can update records it originally wrote.
2. Fitty must not mutate records owned by Apple, Google, Fitbit, or another app.
3. If both sides change a mirrored record, keep both records and mark a conflict for user review unless there is a clear app-owned record.
4. Deletions only apply to app-owned mirrored records.

### Two-Way Rollout Order

1. Apple -> Fitty local import only, no Google writes.
2. Apple -> Google for one simple type, probably `weight`.
3. Add Google write ledger IDs and patch handling.
4. Add deletion handling for Fitty-owned Google records.
5. Add workouts and sleep.
6. Consider steps last, if at all.

## Official References

- Google Health API overview: https://developers.google.com/health
- Google Health API scopes: https://developers.google.com/health/scopes
- Google Health data point list: https://developers.google.com/health/reference/rest/v4/users.dataTypes.dataPoints/list
- Google Health data point create: https://developers.google.com/health/reference/rest/v4/users.dataTypes.dataPoints/create
- Google Health webhooks: https://developers.google.com/health/webhooks
- Apple HealthKit authorization: https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data
- Apple `HKHealthStore`: https://developer.apple.com/documentation/healthkit/hkhealthstore
- Apple `HKMetadataKeySyncIdentifier`: https://developer.apple.com/documentation/healthkit/hkmetadatakeysyncidentifier
- Apple `HKMetadataKeySyncVersion`: https://developer.apple.com/documentation/healthkit/hkmetadatakeysyncversion
- Apple HealthKit sync guidance: https://developer.apple.com/videos/play/wwdc2020/10184/
- Expo SDK 56 docs: https://docs.expo.dev/versions/v56.0.0/
- Expo development builds: https://docs.expo.dev/develop/development-builds/introduction/
- Expo Modules API: https://docs.expo.dev/modules/get-started/
- Expo native module tutorial: https://docs.expo.dev/modules/native-module-tutorial/
- Expo config plugins: https://docs.expo.dev/config-plugins/introduction/
