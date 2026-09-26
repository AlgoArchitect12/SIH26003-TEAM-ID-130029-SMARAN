# MVP-20: offline cognitive activities and coaching

Worktree: `C:\Users\Dharmin\OneDrive\Desktop\SMARAN-A`, branch `feature/mvp20-cognitive-ai`.
Baseline: `e6b0f2c056d3eedaf16b90b7b280a32188f82952`, also `smaran-mvp19-stable`.
Migration 007 was explicitly authorized. No commit, merge, tag, APK build, or deployment is part of this work.

## 1. Migration architecture

`src/db/migrations/007_cognitive_ai_expansion.ts` registers version 7, `cognitive_ai_expansion`, in the existing migration registry. Migrations 001–006 are unchanged.

The existing `runMigrations` wraps the complete `up` call and its `schema_migrations` insertion in `withExclusiveTransactionAsync`. Migration 007 creates `cognitive_sessions_v7`, copies every existing column plus SQLite `rowid`, drops the copied original, and renames the replacement. It repeats that process for `adaptive_model_state`. There is no reset, seed, new telemetry column, or network operation.

Both tables are children of `patient_profiles`, with no incoming foreign keys in the shipped 001–006 schema. Each replacement retains `ON DELETE CASCADE` and its original primary key: session `id`, and model `(patient_id, game_type)`. The migration leaves foreign-key PRAGMAs unchanged. It runs `PRAGMA foreign_key_check` before commit, including when Expo's separate transaction connection has enforcement off.

All explicit index SQL is captured from `sqlite_schema` and recreated after the rebuild, preserving names, column order, descending order, uniqueness and partial predicates. Primary-key autoindexes come from the table definitions. The existing indexes are `idx_cognitive_sessions_patient_completed` and `idx_cognitive_sessions_patient_game_completed`. Rowids are copied explicitly because analytics uses them as pagination snapshot boundaries.

This follows the create/copy/drop/rename approach described by [SQLite](https://www.sqlite.org/lang_altertable.html#making_other_kinds_of_table_schema_changes), using the project's [Expo SDK 54 SQLite transaction API](https://docs.expo.dev/versions/v54.0.0/sdk/sqlite/). No foreign-key toggle is needed for these child-only rebuilds.

## 2. Historical preservation and recovery

`node scripts/check-cognitive-migration.cjs` builds a genuine pre-007 database through the actual historical migrations. Its synthetic fixtures contain two patients, 30 sessions spanning all three old games and levels 1–5, and six separately trained model rows. They include every feedback value and null feedback, demo flags, fractional response timing/weights, distinct timestamps, and non-contiguous rowids.

After the normal runner applies 007, the check compares every field and rowid of every historical row, as well as unaffected tables. It compares exact index definitions, primary-key autoindexes, and foreign-key definitions. Additional test-only partial/session and model indexes verify that preservation is not limited to hard-coded index names.

Injected failures after either table's drop/rename, during index recreation, and while registering version 7 must restore the entire pre-migration schema and data. An orphan with FK enforcement off also causes a full rollback. Successful reruns are no-ops; fresh 001–007 creation succeeds with FK enforcement on and off and creates no sessions or learned models. Integrity checks pass. These are disposable SQLite tests, not a claim that an installed phone database has already been upgraded.

On failure, the runner rolls back and the existing bootstrap presents recovery/retry. Do not delete the database to resolve a migration failure. There is no automatic downgrade migration: an older schema cannot store the three new identifiers. Retain the database and investigate a failed upgrade; any later restore or downgrade needs a separately authorized recovery procedure.

## 3. Old and new constraints

The original identifiers remain exactly `memory_match`, `pattern_recognition`, and `routine_recall`. Added identifiers are `familiar_object`, `sequence_memory`, and `picture_recall`. Both rebuilt tables reject any other game identifier. User-facing “Pattern & Shape” does not rename `pattern_recognition`.

All original metric branches and their limits remain intact. Memory Match retains positive pair totals, complete matches, bounded repeated mistakes, and null selection-specific columns. The existing Pattern/Routine accuracy, integer, completion-count, repeated-error, and one-step recommendation checks remain.

The selection branch extends to the three new games. Familiar Object and Picture Recall reuse positive integer `challenges_completed`; Sequence Memory uses integer `steps_completed` from 2 through 6. For each, the completion count equals `correct_selections`, correct selections cannot exceed attempts, repeated errors cannot exceed incorrect attempts, and accuracy must equal correct selections divided by attempts. Pair-only columns and the other completion-count column must be null. Routine's existing 2–5 step limit remains separate.

Nonnegative hints and recorded response times, valid feedback, difficulty 1–5, and the existing model sample-count constraint remain enforced. All implemented games record decision timing, so `avg_response_ms` remains required; no unknown timing is replaced with invented data. Invalid IDs, null required metrics, fractional counts, wrong completion columns, inconsistent accuracy, impossible repeated-error counts, and invalid difficulty changes are rejected by regression checks.

## 4. Six playable games

| Display name | Stored identifier | Mechanic |
| --- | --- | --- |
| Memory Match | `memory_match` | Preview and match pairs of familiar pictures |
| Pattern & Shape | `pattern_recognition` | Match shapes, continue patterns, or fill a missing shape |
| Routine Recall | `routine_recall` | Preview harmless everyday steps, then select them in order |
| Find the Familiar Object | `familiar_object` | Recognize the picture matching a name or meaning clue |
| Sequence Memory | `sequence_memory` | Hide an ordered picture preview and reconstruct that order |
| Picture Recall | `picture_recall` | Hide a picture set and recognize remembered pictures among unseen distractors |

All use bundled content. The three added games use the existing Material Icons picture collection; they do not download images or claim that generic objects belong to a particular patient.

| Activity / level | 1 | 2 | 3 | 4 | 5 |
| --- | --- | --- | --- | --- | --- |
| Memory Match pairs | 2 | 3 | 4 | 6 | 8 |
| Pattern & Shape | Match, 2 choices | Alternation, 3 choices | Longer groups, 3 choices | Internal gap, 4 choices | Longer internal-gap groups, 4 choices |
| Routine Recall steps | 2 | 3 | 4 | 4 | 5 |
| Familiar Object choices | 2, named object | 3, named object | 4, meaning clue | 5, meaning clue | 6, meaning clue |
| Sequence Memory positions | 2 | 3 | 4 | 5 | 6 |
| Picture Recall pictures | 2 | 3 | 4 | 4 | 5 |

Pattern & Shape and Familiar Object each have five questions. Routine levels 3 and 4 use different content with the same step count. These are product difficulty settings, not clinical stages.

## 5. Pattern & Shape 2.0

Every level has five deterministic challenges with unique choices and exactly one correct answer. Level 1 matches a displayed shape using two options. Level 2 continues an alternating pattern using three options. Level 3 continues longer three-shape or paired repeating groups. Levels 4 and 5 fill an internal gap in four- and five-position repeating groups, with four options.

The repeated group is visible where applicable, giving an explicit intended rule. Numbered shapes wrap on narrow screens. An internal gap is rendered as `?`, with a localized missing-position accessibility label; its answer is not included in the rendered sequence or that label. Shape identity uses geometry and text, without depending on color.

## 6. New game mechanics

**Familiar Object:** five questions per session. Levels 1–2 ask for an explicitly named object; levels 3–5 use localized meaning clues, such as recognizing something with pages to read. Options increase from two to six. The second support stage shows the target picture; the final stage names the answer.

**Sequence Memory:** previews contain 2, 3, 4, 5, or 6 ordered pictures. Higher levels include repeated symbols, so eliminating previously selected choices cannot solve the activity. The patient chooses when to hide the preview. Each subsequent prompt asks for one position. The preview is unmounted during recall and reappears only when the relevant hint is delivered.

**Picture Recall:** previews contain 2, 3, 4, 4, or 5 distinct pictures. Order is irrelevant. Each question contains exactly one picture from the preview and one to three pictures absent from it; a second remembered picture is never used as an ambiguous distractor. The patient chooses when to hide the preview. Support can replay the picture set or explicitly identify the answer.

## 7. Offline coach architecture and AI boundary

`src/ai/cognitive-coach.ts` contains pure, deterministic state transitions and typed translation-key selection. Transient state is only wrong answers for the current question/pair and support level 0–3. The shared selection engine and Memory Match screen use the same rules. There is no free-text generation, LLM, provider SDK, API key, or online inference.

The existing per-patient/per-game adaptive model remains the performance-aware part of the implementation. `online-trainer.ts` refers to incremental model updates on the device, not internet access. Authenticated online generative enhancement is a future possibility only; no such integration was added.

Any future online AI integration needs a separately scoped, authenticated backend with patient authorization, explicit consent and minimal transmitted data. Provider credentials must remain on that backend. Optional responses must be validated, remain within the nonmedical coaching boundary, and fall back to these offline rules on timeout or failure. An online response must never invent attempts, completions, feedback or saved measurements. None of that backend, authentication or network integration exists in MVP-20.

## 8. Incorrect answers, hints, and correct answers

The first wrong answer says exactly: **“That answer isn't correct. Try once more.”** It is localized in the other six catalogs. A second wrong answer provides a supportive message and the first game-specific hint. A third wrong answer reveals the correct answer and disables distractors. The patient still taps the answer (or both matching cards); no correct selection is synthesized.

Manual Hint advances through three stages: a game-specific strategy, a focused cue/replay, and an explicit answer. Each newly delivered support event adds one hint, including automatic help. Jumping directly from the first hint to reveal counts one new delivered event, not two unseen stages. Repeated taps at maximum support do not inflate hints.

Correct selections receive explicit positive feedback and a Continue action. Support resets for the next question/pair. Memory Match's preview and comparison feedback are now patient-controlled, so a brief timer cannot remove the instructions before they are read. Its card positions are visibly numbered as well as announced. The small final completion navigation delay is not a gameplay deadline.

## 9. Adaptive compatibility

History and model queries remain scoped to both patient and game. New selection games start at level 1 when no history exists; Memory Match retains its existing initial level 2. The latest saved recommendation chooses the next level for that game.

Accuracy, same-game personal pace, repeated errors, hints, and recent accuracy stability feed the existing bounded model. New-game extraction reuses the same selection baseline and normalized features. Recommendations remain within 1–5 and at most one level from the played level. Optional feedback trains only that patient's model for that game; Skip does not invent feedback or train a model. Memory Match's feature formula and pair metric semantics remain unchanged.

## 10. Telemetry semantics

Memory Match attempts are completed two-card comparisons; `matches` and `total_pairs` represent actual matched pairs. Its existing repeated-mistake key is an unordered mismatched symbol pair.

For the five selection games, an attempt is an accepted answer tap. Correct selections count actual correct taps, including taps made with support; they are not an unaided-ability measurement. A repeated error is selecting the same wrong choice again for the same question. Automatic reveals themselves never count as attempts or correct answers.

Decision durations are measured from an actionable boundary. Previews, time waiting to Continue, and app-background time are excluded by starting/resuming the decision clock. Time spent considering an answer or reading a delivered hint can remain in decision timing. Wall-clock start/completion timestamps remain separate and may span pauses. Old recorded timing is copied unchanged by migration.

Hints include requested and automatic help, so comparisons with pre-coach hint counts need that context. There is no invented “unassisted correct” field. Unused pair or completion-count columns stay null; optional feedback remains null when skipped. Completed-only persistence and demo exclusion remain unchanged.

## 11. Caregiver analytics

The existing registry-driven analytics supports all six game names, summaries, level groups, history, hints, repeated errors, and recorded timing. SQL continues to use pair matches for Memory Match and correct selections for the other games. Accuracy and response timing use their proper aggregate denominators; no combined cognitive score or clinical trend is introduced.

The caregiver dashboard retains its existing latest-three preview while counting all supported sessions. Full analytics history remains paginated. The expanded analytics regression checks 366 tied-timestamp sessions across all six games, both patients, 1/7/30-day windows, weighted metrics, unknown legacy elapsed timing, read-only behavior, and device-local/India/UTC/New York date boundaries.

## 12. Patient isolation and stale saves

Preparation and gameplay keep the existing patient revision guard. The save service resolves the active patient and verifies pending/model ownership. The repository receives the captured guard and checks it before writes and again before its transaction callback completes. A switch during an awaited session/model operation throws and rolls back both changes. A switch away and back still changes the revision and invalidates old work.

The result screen also requires the pending object to remain the store's current pending object. This blocks a queued pre-switch Submit callback even after returning to the same patient. Late success/error responses cannot repopulate another patient's result UI. A save whose native commit was already dispatched may complete for its original owner; it is never reassigned, and its stale UI response is ignored.

## 13. Localization, accessibility, and medical safety

All added UI text, coach messages, object clues, game names, and placeholders exist in English, Hindi, Assamese, Bengali, Meitei, Khasi, and Mizo, with typed catalog parity and actual-catalog wiring checks. Translations require native-speaker review. Routine Recall retains its pre-existing English routine bodies and explicit English-content notice/read-aloud behavior; seven-language catalog parity is not a claim that these older bodies were translated.

Screens reuse shared typography, contrast colors, large controls, readable wrapped labels, reduced-motion preferences, and optional read-aloud with existing voice-unavailable fallback. No countdown or required speed is imposed. Answers have text/shape labels and accessible names, feedback has polite live regions, and picture previews are absent from the accessibility tree when hidden. Browser/native-boundary tests do not certify TalkBack, VoiceOver, installed offline voices, or physical touch behavior.

Content is limited to benign recognition/recall exercises. The coach does not diagnose, stage a condition, infer fatigue or mood, predict progression, prescribe, or recommend treatment. Existing result/explanation and caregiver safety wording remains in place.

## 14. Changed files

The complete file inventory and exact Git status are recorded below. Ordinary `git diff --stat` excludes newly created, untracked deliverables.

## 15. Migration validation

`node scripts/check-cognitive-migration.cjs` passed again during takeover. It covers six injected rollback boundaries, FK-off orphan detection, exact named/primary-key indexes, primary-key uniqueness, patient-specific cascades, repeat invocation, and fresh creation without demo data.

## 16. Regression validation

Every requested regression completed with exit code 0; individual results are recorded below. Older test fixtures were expanded to six identifiers and seven migrations. Historical migration preservation checks still cover 001–006. The visual guard allows only the explicitly listed cognitive changes and authorized migration/registration; unrelated protected files remain guarded. Analytics' larger fixture uses a sufficient bounded history page rather than dropping timing assertions.

`scripts/check-cognitive-ai.cjs` exercises actual TypeScript engines, repositories/services with real SQLite, and native-boundary-controlled screen handlers. It covers all five selection games at every level with perfect and supported play, the coach for all six games, all six screen flows in seven languages at levels 1 and 5, progressive support/replay, rapid taps, numeric card labels, preview hiding, factual saves, models/analytics, and six stale-save boundaries. The existing profile-switching test additionally checks queued pre-switch submission and late results.

## 17. Toolchain validation

TypeScript, lint, dependency compatibility, public configuration and the all-platform export passed. The first Expo Doctor attempt passed 16/18 checks, with two remote-service failures; its network-enabled retry passed 18/18. The first approval review for that retry timed out, and the permitted second attempt succeeded. Package and configuration files were not changed to obtain that result. Export details are recorded below.

## 18. Protected paths

Git comparison against `e6b0f2c` confirmed no changes to `package.json`, `package-lock.json`, `app.json`, `eas.json`, `plugins/with-private-backup.cjs`, or `src/db/client.web.ts`. Historical migrations 001–006 also remain unchanged. The only new migration is 007, plus its required registry entry.

Browser QA substituted native SQLite and SecureStore exports only inside disposable development-browser sessions. A loopback-only bridge operated on an in-memory synthetic database. It did not open an installed patient database or change production imports, storage fallback, configuration, or dependencies. Those helpers and their output were deleted after use. The maintained regression scripts under `scripts/` are intentional test deliverables and are not imported by production.

## 19. Physical-device work remaining

1. Upgrade a backed-up, populated native installation from the stable baseline; compare history, models, indexes and FK integrity, restart, and simulate process interruption/storage failure during 007.
2. Complete all six games at levels 1 and 5 on Android/iOS, including duplicate/rapid taps, hardware Back, background/foreground, force-close, restart and airplane mode. Confirm no unfinished session is presented as saved.
3. Exercise A → B → A during game preparation, play, feedback/save and explanation/analytics loads. Verify original ownership if a native commit was already in progress.
4. Verify TalkBack/VoiceOver announcement order, visible card numbers, focus after feedback, hidden previews, large OS font settings, physical touch targets, contrast, and reduced motion on smaller devices.
5. Review all seven languages with native speakers; verify installed offline voice availability, pronunciation and cancellation. Routine bodies still intentionally use English.
6. Confirm caregiver counts/history and recommendations after offline restart. No APK/native build or device test is claimed in this milestone.

## 20. Final evidence and Git handoff

Validation date: 2026-09-11. The actual dirty implementation was inspected rather than accepting the prior completion summary. No production code or maintained regression script needed a takeover fix. This document was completed; temporary browser tooling was repaired and then removed. All pre-existing MVP-20 source changes remain uncommitted.

### Memory Match timeout investigation

The unchanged original English level-5 case at 768 × 900 completed and saved successfully. A larger takeover batch then reproduced an infrastructure failure: `timed out awaiting tools/call after 300s`. This is the Playwright tool transport deadline, separate from its 45-second action timeout.

The disposable generator was restricted to one case per tool invocation. It wrote the generated function to a temporary file for the browser tool to read; preview labels were collected in one browser query instead of repeated per-symbol queries. Failures captured the current URL, page text and presence of the storage fixture. The action timeout and all gameplay/save assertions were retained, and per-card size, position and scroll-reachability assertions were added. Individual cases passed.

The earlier `memory-debug.png` showed storage recovery, and the retained old console logs showed Metro disconnects/reloads. A controlled reload during takeover confirmed that a new browser document loses the temporary SQLite/SecureStore replacements and returns the intentionally unsupported-web storage recovery screen. That state cannot be used to diagnose an unreachable card. Each fresh case reinstalls its disposable native substitutes before gameplay.

The evidence supports a QA infrastructure problem (B); no production gameplay defect was reproduced. The original session's exact failed click and call stack were not retained, so the historical click timeout cannot honestly be attributed to a specific locator or proven to be the same 300-second failure.

### Browser evidence

The actual Expo routes were tested at `http://127.0.0.1:8087`, with the temporary SQLite bridge at port 8091. These addresses were only QA infrastructure. All cases used a synthetic patient, extra-large text, high contrast and reduced motion. Browser saves were checked in real in-memory SQLite; this does not certify native SQLite or SecureStore.

| Activity | Level 1, English, 360 × 900 | Level 5, English, 768 × 900 |
| --- | --- | --- |
| Memory Match | PASS: 5 attempts | PASS: 11 attempts |
| Pattern & Shape | PASS: 8 attempts | PASS: 8 attempts |
| Routine Recall | PASS: 5 attempts | PASS: 8 attempts |
| Familiar Object | PASS: 8 attempts | PASS: 8 attempts |
| Sequence Memory | PASS: 5 attempts | PASS: 9 attempts |
| Picture Recall | PASS: 5 attempts | PASS: 8 attempts |

Each case deliberately made three wrong comparisons/selections, received explicit incorrect-answer feedback, progressed to hints/reveal, tapped every correct answer, and saved exactly one completion. Saved hint count was 2 and repeated-mistake/error count was 2. Level-1 Easy feedback trained exactly one model; level-5 Skip left feedback null and trained no model. Recommendations stayed within one level. The result explanation and its safety disclaimer opened successfully. Selection-game checks also used keyboard Enter and verified answer targets of at least 64 × 64 CSS pixels.

Additional complete level-5 Memory Match cases passed at English 320 × 900 and 1280 × 900, and Hindi 360 × 900. All 16 numbered cards had accessible names and could be scrolled fully into view. Targets measured approximately 128 × 128, 108 × 108 and 144 × 144 CSS pixels respectively. No horizontal overflow prevented interaction. All eight pairs were matched and saved, with 11 attempts, 2 hints, 2 repeated mistakes and no fabricated feedback/model training. Phone/tablet screenshots were inspected before deletion.

Each completed gameplay case recorded zero console errors and zero failed requests after fixture installation. Fresh unsupported-web startup and the deliberate reload produced the expected local-storage recovery diagnostic before the fixture was installed. Expo also emitted its existing web push-token-listener warning. These expected native-boundary diagnostics are not a claim of an error-free native runtime.

### Every requested regression

All commands below exited 0 during this takeover. Visual UX ran after temporary-browser cleanup so its artifact guard was exercised.

| Command | Result |
| --- | --- |
| `node scripts/check-cognitive-migration.cjs` | PASS — exact preservation, constraints, rollback, fresh/upgrade |
| `node scripts/check-cognitive-ai.cjs` | PASS — six games, coaching, saves, 84 screen/language/level flows |
| `node scripts/check-profile-switching.cjs` | PASS — isolation, A–B–A, stale callbacks and recovery |
| `node scripts/check-visual-ux.cjs` | PASS — 196 contrast pairs, focus/motion, protected paths, QA cleanup |
| `node scripts/check-privacy-recovery.cjs` | PASS — failure/retry, partial saves, privacy and backup XML |
| `node scripts/check-analytics.cjs` | PASS — six games, 366 tied sessions, pagination, four time-zone runs |
| `node scripts/check-cognitive-expansion.cjs` | PASS — historical upgrade, existing games, feature parity |
| `node scripts/check-my-care.cjs` | PASS — factual counts, patient isolation, four time-zone runs |
| `node scripts/check-my-day.cjs` | PASS — persistence, schedules, notification boundaries |
| `node scripts/check-my-memories.cjs` | PASS — persistence, photo paths, rollback and cleanup |
| `node scripts/check-my-home.cjs` | PASS — 32 local licensed images, eight regions, seven catalogs |
| `node scripts/check-native-hardening.cjs` | PASS — host checks; explicitly does not certify a device |
| `node scripts/check-product-hardening.cjs` | PASS — pending writes, duplicate guards, recovery and brand |
| `node scripts/check-product-polish.cjs` | PASS — 25 parent return actions |
| `node scripts/check-ux-overhaul.cjs` | PASS — DOB, appearance, persistence and navigation |
| `node scripts/check-elderly-ux.cjs` | PASS — seven catalogs, speech cancellation/fallback |

### Toolchain and export

| Command | Result |
| --- | --- |
| `npx.cmd tsc --noEmit` | PASS, exit 0 |
| `npx.cmd expo lint` | PASS, exit 0 |
| `npx.cmd expo-doctor` | PASS, 18/18 on network-enabled retry |
| `npx.cmd expo install --check` | PASS, dependencies up to date for the installed Expo SDK |
| `npx.cmd expo config --type public` | PASS, exit 0; Android/iOS/web configured |
| `npx.cmd expo export --platform all` | PASS, exit 0, `Exported: dist` |

The successful export explicitly produced:

- Android: 1,697 modules; `_expo/static/js/android/entry-53c9d17258c82d8257f61878a27a4118.hbc` (5.05 MB).
- iOS: 1,699 modules; `_expo/static/js/ios/entry-1b0d51bb6368cf5a51222cd2804a950b.hbc` (5.06 MB).
- Web: 1,426 modules; `_expo/static/js/web/entry-58f61f411c98bc5a1b99f2bc24db6620.js` (3.16 MB), plus 34 static routes including all six games.

These are JavaScript/Hermes exports, not an APK, native build or device test. `dist/` is the ignored output of the explicitly requested export and was retained. A scan of the exported files found no QA fixture identifiers or bridge endpoints.

### Cleanup and production boundary

Closed the browser and stopped both local QA processes; ports 8087 and 8091 had no listening server afterward. Removed 20 checked workspace targets: `.playwright-mcp/`, `.expo/mvp20/`, `.expo/mvp19a-browser-qa/`, `.expo/npm-cache/`, and 16 old `.expo/mvp19a-*` log/result files. This removed the fixture bridge, fake native exports, generated browser function, screenshots, logs and QA npm cache. No copied production screen or browser adapter was added to production.

Retained legitimate Expo metadata: `.expo/cache/`, `.expo/types/`, `.expo/web/`, `.expo/devices.json` and `.expo/README.md`. The final visual regression's production-dependency and cleanup guards passed.

The requested production scan found no conflict markers, `localhost`, `127.0.0.1`, Playwright, provider-key names or OpenAI/Gemini/Anthropic integration. Application activity code has no required network request, online LLM call, provider SDK, diagnosis, dementia severity score, decline/progression prediction, clinical risk score or treatment-effect claim. Existing source-credit URLs and documentation links do not make activities depend on a network. References in this handoff and maintained test guards are intentional documentation/testing, not production dependencies.

### Git handoff

`git diff --check` passed. `git status --short`, `git diff --stat`, `git diff --name-status`, and `git ls-files --others --exclude-standard` were inspected. The tracked diff is 23 files, 295 insertions and 121 deletions. There are 10 intended untracked deliverables; these are omitted by ordinary diff statistics. No staged changes, commit, merge, tag, history rewrite, database reset or APK build was made.

Exact status (the file inventory for the complete MVP-20 worktree):

```text
 M app/patient/games/index.tsx
 M app/patient/games/memory-match.tsx
 M app/patient/games/result.tsx
 M components/games/memory-card.tsx
 M components/games/selection-activity-screen.tsx
 M scripts/check-analytics.cjs
 M scripts/check-cognitive-expansion.cjs
 M scripts/check-my-care.cjs
 M scripts/check-my-day.cjs
 M scripts/check-my-memories.cjs
 M scripts/check-native-hardening.cjs
 M scripts/check-profile-switching.cjs
 M scripts/check-visual-ux.cjs
 M src/ai/feature-extractor.ts
 M src/db/migrations/index.ts
 M src/db/repositories/cognitive.repository.ts
 M src/db/schema.types.ts
 M src/games/pattern-recognition.ts
 M src/games/presentation.ts
 M src/games/selection-engine.ts
 M src/games/telemetry.ts
 M src/i18n/cognitive-strings.ts
 M src/services/cognitive.service.ts
?? app/patient/games/familiar-object.tsx
?? app/patient/games/picture-recall.tsx
?? app/patient/games/sequence-memory.tsx
?? docs/history/MVP20_COGNITIVE_AI.md
?? scripts/check-cognitive-ai.cjs
?? scripts/check-cognitive-migration.cjs
?? src/ai/cognitive-coach.ts
?? src/db/migrations/007_cognitive_ai_expansion.ts
?? src/games/recall-activities.ts
?? src/i18n/cognitive-ai-strings.ts
```

Recommendation: **GO for a reviewed MVP-20 source commit** on the current branch. There is no reproduced production blocker in the completed host/browser checks. This is not native release clearance: the physical-device and native-speaker checks in section 19 remain required. The missing historical click trace is disclosed above; no unsupported root-cause certainty is claimed.
