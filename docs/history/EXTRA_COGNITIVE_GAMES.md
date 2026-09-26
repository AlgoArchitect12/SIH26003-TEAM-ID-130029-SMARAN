# Extra cognitive activities — requirements #19 and #20

Implemented on 2026-09-13, only in `C:\Users\Dharmin\OneDrive\Desktop\SMARAN-A`, branch `feature/extra-cognitive-games`. The initial tree was clean. No commit, staging, merge, tag, APK build, deployment, or real patient database mutation was performed. The supplied written mechanics were used; no videos were available to inspect. No external game names, branding, layouts, colors, media, or assets were introduced into production UI.

The [Expo SDK 54 reference](https://docs.expo.dev/versions/v54.0.0/) was read before implementation, with SDK-54 SQLite documentation checked through Context7. Existing Expo/React Native, Router, SQLite, Zustand, semantic theme tokens, buttons, speech service, coach, telemetry and adaptive services are reused. No dependency or package-lock changes.

## 1–3. Games and difficulty

`remember_lights` is Remember the Lights. Four numbered light positions remain fixed in a two-column grid. A fresh offline sequence is presented one position at a time, with steady emphasis and a 700 ms quiet gap, including between repeated positions. Each of two rounds has its own sequence. The player explicitly starts observation, then chooses “I am ready to tap” after it ends. Taps must follow the displayed order. Correct taps receive immediate feedback and an explicit Continue button; the next round begins only after the current one is complete. This differs from the existing Sequence Memory activity, which uses a static picture preview and subsequent picture choices.

`number_path` is Number Path. Each number appears exactly once in a shuffled two-column arrangement. The player selects ascending numbers, beginning with 1, with a visible check mark, completed accessibility label and disabled state on each completed number. Correct selections use the same explicit Continue control. Positions remain stable during a round. Levels 3–5 contain the complete 1→2→3→4→5→6→7→8→9→10 activity.

| Level | Lights: positions per round × rounds | Lights: emphasis per position | Number Path: range | Number Path: spatial shuffle / starting support |
| --- | --- | --- | --- | --- |
| 1 | 2 × 2 = 4 taps | 1,800 ms | 1–5 | Shuffle within groups of 2; show and outline the next number |
| 2 | 3 × 2 = 6 taps | 1,700 ms | 1–7 | Shuffle within groups of 3; show the next number |
| 3 | 4 × 2 = 8 taps | 1,600 ms | 1–10 | Shuffle within groups of 4; show the next number |
| 4 | 5 × 2 = 10 taps | 1,500 ms | 1–10 | Shuffle the full grid; show the next number |
| 5 | 6 × 2 = 12 taps | 1,400 ms | 1–10 | Shuffle the full grid; ask for the next number without naming it initially |

Lights observation is manually stepped when reduced motion or a screen reader is enabled. Anyone can select that mode before observation, or use Show next light during playback to continue at their own pace. Response time is never limited or displayed. There is no countdown, score penalty animation, sound asset, buzzer, strobe, or reaction-speed requirement.

## 4. Wrong answers and hints

Both games call the existing deterministic offline coach through `chooseSelection` and `hintSelection`. A wrong answer never advances the step or increases correct selections. First wrong Lights response: “That isn't the right one. Try once more.” On a second wrong response: “Not quite. Let's look at a small hint.” The first coaching hint actually replays the current round, using 2,400 ms emphasis or manual observation. Previously completed taps remain completed. An explicit second hint identifies and outlines the next light. At three wrong answers the correct choice is revealed and distractors are disabled, allowing a supported tap and continuation without restarting the round.

Number Path identifies the expected number immediately after an error, for example “That isn't the next number. Look for 4.” The second wrong answer also outlines that tile; the third reveals it and disables other pending choices. Explicit hints use the same progression. Assistance never fabricates successful selections. Each increased hint stage counts once; each additional requested replay counts once. Built-in level assistance and initial observation are not counted as requested hints. Repeated errors mean the same incorrect choice on the same step after an earlier error, consistent with existing games.

## 5–8. Adaptation, ownership, telemetry and caregiver integration

Both games start at level 1 and subsequently use the latest same-patient, same-game saved recommendation. They use the existing feature extraction, recommendation thresholds and optional-feedback training. Difficulty stays within 1–5 and changes by at most one level. Skipping feedback saves the session without changing learned model weights. Adaptive model keys remain `(patient_id, game_type)`.

The shared selection screen captures the patient revision before asynchronous preparation, checks it after patient/history/model reads and in event handlers, and invalidates its captured scope on unmount. The board also guards timers, focus, foreground state, and callbacks. Backgrounding interrupts observation and offers a new observation; response timing resumes on foreground/focus and after observation. The existing result service verifies patient/model identity and the repository checks patient revision inside its exclusive transaction, rolling back a switch during writes or readback. A→B→A still invalidates the original revision. Saved histories, settings and learned states remain isolated; unfinished rounds are transient and are not restored after leaving/switching, following existing game behavior.

| Recorded field | Mapping for both additions |
| --- | --- |
| `game_type` | `remember_lights` or `number_path` |
| `steps_completed` | Actual correct positions/numbers tapped across the completed session |
| `correct_selections` | Same actual successful tap count |
| `attempts` | Correct and incorrect eligible taps; disabled, duplicate and stale input excluded |
| `repeated_errors` | Repeated wrong choice for the same task |
| `hints_used` | Delivered hint-stage increments and additional requested replays |
| `accuracy` | `correct_selections / attempts`, including supported correct taps |
| `avg_response_ms` | Mean eligible decision interval; observation, Continue waiting and background intervals excluded at their resume boundaries |
| Session timestamps | Actual start and final successful tap; elapsed time is wall-clock, not active time |
| Difficulty and recommendation | Actual level and bounded next-level recommendation |
| Pair/challenge metrics | `total_pairs`, `matches`, `repeated_mistakes`, `challenges_completed` are NULL |

Hint reading time during an active answer remains part of that factual decision interval. No pace target or clinical inference is shown. Existing results, Why This Level, game titles, caregiver counts, per-game/per-level aggregates, weighted accuracy, and paginated history consume these records through the canonical eight-game catalog. No home-page cards were added. The optional online-instruction request allowlist also recognizes both IDs; its existing truthful not-configured behavior remains unchanged.

## 9. SQLite migration

`009_extra_cognitive_games.ts` is the next sequential migration after MVP-22's 008. Historical migrations 001–008 are unchanged. It rebuilds only the two cognitive child tables to extend their game CHECK constraints and adds exact new-game completion constraints: Lights `2 * (difficulty + 1)` steps, Number Path 5/7/10 steps at the corresponding levels. Existing game constraints remain intact.

Every column, explicit ID and rowid is copied. All named index SQL is saved and restored; primary-key indexes and patient cascade FKs are retained. Because 008 adds triggers on these tables and an external initial-sync snapshot trigger that references them, trigger definitions are captured, suspended and restored within the same exclusive migration transaction. This avoids invalid references during table rename and prevents migration copies from entering the outbox. Sync accounts, owners, queued mutations, versions and cursors are preserved. Foreign-key validation failure rolls back the migration. The normal migration registry provides idempotence.

Regression evidence includes a populated 001–008 database with two patients, 12 historical sessions, 12 adaptive rows, linked sync ownership/outbox records, an additional partial index and an external referencing trigger. Every historical field/ID/rowid and all index/trigger/FK definitions are compared, with failure injection at trigger removal, table rebuild, index restoration, trigger restoration, migration registration and FK validation. Fresh FK-on/FK-off installation, repeated runner invocation and post-upgrade sync enqueue also pass. Tests use disposable host SQLite, not Expo on a physical device. For a deployed device upgrade, retain a pre-upgrade backup; no downgrade or reverse migration is supplied.

## 10. Cloud migration

`20260913000000_extra_cognitive_games.sql` uses `CREATE OR REPLACE FUNCTION public.valid_sync_record` with the existing signature, language, stability and empty search path. Only the allowed activity IDs, step-metric dispatch and two new completion rules change. The original six activities and all other validation are preserved. No tables, ownership policies, grants, RPCs or deployed historical migration are altered. Client serialization uses the unchanged 008 wire columns; the client validator reads the canonical game list. The updated SQLite triggers continue to serialize both game IDs.

Source checks verify the replacement function is otherwise identical to the old function. `supabase/tests/extra_cognitive_games.sql` adds runnable SQL checks for all eight games × five levels, model acceptance, malformed new-game metrics and patient mismatch. PostgreSQL execution was **not run**: no PostgreSQL binary was available and the installed Docker client could not connect to a daemon. The existing `supabase/tests/auth_sync.sql` also remains a pending PostgreSQL check. Nothing was deployed or authenticated against production.

Apply the new cloud migration through a separately authorized rollout before enabling sync for these records. Older six-game clients reject the new IDs on pull and should be upgraded before sharing histories containing the new activities. Local offline play needs no account or network.

## 11–12. Languages, visuals and accessibility

All 25 new keys have nonempty translations and identical interpolation fields in en, hi, as, bn, mni, kha and lus, composed through the existing cognitive catalogs. English is not used as a placeholder for missing translations. Native-speaker review remains outstanding, particularly for regional languages. Existing medical disclaimers remain; these are engagement activities, not diagnosis or treatment.

The boards use MVP-19 semantic colors, wrapping text, existing text scaling and buttons, stable two-column positions, minimum 88 px tile height, explicit button/disabled/selected semantics, numbered row/column labels for lights, and completed-number labels/check icons. Light, Dark, System and both high-contrast appearances are supported. Reduced motion removes press motion and forces patient-paced observation; haptics follow the shared mechanism and are suppressed for reduced motion. Existing read-aloud controls retain installed-voice checks and visible unavailable feedback.

At `http://localhost:8085`, the unmodified app correctly showed its native-storage recovery screen. Actual `GridActivityBoard`, selection engine, generated activities, theme, text, buttons and read-aloud component were then mounted using disposable in-memory props and navigation context in that browser. No storage adapter, auth bypass, persistent test patient, source fixture route, or repository/service replacement was introduced.

The component layout matrix passed 140 combinations: two games × seven languages × five appearance settings × 390×844 and 820×1180 viewports, with extra-large text and reduced motion. No horizontal overflow or missing tile labels was found; minimum measured matrix tile size was 175.2×88 px. A separate selected-number check measured 167.6×88 px tiles with the vertical scrollbar present. Hindi Lights/light and English Number Path/high-contrast-dark phone screenshots were inspected and removed.

English level-5 browser play completed both games with three intentional errors: Number Path saved fixture telemetry of 10 correct/13 attempts/2 hints/2 repeated errors, Lights 12/15/2/2. Keyboard Enter activated observation controls and a correct light. The Mizo read-aloud control displayed its actual installed-voice-unavailable message. React Native Web reports screen-reader-enabled unconditionally, so browser observation correctly remained manual; automatic timing is covered by runnable host checks, not claimed as browser/native timing certification.

Console inspection found only two expected bootstrap storage errors and the existing Expo Notifications web warning. No failed application network requests or additional game errors were observed. Full patient navigation, result persistence, native screen reader behavior and device speech are **not** certified by this component fixture. The fixture was unmounted, the browser and task-owned server closed, and screenshots, browser logs and generated web/cache directories removed.

## 13–15. Regression and toolchain evidence

Run the dedicated script with `node scripts/check-extra-cognitive-games.cjs`. It covers generation/all levels, full 1–10, boundaries, coaching/replay/reveal, completion, exact metrics, same-patient/game recommendations, A→B→A rollback for both games at six async boundaries, actual selection-screen/board handlers across seven languages and levels 1/5, timed observation/input locks/slower replay/background/focus guards, SQLite preservation/fresh install/replay, cloud source compatibility and original UI/catalog constraints.

Independent review found and repaired a weakened test boundary: the populated auth-sync test had replaced the production migration runner with a handwritten 008-only runner. It now runs the production registry, asserts exact historical schema identity immediately before 009, delegates to the real 009 migration, and verifies final preservation and idempotence. Migration inventories/counts include 009, and 009 has its own populated preservation tests. Analytics fixtures cover eight games with actual completion lengths, preserving the original six games' weighted-denominator assertions. Memory Match's only engine change exports the existing shuffle; its source-equivalence check and the new historical-file checks are pinned to feature base `9a4f43c`, rather than moving `HEAD`. Protected-path allowlists add only the specifically authorized files. No product source was changed by these audit repairs.

Final script and Git results are recorded below after cleanup. Doctor and dependency checks initially failed under network restrictions, then passed with approved execution outside the sandbox. Export initially could not execute the installed Hermes compiler inside the sandbox, then passed outside it. These were tool-environment restrictions, not suppressed validation failures. Public config/export ran without dotenv loading to avoid embedding local cloud configuration in disposable build output. Export generated Android/iOS Hermes bundles and web output with 38 routes, including both additions. Known output warnings were Expo Notifications' web limitation and NO_COLOR/FORCE_COLOR interaction.

## 16–20. Review and remaining validation

Source is ready for review and commit after the documented checks, without claiming release certification. Before release, run the two Supabase SQL tests in a disposable local/staging database after both migrations; verify real Android/iOS SQLite migration and persistence, linked outbox synchronization, cold restart, airplane mode, A→B→A during playback and result saving, real TalkBack/VoiceOver labels/focus/announcements, installed/missing language voices, actual device haptics, background interruptions and large system fonts on phones/tablets. No APK was built and no native-device test was performed here. Native-speaker review of all new translations remains required.

Git remains on `feature/extra-cognitive-games`, with no staged changes or commits. Exact final status, changed-file inventory, regression exits, toolchain results and diff checks follow.


## Final results

Baseline HEAD: `9a4f43c0c5a563a871cd514e9012fcf0bc23e86c`. All 21 scripts returned exit 0 after QA cleanup. Analytics and My Care also ran their built-in Asia/Kolkata, UTC and America/New_York child checks.

| Regression command | Result |
| --- | --- |
| `node scripts/check-analytics.cjs` | PASS (exit 0) |
| `node scripts/check-auth-sync-migration.cjs` | PASS (exit 0) |
| `node scripts/check-auth-sync.cjs` | PASS (exit 0) |
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
| `node scripts/check-ux-overhaul.cjs` | PASS (exit 0) |
| `node scripts/check-visual-ux.cjs` | PASS (exit 0) |

| Toolchain command | Result |
| --- | --- |
| `npx.cmd tsc --noEmit` | PASS, exit 0 |
| `npx.cmd expo lint` | PASS, exit 0, no warnings |
| `npx.cmd expo-doctor` | PASS, 18/18 |
| `npx.cmd expo install --check` | PASS, dependencies up to date |
| `npx.cmd expo config --type public` | PASS, SDK 54, unchanged application identifiers/config |
| `npx.cmd expo export --platform all` | PASS, Android/iOS Hermes + web; 38 static routes |
| `git diff --check` | PASS, no whitespace errors |
| `git diff --cached --stat` | Empty; nothing staged |

`git diff --stat` excludes the ten new untracked deliverables; the status below lists all 35 changed/new files. The normal ignored `dist` export and generated `.expo/types` remain. Temporary browser fixtures, logs, screenshots, `.expo/web` and `.expo/cache` were removed.

### Exact git status

```text
On branch feature/extra-cognitive-games
Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
	modified:   README.md
	modified:   app/patient/games/index.tsx
	modified:   components/games/selection-activity-screen.tsx
	modified:   scripts/check-analytics.cjs
	modified:   scripts/check-auth-sync-migration.cjs
	modified:   scripts/check-cognitive-ai.cjs
	modified:   scripts/check-cognitive-expansion.cjs
	modified:   scripts/check-cognitive-migration.cjs
	modified:   scripts/check-mvp22-boundaries.cjs
	modified:   scripts/check-my-care.cjs
	modified:   scripts/check-my-day.cjs
	modified:   scripts/check-my-memories.cjs
	modified:   scripts/check-native-hardening.cjs
	modified:   scripts/check-visual-ux.cjs
	modified:   src/ai/cognitive-coach.ts
	modified:   src/ai/feature-extractor.ts
	modified:   src/db/migrations/index.ts
	modified:   src/db/repositories/cognitive.repository.ts
	modified:   src/db/schema.types.ts
	modified:   src/games/memory-match/engine.ts
	modified:   src/games/presentation.ts
	modified:   src/games/selection-engine.ts
	modified:   src/games/telemetry.ts
	modified:   src/i18n/cognitive-strings.ts
	modified:   supabase/functions/online-ai/contract.ts

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	app/patient/games/number-path.tsx
	app/patient/games/remember-lights.tsx
	components/games/grid-activity-board.tsx
	docs/history/EXTRA_COGNITIVE_GAMES.md
	scripts/check-extra-cognitive-games.cjs
	src/db/migrations/009_extra_cognitive_games.ts
	src/games/grid-activities.ts
	src/i18n/extra-game-strings.ts
	supabase/migrations/20260913000000_extra_cognitive_games.sql
	supabase/tests/extra_cognitive_games.sql

no changes added to commit (use "git add" and/or "git commit -a")
```

### Git diff stat

```text
 README.md                                      |  2 ++
 app/patient/games/index.tsx                    |  2 ++
 components/games/selection-activity-screen.tsx | 16 ++++++++++++----
 scripts/check-analytics.cjs                    | 22 +++++++++++++---------
 scripts/check-auth-sync-migration.cjs          | 12 ++++++++++--
 scripts/check-cognitive-ai.cjs                 |  2 +-
 scripts/check-cognitive-expansion.cjs          |  6 ++++--
 scripts/check-cognitive-migration.cjs          |  4 ++--
 scripts/check-mvp22-boundaries.cjs             |  1 +
 scripts/check-my-care.cjs                      |  4 ++--
 scripts/check-my-day.cjs                       |  4 ++--
 scripts/check-my-memories.cjs                  |  4 ++--
 scripts/check-native-hardening.cjs             |  8 ++++----
 scripts/check-visual-ux.cjs                    |  4 ++++
 src/ai/cognitive-coach.ts                      |  2 ++
 src/ai/feature-extractor.ts                    |  2 ++
 src/db/migrations/index.ts                     |  2 ++
 src/db/repositories/cognitive.repository.ts    |  4 +++-
 src/db/schema.types.ts                         |  6 ++++--
 src/games/memory-match/engine.ts               |  2 +-
 src/games/presentation.ts                      |  5 ++++-
 src/games/selection-engine.ts                  |  2 +-
 src/games/telemetry.ts                         |  2 ++
 src/i18n/cognitive-strings.ts                  |  9 +++++----
 supabase/functions/online-ai/contract.ts       |  2 +-
 25 files changed, 88 insertions(+), 41 deletions(-)
```

### Git diff name-status

```text
M	README.md
M	app/patient/games/index.tsx
M	components/games/selection-activity-screen.tsx
M	scripts/check-analytics.cjs
M	scripts/check-auth-sync-migration.cjs
M	scripts/check-cognitive-ai.cjs
M	scripts/check-cognitive-expansion.cjs
M	scripts/check-cognitive-migration.cjs
M	scripts/check-mvp22-boundaries.cjs
M	scripts/check-my-care.cjs
M	scripts/check-my-day.cjs
M	scripts/check-my-memories.cjs
M	scripts/check-native-hardening.cjs
M	scripts/check-visual-ux.cjs
M	src/ai/cognitive-coach.ts
M	src/ai/feature-extractor.ts
M	src/db/migrations/index.ts
M	src/db/repositories/cognitive.repository.ts
M	src/db/schema.types.ts
M	src/games/memory-match/engine.ts
M	src/games/presentation.ts
M	src/games/selection-engine.ts
M	src/games/telemetry.ts
M	src/i18n/cognitive-strings.ts
M	supabase/functions/online-ai/contract.ts
```
