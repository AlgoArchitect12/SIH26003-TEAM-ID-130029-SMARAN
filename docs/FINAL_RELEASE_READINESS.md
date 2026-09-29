# Final remaining-work audit — 29 September 2026

Baseline: clean `main` at `d99ec29d78cd333e1719fcba15ecda60a7b3cd95`. This sweep continues the current codebase. Historical human QA and evidence files are unchanged. No UI redesign, screenshots, video, Google Drive work, hosted mutation, provider send, deployment or signing operation was performed.

**Decision: repository checks pass; NO-GO for claiming full production/hosted acceptance.** External configuration and physical Android acceptance remain required. The user selected completion of the Meta Cloud API adapter during this sweep.

## What changed

- Added Android native-debug and production-APK EAS profiles while retaining preview APK, production AAB, explicit environments and `com.smaran.ai`.
- Hardened local report queueing: validates the selected immutable snapshot/period, checks current recipient consent/report scope/contact, rejects missing recipient updates and returns the existing intent on repeated clicks. The Reports action uses the saved report's period instead of the currently selected generation tab and confirms a request without asserting delivery.
- Fixed a reproduced notification timezone bug: the last-reconciled timezone was global, so patient A could prevent patient B's existing alarms from rebuilding after an offset change. It is now cached per patient, with a failing-before/passing-after two-patient regression.
- Implemented the optional server-side Meta Cloud API adapter, authenticated owner/cron entry, bounded payloads and requests, additive private send ledger, atomic claims, duplicate-period protection, capped rate-limit retries and signed delivery callbacks. Client receipt forgery/offline replay cannot overwrite server receipts. It remains disabled by default. Ambiguous sends are held for reconciliation, never blindly retried.
- Replaced misleading delivery test output and swallowed migration assertions with executable SQLite, worker-contract and PostgreSQL checks. Updated synthetic recipient fixtures to match actual consented phone numbers. Historical migration/config guards retain their assertions and recognize only the explicitly added profile/migration changes.
- Added [secure delivery setup and recovery](deployment/SECURE_REPORT_DELIVERY.md), server-only blank environment examples and truthful README status.

## Implementation and verification matrix

| Area | Implemented | Locally verified | External dependency | Remaining action |
|---|---|---|---|---|
| Maps/location | Google MapView, marker/zone/recenter, missing-key fallback, foreground permission/capture, pause/revoke, stale/offline status, consent epochs and bounded queue | `check-realtime-location`, `check-family-pairing`, native config checks | Google Cloud key/billing; signing; hosted location RPCs/Realtime; phone | Configure, rebuild and test tiles/GPS/permission/offline/revoke |
| Android/EAS | SDK 54; debug/preview/production APK/AAB profiles; version 1.0.1/code 2 | Config tests and clean Hermes export | EAS project access, chosen environment and signing certificate | Build current signed artifact; inspect/install it |
| Auth | Email/password, Google browser PKCE, state-bound callback, secure persistence, expiry/logout/recovery | Real installed SDK with controlled transport and SecureStore harness | Hosted Auth/email/Google OAuth and isolated identities | Live login/restore/refresh/logout/callback checks |
| Sync | Owner-scoped outbox, push/pull, backoff/manual retry, reconnect, duplicate receipts, transactional cursors, account/patient guards | Real SQLite/PostgreSQL, restart/lost-ack/replay/isolation tests | Deployed migrations/RLS and live accounts | Hosted A/B, offline/reconnect and caregiver acceptance |
| Schema | 15 ordered local migrations; nine ordered hosted migrations including private delivery ledger | Fresh/upgraded SQLite, FK checks, PostgreSQL migrations and six SQL fixtures | Authorized hosted migration visibility/deployment | Review/apply pending migrations, check RPC grants/RLS/publication |
| Secure report delivery | Scoped Meta template text adapter, auth, claims, receipt projection/HMAC, no client provider secret | SQLite queue tests, synthetic provider/webhook tests, real PostgreSQL ledger/RPC tests, Deno check | Meta account/token/template/webhook; hosted deployment; optional cron | Follow delivery guide and verify real accepted/delivered/failed cases |
| Notifications | Local permissions/channel, deterministic IDs, schedule/cancel/retry, privacy-safe content and timezone reconciliation | `check-my-day`, `check-daily-voice`, native config tests | Installed Android/iOS notification APIs and device settings | Phone permission, sound, firing time, timezone/DST, restart/cancel checks |
| Caregiver/reports | Local profiles/scopes, separate hosted pairing, factual 7/30-day snapshots, scoped PDF/email/share | Care Circle/report SQL and service/component harnesses | Native sharing/mail; hosted remote pairing | Device sharing and remote owner/caregiver/revoke tests |
| Cognitive/results | Eleven activities; scoped persistence/adaptation; Back/gesture/late-save protection | Existing cognitive/final-hardening regression entry points | Physical Android | Confirm result visibility, relaunch, controls and TalkBack |
| My Day/Memories/My Home | Existing CRUD/media/bundled regional content; bounded reads and retry | Existing SQLite and component regressions | Native picker/storage/notification behavior | Recheck historical blocked/partial human flows |
| Persistence/privacy | Transactional SQLite, SecureStore session banks/logout intent, backup exclusion | Migration/auth/privacy/native regressions | Native storage and final merged manifest | Device restore/relaunch; SQLite remains unencrypted, local profile switch is not authentication |
| Assistant functions | Authenticated scoped context and server-side optional provider; separate `online-ai` stays disabled | Existing contract tests and Deno checks | Hosted provider secrets/configuration and acceptance | Configure only if claimed in submission |
| Error/loading/retry | Existing 15-second read/cloud deadlines, request guards, failure/retry UI | Existing final-hardening/auth/sync/UI harnesses | Native I/O faults, phone QA | Storage deadlines do not cancel or repair stalled native operations |

Existing routine labels, loading recovery, cognitive saves, result navigation, report activity mapping and My Day guards were retained. Only the reproduced cross-patient timezone defect changed reminder scheduling.

## Maps and Android configuration

`react-native-maps` remains **1.20.1** with `PROVIDER_GOOGLE`, matching [Expo SDK 54](https://docs.expo.dev/versions/v54.0.0/sdk/map-view/). `app.config.js` injects `GOOGLE_MAPS_API_KEY` into `android.config.googleMaps.apiKey`, and the optional iOS key into native iOS config. JS extras contain availability flags only. Both flags are **false in this checkout**. Invalid configured keys and missing platform keys on EAS builds are rejected. Android export succeeding does not validate map authorization.

Foreground coarse/fine location is configured; background location and the location foreground service are disabled. Native config tests inspect backup exclusions and blocked camera/microphone/storage/biometric/overlay permissions. Final APK manifest and actual notification permission behavior still need native acceptance.

Manual Google Cloud work:

1. Select the intended project, attach enabled billing and enable **Maps SDK for Android**.
2. Create a key restricted to that API and Android package **`com.smaran.ai`**, with the SHA-1 of the certificate signing the installed app. Direct EAS APK and Play app-signing certificates can differ; debug builds use a debug certificate.
3. Set `GOOGLE_MAPS_API_KEY` in the profile's selected EAS environment (`development`, `preview` or `production`). Set it with suitable restricted visibility; native keys are distributed in binaries and require API/application restrictions. Local ignored environment files are not the remote EAS environment.
4. Rebuild/install. Verify map tiles, foreground GPS, disabled/denied permission, paused sharing, stale/offline coordinates, scoped caregiver access and revoke. An availability flag does not detect a wrong SHA-1, unauthorized SDK or disabled billing; no native tile-authorization success is claimed.
5. Only for iOS, configure its SDK and separate bundle-restricted key before its build.

## Exact EAS/build handoff

The existing package, owner and project ID were preserved. Profiles are explicit; local version management remains in `app.json` and `package.json`. Keep this candidate at 1.0.1/code 2 unless that code is already published; increment to a new unused Android version code before a subsequent store upload. No signing credentials were invented or inspected for secret values.

| Purpose | Command | Artifact/environment |
|---|---|---|
| Native Android debug | `npx eas-cli build --platform android --profile development` | Debug APK, `development`, standard debug signing; no expo-dev-client dependency/launcher |
| Metro for debug app | `npx expo start --localhost` | Development server; use the installed debug app and usual Android USB/emulator connection |
| Preview installation | `npx eas-cli build --platform android --profile preview` | Internal release APK, `preview` |
| Production APK | `npx eas-cli build --platform android --profile production-apk` | Internal release APK, inherits `production` environment |
| Production AAB | `npx eas-cli build --platform android --profile production` | Store bundle, `production` |
| JS production validation | `npx expo export --platform android --clear --output-dir .expo/remaining-work-android` | Hermes/assets only; no native signature |

Before EAS builds: sign in with access to the existing project, confirm that project, configure its environment values, and select/authorize the intended Android keystore through EAS. Obtain its SHA-1 and configure Maps. Never commit downloaded signing files. Production/preview credentials have not been verified here. Windows local EAS builds are not the supported production path; use EAS cloud or a supported build host ([Expo local-build guidance](https://docs.expo.dev/build-reference/local-builds/)).

**Fresh signed artifact: unavailable.** No current signed APK/AAB was built in this sweep. Ignored historical APKs exist dated 23–26 September; they predate this source and do not prove current acceptance. The ignored generated `android/` folder is also older and was not rewritten. EAS uses the tracked managed config; do not treat the stale local native folder as a current manifest/build verification.

## Hosted Supabase handoff

Read-only audit: public Auth settings returned **HTTP 200**; migration-history probing through the public API returned **HTTP 406**. This is unavailable migration visibility, not proof that deployment is missing. No verified isolated test owner/caregiver accounts were available. Hosted login/push/pull/reconnect/RLS remain **NOT VERIFIED**.

1. Confirm the project and inspect migration history through authorized SQL/CLI access. Do not expose the private migrations schema to the public API. Review deployment/recovery before applying any pending changes.
2. Required source order: `20260912000000`, `20260913000000`, `20260915000000`, `20260916000000`, `20260919000000`, `20260922000000`, `20260924000000`, `20260925000000`, **`20260929000000`**. The ninth migration is the new secure report worker. Verify owner/membership RLS, RPC grants and `location_signals` in `supabase_realtime`.
3. Configure only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the chosen client environment. Privileged keys stay server-side.
4. Enable email/password/confirmation and configure SMTP/sender/rate limits. Retain `{{ .ConfirmationURL }}`. Allow `smaran-ai://auth/callback` and its state-bearing callback pattern; validate the nonce on the installed app.
5. Configure Google OAuth consent/audience/test users and the Web OAuth client in Supabase's provider settings, with the exact project callback (normally `https://<project-ref>.supabase.co/auth/v1/callback`). This application uses browser PKCE, not a native Google sign-in SDK.
6. Test isolated confirmed owner/caregiver accounts: sign in/restore/refresh/sign out, offline local continuity, explicit backup consent, push/pull/reconnect, A/B isolation, pairing scopes and revocation, foreground location and receipts. No hosted success is inferred from disposable PostgreSQL.
7. Deploy/verify the intended functions separately. For delivery, follow [the server setup guide](deployment/SECURE_REPORT_DELIVERY.md); for the optional assistant, configure `AI_PROVIDER`, `AI_API_URL`, `AI_API_KEY`, `AI_MODEL` only on the server.

## Validation evidence from this sweep

| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npm run lint` | PASS, no warnings/errors |
| `git diff --check` | PASS; Git line-ending notices are informational |
| `node scripts/check-final-sih-hardening.cjs` | PASS |
| `node scripts/check-report-delivery.cjs` | PASS; actual SQLite queue + synthetic Meta/webhook contracts |
| `node scripts/check-live-database-sync.cjs` | PASS outside sandbox: nine migrations, six SQL fixtures, real SQLite/PostgreSQL/RLS, restart/replay/isolation |
| `node scripts/check-regressions.cjs` | PASS: 35/35; logs and machine-readable results in ignored `.expo/regressions/` |
| `npx --yes --package deno deno check --no-lock --node-modules-dir=none supabase/functions/report-delivery/index.ts supabase/functions/ai-care-assistant/index.ts supabase/functions/online-ai/index.ts` | PASS, all three entry points; no dependency manifest/lockfile changes |
| Android clean production export | PASS: 1,874 modules, 76 assets, 6.33 MB Hermes bundle in `.expo/remaining-work-android` |
| Source secret scans | PASS in auth/live-database regressions; path/type-only findings, no secret values logged |
| Generated Android bundle configuration | Configured public Supabase URL/key present; no known private local environment values detected; Maps remains unconfigured |
| Signed APK/AAB | NOT PRODUCED from current source |
| Hosted provider/native acceptance | NOT VERIFIED |

Initial sandbox run: 33/35; PostgreSQL startup was denied for two entry points. The elevated run exposed the exact new-migration history guard and concurrently generated browser QA directory, not application failures. The guard was updated without removing comparisons, generated browser artifacts were removed, and the clean aggregate rerun passed all 35 checks. Final review also verified orphaned recipients and revoked retry jobs become terminal without consuming another send attempt or blocking later queue entries.

Browser QA: `http://localhost:8102/caregiver/reports`, 390×844 and 1440×900, no screenshots. The actual app reaches its existing saved-setup recovery screen because web SQLite is unsupported. Retry works; no horizontal overflow; Retry height 60 px; three resources returned HTTP 200. Console: expected local setup errors and Expo Notifications web warning. **Reports content and delivery were not browser-verified.** Native/component tests are recorded separately; no fake web storage or auth bypass was added.

## Exact remaining tasks before submission

1. **Google Cloud:** billing, Android Maps SDK, restricted key, package/certificate SHA-1 and selected EAS environment.
2. **EAS/signing:** authorized project/signing access, current native APK/AAB build, final manifest inspection and installation. Historical binaries are not current evidence.
3. **Hosted Supabase:** inspect/review/apply required migrations; verify RLS/RPC/Realtime and email/Google settings with isolated identities.
4. **Meta/provider:** account/sender/token, approved template/language/API version, server secrets, function deployment, signed webhook, optional queue cron and genuine delivery acceptance. Disable any older unsafe sender. No messages were sent here.
5. **Physical device:** recheck the historical partial/blocked flows: Routine Recall labels, Remember Lights controls, every activity result/back/relaunch, Memories/Home recovery, My Day CRUD/permission/sound/timezone/cancellation, Reports/PDF/email, Maps/GPS/offline/revoke and TalkBack.
6. **Submission claims:** retain PARTIAL/NOT VERIFIED for connected/native features until those checks pass. Automatic recurring report generation, background/emergency tracking, cloud photo restore and web SQLite remain outside the implemented scope; no new claim was introduced.

The remaining external items are not replaceable with test doubles, invented keys, fabricated receipts or another JavaScript export.
