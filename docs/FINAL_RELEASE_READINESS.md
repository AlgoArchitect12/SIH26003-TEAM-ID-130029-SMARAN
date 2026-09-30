# Dependency/security remediation — 30 September 2026

Baseline: clean `feature/prd-completion` at `23c0b529a370fc5e7d0437368c5b2c45c9d8d06b`. This section supersedes the historical dependency counts below. Expo SDK **54.0.37**, React Native **0.81.5**, React **19.1.0**, all direct dependency declarations and product behavior remain unchanged. The versioned [Expo SDK 54 compatibility contract](https://docs.expo.dev/versions/v54.0.0/) and installed callers were reviewed before choosing fixes.

**Improved, not vulnerability-free; full production acceptance remains NO-GO.** `npm audit --json` changed from **21 affected package entries (4 high, 17 moderate)** to **17 (1 high, 16 moderate)**, with zero critical/low entries in either report. These counts include inherited findings, not 21 distinct vulnerabilities: **14 unique GHSA IDs before, 4 after**. Ten unique advisories were fixed: five high, four moderate and one low. The navigation-core update additionally removes one moderate inherited package finding for GHSA-vcc3-ghjq-m6fr; that advisory remains installed through Router. Other moderate fixes belonged to packages classified at their highest severity.

## All 21 baseline package findings

Versions are the installed baseline versions, including packages flagged only through a vulnerable descendant. Every package is used by the app or its build/lint tooling; an npm production dependency is not necessarily shipped JavaScript. The Android export source map includes `decode-uri-component` and `query-string`, and excludes `image-size`, `uuid`, `xcode`, `brace-expansion`, `postcss` and `undici`.

| PACKAGE (BASELINE VERSION) | SEVERITY | DIRECT/TRANSITIVE | FIX AVAILABLE | PRODUCTION IMPACT | ACTION |
|---|---|---|---|---|---|
| `brace-expansion` 1.1.18 / 2.1.4 / 5.0.9 | High | Transitive | 1.1.21 / 2.1.7 / 5.0.12 cover all reported IDs | Minimatch/glob in Expo and ESLint; build/lint DoS, absent from Android bundle | **FIXED**, five copies updated within existing parent ranges |
| `image-size` 1.2.1 | High | Transitive | 2.0.3; no fixed 1.x release found | Metro parses repository/dependency image assets during builds; absent from Android runtime | **NO SAFE FIX** verified for SDK 54; 2.0.3 broke real export and was reverted |
| `postcss` 8.4.49 | High | Transitive | 8.5.23 covers all reported IDs | Expo CSS tooling: source-map disclosure/XSS; absent from Android bundle | **FIXED**, exact override scoped to `@expo/metro-config@54.0.17`; Expo's `~8.4.32` otherwise blocks the fix |
| `undici` 6.28.0 | High | Transitive | 6.28.1 | Expo CLI HTTP/WebSocket tooling; absent from Android bundle | **FIXED**, smallest fixed patch within CLI's `^6.18.2` range |
| `decode-uri-component` 0.2.2 | Moderate | Transitive | 0.5.0, ESM-only | Bundled query parser; malformed attacker-controlled URI data can block JS | **NO SAFE FIX** verified as a drop-in for the existing CommonJS caller; retained, not dismissed as tooling |
| `query-string` 7.1.3 | Moderate | Transitive | Patched decoder only outside `^0.2.2`; no patched 7.x release found | Used by Router/navigation; inherits decoder risk | **NO SAFE FIX** verified without replacing the caller contract |
| `@react-navigation/core` 7.21.13 | Moderate | Transitive | 7.22.1 removes its query-string dependency | Bundled navigation parser; malformed-query DoS path | **FIXED** this dependency path within native's `^7.21.13` range; Router's separate decoder path remains |
| `uuid` 7.0.3 | Moderate | Transitive | 11.1.1; outside Xcode's `^7.0.3` | Xcode build tooling calls only `v4()` without output buffer; affected `v3/v5/v6` path not used; absent from Android bundle | **ACCEPTED RISK** for this checkpoint; no unnecessary four-major override |
| `xcode` 3.0.1 | Moderate | Transitive | No newer release found; requires UUID parent fix | iOS project tooling, inherited UUID finding | **ACCEPTED RISK**, retain SDK-compatible tooling |
| `@expo/config-plugins` 54.0.5 | Moderate | Transitive | No compatible UUID-chain fix verified | Native config tooling → Xcode → UUID | **ACCEPTED RISK**, inherited UUID finding |
| `@expo/config` 12.0.14 | Moderate | Transitive | Same UUID-chain constraint | Build config → config-plugins | **ACCEPTED RISK**, inherited UUID finding |
| `@expo/metro-config` 54.0.17 | Moderate | Transitive | PostCSS fixed; UUID-chain finding remains | Build tooling → config | **FIXED** PostCSS path; **ACCEPTED RISK** inherited UUID path |
| `@expo/prebuild-config` 54.0.9 | Moderate | Transitive | Same UUID-chain constraint | Prebuild tooling → config/config-plugins | **ACCEPTED RISK**, inherited UUID finding |
| `@expo/cli` 54.0.27 | Moderate | Transitive | Undici fixed; UUID-chain finding remains | CLI → config/prebuild/Metro | **FIXED** undici path; **ACCEPTED RISK** inherited UUID path |
| `expo` 54.0.37 | Moderate | Direct | Audit proposes 57.0.26, outside SDK 54 | SDK used at runtime; reported issue originates in build-time UUID chain | **ACCEPTED RISK**, preserve SDK 54 |
| `expo-asset` 12.0.13 | Moderate | Direct | Audit proposes 57.0.18, outside SDK 54 | Runtime assets; finding inherited through constants/config | **ACCEPTED RISK**, no vulnerable UUID API in Android path |
| `expo-constants` 18.0.14 | Moderate | Direct | Audit proposes 57.0.20, outside SDK 54 | Runtime constants; finding inherited through build config | **ACCEPTED RISK**, preserve native compatibility |
| `expo-linking` 8.0.12 | Moderate | Direct | Audit proposes 57.0.11, outside SDK 54 | Runtime links; this package's finding inherits constants/config UUID chain | **ACCEPTED RISK** for UUID path; decoder risk separately retained |
| `expo-notifications` 0.32.17 | Moderate | Direct | Audit proposes 57.0.21, outside SDK 54 | Runtime notifications; finding inherited through constants/config | **ACCEPTED RISK**, preserve native compatibility |
| `expo-router` 6.0.24 | Moderate | Direct | Audit proposes downgrade to 5.1.11; not a safe SDK-54 remedy | Router runtime plus inherited UUID and bundled decoder paths | **ACCEPTED RISK** for UUID; **NO SAFE FIX** verified for decoder; preserve Router 6 |
| `expo-splash-screen` 31.0.13 | Moderate | Direct | Audit proposes 57.0.9, outside SDK 54 | Runtime splash; finding inherited through prebuild/config UUID chain | **ACCEPTED RISK**, preserve native compatibility |

## Exact advisories fixed

| Package | Severity | Advisory |
|---|---|---|
| brace-expansion | High | [GHSA-qhr7-859c-m2p7](https://github.com/advisories/GHSA-qhr7-859c-m2p7): nested-brace stack exhaustion |
| brace-expansion | High | [GHSA-6j4f-fj2g-mc7p](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p): comma-parser stack exhaustion |
| brace-expansion | Moderate | [GHSA-q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr): quadratic rewrite DoS |
| postcss | High | [GHSA-6g55-p6wh-862q](https://github.com/advisories/GHSA-6g55-p6wh-862q): source-map arbitrary file disclosure |
| postcss | High | [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849): source-map path traversal |
| postcss | Moderate | [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93): CSS stringify XSS |
| postcss | Moderate | [GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp): map disclosure when `from` is absent |
| undici | High | [GHSA-rfgv-xxqx-mfg5](https://github.com/advisories/GHSA-rfgv-xxqx-mfg5): unrequested WebSocket subprotocol DoS |
| undici | Moderate | [GHSA-3wwx-pv8p-q78v](https://github.com/advisories/GHSA-3wwx-pv8p-q78v): WebSocket decompression error DoS |
| undici | Low | [GHSA-r53p-7pc4-xj5r](https://github.com/advisories/GHSA-r53p-7pc4-xj5r): retry-interceptor response splitting |

Navigation core **7.21.13 to 7.22.1** also removes its dependency on the vulnerable parser ([upstream release](https://github.com/react-navigation/react-navigation/releases/tag/@react-navigation%2Fcore@7.22.1)). The source diff preserves existing navigation APIs, adds a compatible render API and replaces query parsing. Installed-library tests cover valid/duplicate/flag parameters, link round trips and a 60,000-character malformed query in a child process with a 10-second deadline. This fixes the core path of GHSA-vcc3-ghjq-m6fr; it does not remove the GHSA from the whole tree.

## Retained advisories and exact reasons

- **NO SAFE FIX — image-size:** [GHSA-5p2g-fcmc-qvqq](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq) (JXL/HEIF loops) and [GHSA-w3rx-r6r6-pgpr](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr) (ICNS loop), both high. Tested 2.0.3: Buffer sizing works, but Metro 0.83.3 `getAssetData()` also passes file-path strings. The fixed major removed synchronous file-path support. Two clean Android exports failed on Router's `unmatched.png` with a `TextDecoder.decode` argument error; reverting only this override restored export. Keep build inputs trusted/reviewed. This is a build-time risk, not parsing of patient photos by shipped Android JS. Revisit an upstream 1.x backport or separately validated Metro/SDK upgrade; no permanent local fork was introduced.
- **NO SAFE FIX — decoder:** [GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr), moderate, remains in `decode-uri-component`, `query-string` and Router; navigation core's path is fixed. Version 0.5.0 exports an ESM default; query-string 7.1.3 requires and invokes the module as a CommonJS function. An isolated check confirmed that direct invocation throws `TypeError`. New query-string majors also change module format. Navigation core is now fixed, but Router still declares query-string, so the vulnerable dependency remains installed. The source map confirms the decoder is bundled; actual exploitability of every app link path is not established. **Only the navigation-core parser path is fixed; no claim of complete runtime mitigation or production acceptance.** Revisit a compatible upstream decoder/query-string backport or a separately tested Router/navigation upgrade.
- **ACCEPTED RISK — UUID:** [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq), moderate. Xcode 3.0.1 is the only UUID parent and calls `uuid.v4()` with no caller buffer. The advisory concerns `v3/v5/v6` buffer bounds. UUID/Xcode are absent from the Android bundle. Fixed 11.1.1 is outside the declared 7.x contract; replacing four majors solely to clear inherited Expo findings is unnecessary for the observed path. Retained without an audit suppression; revisit when Xcode/Expo adopt a compatible fix. This scoped checkpoint assessment is not full production sign-off.

## Validation and dependency integrity

- `npm install`: PASS; final install preserves the reviewed lock. npm reports the existing `unrs-resolver` postinstall as unapproved; no script permission was broadened.
- `npx expo install --check`: PASS, dependencies up to date; `npm ls --all --json`: PASS, no invalid dependency graph.
- `npx tsc --noEmit`, `npm run lint`, `git diff --check`: PASS; no lint warnings/errors.
- `node scripts/check-final-sih-hardening.cjs`: PASS. `node scripts/check-regressions.cjs`: **36/36 PASS** on the final dependency set, including the new dependency-security check and the existing helper-only entry point. Auth/live-database source secret scans, ignored-credential checks and disposable PostgreSQL regressions PASS; no private credentials detected in scanned source. Existing hosted/device acceptance limitations remain.
- `node scripts/check-dependency-security.cjs`: PASS. Confirms exactly eight changed lock entries, unchanged remaining metadata/direct dependencies, correct registry URLs/integrities, PostCSS rejection of implicit/out-of-directory map reads, working legitimate maps/CSS, Metro's real file-path asset API and the patched navigation parser. Isolated old 8.4.49 reads the synthetic map; 8.5.23 rejects it.
- Historical dependency guards now first assert the **entire current manifest/lock equals baseline plus the exact reviewed security delta**, then retain their previous milestone comparisons. No blanket dependency exemption or weaker security assertion was added.
- `npx expo export --platform android --clear --output-dir .expo/security-remediation/android --source-maps`: PASS, **1,893 modules, 76 assets, 4.26 MB Hermes bundle**. Final sandbox attempt was denied permission to execute Hermes; the permitted rerun passed. Source map used only for dependency reachability; ignored local output, not a signed APK/device test.
- Only five brace-expansion copies, PostCSS, undici and navigation core changed in the lock; no added/removed packages, package substitutions, install scripts or unrelated dependency churn. Each changed entry retains the official npm registry origin and reviewed integrity. No secrets or credentials were introduced in the changed files.
- Audit JSON, source map and diagnostic logs are local ignored files under `.expo/security-remediation/`; regression logs are under `.expo/regressions/`. No artifacts or environment files are committed.

## Scope and delivery boundaries

- **FIXED:** the ten advisory IDs above plus the navigation-core path of the retained decoder advisory; SDK-54-compatible tooling and navigation updates.
- **ACCEPTED RISK:** unused vulnerable UUID APIs and their inherited build-tool findings, scoped as above.
- **NO SAFE FIX:** the image-size and decoder updates described above remain unresolved; no advisory is hidden or suppressed.
- **EXTERNAL:** signing/Maps/hosted Supabase/provider configuration, language review and physical-device acceptance remain pending as documented below. This pass performs no hosted mutation, deployment or provider send.
- **NOT IMPLEMENTED:** LAN/mDNS/Bluetooth peer synchronization and heritage soundscapes remain absent. No assets or transport were fabricated; UI and PRD product scope are unchanged.
- Delivery remains limited to the authorized commit `chore: remediate release dependency security findings` and `public-sih feature/prd-completion`. `main` remains at `e783167ac8178d451df5fb886dc95e617fb6d2f0`. No Google Drive or old private-repository access. Final commit/push outcome is reported in the task response.

---

# Historical PRD completion update — 30 September 2026

Baseline `e783167ac8178d451df5fb886dc95e617fb6d2f0`; branch `feature/prd-completion`. This update supersedes the older microphone, migration-count and native-debug-build statements below. The 29 September audit is retained as dated history.

**Repository implementation is ready for device acceptance; full production/PRD acceptance remains NO-GO.** See the [complete PRD matrix](PRD_IMPLEMENTATION_MATRIX.md) for all eleven capabilities, metric definitions, privacy and rollout recovery.

## Changes and boundaries

- Added confirmed dialing of the user's saved emergency contact, local voice-memory recording/playback/retry/delete, on-demand local battery status and today's actual routine-completion percentage. Existing activity response-latency history is retained. Read-aloud controls no longer overlap timed visual previews; scoring and game engines are unchanged.
- Added local migration 016, preserving 001–015 and existing data. Audio references and bytes stay outside the explicit cloud allowlist. New copy uses the existing localization catalogs with an explicit English fallback pending human review.
- Preserved the server-side report-delivery boundary, consent/scopes, claims, idempotency, bounded retries and signed receipts. No provider message, hosted mutation or deployment was performed.
- Local LAN/mDNS/Bluetooth synchronization and heritage soundscapes are **NOT IMPLEMENTED**. Remote battery and longitudinal routine-adherence percentages are also absent. Emergency dispatch, clinical interpretation and universal Assamese/Indian-English voice availability are **NOT SAFE TO CLAIM**.

## Current validation

| Check | Current result |
|---|---|
| `npx tsc --noEmit`, `npm run lint`, `git diff --check` | PASS; lint has no warnings/errors |
| `node scripts/check-final-sih-hardening.cjs` | PASS, including confirmed dialer, battery boundaries and recording controls/retry/delete/background |
| `node scripts/check-regressions.cjs` | **35/35 PASS**; ignored logs/results in `.expo/regressions/` |
| Voice-memory storage | Real SQLite/files: restart, text-edit preservation, isolation, path rejection, rollback/retry, replacement/delete and cloud exclusion |
| Routine/latency/report/privacy | Existing analytics, My Care/My Day, cognitive, delivery, auth and real local PostgreSQL regressions PASS |
| Android clean production export | PASS: 1,892 modules, 76 assets, 6.39 MB Hermes; `.expo/prd-completion-android` |
| Source secret scans | PASS in auth/live-database checks; changed-source review found no private credentials or real patient fixtures |
| `npm audit --json` | 21 advisories: 17 moderate, 4 high, 0 critical; unresolved |
| Production-signed APK/AAB | NOT PRODUCED; debug artifact described below |

An earlier overlapping-build run had two 180-second child-process timeouts and passed 33/35; the isolated rerun passed all 35, without increasing timeouts or weakening assertions. Historical dependency checks now admit only the exact SDK-compatible audio/battery/asset additions, verify the unchanged hoisted asset dependency, and continue comparing other dependencies/configuration. Tests exercise real SQLite/files and synthetic native/provider boundaries; they do not demonstrate physical microphone, dialer, battery or delivery behavior.

Browser QA used the actual `/patient/my-memory` route at 390×844 and 1440×900, with no screenshots/video. Web SQLite is intentionally unsupported, so the app displayed saved-setup recovery. Retry responded and returned to that recovery state; no horizontal overflow; accessible Retry button height 60 px; all three resource requests returned HTTP 200. Console contained the expected local-setup error on load/retry and Expo Notifications web warning. **Feature screens, native recording and OS APIs were not browser-verified.** No storage/auth bypass was added. Automatically generated browser text logs were removed from the worktree after inspection.

Dependency advisories include high findings in `brace-expansion`, `image-size`, `postcss` and `undici`, plus moderate Expo/navigation/transitive findings. No automatic dependency upgrade was applied: resolving these requires a separately validated compatible dependency update. Source-secret checks passing does not mean the dependency tree is vulnerability-free.

Android native debug build: **PASS**, `:app:assembleDebug`, 353 tasks (105 executed, 248 up-to-date). The ignored artifact is `android/app/build/outputs/apk/debug/app-debug.apk`. APK inspection confirmed `com.smaran.ai`, version 1.0.1/code 2, min SDK 24/target 36, microphone permission, and linked Audio/Battery modules. No `CALL_PHONE`, camera, broad external-storage or foreground-microphone permission. The debug variant includes development overlay permission; the audio library contributes media-playback foreground-service permissions, while app recording/playback disables background use. This debug APK is not a production-signed release artifact.

The existing ignored Android folder was used for the local build; its old microphone-removal marker was corrected locally. Managed `app.json` is the tracked source of native configuration. Machine-specific `android/local.properties` was preserved and remains ignored/untracked. Generated native files, APKs, export output and test logs are excluded from the commit.

## Remaining acceptance and external work

1. Install a rebuilt native app and verify microphone denial/grant, record/stop/5-minute limit, playback/pause/stop, save failure/retry/discard, delete, relaunch, background interruption and patient switching. Unsaved cache recordings can be lost on process death; no recovery after process death is promised.
2. Verify saved-contact confirmation/cancel and OS dialer handoff, real battery/unknown states, read-aloud/preview timing, routine refresh across midnight, supported voices and TalkBack on a physical Android device.
3. Configure authorized production signing/EAS access and Maps billing/key/package/certificate restrictions; build and inspect a production APK/AAB. No production keystore was invented or inspected.
4. Verify hosted Supabase migration/RLS/RPC/Realtime and Auth setup with isolated accounts. Configure Meta sender/template/server secrets/function/webhook only through the existing [delivery guide](deployment/SECURE_REPORT_DELIVERY.md), then perform separately authorized real acceptance.
5. Obtain human language review and approved licensed heritage audio. Local peer synchronization needs a separately scoped authenticated transport and conflict/revocation design.
6. Resolve or assess the 21 dependency advisories before production release, retaining Expo SDK compatibility and rerunning affected checks.

Delivery is limited to `feature/prd-completion` on `public-sih`; no merge into `main`. Git commit/push identifiers are reported in the final task response. No Google Drive/private-remote access, screenshots or video were used.

---

# Historical remaining-work audit — 29 September 2026

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
