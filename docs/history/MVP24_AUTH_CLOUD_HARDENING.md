# MVP-24: authentication and cloud sync hardening

Workspace: `C:\Users\Dharmin\OneDrive\Desktop\SMARAN-A`

Branch: `feature/mvp24-auth-cloud-hardening`

Base: `045519e37b80a95ead102c299feca507e92a4d74`

Validation date: 2026-09-16. No commit, merge, tag, APK build, migration deployment, live account creation, or live patient database mutation.

## 1. Existing architecture

MVP-22 already used the installed Supabase JS 2.116.0 client, Expo SDK 54, PKCE, native WebBrowser/Linking, a chunked SecureStore adapter, and a Zustand account revision. SQLite is the local source of truth. Triggers capture immutable, account/patient-owned outbox mutations in the same transaction as domain writes. Authenticated RPC pushes precede validated transactional pulls. MVP-23 adds Care Circle, reports, and report preferences to that existing protocol. Patient bootstrap does not depend on Auth.

## 2. Gaps found and addressed

- Signup did not supply a native email confirmation redirect; callback handling lacked an app-attempt state and surfaced only generic errors.
- Cached session restoration did not explicitly verify the user with the Auth server before enabling cloud work.
- Google provider availability was discovered too late, after browser handoff.
- Account errors/statuses and most regional account strings used generic English copy.
- A persistent default owner silently associated later local profiles, even after logout. Backup participation could not be paused.
- Eight network failures could permanently stop automatic retries. Null acknowledgement entries were not explicitly validated.
- Additional guards were needed for overlapping restoration, logout, browser callbacks, and late auth-action completion.

## 3. Email signup

The real SDK `signUp` receives a trimmed, validated email, a password of 8–128 characters, and a state-bound `emailRedirectTo`. A valid returned session means signed in; a returned user without a session means confirmation required. Missing/malformed successful responses cannot manufacture a session. Invalid email, weak password, known duplicate email, rate limit, unconfirmed email, network, and server errors map to fixed translated messages. Passwords are neither logged nor persisted.

Supabase may deliberately obscure an already-registered confirmed email with a user-shaped response. That response stays unauthenticated and receives the neutral check-email instruction; the app cannot truthfully assert account creation or email delivery. Explicit duplicate errors instruct the user to sign in. An already confirmed user can use ordinary password sign-in.

## 4. Email confirmation

The existing root Linking lifecycle consumes the actual native URL. The Router callback screen returns to Account, where the store exposes confirmation/error status. Email confirmation now uses the same real PKCE exchange as OAuth. Query and fragment verification errors are mapped without displaying provider descriptions. Expired, malformed, duplicate-parameter, wrong-route, wrong-state, token-bearing, and oversized URLs are rejected. A link opened on another installation cannot complete this installation's PKCE flow; after confirmation, password sign-in remains the recovery path.

## 5. Email login

Real `signInWithPassword`, loading/disabled controls, readable errors, secure persistence, and known identity before sync. Existing login passwords are not subjected to the new-signup minimum. Email autofill and current/new-password manager semantics explicitly override the shared field's patient/contact defaults.

## 6. Session restoration

Secure storage hydrates before the SDK is constructed. `getSession` handles necessary refresh; `getUser` then verifies the user ID against the stored session before restored cloud identity is accepted. Offline restoration retains secure material, exposes network-unavailable status, and leaves patient entry independent. SecureStore read/write/corruption failures are distinct from a missing session. Revoked or rejected refresh credentials stop cloud access and show session expired. Revalidation occurs on foreground entry and retry after a network failure; overlapping validation is serialized.

## 7. Logout

Logout invalidates the account revision and auth operation, aborts active cloud requests, stops token refresh, clears transient account/sync state, records durable logout intent, invokes real SDK local-scope sign-out, and explicitly clears secure session/PKCE/state material. Late auth actions cannot restore identity or overwrite the new account's busy/error state. No patient/domain deletion occurs. Local records, active-patient selection, reminders, memories, games, Care Circle, reports, and owner-bound queues survive.

## 8. Offline logout

Local sign-out completes even if remote revocation is unreachable and reports that limitation. Existing remote access tokens are not claimed revoked. Secure deletion failures retain a durable logout marker and a storage-error recovery state; restart/retry completes the requested sign-out. Server-side token revocation still requires server contact.

## 9. Account A/B isolation

Every queue, cursor, applied version, and remote record remains scoped to its original owner. Account B cannot send A's queued patients, Care Circle records, or report preferences. Incoming ownership conflicts and patient identity collisions fail rather than reassign data. Returning A resumes only A's work. New local profiles remain unowned until the explicit include/enable action.

Same-device privacy is unchanged: SQLite profiles, including records previously downloaded by A, remain local and visible to people using this unlocked installation. This is **not** a private per-account local vault. Cloud ownership is independent of local visibility. Use separate secured devices when local privacy between household users is required.

## 10. Google architecture

Reuse Supabase's browser provider architecture: public settings check → `signInWithOAuth` → Expo `openAuthSessionAsync` → validated callback → `exchangeCodeForSession`. No native Google SDK, additional dependency, local fake account, or app-embedded Google secret was added.

## 11. PKCE, state, and callback validation

The installed SDK generates S256 PKCE using the existing native crypto bridge. Each attempt also stores a 32-byte random return-state nonce and deadline in SecureStore: 10 minutes for Google, 24 hours for email. This app return-state is separate from the Google-to-Supabase OAuth state that Supabase validates server-side. One current app attempt is supported; beginning another replaces the prior callback state.

Before opening a browser, the app checks the exact Supabase origin, `/auth/v1/authorize`, provider, redirect, S256 method, and challenge shape. Before code exchange, it requires the exact raw `smaran-ai://auth/callback` route, allowed unique parameters, matching stored state, unexpired attempt, and existing secure verifier. No access/refresh token callback is accepted. Duplicate delivery of the same callback is coalesced; successful replay does not exchange twice. Cancellation clears the active state/verifier. Logout clears all stored SDK flow slots too.

## 12. Provider not configured

Absent app config or a disabled/missing Google provider yields “Google sign-in is not configured.” A failed/malformed settings response yields network/cloud-unavailable feedback, not a fabricated provider status. The public `/auth/v1/settings` contract is verified against the Auth server's OpenAPI source.

## 13. External configuration still required

These steps are for a separately authorized staging/native test; none were performed against the hosted project here.

1. Set only `EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>` in ignored local/build configuration. The client accepts modern public publishable keys only.
2. Ensure the three existing Supabase migrations are present in the staging project. Keep their RPC-only writes and owner RLS policies. No new cloud migration is needed.
3. Enable email/password auth and confirmation, configure sender/SMTP and rate limits, and verify the confirmation email template uses the generated `{{ .ConfirmationURL }}` so the supplied redirect and PKCE flow survive. Do not replace it with a raw app token URL.
4. In Supabase Auth URL Configuration, allowlist `smaran-ai://auth/callback` and the query-bearing pattern `smaran-ai://auth/callback\?state=*`. The backslash escapes the literal question mark in Supabase's glob syntax; the wildcard covers the nonce, not additional paths. Verify the dashboard stores this pattern and retains the state query in a staging round trip. Do not use a scheme-wide `**` allowlist. The client still enforces the exact route, parameter allowlist, and saved nonce.
5. Configure Google's consent screen, app name/support details, audience/publishing status, and test users when the app is in testing. Configure only the scopes actually needed for sign-in.
6. Create a **Web application** OAuth client. Register the exact provider callback shown in the Supabase Google provider dashboard, normally `https://<project-ref>.supabase.co/auth/v1/callback`, as a Google authorized redirect URI.
7. Enable Supabase's Google provider, store the Google Web client ID there, and store the Web client secret **server-side in Supabase only**. Do not put either a client secret or privileged Supabase/database key in the mobile app. Configure web origins only if a separate web Google integration actually uses them.
8. Use a development/standalone native build whose scheme is `smaran-ai`, Android package is `com.smaran.ai`, and iOS bundle identifier is `com.smaran.ai`. Verify scheme registration on each platform.

This browser/PKCE flow does **not** use Android/iOS Google client IDs or a native Google SDK, so those client IDs are not required by this implementation. Expo Go does not prove custom application scheme behavior. No APK was built.

Verified references: [Expo SDK 54](https://docs.expo.dev/versions/v54.0.0/), [SDK 54 WebBrowser](https://docs.expo.dev/versions/v54.0.0/sdk/webbrowser/), [Supabase Google configuration](https://supabase.com/docs/guides/auth/social-login/auth-google), [signup responses](https://supabase.com/docs/reference/javascript/auth-signup), [PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow), [redirect glob rules and templates](https://supabase.com/docs/guides/auth/redirect-urls), [public settings contract](https://github.com/supabase/auth/blob/master/openapi.yaml). Installed SDK implementations were also inspected and executed in regression tests.

## 14. Sync orchestration

SQLite → transactional outbox → authenticated Supabase RPC → PostgreSQL → validated pull → SQLite remains intact. One sync pass runs at a time. Captured owner/revision/abort signal and checks inside exclusive transactions reject stale responses. Batches remain 25 mutations, with at most 10 push/pull batches per foreground pass. No sync completion is shown until the push queue is drained and the final pull commits successfully.

## 15. Offline queue

Linked patients' edits accumulate in durable owner-bound SQLite rows, including while signed out or backup is paused. Unlinked local patients remain fully usable without any cloud queue or login. Queue insertion failure rolls back its domain write instead of losing a mutation. Photos and dates of birth remain device-only.

## 16. Reconnect

The existing foreground AppState listener and 30-second polling are reused; no network dependency was added. Failed requests retain exponential backoff capped at five minutes. Reconnect resumes automatically once the queued head is eligible, normally within one foreground poll plus remaining backoff. Manual Sync now resets retries immediately. Extended network/auth failures cap their attempt counter but remain pending; they no longer become permanently failed solely because the device was offline. No background delivery or instantaneous network-event detection is claimed.

## 17. Duplicate/retry behavior

Mutation identity and payload remain immutable. Lost acknowledgements replay the same IDs; server duplicate receipts safely clear only the acknowledged local mutations. Invalid/conflicting mutations require attention. Repeated server failures still stop after eight attempts; network/auth failures stay retryable with capped backoff. Returning to an account does not borrow another account's queue.

## 18. Partial acknowledgement

A complete ordered receipt array may acknowledge some entries and reject others; only applied/duplicate entries are deleted, transactionally. Rejections stay queued with their failure class. Missing, truncated, reordered, null, or malformed receipt arrays delete nothing. Pull failure after successful push preserves the committed push result while leaving the pull cursor unchanged and withholding a new successful-sync timestamp.

## 19. Process restart

Queues, mutation IDs, retry state, ownership, pause consent, cursors, and local data remain in SQLite. Tests close/reopen a file-backed synthetic database and continue actual service operations. Secure session/state/verifier restoration and interrupted logout use the existing SecureStore recovery path.

## 20. Logout/account switch during sync

In-flight HTTP requests are aborted and all response/apply/acknowledgement paths verify the captured account. Tests pause a real SDK RPC response, sign out or switch A→B, resume it, and verify A's queue remains unacknowledged locally. A server may have accepted an aborted request; replay safely resolves that uncertainty through the mutation receipt contract.

## 21. Patient isolation and reversible backup participation

Patient/entity identities, parent ownership, and cross-patient collisions remain checked before applying cloud records. New profiles require explicit backup inclusion. Pause backup and sync reverses participation without deleting patients, queued work, existing cloud copies, or ownership evidence; enable resumes it. Ownership identity itself intentionally remains immutable. This milestone does not transfer an already-owned patient to another account or delete remote backups.

## 22. Care Circle readiness

MVP-23 supports local/revoked members. No authenticated invitation or remote relationship endpoint exists in this source. Login does not change local members into linked remote caregivers. Existing scopes, revocation, owner-bound outbox records, and patient checks remain intact. Remote linking requires a real backend relationship service and authorization tests.

## 23. Report delivery truthfulness

Preferences remain `not_configured`. Login and synchronization do not implement automatic email delivery. Stale consent/revocation checks remain in the existing protocol. Manual native PDF/share stays independent and unchanged.

## 24. Schema/RLS changes

Only new SQLite migration `011_sync_consent.ts`: add constrained account `enabled` flag, initially paused for existing accounts; remove automatic new-profile linking; clear the old default-owner pointer. All patient rows, queues, retry metadata, owners, and cursors survive. Tests cover populated 010→011, rollback at four distinct statement/registry boundaries, rerun idempotency, foreign keys and integrity. Existing users explicitly enable backup again after this upgrade.

SQLite 001–010 and all three Supabase migrations have identical Git blob content against `045519e`, verified with Git's path-aware `hash-object` against each base blob. SQLite 001–006 retain pre-existing Windows CRLF checkout endings while their base blobs use LF; 007–010 and all three Supabase files also match the base as raw filesystem bytes. No historical migration was edited. No RLS changes, cloud migration, or deployment. Recovery after a failed 011 application is the existing transaction rollback and retry. After successful migration, use a forward repair rather than resetting the database; no binary downgrade guarantee is claimed.

Technically, re-enabling means a verified signed-in user selects **Enable backup and sync**. `enableCloudSync()` calls the existing transactional `syncRepository.link()`, setting only that account's `enabled` flag to 1 and explicitly linking/snapshotting any currently unowned local profiles. Already-owned profiles, mutation IDs, retries and pull cursors stay intact. Sync resumes that owner's pending work subject to its existing backoff; **Sync now** resets retries explicitly. Login/session restoration alone never changes consent. Paused accounts still capture edits to already-owned patients locally. Newly created profiles require another explicit inclusion action. Network loss does not reset consent, and returning to a previously enabled account preserves its explicit consent.

## 25. Seven-language coverage

Explicit complete account catalogs for `en`, `hi`, `as`, `bn`, `mni`, `kha`, `lus`, including all new auth, confirmation, recovery, consent, and sync concepts. Regression checks exact key completeness, nonempty values, interpolation, and integration into the main catalog. These are draft translations, **not native-speaker verified**.

## 26. Accessibility/appearance

Account reuses the existing themed typography, scalable shared fields/buttons, wrapping text, large controls, live announcements, and labeled password-manager fields. No motion was added; the existing reduced-motion behavior remains applicable. Executable render checks exercise the real Account screen in seven languages and error states.

Actual Chromium QA at `http://127.0.0.1:54514/account`: widths 320, 390, 768, 1280; System light/dark; reduced motion; 200% zoom; keyboard focus/Enter on Continue offline; ≥56px control height; no horizontal overflow; truthful unavailable web auth; web storage-recovery route. Zero browser console/page errors and failed network responses in the successful run. A 390px dark screenshot was visually inspected, then removed. Native Large/Extra Large, explicit Light/Dark/System/HC Light/HC Dark, TalkBack/VoiceOver, and device password managers still require native verification. Browser QA does not claim web SQLite or native OAuth proof.

## 27. Secret scan

Tracked and untracked project source scanned for literal private keys, provider keys, Supabase secret keys, Google secrets, and bearer/JWT material. The ignored `.env` and `.env.local` were inspected without printing values: only permitted public client settings, no private credential findings. Environment/private-key/credentials paths remain ignored and untracked. Synthetic test credentials are clearly artificial and never contact a live provider. No secret was found or printed.

## 28. Dedicated regression

`node scripts/check-auth-cloud-hardening.cjs`: PASS. Runs real production auth, installed SDK, SQLite migrations/repositories, sync services, patient launch, and Account screen code; substitutes network/native boundaries with synthetic fixtures. Covers email states/errors, confirmation, state/PKCE/callbacks, Google cancellation/provider absence, secure restore/failure, refresh/revocation, timeout/DNS/outage, offline logout, A/B isolation, queue/restart/reconnect, partial/duplicate/rejected/malformed receipts, cursor safety, stale work, Care Circle/report ownership, translations, autofill/accessibility contracts, historical migration protection, and secret patterns. Synthetic revoked-refresh tests intentionally exercise SDK error logging; they contain no real token or password.

## 29. Every existing regression

| Script | Result |
| --- | --- |
| `check-analytics.cjs` | PASS |
| `check-auth-sync.cjs` | PASS |
| `check-auth-sync-migration.cjs` | PASS |
| `check-care-circle-reports.cjs` | PASS |
| `check-cognitive-ai.cjs` | PASS |
| `check-cognitive-expansion.cjs` | PASS |
| `check-cognitive-migration.cjs` | PASS |
| `check-daily-voice.cjs` | PASS |
| `check-elderly-ux.cjs` | PASS |
| `check-extra-cognitive-games.cjs` | PASS |
| `check-mvp22-boundaries.cjs` | PASS (its exported boundary checks also run in consuming regressions) |
| `check-my-care.cjs` | PASS |
| `check-my-day.cjs` | PASS |
| `check-my-home.cjs` | PASS |
| `check-my-memories.cjs` | PASS |
| `check-native-hardening.cjs` | PASS |
| `check-privacy-recovery.cjs` | PASS |
| `check-product-hardening.cjs` | PASS |
| `check-product-polish.cjs` | PASS |
| `check-profile-switching.cjs` | PASS |
| `check-ux-overhaul.cjs` | PASS |
| `check-visual-ux.cjs` | PASS |

## 30. Old tests modified and reasons

- `check-auth-sync-migration`, `check-cognitive-expansion`, `check-cognitive-migration`, `check-my-day`, `check-my-memories`: final production migration registry count 10→11 only.
- `check-my-care`, `check-native-hardening`: registry count and exact authorized migration filename inventory add 011.
- `check-mvp22-boundaries`: explicitly authorize only the new 011 migration in its existing source allowlist.
- `check-care-circle-reports`, `check-extra-cognitive-games`: seed historical ownership and the original default-owner pointer using that historical schema, since current `link()` requires the new column; execute every original preservation assertion immediately before the real 011 migration runs; retain rollback, FK, identity, data, and schema checks; update final registry count.
- `check-auth-sync`: keep Google PKCE checks and assert the newly required state-bearing callback; controlled transport now serves public settings and user verification; prove new profiles wait for explicit consent before B owns them. Existing eight-attempt terminal retry check now exercises server failure. Dedicated tests separately prove long network outages remain pending. No pass assertion was replaced with a source-string check.

## 31. Old tests weakened?

No. Historical preservation assertions were moved to the correct pre-011 boundary, not removed. Account/patient isolation assertions remain. Fixture endpoint additions reflect real new SDK calls. Retry behavior changed deliberately to satisfy automatic reconnect after prolonged offline use.

## 32–38. Toolchain and diff validation

| Check | Result |
| --- | --- |
| `npx.cmd tsc --noEmit` | PASS |
| `npx.cmd expo lint` | PASS |
| `npx.cmd expo-doctor` | PASS, 18/18 |
| `npx.cmd expo install --check` | PASS, dependencies up to date |
| `npx.cmd expo config --type public` | PASS; native scheme/identity preserved |
| `npx.cmd expo export --platform all --output-dir .expo/mvp24-export` | PASS, Android/iOS Hermes plus web, 40 routes |
| `git diff 045519e --check` | PASS |

Public configuration/export checks used `EXPO_NO_DOTENV=1` to avoid loading local configuration into disposable artifacts. Initial sandbox attempts could not fetch metadata or execute Hermes; authorized retries succeeded. No dependency versions or lockfile changed. Export is not an APK or deployment.

## 39–40. Exact changed files and final git status

See the final status snapshot below; every modified/untracked source file belongs to this task. Initial working tree was clean. No staged files.

```text
 M .env.example
 M README.md
 M app/account.tsx
 M scripts/check-auth-sync-migration.cjs
 M scripts/check-auth-sync.cjs
 M scripts/check-care-circle-reports.cjs
 M scripts/check-cognitive-expansion.cjs
 M scripts/check-cognitive-migration.cjs
 M scripts/check-extra-cognitive-games.cjs
 M scripts/check-mvp22-boundaries.cjs
 M scripts/check-my-care.cjs
 M scripts/check-my-day.cjs
 M scripts/check-my-memories.cjs
 M scripts/check-native-hardening.cjs
 M src/cloud/auth-storage.ts
 M src/cloud/auth.ts
 M src/cloud/config.ts
 M src/cloud/sync.ts
 M src/db/migrations/index.ts
 M src/db/repositories/sync.repository.ts
 M src/i18n/account-strings.ts
?? docs/history/MVP24_AUTH_CLOUD_HARDENING.md
?? scripts/check-auth-cloud-hardening.cjs
?? src/db/migrations/011_sync_consent.ts
```

The three `??` files are new and intentionally unstaged; ordinary `git diff --stat` / `--name-status` omit them.

## 41. Temporary cleanup

Task-created browser script/screenshot, disposable export, test-result logs, and synthetic database folders removed after verification. Browser contexts and local HTTP servers were closed. No generated live test users, live auth tokens, database cluster, or hosted mutation exists to clean up. Pre-existing `.expo`, environments, caches, and unrelated files were preserved. No broad `git clean`.

## 42. Exact live device/cloud checklist remaining

Use an authorized staging project and two supported native installations; use synthetic test records and accounts, never production patient fixtures.

### Email

1. Without credentials or network, launch, select/create a local patient, write a reminder/memory, play a game, and reopen the app; confirm no account requirement.
2. With configured public values, create a new email/password account. Check loading, invalid email, weak password, duplicate/obscured duplicate, and rate-limit messages. Require confirmation in staging; confirm the app stays signed out until a real session exists.
3. Receive the real confirmation email. Open it on the initiating native installation while foregrounded, backgrounded, and after process restart. Verify scheme dispatch, preserved nonce, one PKCE exchange, and a real verified account. Check expired/replayed/wrong-device links, malformed routes, wrong state, and cancellation. Confirm no token appears in logs.
4. Sign in with correct and incorrect credentials, confirm password-manager behavior, and check account identity. Restart online and offline; verify secure restoration/refresh and continued offline patient use.
5. Revoke/expire the staging session or refresh token server-side; retry/foreground and verify session-expired state with intact local data.
6. Sign out online and offline, including during push/pull and secure-storage interruption; verify local data/report/Care Circle preservation and accurate remote-revocation caveat.

### Google

1. Complete section 13 configuration, including consent audience/test users, Web client, server-side secret, both callback hops, and native scheme.
2. Confirm `/settings` truthfully reports Google enabled; disabled provider must show the not-configured message before browser launch.
3. Complete the real consent screen/login and verify the resulting server account. Cancel/dismiss at each browser stage; no session should be fabricated.
4. Background/restart during the flow, deliver the callback twice, try wrong/expired state, and verify secure verifier matching and error recovery.
5. Restart after successful login, then sign out online/offline. Test an already signed-in browser Google account and switching Google identities explicitly.

### Sync

1. On device A, sign in as account A and explicitly enable backup. Confirm existing unowned profiles get A's ownership once; newly created profiles require separate inclusion. Pause/resume and verify no queue loss or unintended upload while paused.
2. Make online writes to each supported entity, including Care Circle and report preferences. Verify owner/patient IDs and mutation receipts in staging PostgreSQL using authorized administrative inspection, without exposing credentials.
3. Disconnect device A, make additional writes, kill/reopen the app, and reconnect after more than eight failed attempts. Confirm automatic retry after backoff, duplicate-safe receipts, successful pull, and accurate status.
4. On device B, sign in as account A, enable backup, and pull. Confirm records match, cursors are independent per installation/account, and device-only photos/DOB are not claimed backed up.
5. Interrupt network/process during push and pull; induce timeout, 401, revoked refresh, RPC validation rejection, malformed/truncated receipt, rejected suffix, and pull failure after push. Verify queue/cursor invariants and surviving local data.
6. On each device, run A→logout→B while requests are active. Confirm B neither receives A's server records nor uploads A's queue/care/report preferences. Verify RLS SELECT/INSERT/UPDATE/DELETE and anonymous RPC rejection in a disposable staging test transaction using the existing Supabase SQL tests.
7. Verify same-device local profile visibility follows the documented shared-device design; do not mistake it for a cloud ownership grant. Switch patient A/B while editing and syncing and check parent/entity ownership.

### Care Circle and reports

1. Until a real invitation/relationship backend exists, verify all local members stay local/revoked through login, sync, restart and logout. No remote access should be implied.
2. When backend support exists, test authenticated invitation acceptance, patient/account relationship checks, permission scope enforcement and revocation on two devices before enabling remote-link UI.
3. Verify automatic report delivery remains `not_configured` after login/sync. Separately exercise native PDF generation/share and recipient revocation; no email delivery claim without a real server-side provider.

### Accessibility and appearance

Exercise every auth state in all seven languages with Large/Extra Large text and explicit Light/Dark/System/HC Light/HC Dark. Check wrapping, scroll reachability, error announcement, focus order, TalkBack/VoiceOver, keyboard/password managers and reduced motion on Android and iOS. Obtain native-speaker review before claiming translation quality.

## 43. Known limitations

Hosted email/Google/RLS and physical-device behavior remain unproven here. Browser Auth/SQLite is intentionally unsupported. Backup is foreground-only and reconnect obeys capped backoff. Pause preserves existing remote copies and permanent ownership evidence; account transfer/remote deletion is not implemented. Same-device local profiles are shared, not account-private. One pending app callback attempt is supported. Signup duplicate obfuscation prevents reliable client-side account-existence/email-delivery claims. Remote Care Circle linking and automatic report email delivery have no implemented backend. Draft translations need native-speaker review. No migration downgrade is promised.

## 44. Independent review/commit readiness

Source and local verification are ready for independent review and a separately authorized commit. This is not hosted/native production sign-off; complete section 42 before claiming those proofs. Work stops without committing.

## 45. Final targeted audit

Migration 011 exists as the untracked source file `src/db/migrations/011_sync_consent.ts`, absent from base `045519e` and correctly imported by the production runner. It is the only new SQLite migration. Ordinary tracked-file diffs omit it; the exact status in section 39–40 includes it. The migration is necessary because production consent reads/writes the new constrained `sync_accounts.enabled` column. Its transaction and `schema_migrations` record provide rollback/retry safety and runner-level idempotence; calling `up()` twice directly is not the project convention.

`.expo/mvp24-browser.cjs` was absent when this audit began. It is absent from both the base tree and tracked files and is ignored by `.gitignore:7`. It was a disposable helper from the earlier browser QA and requires no production justification or restoration.

This audit repaired regression coverage only: the old Google redirect assertion now checks the complete callback URI plus its exact state parameter inventory (custom-scheme `URL.origin` is `null`); both historical upgrade fixtures again include the original default-owner pointer; 011 rollback injection now stops after each of its three SQL statements and its registry insert, rather than twice after the same complete SQL batch. Populated upgrade coverage now retains a nonzero cursor, applied version, successful-sync timestamp and pending retry metadata. Additional executable checks verify no sync RPC before consent, paused consent survives session restoration, and A's consent/cursor cannot enable B. Production implementation and historical migrations remain untouched by the targeted audit.

Final rerun: all 23 `scripts/check-*.cjs` pass, TypeScript and lint pass, Doctor passes 18/18, dependency compatibility and public config pass. `npx.cmd expo export --platform all` passes for Android/iOS Hermes and web (40 routes). Expo checks run with `EXPO_NO_DOTENV=1`; network checks and Hermes execution passed after permitted retries outside the sandbox. The generated `dist` export and `.expo/mvp24-audit-temp` directory are removed after verification; pre-existing project caches remain. Native/hosted verification limitations in sections 42–43 still apply.
