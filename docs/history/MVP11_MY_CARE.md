# MVP-11: My Care / caregiver dashboard

Implemented on 7 September 2026 on `feature/mvp11-my-care`, continuing the current local working tree. HEAD remains `9eecb9b` (`feat: add offline NER My Home`), also tagged `smaran-my-home-stable`. Both ancestor checks passed and the starting tree was clean. No commit, merge, tag, push, deployment, account linking, or next milestone was performed.

This is a same-device, read-only view of real locally stored activity. Implementation and validation status are recorded below; physical Android verification and native-speaker review remain outstanding.

1. **Files created:** `app/caregiver/home.tsx`, `src/caregiver/types.ts`, `src/services/caregiver.service.ts`, `src/i18n/care-strings.ts`, `scripts/check-my-care.cjs`, and this report.
2. **Files modified:** `app/onboarding/role.tsx`, `app/patient/home.tsx`, `src/db/repositories/cognitive.repository.ts`, `src/db/repositories/my-day.repository.ts`, `src/i18n/strings.ts`, and `src/i18n/regional-strings.ts`.
3. **Files deleted:** No tracked file. Removed the temporary `.tmp-care-browser.cjs` and its `.playwright-mcp` output directory (73 screenshots/snapshots/logs). Browser runtime substitutions and in-memory test data were discarded when their processes closed.
4. **Dependencies:** Zero additions, removals, or upgrades. Existing React Native, Expo Router, SQLite, Zustand, image, speech, and UI components are reused.
5. **Migration status:** No migration 006, new table, column, index, trigger, or registration. The existing five migrations and registry remain unchanged.
6. **Architecture:** One typed aggregation service composes the existing patient, cognitive, My Day, and memories repositories. The screen handles presentation, formatting, loading, retry, and navigation. SQL and dashboard calculations stay out of the screen.
7. **Same-device boundary:** Only the active patient stored on this device is shown. No caregiver identity, relationship row, invitation, remote permission, or sample account is created. The UI explicitly explains this boundary.
8. **Patient identity:** `resolveActivePatient()` reads the SecureStore active-profile ID, then the real matching profile and settings. The caregiver screen does not use the repository's first-profile fallback, onboarding name draft, or a URL-supplied patient ID. It does not clear flags or create a profile on failure.
9. **Route:** `/caregiver/home`, a single route with explicit Back controls at the top and bottom. No duplicate detail route or caregiver result flow. No-history fallback goes to Patient Home for loaded data, otherwise role selection.
10. **Patient Home integration:** My Care now opens the caregiver route. Its description and accessibility hint say “Open caregiver view.” The obsolete placeholder state/render/styles were removed. Entering My Care writes no cognitive session or activity event.
11. **Onboarding integration:** Selecting caregiver enables “Open caregiver view”; selecting patient preserves the existing language-first path. The previous caregiver notice/stop was removed from the screen. Existing unused translation keys were left alone. Missing/inconsistent local profiles show an intentional recovery state with Back to the originating flow.
12. **Sections:** Patient context; Today at a glance; Cognitive activities and recent details; Routine today; Upcoming reminders; My Memories; Recent Smaran activity; About these records. Content scrolls vertically within a 680px maximum width.
13. **Today calculations:** Cognitive count is the number of eligible sessions completed within the local calendar day. Routine shows completed/total relevant reminders. Saved memories is the actual patient-owned list length. Next reminder and appointment come from computed future occurrences. Empty counts stay zero.
14. **Cognitive calculations:** Three independently scoped SQL COUNT queries provide today, last seven days, and previous seven days. Counts are not derived from the limited recent-session preview; QA includes more than 50 sessions to verify this.
15. **Session source:** Existing `cognitive_sessions`, through `cognitiveRepository`. Both counts and recent records require `game_type = 'memory_match'` and `is_demo_seed = 0`. Only completed, saved activities appear; unsaved gameplay has no row to count.
16. **Last-seven semantics:** From local midnight six calendar days before today, inclusive, to tomorrow's local midnight, exclusive. The UI says “Last 7 days, including today.” Boundaries are constructed with local calendar arithmetic and converted to ISO timestamps for queries against stored UTC ISO timestamps.
17. **Previous-seven semantics:** From local midnight thirteen calendar days before today, inclusive, to local midnight six days before today, exclusive. The two seven-day windows do not overlap. This handles variable-length DST days rather than subtracting fixed 24-hour durations.
18. **Latest session:** The existing recent-session query reads ten real sessions ordered by completion time. Three are shown as detail cards; the first supplies the recommendation. An empty history displays “No cognitive activities recorded yet.” There is no invented initial caregiver level.
19. **Accuracy:** The stored fractional `accuracy` is rendered as a percentage using `Intl.NumberFormat`, rounded to a whole percent for display. It is a game-session statistic, never a health score. Pair count, attempts, and average response milliseconds also come directly from the saved session; response time displays up to one decimal.
20. **Hints:** The stored `hintsUsed` value is displayed, including zero. No inference about independence or disease is made.
21. **Level source:** Each detail says “Level played: {level} of 5” from `difficulty`. The summary says “Latest recommended level: {level} of 5” from the latest session's `recommendedDifficulty`, accompanied by its completion timestamp and “Recommendation saved with the latest completed activity.” It does not claim an activity is currently running at that level.
22. **Adaptive model state:** No dashboard query reads or interprets `adaptive_model_state`. QA inserts unrelated model weights/sample counts and verifies that the dashboard's cognitive data remains identical. Existing game model reads/writes are unchanged.
23. **Adaptive explanation:** “Smaran adjusts activity difficulty gradually using the patient’s own activity history.” No readiness/confidence value, disease trend, or interpretation is exposed.
24. **Reminder summary:** Uses `myDayRepository.today(patientId, now)` unchanged. Displays each relevant reminder's stored title, localized category, local time, and factual marked/not-marked status. Categories cover medicine, hydration, activity, appointment, and custom reminders.
25. **Completion math:** Denominator is enabled, nondeleted daily reminders plus enabled, nondeleted once reminders scheduled on today's local date. Numerator is that list's real matching completion marks; pending is total minus done. Existing history scoping, composite ownership FK, and reminder/day unique index remain authoritative. Disabled/deleted reminders cannot inflate today's numerator or denominator.
26. **Meaning of Done:** “Marked done in Smaran” records an app action. It does not verify medicine consumption or any real-world completion. The feed similarly says “Reminder marked done in Smaran.”
27. **Early-Done limitation:** A daily reminder marked Done before its scheduled time may still notify later that same day because the repeating notification is not safely skipped for one occurrence. This accepted limitation is unchanged. The caregiver's next pending occurrence can be tomorrow without claiming today's OS notification was cancelled.
28. **Upcoming calculation:** Starts from enabled, nondeleted reminders and existing `currentCompletions`. A daily reminder has today's future occurrence unless already marked or its time has passed, then tomorrow's occurrence. Once reminders require a future date/time and no completion for their current scheduled date. Past once reminders are excluded. Each reminder contributes at most its next occurrence; the earliest five are shown with full local dates/times. An occurrence exactly at the calculation time is eligible.
29. **Appointments:** The earliest upcoming reminder of category `appointment` is selected before truncating the general list. It is always labeled “Appointment reminder,” including when outside the first five general entries. No doctor confirmation or hospital integration is implied. Moving a once reminder to another day does not carry a prior-day completion into the new occurrence.
30. **Memories summary:** Uses `memoriesRepository.list(patientId)` unchanged. The count includes only that patient's current rows. Three most recently updated memories are shown in existing repository order.
31. **Memory previews:** Stored name and relationship are shown exactly as returned, with updated date and the existing `MemoryPhoto`. No translation or inference of user content, face recognition, invented relationship, or mutation control is added.
32. **Missing photos:** `MemoryPhoto` and `memoryMedia.resolve` preserve the existing managed-path validation, missing/empty-file fallback, image-error fallback, accessible description, and hidden decorative icon. Browser QA covered the existing web fallback for a stored path and no-photo state; the regression suite exercised real filesystem path isolation and missing files with the native boundary substituted. Native decoding was not tested.
33. **Activity derivation:** Merges up to ten real cognitive completions, ten recent reminder completions, and the creation/latest-update timestamps of current memory rows. It does not create an activity-feed table or claim to retain every memory edit/deletion. Memory names are the current stored names, not historical snapshots.
34. **Activity order:** Sorts by actual parsed timestamp descending, with a stable event ID tie-breaker; shows ten items. Equal memory creation/update timestamps yield only creation. Reminder events lack historical title/category snapshots, so their feed label is generic, avoiding reconstruction from a renamed reminder. Removed reminders retain their genuine completion history via the existing rows.
35. **Aggregation layer:** `loadCaregiverDashboard(patientId, now)` validates the ID/date, looks up the exact profile, and returns typed data or null for a missing profile. Independent reads run together; no query per displayed row. A full focus load observed 13 SELECTs including the existing identity/settings reads. Bounded session/event previews avoid reading their entire histories; existing scoped reminder/memory lists are reused for this small local dataset.
36. **Patient isolation:** Every profile, count, history, completion, upcoming item, and memory read uses the intended ID. The completion feed additionally joins reminder and event on both reminder ID and patient ID. No dashboard caller accepts another patient's ID from route parameters.
37. **SQL binding:** All IDs and date bounds are bound parameters. QA exercises an SQL-like malicious ID, checks each executed dashboard read for patient binding and scoped WHERE predicates, and confirms no global aggregation.
38. **Zero/empty states:** Explicit empty copy covers sessions, today's routine, upcoming reminders, upcoming appointments, memories, and recent activity. Empty data is distinct from a missing profile and a failed read. No seed fallback exists.
39. **Repository failures:** Errors propagate through aggregation. A failed read never returns a fabricated all-zero dashboard. The tests inject a repository failure and verify subsequent recovery.
40. **UI failures:** Loading hides prior dashboard data. Failure displays “We couldn’t load this information right now.” with Try Again and Back. No SQL, exception object, stack, or filesystem path is rendered. Focus-effect cleanup prevents late promises from applying stale screen state.
41. **Disclaimer:** “Smaran shows activity recorded in this app. These records are not a medical assessment. Smaran does not diagnose or assess dementia.” This appears in the restrained About section and the optional spoken summary.
42. **Clinical claims excluded:** No diagnosis, staging, severity assessment, progression prediction, deterioration claim, clinical risk, treatment advice, medication change, or clinician-replacement claim.
43. **Fake analytics excluded:** No health, memory-strength, engagement, adherence, care, or AI-confidence score. Historical comparisons show raw activity counts without improvement/decline labels or percentage trends. No chart dependency.
44. **Caregiver mutations excluded:** No Done button, edit, deletion, medication management, invitation, sharing, or remote-control action. Navigation and optional speech controls are the only interactions. Patient editing flows remain available through their existing routes.
45. **Offline architecture:** Production data comes from native SQLite and existing local SecureStore/media. No external request is needed to aggregate or render. The browser QA bridge is test infrastructure only and was removed before export.
46. **No cloud:** No Supabase, Firebase, REST/GraphQL client, analytics SDK, auth networking, Bhashini dependency, or runtime translation added. Final browser resource inspection showed only Metro on localhost and the temporary loopback QA bridge; no external resource host.
47. **Seven languages:** Caregiver chrome and messages are bundled for en, hi, as, bn, mni, kha, and lus and merged through the existing catalogs. Meitei uses the existing feature-catalog romanization convention. This is implementation coverage; native-speaker linguistic review remains required.
48. **Translation parity:** TypeScript enforces all caregiver keys for every language. Both the new QA and existing elderly-UX QA check nonempty values, key parity, and identical interpolation placeholders. Runtime translation is not used. Existing Intl/local-time formatting patterns are reused; unsupported date locales can use the platform's fallback locale.
49. **Text scaling:** Existing `ThemedText`, `SmaranButton`, `useTextSize`, and saved preference application. No heading, patient name, or metric line cap. Standard and extra-large text were checked; long names and labels wrap.
50. **High contrast:** Reuses existing theme colors and card/button components. Extra-large/high-contrast screenshots show readable text, outlined controls, and distinct cards. No status relies solely on color.
51. **Reduced motion:** No dashboard animation or polling is introduced. Caregiver Stack.Screen uses no transition animation; shared controls honor existing reduced-motion settings. Both enabled and disabled preferences were exercised in browser QA.
52. **Accessibility semantics:** Ten visible headings in the populated state; metrics group a natural label/value accessibility phrase. Buttons have explicit localized labels and visible keyboard focus. Decorative photo/speech icons use the existing hidden semantics. Important targets measured at least 56px with standard text and about 58px with extra-large text, growing for long labels.
53. **Screen-reader/speech behavior:** Browser accessibility roles, labels, focus order, and wrapping were inspected; an actual TalkBack/VoiceOver session was not performed. The optional “Read summary” control respects saved voice-guidance preference and uses `ReadScreenButton`/the existing speech service. Instrumented Expo speech verified content, explicit start/stop, and navigation cancellation. Audible output/native installed voices remain unverified; platform speech-length limits still apply.
54. **375 x 812 QA:** All seven languages tested with standard text/default contrast/motion and with extra-large text/high contrast/reduced motion. No horizontal overflow or clipped text detected. Screenshots reviewed for header, patient context, metrics, bottom controls, disclaimers, and states. Vertical scrolling is intentional.
55. **768px QA:** All seven languages tested at 768 x 1024 with extra-large/high-contrast/reduced-motion settings. Max-width stays 680px, metrics form readable rows, controls remain large, and content order is preserved. Cognitive details and memory fallback screenshots were also reviewed.
56. **All-language visual QA:** English, Hindi, Assamese, Bengali, Meitei/Manipuri, Khasi, and Mizo passed layout scans. Native-script font rendering and longer Roman-script labels were visually checked. These checks certify layout observations, not linguistic accuracy or native font availability.
57. **Populated-state QA:** Test-only records were supplied through an in-memory real SQLite bridge while running actual app screens. A real browser-played Memory Match was saved through the result flow; My Care then displayed its level played, saved recommendation, accuracy, attempts, hints, response time, and updated counts. Data in these tests is synthetic QA data, not a production patient history.
58. **Empty-state QA:** Both widths verified a real empty QA profile with zero counts and all relevant empty messages. Fresh-device caregiver selection verified the separate no-profile state and reversible Back navigation; no sample patient was silently created.
59. **Error-state QA:** Both widths injected a memory-repository read failure, verified calm recovery without stale metrics/raw errors, then restored the boundary and successfully retried. Initial web SQLite bootstrap failure is expected for production web. A transient hot-reload translation-key error occurred while adding the summary control; the completed catalogs/type checks and subsequent seven-language runs resolved it. The final stable-code smoke capture had no new console errors or failed requests. Expo's existing web-notification warning remains unrelated.
60. **Focus refresh:** Uses the existing `useIsFocused` + effect pattern with cancellation and retry dependency. Real My Day Done, a memory added through My Memories, and a saved Memory Match all appeared when the existing caregiver screen regained focus, without restarting the app. There are no repeating SQLite query timers. If the screen remains open across midnight, leave and return to recalculate the local-day window.
61. **Regression results:** `check-elderly-ux`, `check-my-day`, `check-my-memories`, and `check-my-home` all PASS after cleanup. Browser smoke also covered onboarding save, language/region/accessibility, Patient Home, Memory Match/result/Why This Level, My Day, My Memories, My Home/Tea gardens detail, speech start/stop, and navigation cancellation.
62. **check-my-care:** PASS using real in-memory SQLite and actual migrations/repositories/service with only the native database boundary substituted. Checks empty/missing/valid patient, isolation and malicious IDs, counts beyond preview limits, real field values, demo exclusion, model independence, read-only snapshots, reminder date/completion/ownership/duplicate rules, upcoming appointments, memory/feed order, error/retry, catalog parity, factual wording, photo-path guards, and no new migration. Runs in device local time, Asia/Kolkata, UTC, and America/New_York including the 23-hour DST transition day.
63. **TypeScript:** `npx.cmd tsc --noEmit` PASS. Expo regenerated its ignored typed-route declarations for `/caregiver/home`; no unsafe route cast or checked-in generated type edit was used.
64. **Lint:** `npx.cmd expo lint` PASS with zero errors and zero warnings after cleanup. Initial BOM and callback-dependency warnings were corrected.
65. **Expo Doctor:** `npx.cmd expo-doctor` PASS, 18/18 checks. Registry access required the approved sandbox escalation; package files were not changed.
66. **Expo config:** `npx.cmd expo config --type public` PASS. SDK 54, existing plugins, and native identifiers remain unchanged.
67. **Expo export:** Final all-platform export result is recorded in the validation footer. The first sandbox attempt could not execute `hermesc.exe`; the same production command was rerun with approval, without disabling Hermes or changing application configuration.
68. **Diff whitespace:** `git diff --check` PASS. New deliverables were also inspected for scope, temporary content, and source cleanliness.
69. **Package status:** `git diff -- package.json package-lock.json` is blank. No chart/date/backend/analytics package or lockfile churn.
70. **Migrations preserved:** Diffs for 001_core_bootstrap, 002_cognitive_adaptation, 003_multilingual_expansion, 004_my_day, 005_my_memories, and the migration runner are blank. The QA registry contains exactly five versions.
71. **Adaptive AI preserved:** `src/ai`, game engine/telemetry, result feedback/training, and migration 002 are unchanged. Only a read-only count method was added to the cognitive repository.
72. **My Day preserved:** Notification service, permission behavior, scheduling, completion writes, early-Done semantics, and existing repository methods are unchanged. One bounded read-only completion-history method was added.
73. **My Memories preserved:** Repository, save transaction ordering, media lifecycle, managed paths, picker semantics, and existing screens are unchanged. Their regression suite passes.
74. **My Home preserved:** All 32 items/assets, source documentation, state mapping, regional descriptions, and screens remain unchanged. Existing source/asset/mapping checks pass.
75. **Isolation evidence:** Independent patients with distinct sessions, reminders, completion events, and memories remain separate in the new test. An empty third patient stays empty. Cross-owner completion insertion fails the real FK. The dashboard snapshot leaves every table unchanged.
76. **No global aggregate leakage:** The test audits every executed dashboard SELECT, its scoped predicate, and bound patient ID. Counts do not use unscoped table totals. Browser focus capture likewise contained only SELECTs.
77. **Temporary cleanup:** Temporary bridge source, runtime substitutes, screenshots, logs, and snapshots were removed. The bridge's database lived only in memory and disappeared when stopped. No QA endpoint, mock adapter, `.tmp*` file, seeded JSON, debug log, or sample record remains in production source. The ignored `dist/` output is a production export artifact, not a QA substitute.
78. **Git status:** Six existing files modified and six legitimate new files, all unstaged; exact status in the footer. Starting user work was clean and nothing unrelated was discarded.
79. **Diff stat:** Tracked-file diff is six files, 38 insertions and 61 deletions. Git's ordinary diff stat excludes the six untracked deliverables; their individual line counts are recorded in the footer.
80. **Diff name-status:** Only the six modified files listed in item 2 appear in ordinary `git diff --name-status`. New deliverables appear under `??` in status and remain available for review without staging.
81. **Native Android:** NOT TESTED on a physical device or emulator. Export success is not proof of native SQLite/media integration, Android notification delivery, airplane mode, native voice availability, or TalkBack behavior. No EAS, APK, or standalone build work was started.
82. **Remaining limits:** Native device QA and native-speaker translation review; platform Intl/voice fallbacks; no live refresh while continuously focused across midnight; current-memory rows retain only creation/latest-update history; current lists assume a small same-device dataset. Reminder history cannot reconstruct edited titles or independently verify completion outside the app. These limits do not produce fake metrics.
83. **Future account linking:** Would require a separately approved identity/relationship, permission, recovery, and data-protection design. None is implied by this view or persisted for later.
84. **Remote caregiver scope:** Explicitly excluded. No remote patient control, cloud sharing, family invitations, clinician portal, or remote synchronization.
85. **Medical limitations:** Information is limited to activity recorded in Smaran. It is not diagnosis, assessment, risk scoring, disease monitoring, treatment, or independent adherence verification.
86. **Wording audit:** Exact safety choices include “Activities recorded,” “Level played,” “Latest recommended level,” “Marked done in Smaran,” and “Appointment reminder.” Final dangerous-language search matched only the English/romanized-Meitei negative disclaimer wording for diagnosis; both were inspected and retained. No unsupported clinical assertion was found.
87. **Repository extensions:** `cognitiveRepository.countSessions` provides patient-scoped date-window counts without limiting totals to recent rows; `myDayRepository.recentCompletions` provides ten patient-owned actual completion timestamps. No existing method's behavior was changed.
88. **Cross-cutting reasons:** Role selection and Home changes enable the two requested entries; catalog imports expose caregiver labels through the current translator; the two repository reads keep SQL beside existing persistence code. No shared UI, storage, migration, adaptive, notification, or photo service was modified.
89. **No fake production data:** Confirmed. Deterministic fixtures exist only in `scripts/check-my-care.cjs`; temporary browser fixtures were removed. Real production users see their own records, zeros, empty states, or recovery messages.
90. **Readiness:** MVP-11 is ready for local code/product review; the final all-platform export passed. It is not a native-device release certification. No next milestone was started.

Implementation references: the required [Expo SDK 54 documentation](https://docs.expo.dev/versions/v54.0.0/) was read before coding. Focus behavior was checked against the installed Router/React Navigation patterns and [Expo Router focus-effect implementation](https://github.com/expo/expo/blob/sdk-54/packages/expo-router/src/useFocusEffect.ts). Date/time helpers, photo fallback, theming, and speech contracts were reused from the current repository.

## Final validation and Git snapshot

Final export result: **PASS** (`npx.cmd expo export --platform all`, exit 0). Android and iOS Hermes bundles: 4.79 MB each; web bundle: 2.9 MB. Export contains 21 static routes, including `/caregiver/home`. Output: ignored `dist/`. The normal Expo web-notification and Node color-environment warnings do not fail the export. No runtime QA substitute was included.


| Validation | Result |
| --- | --- |
| TypeScript | PASS |
| Expo lint | PASS, no warnings |
| Expo Doctor | PASS, 18/18 |
| Public Expo config | PASS |
| Android/iOS/web export | PASS |
| All five QA scripts | PASS |
| git diff --check | PASS |
| Physical Android/emulator | NOT TESTED |
| Native-speaker review | Outstanding |

`git branch --show-current`

```text
feature/mvp11-my-care
```

`git log -1 --oneline --decorate`

```text
9eecb9b (HEAD -> feature/mvp11-my-care, tag: smaran-my-home-stable, master, feature/mvp10-my-home) feat: add offline NER My Home
```

`git status --short --untracked-files=all`

```text
 M app/onboarding/role.tsx
 M app/patient/home.tsx
 M src/db/repositories/cognitive.repository.ts
 M src/db/repositories/my-day.repository.ts
 M src/i18n/regional-strings.ts
 M src/i18n/strings.ts
?? app/caregiver/home.tsx
?? docs/history/MVP11_MY_CARE.md
?? scripts/check-my-care.cjs
?? src/caregiver/types.ts
?? src/i18n/care-strings.ts
?? src/services/caregiver.service.ts
```

`git diff --stat`

```text
 app/onboarding/role.tsx                     | 35 ++++++-----------------------
 app/patient/home.tsx                        | 35 +++--------------------------
 src/db/repositories/cognitive.repository.ts | 11 +++++++++
 src/db/repositories/my-day.repository.ts    |  9 +++++++-
 src/i18n/regional-strings.ts                |  5 +++++
 src/i18n/strings.ts                         |  4 ++++
 6 files changed, 38 insertions(+), 61 deletions(-)
```

`git diff --name-status`

```text
M	app/onboarding/role.tsx
M	app/patient/home.tsx
M	src/db/repositories/cognitive.repository.ts
M	src/db/repositories/my-day.repository.ts
M	src/i18n/regional-strings.ts
M	src/i18n/strings.ts
```

Untracked deliverables are intentionally not included in ordinary `git diff --stat`; no file was staged. New-file inventory:

| File | Lines |
| --- | ---: |
| `app/caregiver/home.tsx` | 182 |
| `src/caregiver/types.ts` | 21 |
| `src/services/caregiver.service.ts` | 66 |
| `src/i18n/care-strings.ts` | 188 |
| `scripts/check-my-care.cjs` | 191 |
| `docs/history/MVP11_MY_CARE.md` | 180 |

Staged diff: empty. Package/migration/protected-feature diffs: empty. Temporary QA files: none. Medical inference: none. Fake production data: none. No commit, merge, or tag.
