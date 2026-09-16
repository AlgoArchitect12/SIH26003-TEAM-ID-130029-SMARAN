# MVP-25: three cognitive games

The [final independent audit](#final-independent-audit--2026-09-16) below supersedes the original implementation-run evidence and disposition.

Worktree: `C:\Users\Dharmin\OneDrive\Desktop\SMARAN-A`. Branch: `feature/mvp25-three-cognitive-games`. Base and unchanged HEAD: `a030ac8`. The initial worktree was clean. No commit, staging, merge, tag, APK build, cloud deployment, or live patient database mutation was performed.

The [Expo SDK 54 reference](https://docs.expo.dev/versions/v54.0.0/) was read before coding. React Native accessibility documentation was checked through Context7. Existing Expo, React Native, Router, SQLite, Zustand, theme tokens, buttons, read-aloud service, selection engine, offline coach, adaptive engine and analytics are reused. There are no dependency changes.

## 1–9. Games, levels and content validation

1. **Sudoku architecture:** `src/games/sudoku-lite.ts` supplies original fixed blank masks on valid Sudoku solutions. Digit permutations and horizontal reflection produce varied offline boards. The shared selection engine records each accepted entry. Players can select another unfinished cell; its coaching state is retained. Fixed clues and completed cells cannot be overwritten. Incorrect entries never change the grid.
2. **Sudoku levels:**

   | Level | Board | Blanks / correct entries | Guidance |
   | --- | --- | --- | --- |
   | 1 | 4×4, 2×2 regions | 3 | Selected cell, row/column/region emphasis; each blank is an obvious single |
   | 2 | 4×4, 2×2 regions | 6 | Multiple blanks; optional region/row/column hints |
   | 3 | 6×6, 2×3 regions | 8 | Moderate clues; clear region borders |
   | 4 | 6×6, 2×3 regions | 12 | Fewer clues; selected cell guidance |
   | 5 | 6×6, 2×3 regions | 16 | More decisions, still solvable through single-candidate reasoning |

3. **Sudoku validation:** production checks every solution's rows, columns and regions, clue consistency, and a complete chain of forced single-candidate entries before Start. This also proves uniqueness. A separate exhaustive solver in the dedicated regression verifies 24 deterministic seeds at each level, 120 boards total, with at least six distinct boards per level. Malformed and unguided empty boards are rejected. Randomization transforms valid content; it never removes arbitrary unverified clues.
4. **Chess architecture:** `src/games/chess-puzzle.ts` defines original sparse 8×8 positions, with both kings, board coordinates and Unicode pieces. Questions are deterministic; their order and answer order are shuffled. The screen uses a read-only board and large labeled choices containing destination coordinates and piece names. It is a one-move activity, with no engine, clock, ratings or online play.
5. **Chess levels:**

   | Level | Questions per session | Activity |
   | --- | --- | --- |
   | 1 | 6 | Identify all six piece types at the marked source |
   | 2 | 4 | Rook, bishop, queen and king movement |
   | 3 | 4 | Knight and pawn destinations |
   | 4 | 3 | Capture a marked opposing piece |
   | 5 | 3 | Choose the safe capture from two legal captures; one is defended |

6. **Chess legality:** validates square coordinates, piece types/sides, king counts, pawn placement, movement geometry, sliding-piece obstruction, own-piece collisions, pawn forward/capture/double-step rules, and king safety after moving. Capturing a king is rejected. Curated positions are checked to start with neither king attacked and to have exactly one correct offered answer. Independent regression examples cover blocked sliders, knight jumps, pawn movement, a pinned rook, king danger and invalid squares. Castling, en passant, promotion, full-game play and mate search are outside the curated activity contract.
7. **Word Match architecture:** `src/games/word-match.ts` connects stable semantic pair IDs to translated left/right labels and useful association clues. Players select an unfinished source word and a matching answer. Completed pairs are marked; incorrect pairs remain available. Word strings are never used as logic IDs.
8. **Word Match levels:** 3, 4, 4, 5 and 6 pairs respectively. Level 3 adds an unmatched distractor. Levels 3–5 select from a wider pool and include a theme associated with the patient's stored region. Every correct pair must be selected to finish.
9. **Multilingual data:** eleven original associations use existing translated cup/book/music labels plus new words and hints. The same IDs work in en, hi, as, bn, mni, kha and lus. Stored `PatientSettings.region` and the existing regional content's tea, river, bamboo and weaving themes guide selection across all eight regions. This makes no claim about an individual's experiences. Translation completeness and placeholder parity are checked; native-speaker review is pending.

## 10–17. Coaching, ownership, telemetry and reports

10. **Wrong answers/hints:** the existing deterministic `coachAnswer`/`coachHint` progression remains unchanged. First error: a clear supportive correction. Second: hint stage 1 with actual Sudoku row/column/region guidance, chess movement/safety guidance or a word association clue. Third: stage 3 reveals the answer and disables other choices. Explicit hints progress through stages 1/2/3; stage 2 adds candidate/answer emphasis. Correct answers receive calm reinforcement and require Continue. Sudoku starts with “That number doesn't fit here. Try again.” No hint fabricates a successful response.
11. **Adaptation:** the existing screen reads same-patient, same-game history and model; the latest recommendation sets the level, defaulting to 1. The unchanged adaptive algorithm remains bounded to 1–5 and at most ±1 per completed session. Existing optional-feedback learning is reused; skipping feedback preserves weights. New IDs are dispatched to the existing selection feature extractor.
12. **Telemetry:** each new game uses `steps_completed` and `correct_selections` for actual solved cells, chess answers or word pairs. Attempts include eligible wrong and correct choices. Hints count delivered hint-stage increases; repeated errors mean the same wrong choice for the same task. Accuracy is correct/attempts. Existing start/end timestamps, average response duration, patient ID, game ID, level and recommendation are persisted. Non-applicable pair/challenge columns are NULL. Background/Continue waiting are excluded at existing resume boundaries; elapsed session time remains wall-clock. There is no time limit or medical score.
13. **Patient isolation:** actual repositories/services are exercised for A→B→A and all three games at every level. The tests compare unrelated patients' models, reject cross-patient session reads and verify per-game history/model queries.
14. **Stale protections:** the existing captured patient revision guards preparation, Start, board events, completion and result navigation. New boards also guard unmount, focus and foreground state. Tests switch A→B→A during profile/history/model preparation and at six save boundaries: resolution, database acquisition, patient check, session insertion, model update and readback. Stale transactional writes roll back. Unfinished games remain transient and reset when the route is left, following existing behavior.
15. **Discovery:** `CognitiveActivityTypes` contains exactly eleven IDs, retaining the original eight in order and appending `sudoku_lite`, `chess_puzzle`, `word_match`. Three distinct existing Material icons and live routes appear in Train My Mind. No coming-soon lock or authentication requirement was added.
16. **Caregiver analytics:** titles and metric dispatch extend the shared catalog. Existing patient/game/level SQL aggregates, factual counts, weighted denominators and paginated history are used unchanged. The analytics regression now exercises all eleven games, including 671 tied sessions and multiple timezones.
17. **Reports:** the same analytics service produces 7-day and 30-day reports. New snapshots contain eleven ordered games. The report parser also accepts the exact original ordered eight-game snapshot shape, without rewriting stored snapshots. Missing, duplicated, reordered and unknown game entries remain rejected; report math and access scopes are unchanged.

## 18–24. Migrations, languages and accessibility

18. **SQLite:** `012_three_cognitive_games.ts` is necessary because both cognitive tables have eight-game CHECK constraints. It follows migration 009's transactional child-table rebuild pattern, extends only game allowlists and exact completion counts, copies explicit IDs/rowids and every existing column, and restores named indexes and triggers. Trigger suspension prevents outbox echo and permits external trigger references during table replacement. The production runner owns the exclusive transaction and version registration. There is no live DB mutation or downgrade script. A failure rolls back; deployment recovery still requires normal pre-upgrade backup discipline.
19. **Historical SQLite:** migrations 001–011 are compared to `a030ac8` and remain unchanged. Tests cover fresh FK-on/off installation, populated 011 upgrade, repeated runner invocation, six rollback boundaries, exact historical history/models/sync/outbox/retry/cursor/consent/Care Circle/report preservation, restored enqueue, FK and integrity checks.
20. **Supabase:** new forward migration `20260916000000_three_cognitive_games.sql` replaces `valid_sync_record` and `valid_care_record`. It extends activity/model IDs and exact new-game completion checks; report validation accepts exact eight- or eleven-game ordered snapshots. All three historical Supabase migrations remain unchanged. `supabase/tests/three_cognitive_games.sql` supplies runnable checks for eleven games × five levels, models, malformed metrics, ownership and historical/new reports.
21. **Cloud safety:** source comparisons prove validator bodies are otherwise identical to their prior versions. No RLS, ownership, grants, RPC, completion, numeric bounds or field-shape checks are relaxed. The optional online-instruction allowlist recognizes the new IDs while retaining its truthful not-configured response. No migration or function was deployed. PostgreSQL tests were not executed: `psql` is absent and Docker has no running daemon. Run the SQL suites in a disposable local/staging database before an authorized cloud rollout.
22. **Seven languages:** all new UI strings, instructions, piece names, movement rules, associations, correction messages and hints are composed into all seven catalogs. Meitei follows the existing romanized catalog. No native-speaker certification is claimed.
23. **Read-aloud:** existing voice-guidance controls can read instructions, prompts, word choices and coaching. Speech remains optional and uses the existing installed-voice/script checks and cancellation behavior. The browser's Mizo check displayed the actual unavailable-voice message. No voice availability is promised and no microphone permission was added.
24. **Appearance/accessibility:** shared semantic colors, wrapping text, scaled text, buttons and reduced-motion behavior are reused. Sudoku marks the active cell with a dashed border and strong region borders; immutable cells have labels. When a full grid cannot meet the 56 px touch contract, a read-only grid and large cell-selection buttons are shown. Chess always offers large named choices under its responsive board; diagram glyphs/coordinate annotations stay bounded, with scalable full-text instructions and choices. Squares name coordinates, side, piece and source/target; meaning does not rely only on color.

Browser QA used `http://localhost:8085`. The unmodified app displayed its expected native-storage recovery screen. Actual production boards, theme, buttons, selection engine and read-aloud component were mounted with temporary in-memory props and navigation context; no storage adapter, fixture route, auth bypass or persistent patient was added. The layout matrix checked three games × seven languages × five appearances × 320×800, 390×844 and 820×1180 viewports: 315 cases at extra-large text/reduced motion, without horizontal overflow, missing button labels or enabled controls below 56 px. Phone screenshots of Hindi Sudoku/light and Chess/high-contrast-dark were inspected.

Actual browser level-5 play with three intentional errors completed Sudoku (16 correct/19 attempts), Chess (3/6) and Word Match (6/9); each reported two hints and two repeated errors. Keyboard Enter activated an answer. Console inspection found only two expected native-storage initialization errors and the existing Expo Notifications web warning; no additional game errors or failed application requests were observed. Full native navigation, native persistence and TalkBack are not certified by this component fixture.

## 25–35. Validation

25. **Dedicated regression:** `node scripts/check-three-cognitive-games.cjs` covers independent puzzle validation, all levels, coaching, actual screen handlers, metrics, adaptive bounds, patient switching/stale reads/writes, migration preservation, analytics/reports, language/appearance contracts and historical/cloud source protection. Final result is recorded below.
26. **All existing regressions:** every `scripts/check-*.cjs` is run, with individual final exit results recorded below. The boundary helper is included even though its standalone invocation has no assertions; its exported checks also execute through the other suites.
27. **Old tests changed, with reasons:**

   | File | Authorized update |
   | --- | --- |
   | `check-analytics.cjs` | Valid completion lengths for the three new IDs; original weighted-denominator assertions retained |
   | `check-auth-cloud-hardening.cjs` | Migration count 12; exclude only the new forward cloud migration from comparison to an older base; dedicated test protects its contents |
   | `check-auth-sync-migration.cjs` | Final registry count 12; historical 008 boundary still asserted as 8 |
   | `check-care-circle-reports.cjs` | Registry count 12; valid new game rows and corresponding eleven-game aggregate totals |
   | `check-cognitive-ai.cjs` | Load the three new game imports at the existing screen test boundary |
   | `check-cognitive-expansion.cjs` | Correct new Chess completion fixture, eleven-game dashboard count, registry count 12 |
   | `check-cognitive-migration.cjs` | Final/fresh registry count 12 |
   | `check-extra-cognitive-games.cjs` | Append three catalog IDs, registry count 12, resolve new screen imports |
   | `check-mvp22-boundaries.cjs` | Authorize precisely migration 012 |
   | `check-my-care.cjs` | Registry count and explicit migration 012 inventory |
   | `check-my-day.cjs` | Registry counts 12 |
   | `check-my-memories.cjs` | Registry counts 12 |
   | `check-native-hardening.cjs` | Explicit migration inventory/counts 12 |
   | `check-visual-ux.cjs` | Authorize precisely the three game modules and their translation catalog |

28. **Weakening:** no old assertion was removed, no isolation/rollback validation was reduced, no PASS was hardcoded and no production migration runner was bypassed. New fixtures preserve existing error counts and denominator checks. Historical game mechanics, migrations and dependency lockfile remain protected.
29. **TypeScript:** `npx.cmd tsc --noEmit` — final result below.
30. **Lint:** `npx.cmd expo lint` — final result below.
31. **Expo Doctor:** `npx.cmd expo-doctor` — PASS, 18/18 checks.
32. **Dependency check:** `npx.cmd expo install --check` — PASS, dependencies up to date.
33. **Public config:** `npx.cmd expo config --type public` — PASS; SDK 54, application identifiers and configuration unchanged.
34. **All-platform export:** `npx.cmd expo export --platform all` — Android/iOS Hermes and web, including all three routes; final result below. Dotenv loading was disabled for config/export to keep local cloud configuration out of disposable output. Network checks and Hermes compilation initially encountered sandbox restrictions, then passed through approved execution outside it. Known export warnings concern Expo Notifications on web and NO_COLOR/FORCE_COLOR interaction.
35. **Whitespace:** `git diff a030ac8 --check` — final result below.

## 36–41. Handoff

36. **Exact changed files:** the final `git diff --name-status a030ac8` and untracked inventory are recorded below; ordinary diff statistics exclude untracked deliverables.
37. **Exact status:** final `git status --short --untracked-files=all` is recorded below. HEAD and branch are unchanged; the index is empty.
38. **Temporary cleanup:** the component fixture was unmounted, browser closed and task-owned Metro process stopped. Browser logs/snapshots/screenshots, disposable export and task-generated caches are removed before handoff. Regression SQLite fixtures are in memory or cleaned up by their existing scripts. No broad `git clean` is used.
39. **Native/live checks remaining:** Sudoku touch accuracy, 4×4/6×6 sizing, maximum system font and TalkBack; Chess piece rendering, board comprehension, controls and accessibility labels; Word Match wrapping and read-aloud in all languages. Also test phones/tablets, dark/high-contrast/system themes, A→B→A during preparation/play/save, airplane mode, kill/reopen, populated native SQLite upgrade, completed-game analytics/reports and hosted sync after separately authorized cloud migration deployment.
40. **Limitations:** web patient persistence remains intentionally unsupported. Full device flows, OS font extremes, native speech/Unicode rendering, native SQLite upgrade and live PostgreSQL/RLS/sync need the checks above. Translations need native-speaker review. Puzzle variety is finite; chess is curated one-move practice. Old eight-game clients should be upgraded before pulling new IDs/reports. These activities provide engagement and factual activity records, not diagnosis or treatment.
41. **Review/commit safety:** final disposition below concerns source review only, without native/cloud release certification. Stop without commit.

## Final command evidence

All **24 scripts passed (exit 0)** in the final full run. This includes the dedicated game suite and every existing `check-*.cjs`; no failing script was skipped.

| Regression | Final result |
| --- | --- |
| `node scripts/check-analytics.cjs` | PASS (exit 0) |
| `node scripts/check-auth-cloud-hardening.cjs` | PASS (exit 0) |
| `node scripts/check-auth-sync-migration.cjs` | PASS (exit 0) |
| `node scripts/check-auth-sync.cjs` | PASS (exit 0) |
| `node scripts/check-care-circle-reports.cjs` | PASS (exit 0) |
| `node scripts/check-cognitive-ai.cjs` | PASS (exit 0) |
| `node scripts/check-cognitive-expansion.cjs` | PASS (exit 0) |
| `node scripts/check-cognitive-migration.cjs` | PASS (exit 0) |
| `node scripts/check-daily-voice.cjs` | PASS (exit 0) |
| `node scripts/check-elderly-ux.cjs` | PASS (exit 0) |
| `node scripts/check-extra-cognitive-games.cjs` | PASS (exit 0) |
| `node scripts/check-mvp22-boundaries.cjs` | PASS (exit 0) |
| `node scripts/check-my-care.cjs` | PASS (exit 0) |
| `node scripts/check-my-day.cjs` | PASS (exit 0) |
| `node scripts/check-my-home.cjs` | PASS (exit 0) |
| `node scripts/check-my-memories.cjs` | PASS (exit 0) |
| `node scripts/check-native-hardening.cjs` | PASS (exit 0) |
| `node scripts/check-privacy-recovery.cjs` | PASS (exit 0) |
| `node scripts/check-product-hardening.cjs` | PASS (exit 0) |
| `node scripts/check-product-polish.cjs` | PASS (exit 0) |
| `node scripts/check-profile-switching.cjs` | PASS (exit 0) |
| `node scripts/check-three-cognitive-games.cjs` | PASS (exit 0) |
| `node scripts/check-ux-overhaul.cjs` | PASS (exit 0) |
| `node scripts/check-visual-ux.cjs` | PASS (exit 0) |

| Validation | Final result |
| --- | --- |
| `npx.cmd tsc --noEmit` | PASS — exit 0 |
| `npx.cmd expo lint` | PASS — exit 0, no warnings |
| `npx.cmd expo-doctor` | PASS — 18/18 checks |
| `npx.cmd expo install --check` | PASS — dependencies up to date |
| `npx.cmd expo config --type public` | PASS — SDK 54, identifiers/config unchanged |
| `npx.cmd expo export --platform all` | PASS — Android/iOS Hermes + web; 43 routes |
| `git diff a030ac8 --check` | PASS — no whitespace errors (Git emitted only existing LF/CRLF notices) |
| `Historical SQLite 001–011 / Supabase migrations` | PASS — unchanged against a030ac8 |
| `git diff --cached --stat` | Empty — nothing staged |
| `New-file whitespace scan` | PASS — all 13 untracked deliverables |

The final export produced Android `entry-cb7e12e5b1d4b96149f7cfb6ced40da0.hbc` (5.99 MB), iOS `entry-ab7ae94365c5b0f54f41cca2d8bd805f.hbc` (6 MB), and web `entry-e7bb77d4ffe7eb6367ccdd59cbe8451a.js` (3.78 MB). The disposable `dist` directory was then removed. The task's ESLint cache was removed; pre-existing unchanged Expo favicon cache and normal route-type metadata were retained. The failed Hermes temporary directory was confirmed absent. Browser fixture, screenshots/logs and `.playwright-mcp` were removed.

There are **41 intended changed/new files: 28 tracked modifications and 13 new files**. All 83 new translation keys are available in all seven catalogs. No dependency was added. The historical-source checks and source inventory confirm only one new SQLite migration and one new cloud migration.

**Disposition:** ready for independent source review and a reviewed commit. Native/cloud release clearance remains pending the listed device, language and PostgreSQL checks. No commit was made.

### Exact `git diff --stat a030ac8`

```text
 README.md                                      |  2 +-
 app/patient/games/index.tsx                    |  3 +++
 components/games/selection-activity-screen.tsx | 21 ++++++++++++++++-----
 scripts/check-analytics.cjs                    |  4 +++-
 scripts/check-auth-cloud-hardening.cjs         |  4 ++--
 scripts/check-auth-sync-migration.cjs          |  4 ++--
 scripts/check-care-circle-reports.cjs          | 18 +++++++++---------
 scripts/check-cognitive-ai.cjs                 |  2 +-
 scripts/check-cognitive-expansion.cjs          |  5 +++--
 scripts/check-cognitive-migration.cjs          |  4 ++--
 scripts/check-extra-cognitive-games.cjs        |  8 ++++----
 scripts/check-mvp22-boundaries.cjs             |  1 +
 scripts/check-my-care.cjs                      |  4 ++--
 scripts/check-my-day.cjs                       |  4 ++--
 scripts/check-my-memories.cjs                  |  4 ++--
 scripts/check-native-hardening.cjs             |  8 ++++----
 scripts/check-visual-ux.cjs                    |  1 +
 src/ai/cognitive-coach.ts                      |  3 +++
 src/ai/feature-extractor.ts                    |  3 +++
 src/caregiver/reports.ts                       |  3 ++-
 src/db/migrations/index.ts                     |  2 ++
 src/db/repositories/cognitive.repository.ts    |  8 +++++++-
 src/db/schema.types.ts                         |  7 +++++--
 src/games/presentation.ts                      |  4 ++++
 src/games/selection-engine.ts                  |  3 ++-
 src/games/telemetry.ts                         |  3 +++
 src/i18n/cognitive-strings.ts                  |  9 +++++----
 supabase/functions/online-ai/contract.ts       |  2 +-
 28 files changed, 95 insertions(+), 49 deletions(-)
```

### Exact `git diff --name-status a030ac8`

```text
M	README.md
M	app/patient/games/index.tsx
M	components/games/selection-activity-screen.tsx
M	scripts/check-analytics.cjs
M	scripts/check-auth-cloud-hardening.cjs
M	scripts/check-auth-sync-migration.cjs
M	scripts/check-care-circle-reports.cjs
M	scripts/check-cognitive-ai.cjs
M	scripts/check-cognitive-expansion.cjs
M	scripts/check-cognitive-migration.cjs
M	scripts/check-extra-cognitive-games.cjs
M	scripts/check-mvp22-boundaries.cjs
M	scripts/check-my-care.cjs
M	scripts/check-my-day.cjs
M	scripts/check-my-memories.cjs
M	scripts/check-native-hardening.cjs
M	scripts/check-visual-ux.cjs
M	src/ai/cognitive-coach.ts
M	src/ai/feature-extractor.ts
M	src/caregiver/reports.ts
M	src/db/migrations/index.ts
M	src/db/repositories/cognitive.repository.ts
M	src/db/schema.types.ts
M	src/games/presentation.ts
M	src/games/selection-engine.ts
M	src/games/telemetry.ts
M	src/i18n/cognitive-strings.ts
M	supabase/functions/online-ai/contract.ts
```

### Exact `git status --short --untracked-files=all`

```text
 M README.md
 M app/patient/games/index.tsx
 M components/games/selection-activity-screen.tsx
 M scripts/check-analytics.cjs
 M scripts/check-auth-cloud-hardening.cjs
 M scripts/check-auth-sync-migration.cjs
 M scripts/check-care-circle-reports.cjs
 M scripts/check-cognitive-ai.cjs
 M scripts/check-cognitive-expansion.cjs
 M scripts/check-cognitive-migration.cjs
 M scripts/check-extra-cognitive-games.cjs
 M scripts/check-mvp22-boundaries.cjs
 M scripts/check-my-care.cjs
 M scripts/check-my-day.cjs
 M scripts/check-my-memories.cjs
 M scripts/check-native-hardening.cjs
 M scripts/check-visual-ux.cjs
 M src/ai/cognitive-coach.ts
 M src/ai/feature-extractor.ts
 M src/caregiver/reports.ts
 M src/db/migrations/index.ts
 M src/db/repositories/cognitive.repository.ts
 M src/db/schema.types.ts
 M src/games/presentation.ts
 M src/games/selection-engine.ts
 M src/games/telemetry.ts
 M src/i18n/cognitive-strings.ts
 M supabase/functions/online-ai/contract.ts
?? app/patient/games/chess-puzzle.tsx
?? app/patient/games/sudoku-lite.tsx
?? app/patient/games/word-match.tsx
?? components/games/puzzle-activity-board.tsx
?? docs/MVP25_THREE_COGNITIVE_GAMES.md
?? scripts/check-three-cognitive-games.cjs
?? src/db/migrations/012_three_cognitive_games.ts
?? src/games/chess-puzzle.ts
?? src/games/sudoku-lite.ts
?? src/games/word-match.ts
?? src/i18n/three-game-strings.ts
?? supabase/migrations/20260916000000_three_cognitive_games.sql
?? supabase/tests/three_cognitive_games.sql
```
## Final independent audit — 2026-09-16

This section supersedes the earlier implementation-run verdict and evidence above. The audit stayed in this workspace on `feature/mvp25-three-cognitive-games`, with HEAD/base `a030ac8`. No commit, staging, branch switch, merge, tag, APK build or hosted deployment occurred.

Two defects were reproduced and repaired:

- **Coaching retention:** request two hints for a Sudoku blank or Word Match pair, solve a different item, then Continue. The original board reset the earlier item's hint stage from 2 to 0. The board now uses the shared continuation function and restores the saved item's coaching state. Completion still uses the existing parent callback. New runnable coverage tests both games at all five levels, retaining wrong-answer counts and avoiding duplicate hint telemetry.
- **Initial backup dependency order:** actual production SQLite outbox payloads sent a report preference before its Care Circle member; PostgreSQL rejected the preference. The shared queue query now reads patient profiles first, reminders/Care Circle members next, then other entities, retaining sequence order within each entity. It does not rewrite queued rows, mutation IDs, consent or retry metadata. New runnable coverage crosses the 25-event batch boundary, checks parent dependencies and same-entity ordering, and compares all dequeued fields to stored rows. Actual PostgreSQL RPC roundtrips subsequently passed.

Audit edits are limited to `components/games/puzzle-activity-board.tsx`, `src/db/repositories/sync.repository.ts`, the new `scripts/check-three-cognitive-games.cjs`, and this report. No old regression was edited during this independent audit.

### Requested findings 1–21

1. **Large old-test diffs:** not present in the supplied working tree. Every modified old regression has LF endings and no UTF-8 BOM, matching the base. Normal, `-w`, and `--ignore-space-at-eol` numstats agree. Current changes are the small semantic edits documented below. The earlier reported whole-file counts cannot be attributed to a particular cause without that earlier state.
2. **Diff cleanup:** none needed; no formatting/encoding/line-ending rewrite was performed. Initial tracked diff: 28 files, +95/−49. Final tracked diff: 29 files, +100/−51; ordinary Git diff excludes the 13 untracked deliverables.
3. **Catalog:** exactly eleven unique IDs, in this order: `memory_match`, `pattern_recognition`, `routine_recall`, `familiar_object`, `sequence_memory`, `picture_recall`, `remember_lights`, `number_path`, `sudoku_lite`, `chess_puzzle`, `word_match`. Discovery, presentation, telemetry, adaptive feature dispatch, coaching, analytics, reports, client cloud validation and online-AI allowlists recognize them. No old game is lost or extra game exposed.
4. **Sudoku:** PASS. Levels 1–2 use 4×4 boards with 3/6 blanks; levels 3–5 use 6×6 boards with 8/12/16 blanks. All 4,416 possible digit-permutation/reflection outputs were enumerated through the actual generator: 48 distinct boards at each 4×4 level and 1,440 at each 6×6 level. Independent row/column/region and clue checks passed. Production validation proves a forced single-candidate solution for every generated board; the dedicated independent exhaustive solver also proves uniqueness for 120 seeded boards. Fixed/filled cells cannot be overwritten; wrong choices leave values unchanged; correct entries are required for completion. Hints progress, including the repaired continuation path. No countdown or time requirement exists.
5. **Chess:** PASS for the twenty curated one-move tasks across levels 1–5. Piece recognition progresses through rook/bishop/queen/king movement, knight/pawn movement, captures and safe captures. Runtime movement validation includes sliding obstruction, friendly occupancy, both pawn directions/double-step/capture rules, king safety and rejection of king capture. Independent examples also checked queen obstruction, black pawns, pinned pieces and adjacent-king danger. Each curated task has valid coordinates/pieces, both kings outside check initially, and exactly one correct offered answer. **Limits:** no castling, en passant, promotion, turn/history validation, full-position reachability proof, draw rules, mate search or full FIDE engine. Safe captures use static attacked-square checks, not multi-ply search. No clock or Elo; coordinate/side/piece/source/target accessibility labels exist.
6. **Word Match:** PASS at levels 1–5 (3/4/4/5/6 pairs; level 3 also has a distractor). All eleven stable pair IDs are unique, and the entire bank's left/right labels resolve distinctly in all seven languages. Correct IDs, rather than translated display labels, drive pairing. Wrong pairs do not complete an item. Stored region selects existing familiar cultural themes at higher levels. Hints progress, and speech is optional. No native-speaker certification is claimed.
7. **Coaching:** supportive correction after the first error; automatic hint stage 1 after the second and reveal stage 3 after the third. Explicit hints advance 1→2→3; reveal restricts choices without fabricating a correct answer. The repaired board retains prior hints/errors when returning through Continue.
8. **Adaptation:** PASS. Existing per-patient/per-game models and same-game history drive recommendations. Levels remain 1–5 and each completed-session recommendation changes by at most ±1. A/B models remain independent for all three games. Skipping optional feedback preserves model weights.
9. **Telemetry:** PASS. Actual attempted/correct choices, hints, repeated wrong choices, response duration, start/end timestamps, completion, level, patient ID and game ID survive repository readback. Each game records its actual solved-cell/question/pair count using the established selection model. Elapsed session time is wall-clock; it is not a required completion time.
10. **A→B→A:** PASS through production repositories/services at all levels. Session history, per-game models, analytics and both report periods stay patient-scoped.
11. **Stale saves:** PASS for all three games. Switching to B rejects a late A result. A→B→A invalidates captured requests during profile/history/model preparation and six save boundaries: resolution, database acquisition, patient check, session insertion, model update and readback. Transactional stale writes roll back rather than saving under B.
12. **SQLite 012:** PASS through the production migration runner. Fresh FK-on/off installs, populated 011 upgrade, repeated runner invocation and six injected rollback boundaries passed. All historical sessions, models, reminders/events, memories, Care Circle, reports, ownership/auth/sync state, consent, outbox, retry/cursor metadata, rowids, indexes and triggers remain preserved. All eleven IDs are accepted; invalid IDs and new-game completion/level violations are rejected. “Rollback” here means failure-transaction rollback; no post-upgrade downgrade migration is provided.
13. **Historical SQLite:** all eleven migration files 001–011 match `a030ac8` after Git line-ending normalization; no historical migration appears in the diff. Exactly one new SQLite migration exists: `012_three_cognitive_games.ts`.
14. **Local PostgreSQL:** **17.11**, x86_64 Windows, compiled with msvc-19.44.35228, 64-bit. Official portable Windows binaries were obtained through the [PostgreSQL download page](https://www.postgresql.org/download/windows/). The cluster listened only on `127.0.0.1:55432`; database `mvp25_audit`.
15. **Forward Supabase execution:** PASS. Applied `20260912000000_auth_sync.sql`, `20260913000000_extra_cognitive_games.sql`, `20260915000000_care_circle_reports.sql`, then `20260916000000_three_cognitive_games.sql`. The new migration parsed, executed and replayed successfully. All three historical Supabase files remain unchanged. The disposable bootstrap supplied only the required local `auth.users`, `auth.uid()`, `anon` and `authenticated` interfaces; this is PostgreSQL execution proof, not hosted Supabase/JWT-service proof.
16. **SQL fixtures:** `auth_sync.sql`, `extra_cognitive_games.sql`, and `care_circle_reports.sql` passed before and after the new migration; `three_cognitive_games.sql` passed afterward. These include 11 games × 5 levels, adaptive models, old eight-game/new eleven-game reports, invalid IDs, metric/level/completion checks and ownership rejection. An additional disposable test passed **106 RPC roundtrips** (53 actual SQLite outbox payloads for each of two accounts), across all ten entity types, including every new game/level; it checked invalid metrics/IDs/level jumps and exact persisted payloads. Every SQL fixture rolled back. The audit database was then dropped and the cluster stopped.
17. **RLS/grants:** exact before/after/replay catalog snapshots agree for table owners, RLS flags, policies, schema ACLs, function owners, security mode, search path, volatility and grants. RLS is enabled on all four sync tables. Authenticated users retain SELECT-only table access and execute access to push/pull RPCs; validators remain owner-only. Actual cross-account SELECT/UPDATE/DELETE/INSERT probes and direct-write denial passed. No client/service-role secret or credential was introduced.
18. **Analytics/report agreement:** PASS using controlled new-game sessions for both patients. The same counts appeared in cognitive history, analytics, 7-day and 30-day reports (table below). All eleven titles/IDs are recognized; historical eight-game sessions and exact ordered eight-game report snapshots remain readable.
19. **Seven-language coverage:** PASS for `en hi as bn mni kha lus`. All 83 new keys have identical key sets, nonempty values and matching placeholders. All eleven word pairs resolve in every language; gameplay uses IDs. Romanized Meitei follows the existing catalog. Native-speaker review remains outstanding.
20. **Browser/accessibility:** the UI repair justified a fresh matrix. Chrome **152.0.7977.83**, URL `http://localhost:8086`: **315/315** cases (3 games × 7 languages × Light/Dark/System/HC Light/HC Dark × 320×800/390×844/820×1180), extra-large text, reduced motion, and dark system preference. No horizontal overflow, missing enabled-button label or enabled control below 56 px was found. **28/28** Sudoku/Word Match continuation-and-completion flows passed (7 languages × levels 1/5), plus all three level-5 games using Hindi/large text/HC Dark and keyboard Enter: Sudoku 16 correct/19 attempts, Chess 3/6, Word Match 6/9, each with 2 hints and 2 repeated errors. Phone screenshots were inspected. The actual app displayed its expected native-storage recovery screen; the actual production board/engine/theme/buttons were then mounted with transient in-memory props/navigation context, without a storage adapter or persisted patient. Baseline diagnostics were the native-storage initialization error and known Notifications/reduced-motion warnings; **no additional game/runtime/network diagnostics** occurred. Full native navigation, persistence, speech availability and TalkBack are not certified by this fixture.
21. **Dedicated regression:** PASS, exit 0, after both repairs. It executes production puzzle engines, screen handlers, coach, telemetry, adaptive logic, repositories/services and the real SQLite migration runner; new tests cover continued coaching and sync dependency order. Historical/cloud allowlist and UI contracts also have source checks. It does not itself execute PostgreSQL or replace the separate browser/device evidence.

Controlled counts, identical for Patient A and Patient B in each report period:

| Game | Sessions | Attempts | Correct | Hints | Repeated errors |
| --- | ---: | ---: | ---: | ---: | ---: |
| sudoku_lite | 5 | 60 | 45 | 10 | 10 |
| chess_puzzle | 5 | 35 | 20 | 10 | 10 |
| word_match | 5 | 37 | 22 | 10 | 10 |

### 22. Every regression, final fresh run

All scripts were enumerated from the actual repository and run after the final source repair.

| Script | Result |
| --- | --- |
| `scripts/check-analytics.cjs` | PASS, exit 0 |
| `scripts/check-auth-cloud-hardening.cjs` | PASS, exit 0 |
| `scripts/check-auth-sync-migration.cjs` | PASS, exit 0 |
| `scripts/check-auth-sync.cjs` | PASS, exit 0 |
| `scripts/check-care-circle-reports.cjs` | PASS, exit 0 |
| `scripts/check-cognitive-ai.cjs` | PASS, exit 0 |
| `scripts/check-cognitive-expansion.cjs` | PASS, exit 0 |
| `scripts/check-cognitive-migration.cjs` | PASS, exit 0 |
| `scripts/check-daily-voice.cjs` | PASS, exit 0 |
| `scripts/check-elderly-ux.cjs` | PASS, exit 0 |
| `scripts/check-extra-cognitive-games.cjs` | PASS, exit 0 |
| `scripts/check-mvp22-boundaries.cjs` | PASS, exit 0 |
| `scripts/check-my-care.cjs` | PASS, exit 0 |
| `scripts/check-my-day.cjs` | PASS, exit 0 |
| `scripts/check-my-home.cjs` | PASS, exit 0 |
| `scripts/check-my-memories.cjs` | PASS, exit 0 |
| `scripts/check-native-hardening.cjs` | PASS, exit 0 |
| `scripts/check-privacy-recovery.cjs` | PASS, exit 0 |
| `scripts/check-product-hardening.cjs` | PASS, exit 0 |
| `scripts/check-product-polish.cjs` | PASS, exit 0 |
| `scripts/check-profile-switching.cjs` | PASS, exit 0 |
| `scripts/check-three-cognitive-games.cjs` | PASS, exit 0 |
| `scripts/check-ux-overhaul.cjs` | PASS, exit 0 |
| `scripts/check-visual-ux.cjs` | PASS, exit 0 |

`check-mvp22-boundaries.cjs` is an existing exported helper: its standalone invocation exits successfully without running assertions, while its checks execute through other suites. This was not changed or counted as new independent behavioral coverage.

### 23–24. Every modified pre-existing regression and weakening verdict

The table records every semantic change against `a030ac8`, not just changes made during this audit. Assertion-call counts are supporting evidence; the actual diffs and execution were also inspected.

| Old regression | Assert calls, base→final | Exact semantic reason |
| --- | ---: | --- |
| `check-analytics.cjs` | 83→83 | Add the three games' exact completion counts (Sudoku 3/6/8/12/16, Chess 6/4/4/3/3, Word Match 3/4/4/5/6). Existing error counts and weighted-denominator assertions stay intact. |
| `check-auth-cloud-hardening.cjs` | 137→137 | Final migration count 11→12; exclude precisely the new forward Supabase migration from comparison with the older 045519e base. Every historical migration remains compared. |
| `check-auth-sync-migration.cjs` | 21→21 | Two final registry counts 11→12. The historical migration-008 boundary and data/FK preservation assertions remain unchanged. |
| `check-care-circle-reports.cjs` | 149→149 | Two registry counts 11→12; valid new-game session fixtures; seven-day sessions 8→11, hints 16→22, repeated errors 8→11; thirty-day counts 9→12 and 10→13; final seven-day count 8→11. All arithmetic, window-boundary and ownership checks remain. |
| `check-cognitive-ai.cjs` | 103→103 | Resolve the three new production game imports in the existing screen harness; no assertion changes. |
| `check-cognitive-expansion.cjs` | 120→120 | Add the valid level-1 Chess fixture (6 correct/8 attempts); dashboard catalog count 8→11 and matching assertion wording; final registry count 11→12. |
| `check-cognitive-migration.cjs` | 30→30 | Two final/fresh registry counts 11→12 only. |
| `check-extra-cognitive-games.cjs` | 109→109 | Append precisely the three new catalog IDs; two registry counts 11→12; resolve the three new screen imports. |
| `check-mvp22-boundaries.cjs` | 6→6 | Allow precisely src/db/migrations/012_three_cognitive_games.ts in the existing authorized-path set. |
| `check-my-care.cjs` | 80→80 | Final registry count 11→12 and append precisely migration 012 to the explicit inventory. |
| `check-my-day.cjs` | 154→154 | Two registry counts 11→12 only. |
| `check-my-memories.cjs` | 95→95 | Two registry counts 11→12 only. |
| `check-native-hardening.cjs` | 76→76 | Append migration 012 to the inventory; correct its assertion message to 001–012; two numeric migration counts 11→12. |
| `check-visual-ux.cjs` | 65→65 | Allow precisely the three new game modules and their translation catalog in the existing protected-path exception set. |

**24. No old test is weaker.** No assertion was deleted, patient isolation or historical preservation reduced, cloud validation relaxed, execution skipped, hardcoded success substituted, or executable check replaced by source matching. No broad fixture rewrite was used. All old regression edits remain exactly as supplied at audit start; new coverage was added only to the new MVP-25 regression.

### 25–37. Toolchain, inventory and disposition

25. **TypeScript:** `npx.cmd tsc --noEmit` PASS after the final repair.
26. **Lint:** `npx.cmd expo lint` PASS after the final repair, no lint warnings.
27. **Expo Doctor:** `npx.cmd expo-doctor` PASS, 18/18 checks.
28. **Dependencies:** `npx.cmd expo install --check` PASS, dependencies up to date. Project manifests/lockfile are unchanged.
29. **Public config:** `npx.cmd expo config --type public` PASS; SDK 54 and identifiers/config remain unchanged. The [exact SDK 54 reference](https://docs.expo.dev/versions/v54.0.0/) was read before coding.
30. **Export:** `npx.cmd expo export --platform all` PASS after the final repair, using an explicit disposable output directory. Android/iOS Hermes and web completed with 43 static routes, including all eleven games. Final bundles: Android `entry-93470d5e2f68fe02d1a07681973e5dd2.hbc`; iOS `entry-85fbe4b3065f364e53f900da57a3b7e4.hbc`; web `entry-e4f2cacfe641c4306c3b2402b074177b.js`. Dotenv loading was disabled. Initial network and Hermes sandbox failures were rerun successfully with the required tool permissions; no dependency or compiler workaround was added. Known Notifications web and NO_COLOR/FORCE_COLOR warnings remain.
31. **Whitespace:** `git diff a030ac8 --check` PASS; all thirteen untracked deliverables also passed a separate BOM/trailing-whitespace/final-newline scan.
32. **Exact changed files:** 42 total: 29 tracked modifications and 13 untracked new files. Name/status and numstat inventories below include the additional sync repository repair.
33. **Final Git status:** recorded verbatim below. Branch remains `feature/mvp25-three-cognitive-games`, HEAD `a030ac8`, index empty. Everything remains uncommitted.
34. **Cleanup:** task-created PostgreSQL database/cluster/binaries/archive, browser package/profile/helpers, puzzle/SQL fixtures, screenshots, exports, logs and audit caches were removed from the exact task-owned directory. The newly created ESLint cache file was removed. Browser and task Metro processes were closed; PostgreSQL stopped. Pre-existing Expo route metadata, favicon cache and cache directories were retained. No broad Git clean/reset/restore was used.
35. **Native/hosted tests remaining:** physical phone/tablet interaction, maximum OS font sizing, TalkBack/VoiceOver, native A→B→A navigation and persistence, installed voices/read-aloud across languages, native account/backup transport and hosted Supabase integration. No APK was built and no cloud deployment was performed.
36. **Limitations:** source/migration/browser-component evidence does not certify full native workflows, clinical suitability, native-speaker accuracy, every device font/glyph renderer, hosted JWT authentication, production-scale sync queue performance, or full chess-engine correctness. SQLite rollback proof is transactional failure recovery rather than a downgrade.
37. **SAFE TO COMMIT: YES for the reviewed source.** Both independently reproduced defects are repaired; final regressions/toolchain/export and local PostgreSQL checks pass. This is not native/hosted release clearance. No commit was made.

Final `git diff --stat a030ac8`:

```text
 README.md                                      |  2 +-
 app/patient/games/index.tsx                    |  3 +++
 components/games/selection-activity-screen.tsx | 21 ++++++++++++++++-----
 scripts/check-analytics.cjs                    |  4 +++-
 scripts/check-auth-cloud-hardening.cjs         |  4 ++--
 scripts/check-auth-sync-migration.cjs          |  4 ++--
 scripts/check-care-circle-reports.cjs          | 18 +++++++++---------
 scripts/check-cognitive-ai.cjs                 |  2 +-
 scripts/check-cognitive-expansion.cjs          |  5 +++--
 scripts/check-cognitive-migration.cjs          |  4 ++--
 scripts/check-extra-cognitive-games.cjs        |  8 ++++----
 scripts/check-mvp22-boundaries.cjs             |  1 +
 scripts/check-my-care.cjs                      |  4 ++--
 scripts/check-my-day.cjs                       |  4 ++--
 scripts/check-my-memories.cjs                  |  4 ++--
 scripts/check-native-hardening.cjs             |  8 ++++----
 scripts/check-visual-ux.cjs                    |  1 +
 src/ai/cognitive-coach.ts                      |  3 +++
 src/ai/feature-extractor.ts                    |  3 +++
 src/caregiver/reports.ts                       |  3 ++-
 src/db/migrations/index.ts                     |  2 ++
 src/db/repositories/cognitive.repository.ts    |  8 +++++++-
 src/db/repositories/sync.repository.ts         |  7 +++++--
 src/db/schema.types.ts                         |  7 +++++--
 src/games/presentation.ts                      |  4 ++++
 src/games/selection-engine.ts                  |  3 ++-
 src/games/telemetry.ts                         |  3 +++
 src/i18n/cognitive-strings.ts                  |  9 +++++----
 supabase/functions/online-ai/contract.ts       |  2 +-
 29 files changed, 100 insertions(+), 51 deletions(-)
```

Final `git diff --numstat a030ac8`:

```text
1	1	README.md
3	0	app/patient/games/index.tsx
16	5	components/games/selection-activity-screen.tsx
3	1	scripts/check-analytics.cjs
2	2	scripts/check-auth-cloud-hardening.cjs
2	2	scripts/check-auth-sync-migration.cjs
9	9	scripts/check-care-circle-reports.cjs
1	1	scripts/check-cognitive-ai.cjs
3	2	scripts/check-cognitive-expansion.cjs
2	2	scripts/check-cognitive-migration.cjs
4	4	scripts/check-extra-cognitive-games.cjs
1	0	scripts/check-mvp22-boundaries.cjs
2	2	scripts/check-my-care.cjs
2	2	scripts/check-my-day.cjs
2	2	scripts/check-my-memories.cjs
4	4	scripts/check-native-hardening.cjs
1	0	scripts/check-visual-ux.cjs
3	0	src/ai/cognitive-coach.ts
3	0	src/ai/feature-extractor.ts
2	1	src/caregiver/reports.ts
2	0	src/db/migrations/index.ts
7	1	src/db/repositories/cognitive.repository.ts
5	2	src/db/repositories/sync.repository.ts
5	2	src/db/schema.types.ts
4	0	src/games/presentation.ts
2	1	src/games/selection-engine.ts
3	0	src/games/telemetry.ts
5	4	src/i18n/cognitive-strings.ts
1	1	supabase/functions/online-ai/contract.ts
```

Final `git diff --name-status a030ac8` (tracked files):

```text
M	README.md
M	app/patient/games/index.tsx
M	components/games/selection-activity-screen.tsx
M	scripts/check-analytics.cjs
M	scripts/check-auth-cloud-hardening.cjs
M	scripts/check-auth-sync-migration.cjs
M	scripts/check-care-circle-reports.cjs
M	scripts/check-cognitive-ai.cjs
M	scripts/check-cognitive-expansion.cjs
M	scripts/check-cognitive-migration.cjs
M	scripts/check-extra-cognitive-games.cjs
M	scripts/check-mvp22-boundaries.cjs
M	scripts/check-my-care.cjs
M	scripts/check-my-day.cjs
M	scripts/check-my-memories.cjs
M	scripts/check-native-hardening.cjs
M	scripts/check-visual-ux.cjs
M	src/ai/cognitive-coach.ts
M	src/ai/feature-extractor.ts
M	src/caregiver/reports.ts
M	src/db/migrations/index.ts
M	src/db/repositories/cognitive.repository.ts
M	src/db/repositories/sync.repository.ts
M	src/db/schema.types.ts
M	src/games/presentation.ts
M	src/games/selection-engine.ts
M	src/games/telemetry.ts
M	src/i18n/cognitive-strings.ts
M	supabase/functions/online-ai/contract.ts
```

Final `git status --short --untracked-files=all` (complete changed-file inventory):

```text
 M README.md
 M app/patient/games/index.tsx
 M components/games/selection-activity-screen.tsx
 M scripts/check-analytics.cjs
 M scripts/check-auth-cloud-hardening.cjs
 M scripts/check-auth-sync-migration.cjs
 M scripts/check-care-circle-reports.cjs
 M scripts/check-cognitive-ai.cjs
 M scripts/check-cognitive-expansion.cjs
 M scripts/check-cognitive-migration.cjs
 M scripts/check-extra-cognitive-games.cjs
 M scripts/check-mvp22-boundaries.cjs
 M scripts/check-my-care.cjs
 M scripts/check-my-day.cjs
 M scripts/check-my-memories.cjs
 M scripts/check-native-hardening.cjs
 M scripts/check-visual-ux.cjs
 M src/ai/cognitive-coach.ts
 M src/ai/feature-extractor.ts
 M src/caregiver/reports.ts
 M src/db/migrations/index.ts
 M src/db/repositories/cognitive.repository.ts
 M src/db/repositories/sync.repository.ts
 M src/db/schema.types.ts
 M src/games/presentation.ts
 M src/games/selection-engine.ts
 M src/games/telemetry.ts
 M src/i18n/cognitive-strings.ts
 M supabase/functions/online-ai/contract.ts
?? app/patient/games/chess-puzzle.tsx
?? app/patient/games/sudoku-lite.tsx
?? app/patient/games/word-match.tsx
?? components/games/puzzle-activity-board.tsx
?? docs/MVP25_THREE_COGNITIVE_GAMES.md
?? scripts/check-three-cognitive-games.cjs
?? src/db/migrations/012_three_cognitive_games.ts
?? src/games/chess-puzzle.ts
?? src/games/sudoku-lite.ts
?? src/games/word-match.ts
?? src/i18n/three-game-strings.ts
?? supabase/migrations/20260916000000_three_cognitive_games.sql
?? supabase/tests/three_cognitive_games.sql
```
