# Caregiver Sync Status

Implemented against release `1dfccf1`. No commit, deployment, hosted write, historical migration edit, or persisted-data migration was performed.

## Files changed

| Files | Change |
| --- | --- |
| `src/cloud/sync-status.ts` | Central typed state and pure status precedence. |
| `src/cloud/sync.ts` | Extend the existing Zustand store and single-flight pipeline; connectivity subscription, offline metadata reads, foreground refresh, account cleanup and safe retry scheduling. |
| `src/db/repositories/sync.repository.ts` | Read-only, parameterized patient/account ownership check for the indicator. Existing writes and sync transactions are unchanged. |
| `components/caregiver/sync-status.tsx` | Shared accessible indicator, timestamp and existing-pipeline retry button; owner and patient guards. |
| `app/caregiver/home.tsx`, `components/caregiver/care-workspace.tsx` | Place the indicator next to the existing person/header area. |
| `src/i18n/sync-strings.ts`, `src/i18n/strings.ts`, `src/i18n/regional-strings.ts` | Five new strings in English, Hindi, Assamese, Bengali, Meitei, Khasi and Mizo, using existing catalog/fallback rules. Existing account strings are reused. |
| `package.json`, `package-lock.json` | Add only SDK 54-compatible `expo-network ~8.0.8` (installed 8.0.8); no existing dependency upgrades. |
| `scripts/check-sync-status.cjs` | Deterministic model, real SQLite/lifecycle and component tests. |
| `scripts/check-auth-cloud-hardening.cjs`, `scripts/check-live-database-sync.cjs` | Update stale migration-count/source baselines to the existing release with migration 014; supply the existing admin boundary in screen tests. Freeze all historical local/cloud migrations, including previously excluded files. |
| `scripts/check-extra-cognitive-games.cjs`, `scripts/check-three-cognitive-games.cjs` | Explicitly verify the newly authorized network dependency and its lockfile version while retaining all other dependency checks. |
| `README.md`, `docs/SYNC_STATUS.md` | Handoff and validation evidence. |

## Behavior

The existing SQLite → transactional outbox → authenticated `push_mutations` → validated `pull_changes` → SQLite path remains authoritative. Local saves never await cloud work. Mutation identities, batching, acknowledgements, pull guards, consent, ownership, RLS, medical boundaries and safe diagnostics remain intact.

The model preserves names already used by the Account screen:

| Internal status | Caregiver wording/meaning |
| --- | --- |
| `local` | Saved on this device; also used for an unlinked person or a person belonging to another account. |
| `paused` | Backup paused; reconnect does not override consent. |
| `signed-in` | Waiting to sync; a connection or old timestamp alone is not proof of a completed current pass. |
| `offline` | Offline, or “Offline · X changes pending,” plus a local-save/automatic-foreground-sync explanation. |
| `syncing` | Syncing; the action is busy and disabled. |
| `current` | Synced, only after the outbox drains and a complete pull succeeds. |
| `waiting` | Waiting to sync: X changes. |
| `attention` | Sync issue, with Retry when online. No raw exceptions appear. |

Counts and last success come from the existing owner-scoped SQLite queries. No new persisted metadata is added. The indicator explicitly says **Account sync · All linked people**: counts cover that account's linked people, not only the selected person. It checks the selected person's ownership before revealing account metadata. Selection revisions, switching state, owner/revision changes and cleanup guards hide stale results immediately. No metadata from a different owner is shown.

`expo-network` supplies initial/foreground connectivity reads and connection events. A stale initial read cannot overwrite a later event. Reconnection starts the existing `syncNow` pipeline when foregrounded; existing backoff is preserved (up to five minutes, plus the next 30-second foreground tick). Manual Sync now/Retry invokes `syncNow(true)`, which retains the established retry reset and mutation identities. Concurrent requests share one writer; a new owner waits for cancellation of the previous owner before starting its pass.

Local status refresh runs every two seconds while foregrounded, including offline, independently of the 30-second cloud timer. It does not write to SQLite. Background automatic passes are not started; this feature does not promise background delivery. Existing session validation is required before cloud access. Offline sessions can read only their own local queue metadata.

The indicator uses scalable existing text and button components, a polite screen-reader live region, complete accessible wording, wrapping text and the existing large touch target. All status differences have text; color is not required. No new production logging is introduced.

Verified API references: [Expo SDK 54](https://docs.expo.dev/versions/v54.0.0/) and [Expo Network SDK 54](https://docs.expo.dev/versions/v54.0.0/sdk/network/). A native rebuild is needed to include the new module in an existing standalone/development build.

## Validation results

| Command/check | Result |
| --- | --- |
| `npx.cmd tsc --noEmit` | PASS. |
| `npx.cmd expo lint` | PASS. |
| `npx.cmd expo-doctor` | PASS, 18/18 checks. Network-enabled execution was needed. |
| `npx.cmd expo export --platform all --output-dir .expo/sync-status-export` | PASS on final source: Android/iOS Hermes bundles and web, 48 static routes. Sandbox execution initially denied Hermes; the authorized rerun passed. |
| `git diff --check` | PASS. |
| Historical SQLite 001–014 and Supabase migration comparisons | PASS, byte-equivalent after line-ending normalization to `1dfccf1`. No migration files changed. |
| `node scripts/check-sync-status.cjs` | PASS: status precedence; real SQLite offline writes/counts; reconnect; initial-network-read race; foreground/background; active status during reads; manual coalescing; errors/timestamp retention; local-write/pull conflict; offline auth; paused consent; logout/account-switch cancellation; stale metadata and patient lookups; listener/timer cleanup; seven-language rendering and accessibility labels. |
| `node scripts/check-live-database-sync.cjs --status-probe` | PASS: failed/in-flight pulls cannot show a stale success; a write arriving at completion cannot flash Synced; all seven Account catalogs. |
| `node scripts/check-auth-sync.cjs` | PASS, including real SQLite queue, duplicate/lost receipt handling, retry/backoff, owner isolation and controlled Supabase SDK transport. |
| `node scripts/check-auth-cloud-hardening.cjs` | PASS, including auth/session/privacy/source contracts. Synthetic auth-failure diagnostics are expected in this test harness. |
| Every `scripts/check-*.cjs` entry point (30 files) | 20 exited 0; nine baseline failures below; full database suite stops at the existing grant mismatch below. `check-mvp22-boundaries.cjs` only exports helpers, so its direct exit 0 is not an independently executed assertion suite. |

Other successful entry points: `check-analytics`, `check-auth-sync-migration`, `check-care-circle-reports`, `check-cognitive-ai`, `check-elderly-ux`, `check-extra-cognitive-games`, `check-final-ux-game-stabilization`, `check-privacy-recovery`, `check-product-hardening`, `check-product-polish`, `check-profile-switching`, `check-release-stabilization`, `check-report-delivery`, `check-speech-voices`, `check-three-cognitive-games`, and `check-ux-overhaul` (all `.cjs`).

The following nine failures were reproduced by executing the same checks from an untouched `git archive HEAD` of starting commit `1dfccf1`, using the installed dependencies. They were not weakened or repaired as part of Sync Status:

| Script | Existing failure |
| --- | --- |
| `check-cognitive-expansion.cjs` | Expects 13 migrations; actual 14 (line 202). |
| `check-cognitive-migration.cjs` | Expects 13 migrations; actual 14 (line 128). |
| `check-my-care.cjs` | Expects 13 migrations; actual 14 (line 152). |
| `check-my-day.cjs` | Expects 13 migrations; actual 14 (line 60). |
| `check-my-memories.cjs` | Expects 13 migrations; actual 14 (line 106). |
| `check-native-hardening.cjs` | Frozen migration list omits 014 (line 31). |
| `check-daily-voice.cjs` | Speech expectation 1 versus actual 0 (line 42); this task does not change speech behavior. |
| `check-my-home.cjs` | Obsolete `speakScreenText(text, speechLanguage` source assertion (line 126). |
| `check-visual-ux.cjs` | Old MVP22 dependency snapshot already conflicts with the release's installed dependencies. The new network package is also outside that legacy snapshot. |

`node scripts/check-live-database-sync.cjs` was run with the installed PostgreSQL 18 tools and a disposable local server. All six current cloud migrations applied and all four SQL fixtures passed. The suite then failed its existing `authenticated` validator EXECUTE assertion (line 94): it expects `false`, whereas the unchanged `20260922000000_location_admin.sql` explicitly grants `true` at line 29. The assertion and grants were left intact. The later full SDK→PostgreSQL lifecycle scenarios in that script therefore did not execute. Disposable databases were stopped and removed by the script.

`node scripts/check-live-database-sync.cjs --hosted-audit` completed read-only: public Auth settings returned HTTP 200; migration history returned HTTP 406. Hosted push/pull/reconnect/A-B RLS testing remains blocked by unavailable migration visibility and the lack of an isolated authenticated test identity. No credentials or endpoint values were logged, and no hosted records were written.

Browser QA used installed Playwright against `http://localhost:8091/caregiver/home` at 360×900, 768×900 and 1280×900. The actual app showed its expected native-storage recovery screen, without horizontal overflow, browser page exceptions or failed network requests. The console's expected “Local setup initialization failed” diagnostic was observed. Browser QA cannot verify the native caregiver indicator because web deliberately does not implement the native SQLite/SecureStore patient flow. The indicator's actual component functions were exercised through the repository's deterministic UI harness; physical layout and TalkBack still need device checks.

## Android commands and device checks

Run from PowerShell in the workspace with Android SDK tools, USB debugging enabled, and the phone connected:

```powershell
adb devices
npx.cmd expo run:android --device
```

This rebuild installs the new native network module. For subsequent Metro-only starts with that rebuilt app:

```powershell
npx.cmd expo start --clear
```

Use the existing public Supabase configuration and a dedicated test account. Never place privileged keys in the app.

1. Sign in, explicitly enable backup, and open Caregiver Home for a linked test person. Verify Syncing → Synced and the real last-success time.
2. Turn on airplane mode. Make a local reminder or memory-text edit; verify it is immediately visible and the pending count updates while offline. Unlinked people should continue to show Saved on this device.
3. Restore connectivity with the app foregrounded. Verify automatic retry, pending count drain, and Synced only after the complete pull. Existing retry backoff may delay transmission; Sync now/Retry is the explicit immediate retry path.
4. Repeat with the app backgrounded, then foreground it. Kill/reopen offline and confirm local records/outbox survive. Do not expect delivery while the app is closed.
5. With pending work, sign out and sign in as another test owner; switch among linked, unlinked and other-owner people. Confirm no prior-owner counts/timestamps or prior-person sync state appear. Return to the original owner and verify its queue resumes.
6. Pause backup, reconnect and confirm it remains paused. Re-enable only through the existing consent control.
7. Test a server outage on an authorized staging setup: the UI should give generic Sync issue/Retry, retain local data, and not advance last success.
8. Enable TalkBack, extra-large text and high contrast. Check wrapping, live announcements, button focus/touch target, disabled sync action during a pass, and all supported language choices.

Remaining limits: native binary connectivity/lifecycle behavior, TalkBack and physical layout, and authenticated hosted end-to-end sync are not yet verified. The full legacy regression suite is not green for the reasons above. The app's existing shared-device SQLite visibility remains unchanged; account sync ownership is not a private local vault.
