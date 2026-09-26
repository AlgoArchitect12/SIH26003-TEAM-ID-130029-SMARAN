# SIH presentation validation

Application baseline: `ed9f948c097aa7823530c95374528e1aea7e92e1` (version 1.0.1).

This pass changes repository presentation only. Application source, dependencies, database migrations and regression assertions are unchanged.

## Scope and environment

The existing README draft was preserved and reviewed against the application, not rewritten during resumption. The presentation includes the supplied SIH identity, actual feature/status tables, a Mermaid architecture diagram, platform setup, privacy boundaries and real-evidence placeholders. No team members, awards, clinical outcomes or live service results were invented.

Validation ran on Windows with Node.js 24.19.0, npm 11.17.0 and PostgreSQL 18.6. Expo CLI checks/export used `EXPO_NO_DOTENV=1` so the export did not bundle local client configuration. Local credentials were not printed. No signed APK/AAB, screenshots, video or Drive package was created.

## Command results

| Command/check | Result | Evidence and scope |
|---|---|---|
| `npx tsc --noEmit` | ✅ Passed | Exit 0 during the initial presentation pass; application source is unchanged since that run. |
| `npm run lint` | ✅ Passed | Exit 0 during the initial presentation pass; no lint rules or source files changed. |
| `npx expo-doctor` | ✅ Passed | 18/18 checks after registry access was available. |
| `npx expo install --check` | ✅ Passed | Dependencies reported up to date; no dependency installation or lockfile change. |
| `node scripts/check-regressions.cjs` | ⚠️ Initial run incomplete | 32/34 entry points exited 0; family-pairing and live-database checks could not start PostgreSQL in the restricted environment. Both were retried separately below. |
| `node scripts/check-family-pairing.cjs` | ✅ Passed on retry | Exit 0 with local process permission: PostgreSQL pairing/location/RLS checks, service boundaries and UI harness checks. |
| `node scripts/check-live-database-sync.cjs` | ✅ Passed locally on retry | Exit 0 with disposable databases; hosted subtests remain explicitly blocked below. |
| `npx expo export --platform all --output-dir .expo/sih-export` | ✅ Passed on retry | Android and iOS Hermes bundles plus 52 static web routes. Initial execution was blocked by Hermes process permission. |
| Git diff scope and whitespace | ✅ Passed | Only `.gitignore`, `README.md`, `SECURITY.md` and this report change. No application, configuration, dependency or migration changes apart from ignore rules. |
| Documentation links and required content | ✅ Passed | Relative file links resolve; SIH identity, setup, architecture and screenshot/demo placeholders are present. |
| Secret audit | ✅ Passed after review | No real secrets found; scope and scanner false positives described below. |

All **34 regression entry points** have exited successfully across the initial run and the two targeted retries. The aggregate runner was not rerun after those retries; its original `results.json` still records the two initial environment failures. `check-mvp22-boundaries.cjs` is a helper module whose direct exit is not an independently executed assertion suite. No assertion was removed, relaxed or skipped to obtain these results.

Original regression logs remain in ignored `.expo/regressions/`. Targeted retry output is in `check-family-pairing.retry.log` and `check-live-database-sync.retry.log` in that directory. Export output is ignored under `.expo/sih-export/`; none is part of the public commit.

## Database evidence and limits

The local PostgreSQL run applied all eight current Supabase migrations and executed all five SQL fixtures: `auth_sync.sql`, `care_circle_reports.sql`, `extra_cognitive_games.sql`, `location.sql` and `three_cognitive_games.sql`. It exercised SQL/RLS grants, durable SQLite writes/restart, push/pull into a receiving SQLite database, replay after lost acknowledgements, duplicate handling, partial receipts, cursor rollback, consent changes, account/person isolation and retry/auth failure paths.

The family-pairing retry separately exercised hashed expiring codes, scoped snapshots, revocation, cross-patient denial, bounded location history and consent epochs. These checks use synthetic accounts and disposable local PostgreSQL/SQLite databases. Test-owned databases were cleaned up by the existing scripts. No hosted records or production migrations were written.

| Hosted/device check | Status |
|---|---|
| Public Supabase Auth settings endpoint | ✅ HTTP 200; endpoint/key omitted from output |
| Hosted migration history | ⚠️ Blocked: public API returned HTTP 406; deployed migration state remains unconfirmed |
| Hosted push, pull, reconnect and Account A/B RLS | ⚠️ Blocked: migration history is not accessible with public credentials and no verified isolated authenticated test identity is available |
| Physical Android/iOS flows, TalkBack, native notifications, Maps and report sharing | ⏳ Not tested in this presentation pass |
| Deployed assistant provider and WhatsApp delivery | ⏳ Not tested; configuration, authorization and provider acceptance still need verification |
| Signed EAS builds and store deployment | ⏳ Not performed |

The export emitted the existing Expo Notifications warning that push-token listeners are not fully supported on web. Web's native SQLite/SecureStore limitation remains unchanged. Local test adapters and successful bundles do not establish native binary behavior or clinical benefit.

## Security and cleanup

The pre-edit audit covered the 371 tracked baseline files and Git history across local refs, including all history reachable from the public `main`. Gitleaks 8.30.1 reported two `generic-api-key` matches in ordinary prose in `docs/history/MVP22_AUTH_SYNC.md` and `docs/history/MVP24_AUTH_CLOUD_HARDENING.md`; the matched contexts were inspected and classified as false positives. They are not credentials. The four presentation files were scanned separately with full secret redaction and no findings.

The only tracked environment file is the empty `.env.example`. Real local environment files remain ignored. No real provider key, access token, service-role credential, password, credential JSON or private key was introduced. This is a credential-disclosure check, not a claim of a complete application penetration test.

Cleanup adds repository-level ignores for the existing EAS prebuild inspection directory, Supabase CLI temporary metadata and log files. No tracked files were deleted: existing editor recommendations and project instructions are useful configuration, and the application assets and historical documentation are retained.

`SECURITY.md` adds project-specific reporting and deployment boundaries. A separate `CONTRIBUTING.md` was not added because setup and validation are already documented in the README. No license was selected automatically.

## Remaining team decisions and evidence

- Supply verified team-member and institutional details, plus an appropriate private security-reporting contact if desired.
- Select the project's license and confirm reuse/distribution permissions.
- Confirm hosted migration state and provide isolated test identities through secure configuration for end-to-end acceptance.
- Verify the signed native app, accessibility, location consent/revocation, reminders, report sharing and enabled external providers.
- Capture real screenshots and a real demo recording in a separate evidence task.
