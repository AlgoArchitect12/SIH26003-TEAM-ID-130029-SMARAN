# Stitch games implementation — Pass 2

## Resumed baseline

Resumed on September 30, 2026 on `feature/stitch-ui-final-implementation` at
`2e050290fd1cfc1a1aad5413877463bffde7e001`. Initial `git status` was clean and
`git diff` was empty. HEAD and the remote tracking branch matched the expected
Pass 1 commit. The log and reflog showed no partial Pass 2 commit; there was no
interrupted application work to recover or discard.

## Reference and scope

Used the existing export in ignored `.expo/stitch-reference/`, especially
`smaran_dignified_memory/DESIGN.md` and `smaran_ai_active_exercise_feedback/screen.png`,
alongside the established [Pass 1 mapping](STITCH_UI_IMPLEMENTATION_MAP.md).
Read the [Expo SDK 54 reference](https://docs.expo.dev/versions/v54.0.0/) before editing.

Reuse the existing warm canvas, teal actions, slate text, sage success, terracotta
retry, `SmaranCard`, `SmaranButton`, `ThemedText`, and `ProgressIndicator`.
Native system fonts, existing translated copy, text sizing, contrast modes,
voice controls, haptics and reduced motion remain. No new dependencies or assets.

## All eleven activities

Every row uses the existing shared result route for factual metrics, optional
feedback, save/retry, next difficulty, explanation and continuation. Every game
already supports adaptive recommendations and in-session pause/resume; this pass
does not add persistent resume across app termination.

| Game | Presentation implemented | Preserved mechanics and lifecycle |
| --- | --- | --- |
| Memory Match | Teal instruction card, wrapping controls, real pair progress, bordered preview and hint panels, calm teal card backs, legible matched symbols and retry lightbulb. | Separate board/engine, randomized cards, timed preview, flip/compare locks, pairs, hints, telemetry, existing pause/restart and result handoff. |
| Pattern & Shape | Framed pattern board, larger spaced shape tokens, dashed teal missing slot, 88px answer rows, framed correct/retry feedback. | Match/next/missing challenges, level-specific content, choices, coaching and automatic continuation. |
| Routine Recall | Numbered preview rows separated by rules, framed question, large answer cards and calm feedback. | Localized routines, hidden preview after Start, step order, hints and scoring. |
| Familiar Object | Framed prompt, large symbol choices, centered readable picture support, hint and feedback cards. | Existing object/cue rules, level-specific distractors and coaching. |
| Sequence Memory | Actual preview-position indicator, large picture card, framed recall question and answer feedback. | One-at-a-time preview, existing Continue/ready controls, ordered recall, hidden answers and sequence hints. |
| Picture Recall | Larger wrapping picture cards, framed recall question, spacious answer rows and feedback panels. | Original preview set, hide-on-start, unique answer choices and picture hints. |
| Remember Lights | Framed round/instruction panel, 104px tiles with 16px gaps, distinct light emphasis, bordered feedback/hints. | Original playback timing, manual/reduced-motion/screen-reader paths, replay, round progression, pause and foreground guards. |
| Number Path | Larger tiles, framed next-number prompt, sage completed tiles with existing checkmarks, calm retry/hint panels. | Original shuffled positions, ascending answers, completed-input locks and truthful step progress. |
| Sudoku Lite | Framed cell prompt, stronger selected border, sage filled cells, large number choices and feedback. | Original puzzle generation, immutable clues, candidate hints, arbitrary blank selection, retained coaching and narrow-screen full-size fallback controls. |
| Chess Puzzle | Warm alternating board surfaces, 32px piece symbols, scalable 18px coordinates, at least 72px-wide and 88px-tall cells, explicit board answer feedback. | Existing recognition/move/capture/safe tasks, source/target marks, legal-move hints, horizontal board scroll and full-size textual alternatives. |
| Word Match | Large word selectors and answers, visible current pair, sage completed pairs, framed prompt/hints/feedback. | Existing regional pairs, arbitrary pair selection, retained per-pair coaching and used-answer locks. |

## Shared completion and behavior boundaries

- Result summary retains actual accuracy, attempts, hints, completed pairs/steps
  and the existing adaptive recommendation. The optional feeling choices now sit
  in a bordered card. The pause control is visible while a pending result's
  automatic save can be paused; it is hidden after saving, when there is no timer
  left to pause. Existing save, retry, back interception and navigation handlers
  remain unchanged.
- The catalogue and all route wrappers remain intact. Ten activities still use
  `SelectionActivityScreen`; Memory Match retains its separate lifecycle.
- The only `src/` edit removes the stale per-answer Continue sentence from both
  grid games' instructions in all seven translations. The games already advance
  automatically. Engines, difficulty, scoring, telemetry, speech services,
  repositories, schemas, migrations, patient guards, settings and persistence
  contracts are unchanged.
- No invented emergency, cloud, P2P, soundscape, clinical score or adaptive data.
  The export's fictional content and combined catalogue/session layout are not
  imported into the product.

## Files

- `app/patient/games/memory-match.tsx`
- `app/patient/games/result.tsx`
- `components/games/memory-card.tsx`
- `components/games/selection-activity-screen.tsx`
- `components/games/grid-activity-board.tsx`
- `components/games/puzzle-activity-board.tsx`
- `scripts/check-cognitive-ai.cjs`: extend existing rendered-screen checks with
  real pair-progress agreement and pause/resume disabled-state assertions.
- `src/i18n/extra-game-strings.ts` and `scripts/check-extra-cognitive-games.cjs`:
  align grid instructions with existing automatic progression and guard the copy.
- This map and [Pass 2 validation](STITCH_GAMES_PASS2_VALIDATION.md).

Intentional visual accommodations: scrolling and larger controls take precedence
over mockup density. Chess keeps its existing scrollable board and accessible
text alternatives; large Sudoku keeps its existing full-size cell selectors
when the board cannot offer 56px touch targets.
