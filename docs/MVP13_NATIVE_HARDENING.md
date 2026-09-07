# MVP-13 Native Android / Offline / APK Hardening

Release acceptance: **BLOCKED — USER AUTH REQUIRED** and **BLOCKED — PHYSICAL DEVICE REQUIRED**. APK build and all physical Android cases are **NOT RUN**. Configuration/host/export evidence is recorded separately below and in [native results](MVP13_NATIVE_ANDROID_RESULTS.md).

## Baseline and scope

Verified before edits: branch `feature/mvp13-native-hardening`; HEAD `6b1c0f5` (`feat: expand cognitive activities with adaptive Pattern and Routine games`); stable tag `smaran-cognitive-expansion-stable`; clean working tree; blank diff stat/name-status. Current local tree was used directly. No commit, merge, tag, push, publish, submission, account creation, data reset or generated native project.

Created:

- `eas.json`
- `scripts/check-native-hardening.cjs`
- `docs/MVP13_NATIVE_HARDENING.md`
- `docs/MVP13_NATIVE_ANDROID_TEST_PLAN.md`
- `docs/MVP13_NATIVE_ANDROID_RESULTS.md`

Modified:

- `app.json`: explicit Android versionCode 1, Android SQLite default foreign keys, blocked unnecessary inherited permissions.
- `.gitignore`: local release artifacts, APK/AAB and signing credential files.
- `src/services/my-day.service.ts`: existing channel display name becomes `Smaran reminders`; same ID/importance/scheduling semantics.
- `components/error-boundary.tsx`: raw error/stack logging is development-only, consistent with other handlers.

Zero changes to `package.json` or `package-lock.json`. Expo, React Native and React remain unchanged. No cloud/analytics SDK, npm force audit, new dependencies, new game content, algorithm changes, translations, database schema changes or media transaction changes. All six migrations and their runner are preserved byte-for-byte modulo checkout line endings.

## Configuration and compatibility

| Property | Baseline | Final |
| --- | --- | --- |
| Expo dependency / public SDK | ~54.0.36 (installed/locked 54.0.37) / 54.0.0 | Unchanged |
| React Native / React | 0.81.5 / 19.1.0 | Unchanged |
| Installed display name / slug | Smaran AI / smaran-ai | Unchanged |
| Android package / iOS bundle identifier | com.smaran.ai | Unchanged stable identity |
| App version | 1.0.0 | 1.0.0 |
| Android versionCode | Not explicitly configured | 1 |
| New Architecture | true | true |
| Orientation | portrait | portrait |
| iOS tablet support | true | true |
| Android edge-to-edge / predictive back | true / false | Unchanged |
| Router / TypeScript | expo-router/entry; typed routes; strict TS | Unchanged |
| Plugins | Router, splash-screen, SQLite, SecureStore, Notifications, ImagePicker | Same packages; SQLite Android build flag added |
| EAS project / account owner | No projectId or owner configured | Still unlinked; no guessed owner |
| Updates | No expo-updates dependency, URL or remote update config | Unchanged; introspection emits ENABLED=false and launch wait 0 |

`npx.cmd expo-doctor`: **PASS**, 18/18 checks. `npx.cmd expo install --check`: **PASS**, dependencies are up to date after retry with approved network access. Initial restricted-network failures and the PowerShell shim limitation are documented in the results file. Installed native package versions match the lockfile and bundled SDK 54 compatibility map; no incompatibility was proven or package adjustment made. SDK 54 docs were read before editing.

Installed native versions: Expo SQLite 16.0.10, SecureStore 15.0.8, Notifications 0.32.17, FileSystem 19.0.24, ImagePicker 17.0.11, Speech 14.0.8, Haptics 15.0.8, Router 6.0.24, SplashScreen 31.0.13.

Managed workflow remains intact. `expo config --type introspect` evaluates plugins without prebuild/native folders. Android properties emit `expo.sqlite.customBuildFlags=-DSQLITE_DEFAULT_FOREIGN_KEYS=1`. No updates-related change was necessary: native introspection has updates disabled; the nominal CHECK_ON_LAUNCH=ALWAYS field has no effect while ENABLED=false. Standalone release builds are configured to use bundled JavaScript/assets; cold launch without Metro/internet still needs physical verification.

Existing icon, Android adaptive foreground/background/monochrome, splash and favicon PNGs exist. The icon is visibly the generic Expo template. Final branding remains a separate polish item; no artwork was generated or redesigned. Expo Doctor/config/export do not prove the installed splash/icon appearance.

## EAS and APK checkpoint

`eas.json` uses local version metadata, no automatic increments or custom build hooks:

- `preview`: internal distribution, `android.buildType=apk`, normal release build (no development client).
- `production`: `android.buildType=app-bundle`, suitable for a future AAB workflow; no store submission initiated.

EAS CLI 23.2.0 is usable through npx's CLI cache, outside application dependencies. `npx.cmd eas-cli whoami` returned `Not logged in`. Project-link status: unlinked. Authentication/ownership/signing status: **BLOCKED — USER AUTH REQUIRED**. **READY FOR EAS AUTH**.

Exact next command: `npx.cmd eas-cli login`. Then the user runs `npx.cmd eas-cli init` and chooses/confirms the correct owner and project, verifies with `npx.cmd eas-cli project:info`, and runs `npx.cmd eas-cli build --platform android --profile preview`. Stop for any ownership/signing decision rather than guessing. No build was initiated; build ID, signed APK, artifact download and installed version are **NOT RUN**.

The APK should not require npm start, Metro, Expo Go, USB debugging or the same Wi-Fi for ordinary use. EAS build/download itself requires network and account authorization. Binaries/credentials belong in ignored `release-artifacts/` or another private location, never Git. The production app has no API-key/environment-secret requirement; EAS signing credentials are a separate build-account boundary.

## SQLite and migrations

Native `src/db/client.ts` opens `smaran_offline.db` through `expo-sqlite`, shares initialization, enables WAL and foreign keys, verifies the shared connection pragma and retries rejected initialization. Metro resolves the separate `.web.ts` fallback only for web; Android has no browser/IndexedDB bridge requirement. SQLite remains source of truth; no AsyncStorage substitution.

**Proven configuration gap:** SDK 54 `SQLiteDatabase.withExclusiveTransactionAsync` creates a new handle with `useNewConnection:true`, starts BEGIN and then calls application code. The shared handle's `PRAGMA foreign_keys=ON` does not carry over. Installed Android SQLite init does not set it, and default compile flags do not enable it. A host reproduction using a fresh FK-off transaction accepted a memory for a nonexistent patient and yielded one `foreign_key_check` violation. Cognitive save already has an explicit patient check; My Day and My Memories also rely on FK constraints. Every transaction caller was inspected.

**Small shared fix:** configure SQLite's documented `SQLITE_DEFAULT_FOREIGN_KEYS=1` at Android build time via the existing Expo SQLite plugin. Every new native handle starts with FK enforcement. Do not attempt to toggle the pragma inside BEGIN (SQLite ignores that change). No wrapper/repository rewrite or migration edit. This applies to a newly built Android standalone binary, not Expo Go or a previously compiled APK. iOS build flags are unchanged because this milestone targets Android.

The new host regression models separate connections, exercises the actual runner twice, verifies an empty fresh six-migration chain, reproduces the old orphan behavior on an isolated synthetic fixture, verifies that FK-on connections reject orphan memory/reminder writes, and verifies valid memory persistence after reopening. Config introspection checks the build flag actually reaches Gradle. This is **host/config evidence**, not proof of compiled Android SQLite behavior; the physical plan calls for the native shared and transaction pragmas and FK check.

Migration 001 creates profiles/settings; 002 creates Memory Match sessions/model; 003 expands language settings; 004 adds reminders/events with append-only rules; 005 adds personal memories; 006 expands cognitive game types and per-game models. The runner uses exclusive transactions and an applied-version ledger, checks ascending unique versions, rechecks each version in the transaction and records it only after success.

Migration 006 is unchanged. Create/copy/drop/rename operates on child tables with no incoming FK references from migrations 001–005. It preserves every old Memory Match column; adds `memory_match` to historical model rows; recreates both cognitive indexes; uses `(patient_id, game_type)` PK; checks `PRAGMA foreign_key_check` before the runner commits. Existing regression verifies populated upgrade, exact historical values, rollback after injected rebuild/ledger failure, idempotence, indexes, constraints and separate patient/game models. No proven native rebuild incompatibility requires editing 006. Native execution remains **NOT RUN**.

## SecureStore and startup

SecureStore holds active profile ID and onboarding-completed flag; the declared authToken key has no production caller or cloud credential use. Missing values resolve to fresh onboarding; completion without ID or a missing/invalid referenced profile/settings resolves as inconsistent, clears only active flags, and shows onboarding. A valid stored profile can repair its missing completion flag. No fake profile or database row is synthesized. Native unavailable/read/write failures propagate to existing calm retry handling where applicable; availability probing returns false/null as already implemented.

Database bootstrap displays loading text and transitions to translated retry UI on rejection. Launch/profile resolution also has retry UI, and the root ErrorBoundary offers a safe return. Raw SQLite errors are not rendered to patients. No new timeout was added around native operations: actual unresolved native hangs are not simulated by host checks and remain part of cold-start QA. Restart/fresh-install/Keystore survival remains **NOT RUN** on Android.

## My Day native boundary

Existing Notifications plugin retained. Handler is registered on native platforms, permits foreground banner/list and default sound, does not set badges. Android channel `my-day` is created before reading/requesting permission; its name is now `Smaran reminders`, with DEFAULT importance. No harsh custom vibration or new exact-alarm permission. Existing channel/user settings stay under Android control.

Permission requests are initiated only by My Day's explicit Allow action while permission is undetermined. Startup, foreground/focus sync and Retry read permission without prompting; denied permission leaves local reminder CRUD/Done usable. Permission or native scheduling failures return a result consumed by the existing calm notice/retry UI. No push token is requested.

Daily triggers use local hour/minute; one-time triggers use a local date; both specify the same channel. Deterministic notification IDs plus SQLite revision/ID acknowledgements support cancellation, replacement and recovery after scheduling/acknowledgement interruption. A serialized queue prevents competing local writes/schedules. Cold-start and timezone/offset changes rebuild daily requests; PatientLayout syncs on mount/app foreground. Cancellation failures are reported and can retry. Notification taps rely on normal app open/resume; there is no claim of a reminder-specific deep link.

**Accepted limitation unchanged:** a repeating daily reminder marked Done early may still notify later the same day. One-time completed/past reminders are filtered on reconciliation. Next-day repeating behavior remains protected by the existing regression. SDK 54's installed Android scheduling delegate uses inexact `setAndAllowWhileIdle` when exact-alarm access is unavailable. Delivery can be delayed by Doze/OEM policy; no exact minute or medically reliable alarm promise. Force-stop suppresses alarms until the user reopens; use backgrounding for delivery tests. RECEIVE_BOOT_COMPLETED and the library boot receiver support rescheduling attempts, but reboot behavior remains unobserved.

Android 13+ permission, daily/once delivery, background/lock/tap/revoke/reboot behavior: **NOT RUN** physically.

## Memories: picker and filesystem

SDK 54 ImagePicker already uses `launchImageLibraryAsync` with images only, one selection, editing disabled, quality 0.8, no EXIF/base64. Modern system picker grants access only to the chosen image; no broad permission request. Cancel returns calmly; denied/error/invalid asset/missing URI/cache source yields an existing fallback notice. Picker output is validated as a nonempty supported image in app cache, at most 20 MiB. Android activity destruction while the picker is open can lose an unsaved selection; no pending-result recovery/product feature was added. Saved memories remain durable.

FileSystem uses SDK 54's `Directory`, `File`, `Paths` API. Durable relative path is `memories/<patientId>/<32-hex-id>.<extension>` under `Paths.document`; database stores the relative path, runtime resolves the absolute sandbox URI. Patient directory validation, strict extension/filename pattern, traversal rejection and containment checks remain. Directories are created idempotently with intermediates; copy checks size/existence; partial-copy failures clean only the staged file.

Existing service ordering is preserved: copy new → commit DB → cleanup old. Failed DB save rolls back staged media; old photo remains. Remove photo/memory commits before deletion; cleanup failures are reported. Missing/empty/corrupt files use the existing image fallback. No temporary picker URI becomes long-term database state. Host real-file and SQLite regressions pass; actual Android pick/add/restart/replace/restart/remove/restart tests remain **NOT RUN**.

## Speech, haptics, activities and accessibility

Speech is explicit through Read screen. It stops old speech, queries available voices, prefers a matching regional locale then matching language family, and returns unavailable rather than pretending an unsupported voice exists. Navigation, text/language changes and Stop cancel pending/active requests. Errors are caught; seven UI translations remain available independently. Android TTS engines can expose voices that still need downloads/network; offline voice support is device-specific and not promised. No cloud TTS/translation added.

Haptics use optional `selectionAsync` with caught errors; all interactions have visual/text feedback. No error vibration added. Three cognitive activities preserve navigation, tap choices, hints, result/Why/feedback, SQLite session persistence and per-game model keys. Algorithms/content are unchanged; host regression covers those contracts. Native layout, glyphs, buttons, back navigation and force-close adaptive persistence remain **NOT RUN**.

Code audit: shared touch minimum 56 dp, buttons 60/72 dp, visible labels/accessibility roles, decorative icons hidden, translated labels, high-contrast preference, extra-large text multiplier, scrollable bounded content and reduced-motion preferences. Games use taps, not drag-only actions. Phone/tablet insets, large system font, native contrast perception and TalkBack require physical observation. No meaningful UI layout was changed; browser success would not establish Android accessibility. TalkBack: **NOT RUN**.

## Offline assets, care, network and permissions

My Home uses 32 static local image requires across all eight NER states. Existing tests protect stored-region mapping and reject invalid regions without an Assam fallback. No runtime remote image URLs in games. My Care reads local cognitive, routine, memory and upcoming reminder records; focus refresh remains SELECT/read-only, with no remote caregiver or cloud account semantics.

Production source scan covers `src`, `app`, `components`, `hooks`, `constants`: no fetch/axios/cloud/GraphQL/runtime remote translation or environment-key dependency. Reviewed URL matches: 32 My Home source-credit URLs, image-credit/license metadata, and documentation comments in the theme hook/icon component. They are attribution/reference data, not runtime requests. The Bhashini file is a disabled capability stub returning `available:false`, with no network code. Expo Notifications contains transitive native Firebase messaging infrastructure; the app does not register push tokens, configure Firebase or depend on a Firebase backend for local notifications.

All console warn/error callers are development-gated after the ErrorBoundary fix; no production log/debug statements or patient rows/names/reminder/photo content are logged by application source. No analytics/crash SDK added. The hardening script checks guarded logging and rejects new unreviewed network patterns; this is a source scan, not a packet capture of Android/system services.

Blocked permissions: CAMERA, RECORD_AUDIO, READ_EXTERNAL_STORAGE, WRITE_EXTERNAL_STORAGE, USE_BIOMETRIC, USE_FINGERPRINT, SYSTEM_ALERT_WINDOW. ImagePicker/FileSystem inherit legacy storage declarations; picking one image and app-private copying do not need them. SecureStore is used without biometric authentication; the overlay permission appears in Expo's generated template and is unnecessary for a release APK. Installed manifest/plugin inspection and introspection confirm removal directives.

Expected retained library/platform permissions include INTERNET (Expo/FileSystem runtime, not proof core needs network), VIBRATE (gentle haptics), POST_NOTIFICATIONS (runtime permission), RECEIVE_BOOT_COMPLETED (local schedule restoration); notification/AndroidX transitive libraries may add normal permissions such as WAKE_LOCK. No contacts/location/media-library-wide/exact-alarm feature is configured. Final merged APK permission inventory remains **NOT RUN** until a signed artifact is built and inspected; introspection is not a Gradle manifest merge.

## Validation and remaining acceptance

Existing automated scripts: cognitive expansion, My Care, My Home, My Memories, My Day, elderly UX — **PASS**. TypeScript and Expo lint — **PASS**. Expo config, Doctor and SDK compatibility — **PASS**. All-platform export — **PASS**; Android Hermes bundle `entry-ed63b7c36c476db74b577417c70e02b9.hbc` (~4.85 MB), iOS bundle and 24 static web routes produced in ignored `dist/`. Non-failing export warnings: color environment mismatch and unsupported web push-token listener.

Native hardening script and asset-byte verification: **PASS**, `node scripts/check-native-hardening.cjs --export`. It checks config/plugin output, package/migration preservation, production routes, offline sources, native boundary host regressions, managed photos and results-document evidence format. `--export` additionally requires an Android bundle and byte-for-byte presence of all 32 My Home images in Android metadata. It does not physically test Android or authenticate tester evidence.

Java Temurin 17.0.20 and Node 24.19.0 are available. adb/Gradle not found on PATH, standard Android SDK and Android Studio locations absent, ANDROID_HOME/ANDROID_SDK_ROOT/JAVA_HOME unset. Device enumeration/install are **NOT RUN**; a physically attached phone cannot be ruled out without ADB. No Android Studio installation, global config edit, device data deletion, phone setting change or reboot occurred.

Remaining actions: authenticate/link EAS under the user's chosen account; resolve signing decisions; build preview APK; inspect artifact permissions/SQLite build flag; install on an authorized Android device; execute [the native test plan](MVP13_NATIVE_ANDROID_TEST_PLAN.md), including exact airplane-mode sequence, persistence, notification/photo checks, all games/regions/languages and TalkBack. Only the user enables airplane mode/reboots. Preserve data; stop on signing/package conflict. Record outcomes in [native results](MVP13_NATIVE_ANDROID_RESULTS.md).

Medical wording remains unchanged: Smaran shows activity recorded in this app. These records are not a medical assessment. Smaran does not diagnose or assess dementia. No diagnosis, severity/stage, progression/decline, risk score, treatment or verified medication-adherence claim was introduced.

## Final Git scope

Final branch/HEAD remain feature/mvp13-native-hardening / 6b1c0f5. No commit, merge or tag performed. Package files and migrations 001?006 have blank diffs; git diff --check passes. The temporary introspection JSON was removed; ignored dist/ holds the requested export. No APK, native folder or temporary QA source remains.

Git status --short:

```text
 M .gitignore
 M app.json
 M components/error-boundary.tsx
 M src/services/my-day.service.ts
?? docs/MVP13_NATIVE_ANDROID_RESULTS.md
?? docs/MVP13_NATIVE_ANDROID_TEST_PLAN.md
?? docs/MVP13_NATIVE_HARDENING.md
?? eas.json
?? scripts/check-native-hardening.cjs
```

Git diff --stat (tracked files only; five new files are separately listed above):

```text
 .gitignore                     |  7 +++++++
 app.json                       | 19 ++++++++++++++++++-
 components/error-boundary.tsx  |  2 +-
 src/services/my-day.service.ts |  2 +-
 4 files changed, 27 insertions(+), 3 deletions(-)
```

Git diff --name-status:

```text
M .gitignore
M app.json
M components/error-boundary.tsx
M src/services/my-day.service.ts
```

Git ls-files --others --exclude-standard contains exactly the five created files listed above. Git emits the existing Windows LF-to-CRLF checkout notice; no whitespace error. All nine changed/new files were reviewed.

## References checked

- [Expo SDK 54](https://docs.expo.dev/versions/v54.0.0/)
- [SDK 54 SQLite](https://docs.expo.dev/versions/v54.0.0/sdk/sqlite/) and installed `expo-sqlite/src/SQLiteDatabase.ts`, Android init/build flags and config plugin.
- [SQLite default foreign-key compile option](https://www.sqlite.org/compile.html#default_foreign_keys)
- [SDK 54 app configuration](https://docs.expo.dev/versions/v54.0.0/config/app/)
- [SDK 54 ImagePicker](https://docs.expo.dev/versions/v54.0.0/sdk/imagepicker/) and [FileSystem](https://docs.expo.dev/versions/v54.0.0/sdk/filesystem/)
- [SDK 54 Updates](https://docs.expo.dev/versions/v54.0.0/sdk/updates/) and [Speech](https://docs.expo.dev/versions/v54.0.0/sdk/speech/)
- [Expo APK build profiles](https://docs.expo.dev/build-reference/apk/)
- Context7 SDK 54 notifications docs and installed `ExpoSchedulingDelegate.kt` (inexact fallback verified in installed 0.32.17 source, not inferred from a newer SDK).
