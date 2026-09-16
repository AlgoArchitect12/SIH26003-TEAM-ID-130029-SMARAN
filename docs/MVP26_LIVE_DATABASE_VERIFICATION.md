# MVP-26 database verification

Verified on 2026-09-16 in `C:\Users\Dharmin\OneDrive\Desktop\SMARAN-A`, branch `feature/mvp26-live-database-verification`, HEAD/base `6ce8df9`. The starting working tree was clean. Node.js 24.19.0 and PostgreSQL 18.6 were used.

**SOURCE/LOCAL VERIFIED, HOSTED MIGRATION/AUTH BLOCKED. Source is safe to review/commit; no commit or deployment was made.**

The production path remains:

```text
domain repository write
  -> SQLite statement/exclusive transaction
  -> SQLite outbox trigger in that same transaction
  -> sync_outbox (immutable identity/payload, owner, sequence, durable retries)
  -> syncNow / captured authenticated account + enabled backup
  -> Supabase SDK push_mutations(events), account cancellation signal
  -> PostgreSQL owner lock, validator, sync_records + sync_mutations
  -> validated ordered receipts, transactional local acknowledgement
  -> pull_changes(account cursor)
  -> validated parents/records, exclusive SQLite apply with echo suppression
  -> sync_versions + pull_cursor commit in the same transaction
  -> successful completion status, only when no local changes remain
```

`src/db/client.ts` opens the shared Expo SQLite connection, enables WAL and foreign keys, and executes `src/db/migrations/index.ts`. The test loads both production modules, adapting only the Expo SQLite API to Node's real SQLite driver. It does not replace migration SQL, repository writes, validators, the outbox, or the sync engine.

`patient.repository.ts`, `my-day.repository.ts`, `memories.repository.ts`, `cognitive.repository.ts`, and `care-circle.repository.ts` own domain writes. The cognitive session and adaptive model commit together. `reports.service.ts` derives factual reports from the production analytics and domain repositories; preferences and report records use the Care Circle repository. Triggers installed by migrations 008/010 and preserved by later migrations enqueue eligible structured fields atomically. Trigger failure rolls back the source write. Photos, dates of birth, notification identifiers, and auth material are excluded from the cloud payload.

`sync.repository.ts` owns account consent, immutable patient ownership, queue ordering, acknowledgements, retry metadata, and pull application. Profiles precede children; reminders and Care Circle members precede their dependants; sequence order is retained within each rank. `sync.ts` serializes passes, sends at most ten batches of 25, and uses foreground AppState events plus a 30-second foreground timer for reconnect. Manual sync resets retry scheduling. Network/auth failures stay retryable with bounded backoff; invalid/conflicting entries require attention. Mutable cloud state uses last server-accepted writes; sessions/events are immutable and tombstones do not resurrect.

`auth.ts` creates the existing Supabase client with bounded fetch, validates restored sessions, and captures owner/revision/AbortSignal for asynchronous work. `auth-storage.ts` uses chunked SecureStore, persisted logout intent, and guarded callbacks. Logout invalidates cloud work without deleting SQLite patients. Cloud ownership and local shared-device profile visibility are intentionally different: local profiles remain visible, but another account cannot acquire their mutations or cloud cursor. Migration 011 requires explicit account-scoped backup consent, retains queues/cursors/owners, and stops automatic association of newly created profiles.

The new regression reuses the existing Supabase SDK/native-boundary harness. Its HTTP adapter invokes the real migrated PostgreSQL RPC functions under the `authenticated` role, setting only synthetic account claims. The disposable standalone cluster supplies the minimal `auth.users`/`auth.uid()` contract. This proves PostgreSQL transactions, SQL validators, grants, and RLS; it does **not** claim to verify hosted JWT issuance, GoTrue, PostgREST transport, or native SecureStore/SQLite binaries.

Two production status gaps were repaired without a schema change:

- Opening Account after a failed pull previously replaced `attention` with `current` whenever an old successful timestamp existed. Opening it during an active pull could do the same. Status refresh now preserves failure/in-flight states until a completed pass explicitly refreshes the result.
- A paused account previously displayed only “Saved on this device.” The existing consent row now distinguishes “Backup paused,” with a label in every supported language. The completion regression also guards against a transient “Synced” state when a local write arrives before completion.

The first status defect was reproduced as expected `attention`, actual `current`. The concurrent-write check also reproduced an emitted `current` state while the outbox was nonempty. Both executable checks now pass. No outbox, ownership, authentication, migration, or server architecture was redesigned.

| # | Requested result | Evidence / outcome |
| --- | --- | --- |
| 1 | Production architecture | Confirmed above: SQLite authority, transactional outbox, existing authenticated RPC path, guarded transactional pull/cursor, SecureStore auth. |
| 2 | Offline writes | PASS: profiles/settings, reminders/events, memories, eleven sessions/models per patient, Care Circle, reports/preferences. No account is needed for local writes; no queue before consent. |
| 3 | Restart | PASS: close all SQLite handles, inspect the persisted database in a separate Node process, reopen the runtime, compare a hash of every table/row including queue/retries/sequence. |
| 4 | Multiple writes | PASS: A, B, update A, C produce three business records and four distinct ordered immutable mutations. AUTOINCREMENT high-water is exact. |
| 5 | Retry | PASS: network loss, real bounded-fetch timeout, HTTP 401, expired credentials, refresh failure, invalid RPC payload, durable attempts/deadlines, and bounded retries. |
| 6 | Duplicate/idempotence | PASS: real PostgreSQL duplicate receipts after lost response and separate-process exit after commit but before local acknowledgement; mutation/business counts do not grow on replay. |
| 7 | Partial acknowledgement | PASS: mixed applied/rejected receipts delete only confirmed IDs. Missing/truncated/malformed receipt arrays fail closed and retain the queue. |
| 8 | Push succeeds/pull fails | PASS: acknowledged mutations remain cleared, cursor remains unchanged, no new success timestamp, attention status. |
| 9 | Cursor safety | PASS: malformed/stale/foreign-owner batches rejected; apply/versions/cursor/echo flag roll back together; local queued writes prevent pull overwrite. |
| 10 | Backup consent | PASS: off/on/pause/resume, preserved pending records, no paused RPC, per-account consent. Populated 010-to-011 upgrade preserves owners/retries/nonzero cursor while disabling consent. |
| 11 | Logout | PASS: online/offline, pending push, in-flight pull, and token refresh. Stale acknowledgements/apply are rejected and local records remain. |
| 12 | Accounts A/B | PASS locally: B cannot push A's queue, inherit A's consent/cursor, or read A's cloud Care Circle/preferences. SQL fixtures exercise both populated accounts and cross-account rejection. |
| 13 | Patients A/B/A | PASS: all domains, actual active-patient resolver/session guards, stale session write rollback, and account-wide sync retaining original patient ownership after a visible-patient switch. |
| 14 | Eleven games | PASS: exact catalog below, local persistence, outbox, analytics/reports, TypeScript and PostgreSQL validators. Invalid game rejected. |
| 15 | Care/report dependency | PASS: offline member then dependent preference, ranked queue delivery to real PostgreSQL, no missing-recipient rejection, successful pull into empty SQLite. |
| 16 | SQLite integrity | PASS: `PRAGMA integrity_check` returns `ok`; `PRAGMA foreign_key_check` returns zero rows on disposable source/receiver/upgrade databases. |
| 17 | Fresh migrations | PASS: production client and runner apply 001–012; repeated initialization coalesces; repeated migrations are idempotent. |
| 18 | Populated migrations | PASS: populated upgrade, retained rows/owners/cursors/retries/high-water, injected rollback, rerun, reopen. Existing migration regressions cover their additional failure boundaries. |
| 19 | PostgreSQL version | 18.6, installed Windows binaries, unique loopback-only disposable cluster. Installed database services were not used. |
| 20 | SQL migrations/fixtures | PASS: all four source migrations applied in order; all four SQL fixtures executed and rolled back. See inventory below. |
| 21 | RLS/grants | PASS locally: four tables with RLS enabled, authenticated owner policies, revoked direct writes, anonymous RPC denial, private validator, unchanged table grants across forward migrations. No app service-role dependency. |
| 22 | Hosted reachability | PASS: configured public Auth settings endpoint returned HTTP 200. URL/key/response contents were not printed. |
| 23 | Hosted migration history | BLOCKED for independent confirmation: querying `supabase_migrations` through the public API returned HTTP 406. The user's latest manual observation is **only `20260912000000`**. Later migrations remain unconfirmed, not presumed deployed. |
| 24 | Hosted test identity | Unavailable: no dedicated test-identity configuration found in local/process configuration; no verified isolated authenticated session supplied. No login/signup or auth bypass attempted. |
| 25 | Hosted push | BLOCKED by migration/auth prerequisites. No hosted write was made. |
| 26 | Hosted pull | BLOCKED by migration/auth prerequisites. |
| 27 | Hosted reconnect | BLOCKED by migration/auth prerequisites. Local actual-SQL reconnect and restart passed. |
| 28 | Hosted A/B RLS | BLOCKED by migration/auth prerequisites. Local actual PostgreSQL/RLS tests passed. |
| 29 | Status UX | PASS executable states for all seven languages: saved locally, waiting, synced, attention, backup paused; sign-in prompt retained. Failed/in-flight pull cannot turn into synced merely on Account refresh. Browser scope below. |
| 30 | Diagnostics | No additional inspector/logger needed. Production auth/storage/sync modules contain no console logging. Regression output uses test labels/statuses; hosted errors are sanitized and secret scan reports only type/path. |
| 31 | Dedicated regression | PASS, exit 0: `scripts/check-live-database-sync.cjs`. Hosted subtests print BLOCKED explicitly. |
| 32 | Every regression | PASS: 25/25 executable `check-*.cjs` scripts, inventory below. No local test left blocked. |
| 33 | Old tests modified | Only `check-auth-cloud-hardening.cjs`: export its existing `harness` for reuse (one line); no old assertions/fixtures/runner changes. |
| 34 | Test weakening | None. No assertion removed, no isolation/migration skip, no hardcoded success, no executable test replaced by text matching. |
| 35 | TypeScript | PASS: `npx.cmd tsc --noEmit`, rerun after final production fix. |
| 36 | Lint | PASS: `npx.cmd expo lint`, rerun after final production fix. |
| 37 | Expo Doctor | PASS: `npx.cmd expo-doctor`, 18/18 checks. |
| 38 | Dependencies | PASS: `npx.cmd expo install --check`, up to date. No dependency/lockfile change. |
| 39 | Public config | PASS: `npx.cmd expo config --type public`, SDK 54, identifiers/config unchanged. Dotenv disabled for toolchain/export. |
| 40 | Export | PASS: `npx.cmd expo export --platform all` with explicit disposable output directories; final Android/iOS Hermes and web export, 43 routes. No APK. |
| 41 | Secrets | PASS tracked/untracked project source scan for privileged keys/JWTs, database URL passwords, literal tokens, Google/provider secrets and private keys. No findings; `.env.local` ignored. |
| 42 | SQLite history | PASS: all existing 001–012 files unchanged against `6ce8df9`. No new migration. |
| 43 | Supabase history | PASS: all four existing migrations unchanged against `6ce8df9`. No forward migration/deployment needed for source repairs. |
| 44 | Changed files | Eight paths: exact status below. Four production files, one one-line test export, one new regression, README and this report. |
| 45 | Git status | Branch/HEAD unchanged; exact final status below. No staged changes/commit. `git diff 6ce8df9 --check` passed. |
| 46 | Cleanup | Task PostgreSQL clusters stopped/removed; disposable SQLite databases, exports, browser outputs and validation logs removed. Exact cleanup verified before handoff; no broad Git clean. |
| 47 | Human/live actions | Confirm hosted history; explicitly approve/apply missing migrations; provide two confirmed isolated test identities for live A/B testing; then run hosted/native reconnect flow. Details below. |
| 48 | Database status | **SOURCE/LOCAL VERIFIED, HOSTED MIGRATION/AUTH BLOCKED** |
| 49 | Safe to review/commit | **YES for source**, with hosted/native limitations explicit. No commit, merge, tag, release or deployment performed. |

Exact supported catalog:

```text
memory_match
pattern_recognition
routine_recall
familiar_object
sequence_memory
picture_recall
remember_lights
number_path
sudoku_lite
chess_puzzle
word_match
```

All PostgreSQL source migrations executed, in this order:

```text
PASS 20260912000000_auth_sync.sql
PASS 20260913000000_extra_cognitive_games.sql
PASS 20260915000000_care_circle_reports.sql
PASS 20260916000000_three_cognitive_games.sql
```

Every SQL fixture executed against that final schema:

```text
PASS auth_sync.sql
PASS care_circle_reports.sql
PASS extra_cognitive_games.sql
PASS three_cognitive_games.sql
```

Every JavaScript regression executed:

```text
PASS check-analytics.cjs
PASS check-auth-cloud-hardening.cjs
PASS check-auth-sync.cjs
PASS check-auth-sync-migration.cjs
PASS check-care-circle-reports.cjs
PASS check-cognitive-ai.cjs
PASS check-cognitive-expansion.cjs
PASS check-cognitive-migration.cjs
PASS check-daily-voice.cjs
PASS check-elderly-ux.cjs
PASS check-extra-cognitive-games.cjs
PASS check-live-database-sync.cjs  (local PASS; hosted subtests BLOCKED)
PASS check-mvp22-boundaries.cjs
PASS check-my-care.cjs
PASS check-my-day.cjs
PASS check-my-home.cjs
PASS check-my-memories.cjs
PASS check-native-hardening.cjs
PASS check-privacy-recovery.cjs
PASS check-product-hardening.cjs
PASS check-product-polish.cjs
PASS check-profile-switching.cjs
PASS check-three-cognitive-games.cjs
PASS check-ux-overhaul.cjs
PASS check-visual-ux.cjs
```

After the final production status refinement, both existing auth/sync regressions, TypeScript, lint, the dedicated regression and all-platform export were rerun successfully. During harness development, fixture/loader/clock assumptions and Windows subprocess/OneDrive cleanup failures were corrected; none were reported as a PASS. PostgreSQL required permission to execute outside the restricted Windows process sandbox. The final run stopped and removed its cluster automatically.

The final export produced Android `entry-f0f98073d7b343548fb6519084836b48.hbc`, iOS `entry-aa4d8860c541b66edec39d50f0172ef0.hbc`, and web `entry-527585591aa753a3925bf34d6456a76b.js`. Existing Expo Notifications web and NO_COLOR/FORCE_COLOR warnings were observed.

Browser QA used the actual `http://localhost:8096/account` page with dotenv disabled at 360x800, 768x1024 and 1440x900. No horizontal overflow occurred; Email/Password labels and disabled unavailable-auth controls were present; Tab focused Continue offline, and Enter navigated to the local entry route. No failed application network requests were observed. The two `Local setup initialization failed` console errors (Account initialization and entry recovery) and Notifications warning are the documented web limitation: native SQLite/SecureStore are intentionally unavailable there. Native authenticated/paused screen behavior is covered by the real component/state harness, not falsely claimed as live browser or device authentication. Translation keys are complete; new non-English wording remains subject to native-speaker review like the existing draft catalog.

Run the dedicated check from this repository with installed PostgreSQL tools:

```powershell
node scripts/check-live-database-sync.cjs
# Optional installed binary directory, if different:
$env:SMARAN_PG_BIN = 'C:\Program Files\PostgreSQL\18\bin'
# Read-only hosted checks without starting a local cluster:
node scripts/check-live-database-sync.cjs --hosted-audit
```

The default command creates a uniquely named directory under `.expo/live-database-*`, starts a loopback-only cluster containing synthetic data, applies source migrations, runs fixtures and the production sync path, then removes the directory. A missing local PostgreSQL installation is a local **FAIL**, not a hosted BLOCKED. Hosted audit is read-only; its prerequisite classifier never converts unavailable migration/auth evidence into PASS. The `--restart-probe`, `--interrupt-after-push`, and `--status-probe` modes support the regression itself; they do not add an alternate application sync path.

Remaining human/live actions, in order:

1. In the hosted project's authorized SQL editor, run `select version from supabase_migrations.schema_migrations order by version;` and provide only the version list. Public client keys cannot inspect that private schema. This audit did not confirm whether the three later versions are still absent.
2. If the observed state is still only `20260912000000`, deliberately approve and deploy `20260913000000`, `20260915000000`, and `20260916000000` in order through the normal Supabase migration workflow. Preserve RLS, grants and email confirmation. Deployment is not authorized by this verification report and was not performed.
3. Make two confirmed, explicitly isolated test accounts available for hosted A/B verification through secure local configuration or native sign-in. Do not put passwords/tokens in chat or source, and do not use personal/production patient records or privileged app keys. No such identity was available for this run.
4. With current migrations and those identities, exercise the existing native app path: consent, baseline sync, offline domain writes, full runtime restart, reconnect, acknowledged push, hosted owner-scoped persistence, pull into a clean disposable local runtime, and A/B isolation. Check native SecureStore, SQLite driver behavior, cancellation, font/accessibility behavior and network transitions on Android/iOS. No hosted/native end-to-end claim is made before that execution.

Final `git status --short --untracked-files=all` (also the exact changed-file inventory):

```text
 M README.md
 M app/account.tsx
 M scripts/check-auth-cloud-hardening.cjs
 M src/cloud/sync.ts
 M src/db/repositories/sync.repository.ts
 M src/i18n/account-strings.ts
?? docs/MVP26_LIVE_DATABASE_VERIFICATION.md
?? scripts/check-live-database-sync.cjs
```

The [Expo SDK 54 reference](https://docs.expo.dev/versions/v54.0.0/) and [versioned SQLite API](https://docs.expo.dev/versions/v54.0.0/sdk/sqlite/) were read before coding. The installed Supabase SDK was inspected and executed; its [upstream auth implementation](https://github.com/supabase/supabase-js/tree/master/packages/core/auth-js) distinguishes proactive refresh failure with a still-valid access token from rejected refresh after expiry. Both cases were exercised, as was logout during refresh. No tokens or passwords were printed or persisted in task files.
