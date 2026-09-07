# MVP-12 — Cognitive Expansion

Implemented for review on `feature/mvp12-cognitive-expansion`, based on `d68b49f` (`smaran-my-care-stable`). Baseline branch, HEAD, ancestry and clean working tree were verified before editing. The continuation explicitly approved migration 006 and activity-scoped adaptation. No commit, merge, tag, APK, EAS build or deployment was performed.

## Implementation and dependency map

Patient Home → Train My Mind hub → Memory Match / Pattern Recognition / Routine Recall → typed completed telemetry → activity-specific feature extraction → shared recommendation mechanics → pending result → optional feedback → transactional session/model save → shared result and Why This Level.

My Care reads the same patient-owned session repository, aggregates all three legitimate activity types, and uses activity-aware titles and factual metrics. Migrations and schema types support this path; no parallel persistence or result system was introduced.

New files:

| File | Purpose |
| --- | --- |
| `app/patient/games/index.tsx` | Train My Mind hub |
| `app/patient/games/pattern-recognition.tsx` | Pattern route |
| `app/patient/games/routine-recall.tsx` | Routine route |
| `components/games/selection-activity-screen.tsx` | Shared tap-based activity UI, loading, retry, speech, progress and completion |
| `src/games/pattern-recognition.ts` | Deterministic five-level pattern content |
| `src/games/routine-recall.ts` | Five harmless English routines and ordered-selection tasks |
| `src/games/selection-engine.ts` | Actual selection, retry, hint and timing telemetry |
| `src/games/telemetry.ts` | Discriminated telemetry and explicit metric mapping |
| `src/games/presentation.ts` | Activity titles and honest summaries/facts |
| `src/services/cognitive.service.ts` | Shared feedback, recommendation and atomic save orchestration |
| `src/db/migrations/006_cognitive_expansion.ts` | Session/model table rebuild |
| `src/i18n/cognitive-strings.ts` | 42 UI keys in seven languages |
| `scripts/check-cognitive-expansion.cjs` | Deterministic migration, repository, adaptation, game and safety checks |
| `docs/MVP12_COGNITIVE_EXPANSION.md` | This review report |

Modified files are listed in the final Git snapshot. They cover Patient Home, Memory Match integration, shared result/Why screens, caregiver presentation/service/types, cognitive persistence/types/migration registration, adaptive input/extraction/explanation/model identity, translation registration, and narrowly updated historical QA expectations.

## Database and upgrade contract

The exact previous blocker was:

```sql
game_type TEXT NOT NULL CHECK (game_type = 'memory_match')
total_pairs INTEGER NOT NULL CHECK (total_pairs > 0)
matches INTEGER NOT NULL CHECK (matches = total_pairs)
repeated_mistakes INTEGER NOT NULL DEFAULT 0 CHECK (
  repeated_mistakes >= 0 AND repeated_mistakes <= attempts - matches
)
```

A single constrained table was chosen. It retains the existing session queries and atomic save path without introducing child-table joins or losing original fields.

| Session fields | Contract |
| --- | --- |
| Shared envelope | ID, patient ID, canonical game type, difficulty, attempts, accuracy, hints, average response time, optional feedback, recommended difficulty, demo flag, start/completion/creation timestamps |
| Memory Match only | `total_pairs`, `matches`, `repeated_mistakes`; previous relationships retained |
| Pattern only | `challenges_completed`, `correct_selections`, `repeated_errors` |
| Routine only | `steps_completed`, `correct_selections`, `repeated_errors` |
| Inapplicable fields | SQL NULL, absent from the TypeScript variant; no invented pairs/matches |
| New-game constraints | Integer counts, complete selections equal completed units, attempts at least correct selections, bounded repeated errors, factual accuracy ratio; Routine has 2–5 steps; integer levels 1–5 and maximum ±1 recommendation |
| Adaptive identity | Composite primary key `(patient_id, game_type)` |

Migration 006 creates replacement tables, copies existing fields using explicit column lists, drops the old tables, renames replacements and recreates indexes. It runs inside the existing exclusive migration transaction; the version ledger is written in that same transaction. It does not toggle `foreign_keys`.

The inspected 001–005 schema contains no inbound foreign keys to either cognitive table. Both remain children of `patient_profiles` with `ON DELETE CASCADE`. The existing `idx_cognitive_sessions_patient_completed` is retained, and `idx_cognitive_sessions_patient_game_completed` supports per-activity history. The composite model primary key supplies its ownership lookup index.

Expo SDK 54's installed `SQLiteDatabase.ts` opens a separate connection for exclusive transactions. Connection-local foreign-key settings therefore must not be assumed to propagate. Migration 006 explicitly checks `PRAGMA foreign_key_check` before commit, including a tested failure with FK enforcement off. Cognitive saves verify that the patient exists inside the transaction; session/model ownership is also checked before writing. The existing shared connection still enables foreign keys. No transaction-runner rewrite was needed.

All historical Memory Match rows retain every original value. Existing model rows gain only `game_type = 'memory_match'`; their weights, bias, sample counts and timestamps are not reinitialized or retrained.

Failure recovery is atomic. Tests inject failure after the complete rebuild, and separately inject an orphan that fails final FK validation. Both restore the old schema and migration ledger. Session/model and readback failures also roll back their entire save transaction. A successful upgrade has no automatic downgrade: an older binary's patient-only model upsert is incompatible. A release requiring downgrade recovery needs a consistent pre-upgrade database backup or a reviewed forward correction. Restoring a backup loses records created after that backup.

No production or physical-device database was opened during this task. Upgrade and reopen checks used isolated real SQLite databases. The normal native startup migration runner will apply 006 when this code is run against an existing installation.

References: [Expo SDK 54](https://docs.expo.dev/versions/v54.0.0/), [Expo SQLite SDK 54](https://docs.expo.dev/versions/v54.0.0/sdk/sqlite/), [SQLite table-rebuild guidance](https://www.sqlite.org/lang_altertable.html#making_other_kinds_of_table_schema_changes). API behavior was also checked through Context7 and the installed SDK source.

## Activities and adaptation

| Level | Pattern Recognition | Routine Recall |
| --- | --- | --- |
| 1 | AB, two distinct choices | Two steps: book into an open bag |
| 2 | AB/AAB, three choices | Three steps: fold and store a towel |
| 3 | ABC/AABB, three choices | Four steps: pencil into a box, then store it |
| 4 | ABCA/AABC, four choices | Four steps: picture into an envelope |
| 5 | ABACD/AABCD, four choices | Five steps: prepare and put away a bag |

Pattern has five challenges per completed activity. The repeating group is shown explicitly, followed by two repetitions and a prefix. Choices are distinct and contain exactly one answer. Shapes differ by form, not only color. Numbered tiles wrap vertically on small screens.

Routine previews the intended sequence before Start, which makes the intended ordering explicit even where an everyday action might have other reasonable orders. Choices contain only remaining steps; the user taps the first, then next step. Content includes no medication, medical, emergency, fire/stove, heated-food, financial or other safety-critical procedure.

Both activities count each submitted selection, require actual completion, allow one factual hint per question, and detect repeated selection of the same incorrect option on the same question. There are no countdowns, automatic challenge advances, failure sounds or harsh failure haptics. Continue gives the user control after each successful choice. Background time and time spent waiting on Continue are excluded from decision duration. Timing stays out of the patient-facing game UI.

Memory Match retains its board engine, pair counts, preview/timers and original numeric features. Its first level remains **2**. Pattern and Routine start at **1**, read only the patient's same-activity non-demo history, and do not create learned model rows before feedback on an actual completed activity. Skipping feedback stores NULL and leaves learned weights untouched.

Shared sigmoid recommendation thresholds, bounded training and the maximum ±1 adjustment remain unchanged. Pattern uses accuracy, its own decision-time baseline, repeated errors per attempt, hints per completed pattern and recent accuracy consistency. Routine uses its own decision-time baseline, ordering accuracy, correct selections minus repeated errors per attempt, hints per completed step and recent accuracy consistency. Values are bounded to 0–1. The existing internal model weight names are reused as numeric slots; they are not clinical measurements.

Results, explanations and caregiver details dispatch on the canonical `CognitiveActivityType`. Why This Level uses earlier sessions from the same patient/activity and the recommendation saved with the exact session. During browser QA, opening another activity after Why This Level exposed an inactive result screen redirect. Result and Why screens now guard their effects by navigation focus. The full consecutive-activity browser flow passed after the fix; the QA script checks that guard remains present.

## Verification

All commands below passed on the final production source with the temporary web bridge removed. The additional final FK/index regression assertions were then run successfully in `check-cognitive-expansion.cjs`.

| Command | Result |
| --- | --- |
| `node scripts/check-elderly-ux.cjs` | PASS: seven catalogs, interpolation, speech cancellation/fallback |
| `node scripts/check-my-day.cjs` | PASS: persistence, notifications, ownership, calendar boundaries, duplicate protection |
| `node scripts/check-my-memories.cjs` | PASS: persistence, file lifecycle, rollback, path guards |
| `node scripts/check-my-home.cjs` | PASS: all 32 items/images, eight state mappings, offline content |
| `node scripts/check-my-care.cjs` | PASS: real SQLite, factual counts, isolation, read-only dashboard, retry; device-local/India/UTC/New York dates |
| `node scripts/check-cognitive-expansion.cjs` | PASS: migration, models, all game levels, telemetry, safety, presentation and language parity |
| `npx tsc --noEmit` | PASS |
| `npx expo lint` | PASS, no warnings |
| `npx expo-doctor` | PASS, 18/18 |
| `npx expo config --type public` | PASS, SDK 54 |
| `npx expo export --platform all` | PASS: Android/iOS Hermes bundles and web export, 24 static routes |
| `git diff --check` | PASS |
| Historical migration and package diffs | Blank |

On Windows, `npx.cmd` was used to avoid PowerShell execution-policy restrictions. Export reported the existing web notification-listener limitation and environment color warnings; neither failed the export.

Migration QA covers the actual fresh 001→006 registry, a populated 001–005 upgrade, repeat runner invocation, injected rebuild rollback, FK-validation rollback, exact preservation of eight historical sessions and two patients' models, index definitions, composite-key uniqueness, all three game types, invalid types/metrics, patient isolation, atomic save failures, independent models, and file reopen persistence.

The My Day/My Memories scripts previously assumed a five-migration registry and compared `SELECT *` snapshots. Their migration-count expectations now include 006, and snapshots explicitly compare every historical field. Their behavioral and data-integrity assertions remain intact. My Care's fixture model insert and migration inventory were updated narrowly.

### Browser matrix

Real routes ran at `http://localhost:8082` using a temporary local SQLite bridge and a temporary web device-storage boundary. Actual application repositories, services, screens, game logic and migration SQL were exercised. Level 5 setup records and test profiles existed only in the disposable QA database.

| UI language | 375×812: Pattern L1/L5, Routine L1/L5 | 768×1024: same flows |
| --- | --- | --- |
| English | PASS | PASS |
| Hindi | PASS | PASS |
| Assamese | PASS | PASS |
| Bengali | PASS | PASS |
| Meitei | PASS | PASS |
| Khasi | PASS | PASS |
| Mizo | PASS | PASS |

Every case used extra-large text, high contrast, reduced motion and voice controls. The matrix exercised the hub, previews, progress, repeated incorrect choices, hints, completion, optional feedback/skip, SQLite save, result, Why This Level, return to hub, another activity, and My Care. It checked exact saved attempts/correct selections/hints/repeated errors, model behavior, activity titles and displayed levels. No horizontal overflow, offscreen horizontal content, or answer targets below 64px was found. English phone answer buttons measured 312×72px. Phone Pattern L1/L5 and Routine L5 screenshots were inspected, then deleted.

The matrix had no console errors or failed network requests. The existing Expo notifications web warning was present. Separate intentional save-failure QA produced one expected logged error: no session was added and no success controls appeared; retry added exactly one session. Preparation failure/retry and keyboard Enter activation passed. Memory Match completed at Level 2 with three pairs, three attempts, one hint, accuracy 1, feedback `easy`, and next level 3, then successfully opened another activity.

With Assamese controls, the real Windows browser speech engine read English routine steps using `en-US`. Stop worked, and leaving the screen cancelled speech. This verifies the shared web speech flow, not Android voices or physical-device audio.

The temporary bridge, storage adapter, fixture database, test scripts/data, screenshots and Playwright logs were removed. The original `client.web.ts` was restored exactly. Production web persistence remains intentionally unsupported; the web export is not evidence of native persistence QA.

## Required review record

The following maps all 78 requested report points to the implemented evidence.

| # | Review point | Outcome |
| --- | --- | --- |
| 1 | Files created | Fourteen, listed above and in Git status |
| 2 | Files modified | Twenty, listed in Git status |
| 3 | Dependencies | Zero additions; package files unchanged |
| 4 | Migration 006 | Added and registered normally |
| 5 | Old schema blocker | Memory-only CHECK plus mandatory pair metrics, quoted above |
| 6 | Target session architecture | Shared envelope plus constrained activity-specific nullable columns |
| 7 | Table rebuild | Explicit create/copy/drop/rename and recreated indexes |
| 8 | Foreign keys | Patient cascade preserved; no inbound dependencies; final integrity check |
| 9 | Rollback atomicity | Rebuild failure and FK-validation failure tested |
| 10 | Memory Match row preservation | Every original field compared before/after |
| 11 | Adaptive migration | Existing model rows tagged memory_match |
| 12 | Model identity | Composite patient/activity primary key |
| 13 | Old model preservation | Every original weight, bias, count and timestamp compared |
| 14 | Activity union | One canonical three-value CognitiveActivityType |
| 15 | Telemetry types | Explicit discriminated union; no any |
| 16 | Memory telemetry | Original calculations retained; discriminator added |
| 17 | Pattern telemetry | Completed patterns, selections, attempts, accuracy, hints, repeated errors and time |
| 18 | Routine telemetry | Completed steps, selections, attempts, accuracy, hints, repeated errors and time |
| 19 | Extraction architecture | Activity dispatch plus shared recommendation/training |
| 20 | Memory features | Pair-based calculations retained and numerically checked |
| 21 | Pattern features | Same-activity factual normalized measures |
| 22 | Routine features | Same-activity factual ordering measures |
| 23 | Adaptive isolation | Independent reads, upserts and trained models tested |
| 24 | Initial levels | Memory 2 unchanged; Pattern/Routine 1 |
| 25 | ±1 rule | Shared mechanics, repository validation and new-game SQL constraints |
| 26 | Hub | Three real activities; Patient Home routes to hub |
| 27 | Pattern architecture | Local curated repeating groups plus shared selection engine |
| 28 | Pattern levels | Five conservative configurations, described above |
| 29 | Pattern validity | Determinism, valid symbols, repetition and one answer tested |
| 30 | Pattern accessibility | Numbered/labelled shapes, large buttons, keyboard and scrolling |
| 31 | Pattern speech/haptics | Existing speech control and gentle selection haptic |
| 32 | Routine architecture | Local preview and ordered tap-selection tasks |
| 33 | Routine levels | 2, 3, 4, 4, 5 steps |
| 34 | Routine safety | Harmless content reviewed and scanned |
| 35 | Routine interaction | First/next taps, retry, hint and explicit Continue |
| 36 | Routine accessibility | Short text, English body language, meaningful option labels |
| 37 | Shared results | Activity-aware counts, accuracy, hints, attempts and next level |
| 38 | Shared Why This Level | Correct activity, prior own history and saved recommendation |
| 39 | Feedback | Optional; skipped value NULL, no invented training target |
| 40 | Atomic persistence | Session, optional model and readback inside one transaction |
| 41 | Caregiver integration | Correct activity titles, next-level source and event labels |
| 42 | Caregiver counting | Patient-scoped whitelist; demo rows excluded; no recent-history count cap |
| 43 | Caregiver metrics | Pair metrics only for Memory; patterns/steps for new games |
| 44 | Seven-language UI | 42 new keys per language with interpolation parity |
| 45 | Routine fallback | Explicit English body notice and speechLanguage=en |
| 46 | Patient isolation | Two-patient repository/migration QA and separate browser profiles |
| 47 | Offline behavior | Bundled content/icons, local SQL, no runtime service dependency |
| 48 | High contrast | Existing theme colors; matrix enabled |
| 49 | Reduced motion | Matrix enabled; no new timed animation |
| 50 | 375×812 | All languages, both games, L1/L5 and shared flows passed |
| 51 | 768px | Same matrix passed at 768×1024 |
| 52 | Seven-language browser QA | All seven passed |
| 53 | Pattern all-level QA | Deterministic checks at L1–L5; browser L1/L5 |
| 54 | Routine all-level QA | Deterministic checks at L1–L5; browser L1/L5 |
| 55 | Migration QA | Fresh/upgrade/replay/rollback/integrity/constraints passed |
| 56 | Adaptive QA | Patient and activity isolation, skip and bounded updates passed |
| 57 | Memory regression | Engine/feature checks and real browser completion passed |
| 58 | My Care regression | All timezone runs and browser labels/count data passed |
| 59 | My Day regression | Existing comprehensive script passed |
| 60 | My Memories regression | Existing comprehensive script passed |
| 61 | My Home regression | All 32 content items/assets passed unchanged |
| 62 | TypeScript | PASS |
| 63 | Lint | PASS, no warnings |
| 64 | Expo Doctor | 18/18 PASS |
| 65 | Expo config | PASS |
| 66 | Expo export | Android/iOS/web PASS |
| 67 | Packages | Both package files unchanged |
| 68 | Migrations 001–005 | Untouched; all five diffs blank |
| 69 | Migration 006 status | Approved forward migration added; no device DB migrated here |
| 70 | Clinical claims | Safety scan found no unsupported assertion; disclaimers retained |
| 71 | Fake metrics | Only actual completed selections persist; no seeded production models |
| 72 | Temporary cleanup | All browser adapters, fixtures, screenshots and logs removed |
| 73 | Native Android | Not tested; no physical Android/APK/EAS claim |
| 74 | Native-speaker review | Outstanding for new UI translations, especially regional languages |
| 75 | Remaining limitations | Small deterministic content set; English routine bodies; device QA and downgrade recovery remain release work |
| 76 | Final Git status | Captured below; no staged changes |
| 77 | Final diff stat | Captured below; untracked files excluded by Git |
| 78 | Final name-status | Captured below, with separate untracked inventory |

The final safety search covered diagnosis, dementia score, severity, stage, progression, decline, deterioration, risk, cognitive health, memory strength, IQ, too slow and wrong in game/result/caregiver production code and new strings. There were no matches in those searched files. Existing translated medical-safety disclaimers remain intact. My Day notification code, My Memories media lifecycle, My Home content/assets and onboarding production files were not changed.

## Final Git snapshot


### Branch

```text
feature/mvp12-cognitive-expansion
```

### HEAD

```text
d68b49f (HEAD -> feature/mvp12-cognitive-expansion, tag: smaran-my-care-stable, master, feature/mvp11-my-care) feat: add offline My Care caregiver dashboard
```

### git status

```text
On branch feature/mvp12-cognitive-expansion
Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
	modified:   app/caregiver/home.tsx
	modified:   app/patient/games/memory-match.tsx
	modified:   app/patient/games/result.tsx
	modified:   app/patient/games/why-level.tsx
	modified:   app/patient/home.tsx
	modified:   scripts/check-my-care.cjs
	modified:   scripts/check-my-day.cjs
	modified:   scripts/check-my-memories.cjs
	modified:   src/ai/adaptive-engine.ts
	modified:   src/ai/explanation.ts
	modified:   src/ai/feature-extractor.ts
	modified:   src/ai/types.ts
	modified:   src/caregiver/types.ts
	modified:   src/db/migrations/index.ts
	modified:   src/db/repositories/cognitive.repository.ts
	modified:   src/db/schema.types.ts
	modified:   src/games/memory-match/telemetry.ts
	modified:   src/i18n/regional-strings.ts
	modified:   src/i18n/strings.ts
	modified:   src/services/caregiver.service.ts

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	app/patient/games/index.tsx
	app/patient/games/pattern-recognition.tsx
	app/patient/games/routine-recall.tsx
	components/games/selection-activity-screen.tsx
	docs/MVP12_COGNITIVE_EXPANSION.md
	scripts/check-cognitive-expansion.cjs
	src/db/migrations/006_cognitive_expansion.ts
	src/games/pattern-recognition.ts
	src/games/presentation.ts
	src/games/routine-recall.ts
	src/games/selection-engine.ts
	src/games/telemetry.ts
	src/i18n/cognitive-strings.ts
	src/services/cognitive.service.ts

no changes added to commit (use "git add" and/or "git commit -a")
```

### git diff --stat

```text
 app/caregiver/home.tsx                      |  15 ++-
 app/patient/games/memory-match.tsx          |  16 ++--
 app/patient/games/result.tsx                |  76 ++++++---------
 app/patient/games/why-level.tsx             |  49 +++++-----
 app/patient/home.tsx                        |   4 +-
 scripts/check-my-care.cjs                   |   8 +-
 scripts/check-my-day.cjs                    |  10 +-
 scripts/check-my-memories.cjs               |  10 +-
 src/ai/adaptive-engine.ts                   |   5 +-
 src/ai/explanation.ts                       |   9 +-
 src/ai/feature-extractor.ts                 |  53 ++++++++++-
 src/ai/types.ts                             |   6 +-
 src/caregiver/types.ts                      |   3 +-
 src/db/migrations/index.ts                  |   2 +
 src/db/repositories/cognitive.repository.ts | 141 ++++++++++++++++++----------
 src/db/schema.types.ts                      |  18 ++--
 src/games/memory-match/telemetry.ts         |   2 +
 src/i18n/regional-strings.ts                |   5 +
 src/i18n/strings.ts                         |   4 +
 src/services/caregiver.service.ts           |   2 +-
 20 files changed, 269 insertions(+), 169 deletions(-)
```

### git diff --name-status

```text
M	app/caregiver/home.tsx
M	app/patient/games/memory-match.tsx
M	app/patient/games/result.tsx
M	app/patient/games/why-level.tsx
M	app/patient/home.tsx
M	scripts/check-my-care.cjs
M	scripts/check-my-day.cjs
M	scripts/check-my-memories.cjs
M	src/ai/adaptive-engine.ts
M	src/ai/explanation.ts
M	src/ai/feature-extractor.ts
M	src/ai/types.ts
M	src/caregiver/types.ts
M	src/db/migrations/index.ts
M	src/db/repositories/cognitive.repository.ts
M	src/db/schema.types.ts
M	src/games/memory-match/telemetry.ts
M	src/i18n/regional-strings.ts
M	src/i18n/strings.ts
M	src/services/caregiver.service.ts
```

### git ls-files --others --exclude-standard

```text
app/patient/games/index.tsx
app/patient/games/pattern-recognition.tsx
app/patient/games/routine-recall.tsx
components/games/selection-activity-screen.tsx
docs/MVP12_COGNITIVE_EXPANSION.md
scripts/check-cognitive-expansion.cjs
src/db/migrations/006_cognitive_expansion.ts
src/games/pattern-recognition.ts
src/games/presentation.ts
src/games/routine-recall.ts
src/games/selection-engine.ts
src/games/telemetry.ts
src/i18n/cognitive-strings.ts
src/services/cognitive.service.ts
```

Ordinary diff statistics exclude the fourteen new, untracked deliverables above. Staged diff is empty. Package and historical-migration diffs are empty.
