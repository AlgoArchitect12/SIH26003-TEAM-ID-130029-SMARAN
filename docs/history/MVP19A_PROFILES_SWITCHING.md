# MVP-19A profiles and switching

Completed in `C:\Users\Dharmin\OneDrive\Desktop\SMARAN-A` on 2026-09-10. Branch: `feature/mvp19a-profiles-switching`; unchanged HEAD: `b7eb6bd093a6ef3dabce14940eb98e86ce842034`. Implementation remains uncommitted. No reset, revert, migration, dependency update, commit, merge, tag, native build, APK or deployment was performed.

## 1. Takeover findings

The worktree initially contained seven modified tracked files and five untracked files. Existing work covered the patient repository, resolver, SecureStore key, DOB component/utilities and profile translations. Untracked work included `app/profiles.tsx`, `components/patient/current-person.tsx`, `src/i18n/profile-strings.ts`, `src/services/profile-switching.service.ts` and `src/stores/patient-session.store.ts`.

`app/add-person.tsx` was absent, consistent with the reported previous auto-review decline. It was created successfully during this takeover. The existing work was continued in place.

Read the repository instructions, README, MVP-18 privacy/recovery and cognitive analytics documentation, relevant callers/repositories/stores and regression harnesses. Checked [Expo SDK 54](https://docs.expo.dev/versions/v54.0.0/), its [SecureStore](https://docs.expo.dev/versions/v54.0.0/sdk/securestore/) and [SQLite](https://docs.expo.dev/versions/v54.0.0/sdk/sqlite/) contracts, and the SDK 54 Router documentation through Context7. Stack removal uses the documented [React Navigation reset action](https://github.com/expo/expo/blob/sdk-54/docs/pages/router/migrate/from-react-navigation.mdx).

## 2. Unfinished pieces and defects found

- Add Person, the profile-switching check and this document did not exist.
- The session revision helper was unused. Delayed settings and cognitive saves could reapply old global state after a switch.
- Launch did not route ambiguous/dangling selections to the chooser. The menu and caregiver flows did not expose the existing switch component.
- The chooser referenced the absent Add Person route. Root reset calls needed the correctly typed `CommonActions.reset` dispatch.
- The reserved ID needed collision/orphan-DOB checks and a way to finish a committed addition without changing the current person.
- Speech stop errors were swallowed; selecting another person needed to fail if native speech could not be stopped.
- Emergency telephone autofill was enabled. Obsolete example DOB instructions remained in all seven catalogs.
- Initial regressions exposed an obsolete resolver error expectation and a repository mock missing `listProfiles`. Later checks exposed a source assertion that needed the newly required router dependency. Assertions were retained; harnesses were updated to the actual contracts.

## 3. Multi-profile architecture

The existing tables already support multiple profiles. Each profile has its own settings row, reminder/event rows, personal memories, cognitive sessions and adaptive models. DOB remains in `smaran.dob.{patientId}` in SecureStore. SQLite and SecureStore remain the sources of truth; the new Zustand session revision only invalidates transient work.

First-time onboarding keeps its exclusive transaction and accidental-duplicate guard. Explicit addition calls the separate `createAdditionalProfileWithSettings` repository operation, which requires an existing patient and a new reserved ID, then commits profile and settings together. A retry with an already committed addition reads that profile without overwriting it.

Appearance remains the existing device-wide SecureStore preference. Language, region, text size, voice guidance, reduced motion and the legacy high-contrast setting are loaded for the selected patient. Add Person owns a separate local draft and preferences; it never borrows another person's personal fields.

## 4. Launch and recovery

| Persisted state | Behavior |
| --- | --- |
| No profiles, no active ID, completion absent/false | First-time onboarding |
| One profile, genuinely missing active ID | Recover that sole profile; launch repairs routing flags |
| Multiple profiles, valid active ID and settings | Open exactly that patient |
| Multiple profiles, genuinely missing active ID | Chooser with no selected person; Continue disabled until selection |
| Dangling, empty or malformed explicit active ID | Chooser; no inferred replacement |
| No profiles with a saved active ID or completed flag | Recovery/Retry, including direct chooser entry; never fresh setup |
| SecureStore unavailable/read rejection | Recovery/Retry; no missing-value fallback or flag deletion |
| Invalid completion flag, missing/invalid settings or failed database read | Recovery/Retry; saved rows remain intact |
| Genuinely absent DOB | Preserved as absent; existing Profile can add it |
| Corrupt DOB or failed DOB read while selecting | Selection fails; existing active ID is retained |

The resolver remains read-only. Selection reads and validates the selected setup, requires speech to stop, writes completion, and writes the active ID last. Therefore failure before the active-ID write does not change the current patient. A crash after the final active-ID write recovers the selected patient on launch. No recovery path deletes patient data or clears the active/completion flags.

## 5. Add Person and DOB staging audit

The four steps are language, personal details/DOB, region and accessibility. Language and region require explicit choices. Personal fields start blank; optional emergency fields stay optional. Save commits the new person and shows their saved name. **Continue as [name]** explicitly activates that person; **Return to person list** finishes the addition without switching.

Only one preparation/save runs at a time in the process. The persistent pending marker contains an opaque reserved ID, never name, DOB or contact text. New IDs are checked against both existing profile rows and existing DOB keys before reservation.

| Interruption/failure | Result and recovery |
| --- | --- |
| Reservation read/write | No profile/DOB save; active patient unchanged; Retry |
| Invalid form or missing DOB | No profile creation; form stays available |
| DOB write | No new SQLite profile; reserved ID remains retryable |
| SQLite profile/settings transaction | Transaction rolls back; staged DOB is confined to the reserved ID; active patient unchanged |
| Cold reopen after that rollback | Same reserved ID, blank form; staged DOB is never loaded as a new person's birthday. A new validated submission replaces staging before its profile is committed |
| Crash/read failure after SQLite commit | Pending ID locates the committed person; reopening shows the saved name; repeated save does not duplicate or overwrite it |
| Activation/marker-cleanup failure | Saved person remains available; current active ID is retained until the final successful switch write |
| Return from a saved addition | Only the pending marker is removed; profile, DOB and the previous active selection remain |

An abandoned uncommitted staged DOB can remain under its reserved key. It is not selectable or copied to another ID; later valid submission replaces it before that same ID receives a profile. There is no speculative orphan sweep or cross-store rollback that could delete a working person's DOB. Unknown DOB keys also prevent newly generated IDs from reusing them. Storage corruption continues to require visible recovery rather than a guessed identity.

## 6. Switching and navigation

The patient menu shows the current person and Switch person. Caregiver Home shows Viewing and Switch person; activity history also offers it with its loaded patient. Caregiver entry from the role screen opens the chooser with caregiver destination context. Ambiguous caregiver Home recovery keeps that context.

Leaving a person invalidates requests, clears cognitive pending/saved results, clears the onboarding draft/settings mirror and cancels speech. Root navigation is reset so old patient/caregiver screens, forms, photos, activity boards, timers and analytics pagination are discarded. Direct chooser/Add Person entry also removes any older root routes. A successful selection resets to Patient Home or Caregiver Home with the selected person's saved settings.

Revision checks cover the active resolver, shared patient/region loaders, cognitive preparation/results, caregiver/analytics loads and settings saves. Old reminder/memory save continuations cannot navigate over the new screen. An already started patient-scoped SQLite save can finish for its original owner; it cannot write to the newly selected owner's ID or restore old shared UI state. Analytics also rejects stale responses across A → B → A, where comparing only the final ID would be insufficient.

## 7. Elderly DOB picker

The shared component used by onboarding, Add Person and Profile exposes large Day, Month and Year buttons and a modal list. Months are named, year groups lead to ten individual years, and dates start unselected. Existing DOBs are shown only for their owning patient.

Leap years, century exceptions, month lengths, today/future boundaries and birthday age calculations are checked. Changing a month/year clears an incompatible day rather than silently inventing another birthday. Expanded/selected accessibility state, close/Back support and disabled-save state are present. Native modal focus, touch behavior and TalkBack are still device checks.

## 8. Form/autofill audit

All application `TextInput` use routes through the existing shared `Field`. It now sets `autoComplete="off"`, `textContentType="none"`, `importantForAutofill="no"` and disables autocorrection, including when an inappropriate telephone-autofill prop is supplied. The onboarding telephone override was removed.

Profile/contact placeholders were already generic instructions. The unused example-DOB copy was removed from all seven catalogs. New profile, memory and reminder personal text remains blank; saved edit forms load only their owner's stored values. Reminder time/date defaults and bundled regional/activity content are retained; they are not sample personal records. Synthetic data exists only in regression fixtures, not production setup.

## 9. Patient-isolation evidence

`node scripts/check-profile-switching.cjs` executes the actual repositories/services with Node's SQLite and mocked native SecureStore/speech boundaries. It uses a disposable synthetic database inside `.expo`, closes/reopens it, checks foreign keys and compares all persisted tables around switches.

Coverage includes fresh/sole/multiple/dangling resolution; corrupt/failed storage reads; accidental onboarding duplicates; ID collisions and orphan DOB keys; reservation, DOB, SQLite, post-commit-read, completion, active-ID and marker-delete failures; rapid duplicate saves/selections; and full A → B → A preservation. Each patient's DOB/settings, reminders, memories, sessions, model and caregiver/analytics reads are checked. Delayed native voice lookup, actual Settings/Cognitive Result screen continuations and in-flight A → B → A analytics are exercised.

The same script executes the real launch, chooser, Add Person, CurrentPerson, DOB and Field component logic with controlled hooks/native view boundaries. It checks blank drafts, explicit choices, SQLite failure/retry, saved-person continuation, caregiver destination reset and direct-entry history removal. These are runnable behavior checks, not native-rendering certification.

MVP-18's generic notification wording, saved-patient language lookup, private photo paths, read-only caregiver queries, backup exclusions and storage-failure distinctions remain covered by the full existing suite. Switching does not cancel another saved person's care reminders: their existing OS alarms remain generic; all in-app reminder details are selected-patient scoped. Appearance and the unlocked device remain shared. Profile selection is not authentication or a separate caregiver account.

## 10. Files changed

- New: `app/add-person.tsx`, `app/profiles.tsx`, `components/patient/current-person.tsx`, `src/services/profile-switching.service.ts`, `src/stores/patient-session.store.ts`, `src/i18n/profile-strings.ts`, `scripts/check-profile-switching.cjs`, this document.
- Launch/onboarding/menu/caregiver: `app/index.tsx`, `app/onboarding/{complete,profile,role}.tsx`, `app/patient/menu.tsx`, `app/caregiver/{home,activity}.tsx`.
- Patient async boundaries: `app/patient/_layout.tsx`, `app/patient/games/{index,memory-match,result,why-level}.tsx`, `app/patient/{settings,my-day-reminder,my-memory-editor,my-memory}.tsx`, `components/games/selection-activity-screen.tsx`, `components/my-day/shared.tsx`, `components/my-home/shared.tsx`.
- Repository/storage/forms/i18n: `src/db/repositories/patient.repository.ts`, `src/services/{active-patient,analytics,secure-storage,speech}.service.ts`, `src/utils/date-of-birth.ts`, `components/onboarding/date-of-birth-field.tsx`, `components/ui/smaran-field.tsx`, `src/i18n/{strings,regional-strings,ux-strings}.ts`.
- Existing harness adaptations: `scripts/check-{elderly-ux,my-care,native-hardening,privacy-recovery,product-hardening}.cjs`. The privacy harness is reused by the new regression; existing checks still execute normally.

## 11. Complete validation

Node: `v24.19.0`. Final regression run: all 13 scripts passed, including their existing timezone/child checks:

```text
check-analytics.cjs: exit=0
check-cognitive-expansion.cjs: exit=0
check-elderly-ux.cjs: exit=0
check-my-care.cjs: exit=0
check-my-day.cjs: exit=0
check-my-home.cjs: exit=0
check-my-memories.cjs: exit=0
check-native-hardening.cjs: exit=0
check-privacy-recovery.cjs: exit=0
check-product-hardening.cjs: exit=0
check-product-polish.cjs: exit=0
check-profile-switching.cjs: exit=0
check-ux-overhaul.cjs: exit=0
```

| Requested check | Final result |
| --- | --- |
| `npx.cmd tsc --noEmit` | PASS, exit 0 |
| `npx.cmd expo lint` | PASS, exit 0 |
| `npx.cmd expo-doctor` | PASS, 18/18 checks, exit 0 |
| `npx.cmd expo install --check` | PASS, dependencies up to date, exit 0 |
| `npx.cmd expo config --type public` | PASS, exit 0 |
| `npx.cmd expo export --platform all` | PASS, Android/iOS Hermes bundles, web bundle and 31 static routes including both new routes, exit 0 |

The first doctor/install checks failed because the sandbox blocked network access; their authorized network rerun passed. The first export reached Hermes but the sandbox denied compiler execution; the authorized rerun passed. Neither rerun changed dependencies/configuration or built an APK. Export emitted the existing web push-token warning and Node color-environment warnings. The initial stale `.expo` route types were regenerated by Expo; no generated route declarations are committed.

Browser QA used the actual app at `http://localhost:8085/`, `/profiles` and `/add-person`. The unchanged native-storage bootstrap correctly showed recovery/Retry for each route. Checked 1536×770, 360×800 and 1280×800; no horizontal overflow, Retry focus/click worked, and its measured height was 56 px. Console: expected fixed `Local setup initialization failed` messages and the existing web push-token warning. No failed application network requests were observed. The guard was not bypassed to simulate native data. Browser/native profile success flows are not claimed.

Local logs are under ignored `.expo/mvp19a-*`; browser evidence was moved to `.expo/mvp19a-browser-qa`. Export output is ignored `dist/`. The temporary development server was stopped.

Protected-path diff against `b7eb6bd` passed with exit 0, with no modified or untracked entries: `package.json`, `package-lock.json`, `src/db/migrations`, `src/db/client.web.ts`, `app.json`, `eas.json`, `plugins/with-private-backup.cjs`. No migration is necessary.

## 12. Device tests remaining

1. Native Android/iOS cold launch with no profiles, sole-profile lost flags, valid multi-profile selection, and missing/dangling active ID. Verify no guessed patient or blank-setup overwrite.
2. Add Person, cancel/back, rapid taps, SQLite/SecureStore failure and process termination at reservation/DOB/commit/activation boundaries. Reopen and verify current-person safety and exactly one added profile.
3. A → B → A through patient menu, caregiver chooser and direct links; hardware Back must not restore an old patient's forms, photos, reminders, games or analytics pages.
4. Switch while settings/cognitive/memory/reminder work and speech are pending; confirm UI language, settings, DOB, model and read-aloud state belong to the selected patient. Test native speech-stop failure.
5. DOB modal touch/focus/Back and TalkBack at large/extra-large text; older year groups, leap day, future restrictions, seven languages and native-speaker review of translations.
6. Verify actual keyboards/password managers do not inject device-owner/contact information. Platform autofill flags require device confirmation.
7. Offline restart, managed photos, notification scheduling/reconciliation and generic lock-screen content for both saved people; confirm MVP-18 backup/restore behavior on the device build that contains its native configuration.

## 13. Git handoff

HEAD and branch remain unchanged. All changes remain uncommitted; protected paths are unchanged. The final handoff includes `git diff --check`, `git status --short`, `git diff --stat`, `git diff --name-status` and `git ls-files --others --exclude-standard`. Ordinary Git diff statistics omit the eight untracked deliverables; they are listed separately in the final status.
