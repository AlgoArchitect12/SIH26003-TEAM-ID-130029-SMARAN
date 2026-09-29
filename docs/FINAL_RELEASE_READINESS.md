# Final technical release readiness — 29 September 2026

Baseline: `5190871e7344b9ee34065521c15ec436c0061246`, clean `main` checkout. This continues the [final hardening](FINAL_SIH_HARDENING.md); it does not supersede the pending physical-phone checks in the human QA report. No screenshots, recordings, Drive operations, UI redesign, hosted writes or deployment were performed.

**Decision: NO-GO for claiming full production/hosted completion.** Local engineering checks pass apart from the previously documented historical file allowlist assertion. Physical Android acceptance and connected-service acceptance remain outstanding. No new application defect was established in the audited local flows.

## Changes from the baseline

- Fixed the hosted migration readiness gate in `scripts/check-live-database-sync.cjs`. It previously accepted the four migrations through 16 September while source contains eight through 25 September. The false acceptance was reproduced before editing. It now derives required versions from source, rejects each individually missing migration, and still requires a verified isolated identity. No production service or migration changed.
- Corrected the moved authentication documentation link in `.env.example`.
- Corrected README delivery status: credentials alone cannot enable the disabled WhatsApp handler. Linked this current audit without replacing historical results.
- Detected a stale cached export that lacked the current public Supabase values. A clean-cache export includes both values in the final Hermes bundle; no credential was printed or changed. Clear Metro's cache when validating a changed build environment.

## Functional audit

| Area | Status and actual boundary |
|---|---|
| Activity sessions/results | PASS in regression harnesses. Patient/activity identity, telemetry, feedback, saved/recommended level and adaptation use scoped records. Transactional session/model saves reject stale patients and conflicting latest sessions. Failed saves retain the result; saved results wait for explicit navigation. Physical result/back/relaunch acceptance remains NOT VERIFIED. |
| Reports | PASS in SQLite and presentation checks. All eleven activities retain separate identities/metrics. Accuracy totals use correct/attempt counts, not a mean of percentages. Memory Match's two-card explanation is selected only for Memory Match; Pattern & Shape uses selection-attempt copy. Detail history retains its own game, level, hints and feedback. Why-level reads the requested session for the active patient and uses its activity type. Immutable 7/30-day snapshots contain aggregate facts, not every session's feedback/level or an AI explanation. Scope filtering and HTML escaping remain in place. |
| My Day | PASS local create/edit/enable/complete/remove, duplicate completion protection, persistence and scheduling failure/retry checks. Native permission and actual notification delivery remain NOT VERIFIED. |
| My Memories | PASS local media/persistence and empty/loading/error/retry checks. Patient changes invalidate loads; copied files are cleaned up on failed saves. Native picker and phone relaunch acceptance remain NOT VERIFIED. |
| My Home | PASS bundled content, regional initialization, switch recovery and error/retry checks. No network content dependency. Physical-phone recovery remains NOT VERIFIED. |
| Caregiver/navigation | PASS local profile/scoped data, contacts, recipient updates/revocation and navigation/request-guard regressions. Shared-device local profiles are not private account authentication. Remote pairing is a separate hosted boundary. |
| Async resilience | Active-patient/bootstrap, relevant list and caregiver loads have 15-second deadlines. Cloud fetches use abort/deadline and account revision guards. Native read deadlines do not cancel or repair the underlying storage operation. Existing write transactions/queues are retained. |

## Maps and location — PARTIAL / externally BLOCKED

Implemented: `react-native-maps` 1.20.1, `PROVIDER_GOOGLE`, map/marker/safe-zone circle/recenter, coordinates and freshness, foreground permission, pause/revoke, bounded location history/outbox, consent epochs, owner/caregiver scope checks and Realtime invalidation with polling fallback. Capture stops when backgrounded or the person/account changes. SQL/RLS and synthetic permission/offline/revocation checks pass.

`app.config.js` reads `GOOGLE_MAPS_API_KEY` and `GOOGLE_MAPS_IOS_API_KEY` into native configuration; JS extras contain only availability flags. Both flags are **false** in this checkout. Malformed configured keys throw; EAS builds reject a missing platform key. A local export can succeed without Maps configured. The map has a missing-key message; a syntactically valid but unauthorized key/billing restriction is not detected by that flag, and no dedicated native tile-authorization error UI is implemented. Coordinates/status remain independent of map tiles. No live map success is claimed.

Manual configuration still required:

1. Select the intended Google Cloud project, attach enabled billing and enable **Maps SDK for Android**.
2. Create an API key restricted to that API and Android application `com.smaran.ai` plus the SHA-1 of the certificate signing the installed build. Use the EAS signing certificate for a directly installed APK; use the Play app-signing certificate for a Play-distributed app. The actual signing SHA-1 was not obtained here.
3. Set `GOOGLE_MAPS_API_KEY` in the selected EAS `preview` or `production` environment; keep it out of Git. A native Maps key is distributed in the binary, so restrictions are necessary.
4. Rebuild/install the native app and verify tiles, foreground GPS, denied permission, disabled device location, offline/stale state and consent revoke with a scoped caregiver. Location sharing also requires the Supabase work below.
5. Only for iOS: enable its Maps SDK, create a separate key restricted to bundle ID `com.smaran.ai`, and set `GOOGLE_MAPS_IOS_API_KEY` before rebuilding.

References: [Expo SDK 54 Maps setup](https://docs.expo.dev/versions/v54.0.0/sdk/map-view/) and [Google Android Maps setup](https://developers.google.com/maps/documentation/android-sdk/get-api-key).

## Supabase/auth/sync — local PASS, hosted PARTIAL/BLOCKED

Local implementation: optional email/password and Google browser PKCE, exact state-bound callback validation, SecureStore session persistence and logout recovery, local/offline continuity, backup consent, durable owner-scoped outbox, bounded batch passes, capped retry delay/manual retry, transactional pull cursors and account-change cancellation. General backup excludes photo bytes and birth dates; location uses separate consent. Foreground lifecycle drives automatic sync. Real SQLite plus disposable PostgreSQL tests pass; they do not establish deployed Auth/RLS acceptance.

The ignored local environment has a URL and modern public publishable key. A fresh read-only request to hosted Auth settings returned HTTP 200. Migration history through the public API returned HTTP 406. This does **not** prove migrations are missing; it means their deployment cannot be verified with the available public access. No verified isolated owner/caregiver identities were available, so live login, push/pull, reconnect, pairing and cross-account RLS remain BLOCKED. Do not expose the private migrations schema to solve this probe limitation.

Manual configuration/validation required:

1. Confirm the intended project and obtain authorized migration visibility using the SQL editor or authenticated CLI. Read `select version from supabase_migrations.schema_migrations order by version;`. Review pending changes and recovery before applying anything; no database reset is needed.
2. Verify all eight existing migrations, in order: `20260912000000`, `20260913000000`, `20260915000000`, `20260916000000`, `20260919000000`, `20260922000000`, `20260924000000`, `20260925000000`. Verify RPC grants, owner/membership RLS and `public.location_signals` membership in `supabase_realtime`.
3. Set only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the chosen build environment. Never bundle privileged keys.
4. Enable email/password and confirmation; configure sender/SMTP/rate limits and retain `{{ .ConfirmationURL }}` in the email template. Allow `smaran-ai://auth/callback` plus the state-bearing pattern `smaran-ai://auth/callback\?state=*`; verify the returned nonce on the installed app.
5. For Google login, configure OAuth consent/audience/test users and a Web application OAuth client. Register the exact Supabase provider callback, normally `https://<project-ref>.supabase.co/auth/v1/callback`. Store its ID/secret in Supabase's Google provider settings; the secret remains server-side. This code uses browser PKCE, not a native Google sign-in SDK.
6. Use isolated confirmed owner/caregiver accounts to test login/restore/logout, backup consent, offline edits/reconnect, A/B isolation, pairing scopes/revocation and foreground location sharing. Check actual deployed function versions separately.

The assistant Edge Function authenticates through `auth.getUser`, obtains scoped context through RPC, and keeps `AI_PROVIDER`, `AI_API_URL`, `AI_API_KEY`, `AI_MODEL` server-side. Provider-backed acceptance is NOT VERIFIED; `online-ai` remains not configured. No Deno CLI validation or deployment was performed.

References: [Supabase migration workflow](https://supabase.com/docs/guides/deployment/database-migrations), [native deep links](https://supabase.com/docs/guides/auth/native-mobile-deep-linking), and [repository auth setup](history/MVP24_AUTH_CLOUD_HARDENING.md#13-external-configuration-still-required). Its historical three-migration count is superseded by the eight listed here.

## Secure report delivery — safe disabled boundary, delivery BLOCKED

The current `report-delivery` Edge Function always returns HTTP 503 with `not_configured`; it reads no records and contacts no provider. No client provider/service credentials were found. Local recipient phone normalization, patient ownership, consent/revocation and report references are checked before queueing. Queueing is not a send receipt. Native PDF sharing/email composition remains available, with device delivery unverified.

Before any automatic delivery: implement authenticated worker entry, persisted owner/patient/recipient lookup, current consent and scopes, atomic job claims, idempotent provider requests, bounded retries and verified receipts. Configure an approved WhatsApp Business template and provider credentials server-side only after that implementation. **Adding credentials alone is insufficient.** The deployed handler/version was not inspected; if an older unsafe worker is deployed, disable its triggers or replace it with the fail-closed handler before using real reports. No deployment was made here.

## Security and Android configuration

- Tracked/source secret scans found no credential-pattern matches; only `.env.example` is tracked. `.env`, `.env.local`, signing material, release binaries and generated exports are ignored. Findings are bounded to source/working-tree scans, not a certification of Git history or existing hosted deployments.
- A clean-cache diagnostic JavaScript export contained the intended public Supabase configuration and no privileged-key pattern matches. An apparent raw-byte Hermes match was traced to the SDK's `sb_secret_` prefix check adjacent to other strings, not a credential. The final clean-cache Hermes export was separately checked for the current public URL/key without logging their values.
- Inspected app diagnostics contain fixed messages, not raw tokens, contacts, coordinates or report payloads. Synthetic test records remain fixtures; no new demo data or personal files were added.
- Android identity remains `com.smaran.ai`, app version `1.0.1`, version code `2`, scheme `smaran-ai`. EAS preview produces an internal APK; production produces an AAB. Signing access and selected EAS environment were not validated.
- Expo config introspection confirms coarse/fine location, Internet and vibration declarations; background location and location foreground service are disabled. Camera/microphone, legacy storage, biometric and overlay permissions have removal directives. This is config introspection, not a final merged APK manifest inspection; notification runtime permission still needs device acceptance.
- Backup is disabled; full-backup and device-transfer exclusion configuration remains. SQLite is not encrypted with SQLCipher, and local profile switching does not provide user authentication.

## Checks in this continuation

| Command/check | Result |
|---|---|
| `npx.cmd tsc --noEmit` | PASS. |
| `npm.cmd run lint` | PASS, no warnings/errors. |
| `git diff --check` | PASS; LF/CRLF notices are not failures. |
| `node scripts/check-final-sih-hardening.cjs` | PASS. |
| `node scripts/check-regressions.cjs` | 32/35 on initial aggregate; two PostgreSQL startup restrictions, plus the existing historical allowlist assertion. |
| Elevated `node scripts/check-live-database-sync.cjs` | PASS after migration-gate change: all eight migrations, five SQL fixtures, real SQLite/PostgreSQL persistence, restart/replay, retries, isolation and RLS. Hosted checks explicitly remain blocked as above. |
| Elevated `node scripts/check-family-pairing.cjs` | PASS: SQL pairing/location, permissions/revocation, input validation and UI harness checks. |
| Combined regression outcome | **34/35 entry points pass.** `check-visual-ux.cjs` still rejects the earlier timeout changes in `active-patient.service.ts` and `with-timeout.ts` under an MVP-19A allowlist. Its contrast checks pass. Neither that assertion nor production code was changed to hide the failure. |
| `CI=1 npx.cmd expo export --platform android --clear --output-dir .expo/release-readiness-android` | PASS after authorized Hermes execution outside the sandbox: 1,874 modules, 76 assets, 6,331,860-byte Hermes bundle. Current public Supabase URL/key presence checked. This is a production bundle export, not a signed APK/AAB or physical-device acceptance. |

No browser QA was needed for this test/documentation-only change; no UI was modified. Physical Android QA remains the user's separate task.

The two temporary exports created by this continuation were removed after validation. Existing caches, regression logs and historical assets were preserved. Only the current checkout's four intended test/documentation files are included in the release-readiness commit; no old private-worktree source or private remote was accessed.

## Remaining work by submission priority

**MUST FIX BEFORE SIH SUBMISSION**

- Finish the physical-phone acceptance of the rebuilt app: routine choices, Remember Lights controls, result persistence/back behavior, Memories/Home recovery, My Day CRUD/notification permission, report summary/details and sharing, and TalkBack. The prior blocked/partial observations cannot be marked PASS by harnesses.
- If any older unsafe report worker is deployed, disable it or deploy the fail-closed replacement before processing real reports; current deployment state is unknown.
- Make the submission's feature claims match the verified scope. Connected-service claims require the external configuration and live tests below; otherwise explicitly retain PARTIAL/BLOCKED status.

**EXTERNAL CONFIGURATION REQUIRED**

- Google Cloud billing/Maps API/key restrictions and the actual signing SHA-1; selected EAS environment/signing, native rebuild and device checks.
- Supabase migration visibility/deployment, RLS/RPC/Realtime checks, email/Google settings, callback configuration and isolated live identities.
- Secure delivery worker implementation plus provider setup if automatic delivery is in submission scope; optional assistant provider setup and acceptance if claimed.

**SAFE TO DEFER**

- Automatic WhatsApp delivery and optional AI provider features while clearly unavailable; local reports and manual native sharing cover the implemented path.
- Historical MVP-19A test-boundary maintenance, with the existing 34/35 result disclosed. It is not evidence of a new product defect.
- iOS acceptance, web SQLite support, cloud photo restore and background tracking when excluded from the Android/local submission scope. No emergency tracking promise.

**NOT AN ISSUE**

- Memory Match/Pattern & Shape report-copy mixing: the existing activity-specific fix and regressions pass.
- Offline local use without an account, explicit backup consent, missing-key fallback and disabled unsafe delivery are intentional boundaries.
- Sandbox-only Hermes/PostgreSQL failures were resolved by authorized reruns; no architecture replacement or production-code workaround was necessary.
