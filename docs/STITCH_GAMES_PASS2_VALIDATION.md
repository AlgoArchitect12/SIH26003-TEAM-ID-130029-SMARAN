# Stitch games Pass 2 validation

Validated September 30, 2026. See the [implementation map](STITCH_GAMES_IMPLEMENTATION_MAP.md)
for the per-game changes and preserved behavior.

## Starting state after interruption

- Branch: `feature/stitch-ui-final-implementation`.
- HEAD and upstream: `2e050290fd1cfc1a1aad5413877463bffde7e001`.
- Initial status clean; unstaged diff empty; log/reflog showed no Pass 2 commit.
- No interrupted application changes existed. Nothing was reset or discarded.

## Automated checks

| Check | Result |
| --- | --- |
| `npx.cmd tsc --noEmit` | PASS, final source. |
| `npm.cmd run lint` | PASS, final source, no warnings. |
| `node scripts/check-regressions.cjs` | PASS, 37/37 scripts; [individual results](evidence/stitch-pass2/regressions.json). |
| Cognitive AI suite | All six original games, five difficulty levels, seven languages, rendered screen flows at levels 1/5, wrong/correct/hint/reveal, duplicate/stale input and completion. Added real Memory Match progress agreement and paused input checks. |
| Extra cognitive games suite | Both grid games across five levels and seven languages; manual/timed playback, slower replay hints, background/focus guards, truthful telemetry, persistence and patient isolation. Added a seven-language guard against instructions requesting the absent per-answer Continue button. |
| Three cognitive games suite | Sudoku, Chess and Word Match, all five levels; 120 independently solved unique Sudoku variations; chess legality/safety; regional word pairs; seven-language screen flows at levels 1/5; arbitrary cell/pair selection and retained coaching. |
| Persistence/navigation regressions | Real SQLite repositories/services, atomic saves, reopen/readback, per-game models, patient isolation, rollback/stale-save boundaries, save-before-leaving results and factual reports. |
| Visual UX suite | 196 contrast pairs, appearance resolutions, wrapping, focus, motion, accessible state and protected-path checks. |
| `git diff --check` | PASS. |

The initial suite run was 36/37 because Playwright created a temporary
`.playwright-mcp` folder prohibited by the cleanup check. Its logs were moved into
ignored `.expo/stitch-pass2-browser/`; the suite then passed. No assertion was
removed or weakened. Full-suite database tests use disposable local instances,
not the application's patient database or a production database.

## Android validation

- Final command: `EXPO_OFFLINE=1 npx.cmd expo export --platform android --output-dir .expo/stitch-pass2-final`.
- PASS: 1,896 modules, 77 assets; Hermes bundle
  `entry-18e6d5b3cafd8d5ea1e304ce3fc0f3a3.hbc`, approximately 6.4 MB.
- Native build: `android/gradlew.bat :app:assembleDebug --offline -PreactNativeArchitectures=x86_64 -x lint -x test`.
- PASS: `BUILD SUCCESSFUL`, 311 actionable tasks, 42 executed and 269 up-to-date.
  Existing Gradle deprecation notices remain. TypeScript, lint and regression
  checks were run separately; the Gradle command is a debug build validation.
- Installed this debug APK using `adb install -r`, preserving existing data.
  Runtime QA used the existing Pixel 9a emulator, Android 15/API 35,
  1080 × 2424, with current source served by Metro and native Hermes/modules.
  This is not a signed release or physical-device certification.

## All eleven game statuses

All eleven presentations are implemented. All eleven have automated full-game
completion, metrics and persistence coverage. Native coverage below distinguishes
complete sessions from individual-board interaction checks.

| Game | Native checks performed | Visual evidence |
| --- | --- | --- |
| Memory Match | Level 2 preview, pause/resume, mismatch, all three pairs, completion: 4 attempts, 75% accuracy, 0 hints. | [Board](evidence/stitch-pass2/memory.png) |
| Pattern & Shape | Level 3 start, pause/resume, retry/correct selection and Android Back to catalogue. | [Pattern and retry](evidence/stitch-pass2/pattern.png) |
| Routine Recall | Level 2 preview, start, pause/resume, retry/correct step and Android Back. | [Preview](evidence/stitch-pass2/routine.png) |
| Familiar Object | Level 2 start, pause/resume, retry/correct picture and Android Back. | [Prompt and choices](evidence/stitch-pass2/familiar.png) |
| Sequence Memory | Level 2 three-picture preview progression, hide/start, pause/resume, retry/correct selection and Android Back. | [Preview progress](evidence/stitch-pass2/sequence.png) |
| Picture Recall | Level 2 preview, hide/start, pause/resume, retry/correct selection and Android Back. | [Picture cards](evidence/stitch-pass2/picture.png) |
| Remember Lights | Level 1 manual playback, both rounds, pause/resume, incorrect/correct taps, completion, automatic save and on-screen Back; level 2 playback rechecked with final instructions. | [Playback](evidence/stitch-pass2/lights.png) |
| Number Path | Level 2 all seven targets, pause/resume, one incorrect choice, completion: 8 attempts, 88% displayed accuracy, 0 hints; save and Back. Level 3 board checked in large text/high contrast. | [Large text/contrast](evidence/stitch-pass2/number.png) |
| Sudoku Lite | Start, pause/resume, board and full-size choices, three hints, correct cell, Android Back. | [Board](evidence/stitch-pass2/sudoku.png) |
| Chess Puzzle | Start, pause/resume, readable board/coordinates and full-size move alternatives, three hints, correct move, Android Back. | [Board and alternatives](evidence/stitch-pass2/chess.png) |
| Word Match | Start, pause/resume, word selectors/answers, three hints, correct pair, Android Back. | [Word choices](evidence/stitch-pass2/word.png) |

[Shared saved result](evidence/stitch-pass2/result.png) shows real completed steps,
attempts, accuracy, hints and next difficulty. No pause action remains once the
result has saved. The synthetic QA sessions are left on the emulator; no history
was deleted to restore counts. Several native checks were restarted after Fast
Refresh reset their in-progress screens during final edits; only completed
reruns are reported above.

## Native accessibility and persistence checks

- Extra Large text on [Sudoku](evidence/stitch-pass2/large-text.png), Extra Large
  plus [Dark on Word Match](evidence/stitch-pass2/dark.png), and Extra Large plus
  high contrast light on Number Path: readable wrapping, visible borders and
  reachable controls. Restored Standard text and Use device setting afterward.
  Voice guidance remained off as originally configured; automated seven-language
  flows retain the read-aloud controls and reduced-motion paths.
- Read-only copies of native SQLite before play, after play and after force-stop/
  relaunch verified both original profiles and all 11 original session rows were
  unchanged. The three completed QA sessions increased the total to 14. All saved
  sessions and adaptive model rows survived relaunch exactly, and accessibility
  settings matched the starting values. [Aggregate evidence](evidence/stitch-pass2/persistence.json)
  contains no patient records; raw database copies remain ignored and local.
- Relaunch opened the catalogue with the existing profile. Native Back checks
  and on-screen return controls reached the catalogue without changing routes.
- Historical logcat contained one multiple-linking diagnostic during development
  reloads. The cleanly relaunched process (PID 13761) returned no ReactNativeJS or
  AndroidRuntime errors; the catalogue loaded normally. No navigation configuration
  was changed to suppress the diagnostic.

## Browser scope

Actual Playwright checks at `http://localhost:8081/account` at 360, 768 and 1280 ×
900: no horizontal overflow and the labelled Email field accepted keyboard focus.
Console/network inspected: the existing web notification capability warning and
`Local setup initialization failed` were present; no failed application API
request appeared in the inspected network list.

Opening `/patient/games/memory-match` reached the existing saved-setup error
because the project intentionally does not provide a patient SQLite adapter on
web. No fake storage or authentication bypass was added. Browser patient game
QA is therefore unavailable; native game execution and regression coverage are
reported separately.

## Review and limits

Complete diff reviewed for scope and behavior. Changes are confined to six game
presentation files, the two grid instruction strings in seven languages, two
existing regression scripts, the implementation/validation documents and selected
synthetic QA evidence. No route definitions, engines, scoring, difficulty,
telemetry, speech services, dependencies, schemas or migrations changed.

Builds, raw device/database captures, local drivers and browser artifacts stay in
ignored `.expo/` or `android/`; none are production runtime dependencies.
No iOS/physical-device session, full TalkBack listening pass, native-speaker
translation review, live cloud sync or new signed release is claimed.

## Git boundaries

Only `feature/stitch-ui-final-implementation` is authorized for commit and push,
with destination `public-sih` and no merge. Local refs were recorded before work;
protected remote refs were recorded before push for comparison. `main`,
`feature/prd-completion`, checkpoint branches and golden tags remain outside the
change. Final commit SHA, push verification and clean-tree status are reported in
the completion response rather than embedding a self-referential commit hash.
