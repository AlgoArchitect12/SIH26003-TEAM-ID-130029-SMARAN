# MVP18A privacy and recovery hardening

Original implementation date: 2026-09-09; localization follow-up: 2026-09-10. Worktree: **SMARAN-A** only. Branch: `feature/mvp18a-privacy-recovery`. Baseline: `d835e03` (`docs: map SIH26003 requirement depth and roadmap`). The original implementation reported a clean starting worktree; the follow-up started with the existing uncommitted MVP-18A work and preserved it. No other worktree, live patient database or credentials were accessed.

Read before implementation: [MVP17 requirement-depth plan](MVP17_REQUIREMENT_DEPTH_PLAN.md), [SIH26003 requirement matrix](SIH26003_REQUIREMENT_MATRIX.md), README, repository instructions, and the relevant MVP13/MVP16 hardening evidence. Source and installed Expo SDK 54 packages were checked against [the versioned Expo reference](https://docs.expo.dev/versions/v54.0.0/). Historical device reports are not new test results.

## IMPLEMENTED

### Storage inventory and privacy findings

The classifications below describe actual current storage, not a proposed move of data. Reads temporarily bring these values into application memory and visible/read-aloud screens.

| Audited data or boundary | Classification | Actual location and protection boundary |
| --- | --- | --- |
| Patient preferred name, legacy age bracket, optional emergency name/phone | Local database | `patient_profiles` in `smaran_offline.db`; private app storage, parameterized SQL. No application-level database encryption configured. |
| Language, region, text size, voice guidance, reduced motion, legacy high contrast | Local database; transient memory | `patient_settings`, then Zustand for UI use. Existing settings fields/semantics retained. |
| Active patient and onboarding completion | SecureStore; transient memory | `smaran.active-profile-id`, `smaran.onboarding-completed`; routing state, not identity credentials. A missing flag is no longer enough to assume an empty database. |
| Patient DOB | SecureStore; transient memory | `smaran.dob.{patientId}`, validated ISO date. Age is calculated for display. No DOB added to SQLite, notifications or cognitive adaptation. |
| Appearance mode | SecureStore; transient memory | `smaran.appearance`, mirrored to Zustand only after successful read/save. Invalid non-null values now fail visibly instead of becoming a default. |
| Personal memory names, relationships, descriptions, relative photo paths | Local database | `personal_memories`, scoped to patient. Text is user supplied and sensitive. |
| Personal photos | Managed file | `Paths.document/memories/{patientId}/{randomFileId}.{extension}`. App-private copies, no app-level encryption. Original gallery photo is outside Smaran's control. |
| Picker/partial-copy files | Managed file (temporary) | Picker source is validated inside `Paths.cache`; copy target is checked and a partial target is cleaned up on handled failure. Picker cache may persist until OS cleanup/uninstall; neither immediate removal nor secure erasure is guaranteed. |
| Reminders, title, free-text note, type, time, recurrence, enable/delete/revision state | Local database | `reminders`; SQLite remains the truth. Full text is visible only in the app's current UI/read-aloud flows, not in newly requested OS notifications. |
| Reminder completion facts | Local database | Append-only `reminder_events`; a Done tap is a record in Smaran, not verified ingestion or attendance. |
| Cognitive session facts and adaptive model | Local database; transient memory | `cognitive_sessions`, `adaptive_model_state`; in-progress/pending session state is transient Zustand state. No clinical classification or cloud analytics added. |
| My Care | Transient memory over local database | Read-only summary queries for the active local patient; same unlocked device, no separate caregiver login, verified identity or authorization grant. Existing links can enter patient flows. |
| Scheduled/delivered notifications | OS notification | Generic requested title/body plus opaque reminder ID. Expo also persists scheduled requests/triggers in Android shared preferences; these are outside SQLite and SecureStore. |
| Read-aloud text | Transient memory; OS speech service | Screen text is passed to the chosen installed TTS engine. Smaran has no speech upload client. The chosen OS engine's offline/network behavior is not certified here. |
| Record IDs | Local database, managed paths, SecureStore keys, OS notification metadata | Existing random UUID/hex IDs and integer completion IDs are unchanged. Patient scoping and validation are not authentication; an ID is not a password. |
| `authToken` key | Configuration-only | Declared, unused key name. No token issuance, authentication or remote account exists. |
| Package/scheme/EAS project identity and backup/permission policy | Configuration-only | App configuration; no new runtime identifiers, permissions or dependencies. EAS project metadata is not a patient identity. |
| Logs/debug output | Transient memory / development console | All application console calls remain `__DEV__` gated. Raw exception objects and component stacks were removed; fixed operational messages remain. No application production telemetry exporter was found. Native library/OS diagnostics are not certified by a JavaScript scan. |

Android path evidence comes from the installed packages: `expo-sqlite/android/.../SQLiteModule.kt` sets the default directory to `context.filesDir/SQLite`; thus this database and its `-wal`/`-shm` companions belong to the Android **file** domain, not just the usual **database** domain. `expo-file-system`'s `FileSystemModule.kt` and `legacy/AppDirectoriesModule.kt` map documents to `context.filesDir` and cache to `context.cacheDir`.

### Notification hardening

`src/services/my-day.service.ts` requests generic localized copy through the existing `t()` function and typed My Day catalog. The English fallback is:

```text
Smaran reminder
Open Smaran to see your reminder.
```

The notification title/body use saved `patient_settings.language` for the patient ID supplied to reconciliation, independently of transient UI/onboarding language. Both keys (`dayNotificationTitle`, `dayNotificationBody`) are present in en, hi, as, bn, mni, kha and lus; Meitei follows the existing My Day catalog's Latin transliteration. The Android channel label remains unchanged. Missing settings/language, an unsupported language, or a rejected settings read use the existing i18n English fallback. A language read failure does not mark otherwise successful scheduling as failed, undo the SQLite save or borrow another patient's settings. Title, medication/category, appointment note and free text are absent from new notification content. The existing opaque `reminderId` remains in data for record correlation; it conveys no name or clinical detail and is not an access credential.

The same My Day queue, deterministic identifiers, daily/date triggers, cancellation, revisions and SQLite acknowledgement are retained. The daily fast path checks actual pending title/body against the current localized copy, so matching revisions cannot preserve an old sensitive payload or outdated language on the next reconciliation. Cold start already rebuilds daily alarms; one-time schedules are reconciled as before. Language changes take effect when My Day next reconciles, including app foreground and My Day focus.

On reconciliation, already-presented My Day notifications with older non-generic wording are dismissed. Unrelated notifications and generic messages matching any of the seven catalogs are retained. Dismissal failure produces the existing My Day failure/Retry state independently of scheduling; it does not undo committed reminders or prevent that reconciliation's scheduling work. Permission-denied fallback still leaves SQLite reminders usable.

This is application content minimization, not an authenticated notification detail view. OS notification listeners, history, watches or previously copied text cannot be recalled. An older installed version or an upgrade that has not successfully reconciled may still have old scheduled/presented content. Physical upgrade and lock-screen tests remain required. APIs were checked against [Expo SDK 54 Notifications](https://docs.expo.dev/versions/v54.0.0/sdk/notifications/) and the installed 0.32.17 source/types.

### Android backup and restore findings

Baseline Expo introspection produced:

```xml
android:allowBackup="true"
android:fullBackupContent="@xml/secure_store_backup_rules"
android:dataExtractionRules="@xml/secure_store_data_extraction_rules"
```

The installed SecureStore 15.0.8 XML includes only `sharedpref/.` and excludes `sharedpref/SecureStore`, for legacy backup and both modern cloud/device-transfer sections. Under Android's include semantics, other domains are omitted. SQLite/app files/photos were therefore already outside this generated allowlist; SecureStore alone was not evidence of that fact. Other preferences were still included. In particular, `SharedPreferencesNotificationsStore.kt` serializes the entire scheduled notification request into `expo.modules.notifications.SharedPreferencesNotificationsStore`, including the old user text. This was a real backup/transfer exposure beyond SecureStore.

Android documents that an include list replaces default inclusion, and that `allowBackup=false` alone may still allow device transfer on some Android 12+ manufacturers. The new policy therefore supplies explicit extraction exclusions as well as disabling backup. [Android Auto Backup](https://developer.android.com/identity/data/autobackup).

The small [local config plugin](../../plugins/with-private-backup.cjs) uses the installed `expo/config-plugins` Android manifest and file mods. It writes one deterministic XML resource during native generation. No native module, string patch of generated Kotlin/Gradle, dependency or migration was added. SecureStore's own backup setup is disabled because this plugin takes ownership and excludes **all shared preferences**, including SecureStore and notification payloads, as required when using a custom policy. [Expo SDK 54 SecureStore backup configuration](https://docs.expo.dev/versions/v54.0.0/sdk/securestore/).

Current Expo introspection verifies:

```xml
android:allowBackup="false"
android:fullBackupContent="false"
android:dataExtractionRules="@xml/smaran_data_extraction_rules"
```

The generated resource excludes `.` in each of `root`, `file`, `database`, `sharedpref`, `external`, `device_root`, `device_file`, `device_database`, and `device_sharedpref`, in **both** `cloud-backup` and `device-transfer`. This covers SQLite plus sidecars, documents/photos, native scheduled payloads and encrypted small values under the documented domain rules. The host regression executes the actual resource writer twice in a disposable directory, parses the XML and verifies all exclusions and identical bytes. Introspection alone would not execute this file mod.

Exact `app.json` diff:

```diff
@@ -15,6 +15,7 @@
     "android": {
       "package": "com.smaran.ai",
       "versionCode": 1,
+      "allowBackup": false,
       "blockedPermissions": [
         "android.permission.CAMERA",
         "android.permission.RECORD_AUDIO",
@@ -60,7 +61,11 @@
           }
         }
       ],
-      "expo-secure-store",
+      [
+        "expo-secure-store",
+        { "configureAndroidBackup": false }
+      ],
+      "./plugins/with-private-backup.cjs",
       "expo-notifications",
       [
         "expo-image-picker",
```

Every config change has one purpose: `allowBackup: false` disables Android backup participation; `configureAndroidBackup: false` prevents the SecureStore plugin from owning conflicting rules; the local plugin supplies the legacy disable flag and complete modern exclusions. `eas.json`, identity, permissions, dependencies and SQLite build flags are unchanged. The plugin only affects Android. It needs a later native build/install to affect a phone; an Expo JS export does not install these manifest/resource changes.

### Recovery changes and preserved operations

| Operation | Implemented behavior / evidence |
| --- | --- |
| SecureStore read/delete | Unavailable capability now throws `SecureStorageUnavailableError`; an actual missing read alone returns `null`. Native read/write/delete rejection propagates. The focused script first reproduced the old missing-rejection failure, then passed with the fix. No recovery path clears flags. |
| Active patient | Resolver reads the explicit active ID when present. If the ID is genuinely absent, the existing repository lookup now permits only a sole local profile. No profile plus no completed flag is fresh setup. Ambiguity, dangling ID, invalid flags or missing/invalid settings throw into each caller's existing error/Retry flow. Resolving is read-only, preserving My Care's query boundary. |
| Startup routing | After a successful sole-profile recovery, launch rewrites only the active/completed routing flags. Failure stays on Retry. A failed read never resets onboarding or routes to blank setup. Completion screen now uses the same resolver instead of its own flag deletion path. |
| Onboarding | Existing exclusive SQLite profile/settings transaction and saved retry ID are retained. A new-profile save checks for an existing row inside the transaction, preventing a second profile after a lost draft. Tests inject failure at SQLite settings, DOB, active ID and completion flag; retry uses the same record. A fresh resolver/launch recovers the sole committed profile even after transient draft state is gone. |
| Profile and DOB | SQLite update and DOB write remain separate. A successful SQLite update is retained if DOB fails; edited fields stay available for Save retry. New localized wording says some details may already be saved. While reloading Profile, old editable values are hidden; a failed DOB/profile read cannot expose blank or stale editable values for saving. |
| Missing/corrupt DOB | A genuinely absent DOB remains absent and can be entered in My Profile, including after an interrupted initial save. Empty, malformed or noncanonical stored dates reject; they are not silently converted to “not added” or overwritten. No DOB is inferred from age bracket. |
| Appearance/settings | Invalid appearance reads reject and successful saves update memory only after SecureStore succeeds. Existing settings locks, disabled choices, retry wording and SQLite-before-UI updates are retained. No preference is saved over a failed load. |
| Reminders | Existing SQLite-first save/edit/disable/delete and independent OS failure result remain. Regression verifies failed scheduling/cancellation, successful retry, matching payload replacement, dismissal failure, daily recurrence, one-time completion and stable identifiers. No rollback of saved data because notifications fail. |
| Memory/photo create, replace, remove | Existing copy/validate → transactional save → old-photo cleanup ordering retained. Existing regressions use real host files/SQLite with injected partial-copy/delete/SQL failures and verify old working photos survive replacement failures. No speculative cleanup sweep or destructive data reset added. |
| Database bootstrap | Existing WAL, verified foreign keys, shared initialization promise and transactional migrations 001–006 retained. Initialization failures remain retryable. SecureStore appearance read failure now also reaches bootstrap recovery rather than silently applying missing-state behavior. |

Permanent corruption, a dangling explicit patient ID or multiple profiles without an active ID may require a future deliberate support/selection flow; Retry is not a promise to repair these automatically. All rows/flags are preserved. No patient selection by name, inferred identity, new recovery database, journal, wipe button or schema migration was introduced.

The duplicate guard applies to accidental new-profile creation through today's onboarding; it is not a database-wide one-patient invariant. An explicit valid active ID continues to resolve its own profile/settings when other profiles exist. Multiple profiles with no valid selection must fail conservatively. Future explicit "Add another person" and "Switch person" require dedicated creation/selection flows with deliberate active-ID updates, transient-state refresh and per-patient reminder/game/model/memory/DOB/settings/report isolation. Those flows must not simply remove the interrupted-onboarding guard. No switching UI, migration or multi-patient creation feature is implemented here.

### UX, logging and security reality

Help and About now show three short privacy paragraphs and include them in Read Screen: device-local prototype storage, possible loss on uninstall/device loss and no cloud sync, and shared unlocked-device My Care access without separate sign-in. Profile/onboarding failures explain partial-save semantics. These five keys are provided in English, Hindi, Assamese, Bengali, Meitei, Khasi and Mizo through the existing typed UX catalog. Native-speaker review is still required; key parity does not certify translations.

Application console calls now contain fixed development-only diagnostic messages, including startup, onboarding completion, game load/save, speech, haptics and the error boundary. Exception payloads can carry patient text or file paths, so they are not printed. The regression checks the TypeScript AST for literal-only arguments and the existing development guard. Useful operational messages remain; no logging service was added.

SecureStore protects small values using Android Keystore-backed encrypted preferences, but Android uninstall removes the relevant key/data. iOS Keychain behavior differs and values can persist across reinstall. It is not a recovery backup and does not encrypt adjacent stores. Smaran requests no biometric authentication; caregiver view is not identity separation. [Expo SDK 54 SecureStore](https://docs.expo.dev/versions/v54.0.0/sdk/securestore/).

SQLite has no configured SQLCipher/key lifecycle, and personal photo files have no app-level encryption. Platform sandbox/device protections are separate and were not penetration-tested. `exif: false` suppresses returned picker metadata; copying bytes does not prove embedded metadata removal. No custom cryptography, encryption conversion, photo upload or privacy certification was attempted. [Expo SDK 54 SQLite](https://docs.expo.dev/versions/v54.0.0/sdk/sqlite/).

## Original implementation validation evidence (historical)

This section records the previous implementation run, not new execution claims for the September 10 localization follow-up below.

All ten requested existing regression scripts passed:

```text
node scripts/check-native-hardening.cjs
node scripts/check-product-hardening.cjs
node scripts/check-product-polish.cjs
node scripts/check-ux-overhaul.cjs
node scripts/check-my-day.cjs
node scripts/check-my-memories.cjs
node scripts/check-my-care.cjs
node scripts/check-elderly-ux.cjs
node scripts/check-cognitive-expansion.cjs
node scripts/check-my-home.cjs
```

`node scripts/check-privacy-recovery.cjs` also passed: actual SecureStore service failure contracts; invalid DOB/appearance handling; actual onboarding/Profile/launch component behavior with controlled UI/native boundaries and real host SQLite repositories; four interrupted-write boundaries; retry without duplicate profiles; sole-profile cold launch, ambiguity/dangling flags; visible/spoken privacy copy in all seven languages; literal-only development logs; Expo manifest introspection and actual deterministic XML generation. My Day's existing script now tests generic payloads, warm legacy replacement and independent presented-notification cleanup. Older assertions that expected privacy leaks or clearing/rerouting damaged state were replaced by explicit privacy/preservation assertions; database ownership, recurrence and transaction checks remain.

| Required command | Result |
| --- | --- |
| `npx tsc --noEmit` | PASS |
| `npx expo lint` | PASS, no warnings |
| `npx expo-doctor` | PASS, 18/18 |
| `npx expo install --check` | PASS, dependencies up to date |
| `npx expo config --type public` | PASS, correct SDK/identity/backup plugin |
| `npx expo export --platform all --max-workers 2` | PASS, Android/iOS Hermes bundles and 28 static web routes in ignored `dist/`; not an APK |
| Protected package, migration, web-client diffs | Blank; no migration 007 |
| `git diff --check` | PASS |

Non-failing export notices: existing `NO_COLOR`/`FORCE_COLOR` mismatch and unsupported web push-token listener. No new dependency was installed.

Browser QA used the real app at `http://localhost:8091/`, with production web SQLite/SecureStore boundaries unchanged. At 360, 768 and 1280 pixels, in system light/dark with reduced motion requested, the recovery alert and Retry remained visible, the button was 56px high and no horizontal overflow was measured. Retry returned to recovery as expected because native storage is unsupported on web. Keyboard focus was observed on Retry; the 360px dark screenshot showed readable wrapping, brand and visible focus outline. Three retained HTTP requests returned 200. Console showed only the expected static `Local setup initialization failed` message per attempt and existing web notification warning, without raw exception contents. No working native persistence or patient-screen browser PASS is inferred. Help/About/Profile have host component checks; actual patient layouts require Android. Temporary browser files are removed after inspection; no adapters or localhost source code were added.

## NOT YET GUARANTEED / DEVICE TEST REQUIRED

No APK was built, no Gradle merged manifest/resource artifact was inspected and **no physical-device test below was run**. Native backup configuration is implemented and host-verified, not device-certified. Older backups, vendor transfer tools, notification history/listeners, iOS backup, rooted devices, device loss and secure erasure are outside any guarantee here. Newer cross-platform transfer modes also need explicit compatibility review; no Android-to-iOS transfer claim is made.

| Physical test | Required observation | Status |
| --- | --- | --- |
| Upgrade and locked-screen notifications | Using synthetic sensitive title/note, verify only the generic wording is visible for daily and once reminders. Upgrade with pending and presented old reminders, open the app, confirm replacement/dismissal; check system notification history separately. | NOT RUN |
| Denied/revoked notification permission | Save/edit/delete remains in My Day; clear fallback/Retry; no completion inferred. Regrant and verify reconciliation. | NOT RUN |
| Force-stop/reboot scheduling | Compare SQLite reminders to actual requested/delivered schedules after reopen/reboot, timezone change and permission denial. Do not promise delivery while Android has force-stopped the app. | NOT RUN |
| Interrupted onboarding/profile/settings writes | Interrupt at SQLite commit, DOB, active ID, completion flag and appearance save; relaunch/retry; verify original ID, records and old/new values. Missing DOB stays missing and is editable in My Profile. | NOT RUN |
| Personal photo replacement failure | Low storage/interrupted copy and database failure preserve the old photo; cleanup failure is visible; reopen resolves the saved relative path. Verify source gallery photo remains. | NOT RUN |
| Force-close/reopen | Saved profiles, language, appearance, reminders, memories and completed activities remain; incomplete transient drafts/sessions are not claimed durable. | NOT RUN |
| Airplane mode | Cold launch and local CRUD/activities work; unavailable voices have a visible fallback. No remote caregiver or network recovery guarantee. | NOT RUN |
| Backup/device transfer/restore | On disposable synthetic data and an authorized later build, inspect merged manifest/XML, test Android 11 and Android 12+ cloud/transfer where available, including a target OEM that ignores allowBackup for transfer. Check SQLite/WAL, photos, SecureStore and notification preferences; destination must not restore stale schedules with missing source data. Check preexisting backup behavior separately. | NOT RUN |
| TalkBack | Error/Retry, disabled controls, partial-save message, privacy headings/read-aloud and focus order remain understandable. | NOT RUN |
| Extra-large text | Small phone/tablet, seven languages, Profile and Help/About scroll without clipping or hidden actions. | NOT RUN |
| Dark/high-contrast modes | Five saved appearance modes, system startup transition and all error/privacy text remain readable on Android. | NOT RUN |
| Language review | Native speakers review the five privacy/support keys and two generic notification keys in all seven languages. | NOT RUN |

### Claims Smaran must NOT make

- Fully encrypted, encrypted SQLite/photos, anonymous, HIPAA compliant, clinically secure, cloud backed up, guaranteed restoration or guaranteed backup/transfer exclusion on every device.
- Strong caregiver identity separation, authenticated healthcare-worker access, remote monitoring or cloud synchronization.
- Guaranteed notification delivery, medicine taken, appointment attended, or patient condition inferred from missing activity/Done records.
- Dementia diagnosis, stage/severity, progression prediction, clinical risk, treatment/cure or slowing cognitive decline.
- Guaranteed embedded-photo metadata removal, immediate removal of all cached/orphan files, secure erasure or recall of notifications/backups already copied elsewhere.

## Original implementation Git scope (historical)

No commit, merge, tag, push, deployment, APK build, new cloud/auth/analytics feature or database migration. Protected diffs for `package.json`, `package-lock.json`, `src/db/migrations`, `src/db/client.web.ts`, and `eas.json` are empty. New files are this report, the local config plugin, and the focused regression script; ordinary `git diff --stat` excludes these untracked files.

After removing the temporary Playwright output/screenshot and stopping the QA server, `git diff --check` passes. The tracked diff has 24 files changed, 157 insertions and 112 deletions; the three new files are additional. `git diff --name-status` contains the same 24 `M` paths below. `git ls-files --others --exclude-standard` contains exactly `docs/history/MVP18A_PRIVACY_RECOVERY.md`, `plugins/with-private-backup.cjs`, and `scripts/check-privacy-recovery.cjs`.

Exact `git status --short`:

```text
 M app.json
 M app/_layout.tsx
 M app/index.tsx
 M app/onboarding/complete.tsx
 M app/patient/games/memory-match.tsx
 M app/patient/games/result.tsx
 M app/patient/games/why-level.tsx
 M app/patient/profile.tsx
 M app/patient/support.tsx
 M components/error-boundary.tsx
 M components/onboarding/finish-onboarding.tsx
 M hooks/use-haptics.ts
 M scripts/check-my-care.cjs
 M scripts/check-my-day.cjs
 M scripts/check-my-home.cjs
 M scripts/check-native-hardening.cjs
 M src/db/repositories/patient.repository.ts
 M src/i18n/ux-strings.ts
 M src/services/active-patient.service.ts
 M src/services/my-day.service.ts
 M src/services/profile-details.service.ts
 M src/services/secure-storage.service.ts
 M src/services/speech.service.ts
 M src/stores/appearance.store.ts
?? docs/history/MVP18A_PRIVACY_RECOVERY.md
?? plugins/
?? scripts/check-privacy-recovery.cjs
```

## September 10 localization follow-up: current audit and revalidation

The branch and HEAD matched the request. All 24 initially modified files plus the existing report, backup plugin and privacy regression were inspected. The audit covered secure-read failure semantics, routing/completion recovery, duplicate onboarding, Profile partial saves, DOB/appearance validation, notification reconciliation, backup configuration, Help/About catalogs, sanitized diagnostics and the changed regression expectations. The initial My Day regression actually failed because it referenced absent `dayNotificationTitle`/`dayNotificationBody` keys; the service still had fixed English copy. Earlier PASS summaries were not accepted as current evidence.

This follow-up changed seven files: `src/services/my-day.service.ts`, `src/i18n/my-day-strings.ts`, `src/db/repositories/patient.repository.ts` (comments only), `scripts/check-my-day.cjs`, `scripts/check-native-hardening.cjs` (settings boundary fixture), `scripts/check-privacy-recovery.cjs`, and this report. The recovery algorithm and onboarding guard were retained. Added recovery checks exercise both explicit patient IDs in a two-profile database, reject a dangling selection, block accidental further onboarding and verify existing rows remain unchanged.

Notification regression runs the actual service and repositories with host SQLite and a controlled native notification boundary. It covers all seven languages for daily/date triggers, language changes at unchanged reminder revisions, generic-only payloads, safe presented messages in every language, another patient's missing settings without language borrowing or schedule changes, and a failed language read after a successful reminder save. Existing permission, cancellation, rescheduling, completion, revision, timezone/date and queue checks still pass. Key parity and executable behavior are verified; native-speaker approval and actual OS delivery are not claimed.

All eleven commands passed in this follow-up:

```text
node scripts/check-privacy-recovery.cjs
node scripts/check-my-day.cjs
node scripts/check-native-hardening.cjs
node scripts/check-my-care.cjs
node scripts/check-product-hardening.cjs
node scripts/check-product-polish.cjs
node scripts/check-ux-overhaul.cjs
node scripts/check-elderly-ux.cjs
node scripts/check-cognitive-expansion.cjs
node scripts/check-my-home.cjs
node scripts/check-my-memories.cjs
```

`npx.cmd tsc --noEmit` and `npx.cmd expo lint` passed without diagnostics. `npx.cmd expo-doctor` passed 18/18; `npx.cmd expo install --check` reported dependencies up to date. Bare `npx` initially hit PowerShell's script execution policy, so the installed `.cmd` launcher was used without changing that policy. Exports and browser/device QA from the original section were not rerun in this follow-up. No APK was built.

Both staged and unstaged protected diffs are blank for `package.json`, `package-lock.json`, `src/db/migrations`, `src/db/client.web.ts` and `eas.json`. `git diff --check` passes. `git diff --stat` reports 25 tracked files changed, 230 insertions and 113 deletions; this includes the pre-existing implementation and excludes the three untracked files. `git diff --name-status` lists those 25 modified paths. `git ls-files --others --exclude-standard` still lists exactly the report, `plugins/with-private-backup.cjs` and `scripts/check-privacy-recovery.cjs`.

No commit, merge, tag, migration, dependency, user-switching UI or other deferred feature was added. Exact current `git status --short`:

```text
 M app.json
 M app/_layout.tsx
 M app/index.tsx
 M app/onboarding/complete.tsx
 M app/patient/games/memory-match.tsx
 M app/patient/games/result.tsx
 M app/patient/games/why-level.tsx
 M app/patient/profile.tsx
 M app/patient/support.tsx
 M components/error-boundary.tsx
 M components/onboarding/finish-onboarding.tsx
 M hooks/use-haptics.ts
 M scripts/check-my-care.cjs
 M scripts/check-my-day.cjs
 M scripts/check-my-home.cjs
 M scripts/check-native-hardening.cjs
 M src/db/repositories/patient.repository.ts
 M src/i18n/my-day-strings.ts
 M src/i18n/ux-strings.ts
 M src/services/active-patient.service.ts
 M src/services/my-day.service.ts
 M src/services/profile-details.service.ts
 M src/services/secure-storage.service.ts
 M src/services/speech.service.ts
 M src/stores/appearance.store.ts
?? docs/history/MVP18A_PRIVACY_RECOVERY.md
?? plugins/
?? scripts/check-privacy-recovery.cjs
```
