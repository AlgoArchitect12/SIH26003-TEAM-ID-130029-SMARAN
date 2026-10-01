# Final Stitch visual fidelity audit

Baseline: `1824535507d3f0b3ce95f21d1218ac553873d6a9`, clean working tree on
`feature/stitch-ui-final-implementation`, September 30, 2026. The annotated tag
`pre-stitch-ui-pass2-golden` and branch `checkpoint/stitch-ui-pass2-golden` are
read-only baselines for this work.

## Actual references inspected

The complete archive is
`C:\Users\Dharmin\Downloads\stitch_smaran_ai_ui_ux_polish.zip`.
SHA-256: `afbedb82348f129e9de3fd1ddd909d2592c6025782a727250f8b2d7166a029ba`.
Its root is `stitch_smaran_ai_ui_ux_polish/`: 17 screen/reference PNGs with
corresponding HTML, three supporting PNGs, a PRD and
`smaran_dignified_memory/DESIGN.md` (61 ZIP entries including directories).
Every screen PNG and all three supporting images were opened for visual
inspection. HTML headings, structure and color definitions were inspected as
secondary references; DESIGN.md was read in full. Extracted files are local,
ignored QA material in `.expo/stitch-final-reference/`.

The previously used `stitch_smaran_ai_ui_ux_polish (1).zip` was also inventoried.
It lacks all three game reference sheets. Its shared files are byte-identical
except for the profile PNG and accessibility HTML. This audit uses the complete
archive above, including its profile PNG, rather than inheriting the earlier
pass's visual assumptions.

**PNG precedence:** the rendered screens have a pale blue canvas and panels.
The earlier implementation followed DESIGN.md's conflicting warm-canvas prose.
Normal light mode now follows the actual PNGs: `#F8F9FF` canvas, white raised
cards, `#EFF4FF` muted panels, `#E6EEFF` selected panels and deep teal actions.
Interactive borders remain strong; static card boundaries use the softer
divider color. High contrast and dark modes retain their accessible palettes.

Read the [Expo SDK 54 reference](https://docs.expo.dev/versions/v54.0.0/) before
editing. This remains the existing Expo Router/React Native application, with
shared components, theme tokens, native SQLite, Zustand preferences and the
existing optional cloud services. No additional framework or dependency.

## Core screen mapping

Reference names below are directories under the archive root; each means its
actual `screen.png` and secondary `code.html`. Shared changes apply to every
listed route without duplicating their screen implementations.

| Screen / Stitch reference | React Native route/component | Differences found and implemented changes | Intentional deviations | Validation |
| --- | --- | --- | --- | --- |
| Branding: `smaran_ai_emblem` | `components/ui/smaran-brand.tsx`, `screen-wrapper.tsx` | Oversized centered masthead differed from the small left-aligned reference. Reuse the exact supplied emblem at 32px with left-aligned text. Extend the same shell to Account. | No inert SOS or profile icon. Real navigation remains labelled. | Native capture pending final rerun. |
| Comfort onboarding: `smaran_ai_onboarding_senior_setup` | `app/onboarding/accessibility.tsx`, `onboarding-screen.tsx`, `selection-card.tsx` | Green panels/heavy static frames replaced by reference blue panels, softer grouping and smaller brand. Existing selected controls, preview and real progress preserved. | Actual step 3 of 5/6, seven languages and appearance options; no dual-language audio or Bluetooth assistance claim. | Native capture pending. |
| Profile onboarding: `smaran_ai_senior_onboarding_profile` | `app/onboarding/profile.tsx`, `smaran-field.tsx` | Correct shared header, panel treatment and card padding around existing labelled inputs. | No invented person/photo, verified identity or local companion restore. Actual validated fields and onboarding order retained. | Native capture pending. |
| Home: `smaran_ai_home_companion` | `app/patient/home.tsx`, `home-action-card.tsx` | Correct canvas/header; add the reference's inset date strip; change the featured image card from a cramped icon row to vertical title/copy and a clear peach action band. | Current person's greeting/date/region and real reminders only. Existing regional photo and offline wording; no weather, fake daily score or unimplemented featured game. | Native Home comparison executed; final evidence pending. |
| Train My Mind: `smaran_ai_train_my_mind`, catalogue in `smaran_ai_11_cognitive_activities_hub` | `app/patient/games/index.tsx`, `home-action-card.tsx` | Blue intro and icon panels, compact branding and lighter card outlines replace the green/heavy presentation. Existing icon/title/subtitle catalogue matches the comprehensive 11-game reference's row structure. | Keep all 11 actual games. No mockup's four fictional activities, fake completion percentage, clinical validation, audio duration or category filters without data. | Native catalogue comparison executed; all-game checks pending. |
| My Day: `smaran_ai_daily_timeline_my_day` | `components/my-day/my-day-content.tsx` | Existing chronological time-first cards already map to reference. Shared blue date/completion panel and calmer static grouping improve hierarchy. | Actual reminder state and completion time only; no fake medication, BP, arrivals or snooze. Empty schedule stays empty. | Native empty state inspected; regression verification pending. |
| My Memories: `smaran_ai_my_memories_regional_reminiscence` | `app/patient/my-memories.tsx`, `my-memory.tsx`, `my-memory-editor.tsx`, `memory-photo.tsx` | Correct shared canvas/intro/frame treatment; preserve existing photo-led saved-memory cards, editor and warm explanatory empty state. | No supplied family photo presented as the user's family. Contain personal photos to avoid cutting out faces. Real voice recording controls remain in detail. | Native empty state inspected; photo/editor regression verification pending. |
| My Home / North-East: `smaran_ai_north_east_heritage_my_home` | `app/patient/my-home.tsx`, `my-home-memory.tsx`, `components/my-home/shared.tsx` | Correct common header/surface hierarchy around the existing supplied Brahmaputra image and regional narrative cards. | Eight actual regional packs, existing credits and text-to-speech. No fabricated soundscape library. Uncropped credited photographs remain; supplied river image is decorative for Assam only. | Final native rerun pending after Fast Refresh interrupted capture. |
| Caregiver: `smaran_ai_caregiver_center_pairing` | `app/caregiver/home.tsx`, `care-overview.tsx`, `care-workspace.tsx`, `sync-status.tsx` | Correct shared header/blue panels/white card grouping around real identity, sync status and factual metrics. | Keep authenticated account-based sync, real caregiver contacts and counts. No remote battery, P2P/Wi-Fi telemetry or emergency dispatch. | Native and boundary checks pending final verification. |
| Pairing: same caregiver reference | `app/caregiver/pairing.tsx`, `components/caregiver/pairing-panel.tsx` | Shared card/panel presentation applies to permissions and existing pairing controls. No pairing service edits. | Real expiring code, selected scopes and revocation; no fake QR code or always-paired badge. | Native signed-out state and regression verification pending. |
| Reports: `smaran_ai_caregiver_reports_analytics` | `app/caregiver/reports.tsx`, `activity.tsx`, `care-workspace.tsx` | Existing selected period buttons and report-section panels now use the reference's blue/white surfaces and softer static boundaries. | Actual generated facts, scope filtering and existing export/delivery consent. No physician assessment, stability curve or fake weekly metrics. | Native and full regression verification pending. |
| Settings: `smaran_ai_settings_accessibility` | `app/patient/settings.tsx`, `patient-page.tsx`, `appearance-choices.tsx` | Shared blue selected controls/live preview and white grouped cards, compact header. Preserve readable labels and genuine save status. | Existing separate settings sections and all appearance/language options remain. No fictional doctor voice or voice speed controls. | Final native rerun and large-text/dark checks pending. |
| Location: `smaran_ai_location_offline_vault` | `app/patient/location.tsx`, `app/caregiver/location.tsx`, `location-panel.tsx`, `location-map.native.tsx` | Shared header, blue consent panel and white surfaces now follow PNG hierarchy. Real map/coordinates/freshness remain conditional on actual data. | No decorative fake map, guaranteed safe radius, background schedule, offline queue or zero-battery claim. Actual device battery only. | Native signed-out/permission presentation and security checks pending. |
| Account / Auth / Sync: no dedicated screen PNG; use settings/caregiver reference shell | `app/account.tsx`, `app/auth/callback.tsx`, `sync-status.tsx` | Previously bare Account title is now the same icon-led PageIntro, with the shared brand header and card treatment. Existing status, fields, actions and guards unchanged. | No invented connected/cloud state; web's native-auth limitation remains visible. Callback behavior unchanged. | Native and browser verification pending. |

## All eleven game mappings

Game sheets are visual references for presentation, not specifications to replace
the app's working engines. `selection-activity-screen.tsx` still owns ten games;
Memory Match retains its separate engine and route. Prompt text, legal choices,
timing, scoring, difficulty, telemetry, speech and persistence remain unchanged.

| Game / reference sheet | Route / component | Differences found and implemented changes | Intentional deviations | Validation |
| --- | --- | --- | --- | --- |
| Memory Match / `smaran_ai_games_1_4_visual_references` | `app/patient/games/memory-match.tsx`, `memory-card.tsx` | Pale question-mark backs changed to solid deep teal with a quiet motif and high-contrast position label. Header uses the blue instruction surface. Matched checks, preview, wrong/hint states stay explicit. | Familiar existing symbols, not invented cultural pair assets. Existing randomized pair counts and preview. | Native and game tests pending. |
| Pattern & Shape / games 1–4 | `app/patient/games/pattern-recognition.tsx`, `selection-activity-screen.tsx` | Reference's terracotta shapes, blue option surfaces and compact secondary instructions. Dashed missing slot and correct/retry feedback retained. | Existing circles/triangles/squares/stars and real sequence rules, not a new motif engine. | Native and game tests pending. |
| Routine Recall / games 1–4 | `app/patient/games/routine-recall.tsx`, shared selection screen | Plain divider list becomes individually shaded numbered routine rows. Blue answer cards and shared instruction treatment. | Existing actual localized step order; no fake medication/meal state in the exercise. | Native and game tests pending. |
| Familiar Object / games 1–4 | `app/patient/games/familiar-object.tsx`, shared selection screen | Full-width answer rows become spacious picture-choice cards with vertically stacked 48px symbols and labels. | Existing semantic object task and symbols. No image that reveals the answer before an earned hint. | Native and game tests pending. |
| Sequence Memory / `smaran_ai_games_5_8_visual_references` | `app/patient/games/sequence-memory.tsx`, shared selection screen | Teal preview symbols, blue instruction surface and two-column recall choices. Real preview position and progress remain. | Existing picture sequence, not the reference's unsupported musical-bell exercise. | Native and game tests pending. |
| Picture Recall / games 5–8 | `app/patient/games/picture-recall.tsx`, shared selection screen | Framed picture previews and two-column symbol choices better match visual answer cards. | Existing hide-and-recall set; not a new scene-question game or invented observation timestamp. | Native and game tests pending. |
| Remember Lights / games 5–8 | `app/patient/games/remember-lights.tsx`, `grid-activity-board.tsx` | Plain numbered tiles become blue light cards with bulb symbols and a warm peach/sun cue while illuminated. | Preserve playback cadence, manual/reduced-motion/screen-reader path, replay and input locks; no countdown. | Native and game tests pending. |
| Number Path / games 5–8 | `app/patient/games/number-path.tsx`, grid board | Two-column oversized list becomes a three-column path board, with minimum 80px tile width/88px height, blue default tiles and retained done/hint marks. | Keep actual randomized positions and ascending-answer rules. No fake path line or decorative targets. | Native and game tests pending. |
| Sudoku Lite / `smaran_ai_games_9_11_universal_results_reference` | `app/patient/games/sudoku-lite.tsx`, `puzzle-activity-board.tsx` | Number answers now form a wrapping number pad instead of full-width rows. Blue guided board and completed-cell states remain. | Real 4×4/6×6 puzzles, fixed clues, arbitrary blank selection and full-size fallback controls on narrow displays. | Native and game tests pending. |
| Chess Puzzle / games 9–11 | `app/patient/games/chess-puzzle.tsx`, puzzle board | Teal/white board becomes alternating wood tones using two shared theme tokens; coordinates explicitly use high-contrast body ink. | Real 8×8 chess and legal moves, scrollable large cells and textual alternatives. Do not copy the mockup's cropped/nonstandard board. | Native and game tests pending; board contrast check executed. |
| Word Match / games 9–11 | `app/patient/games/word-match.tsx`, puzzle board | Source words and meanings now use wrapping paired columns with blue default surfaces and preserved completed/selected feedback. | Existing regional vocabulary, pair focus, coaching and used-answer locks; no unrelated photo or fabricated cultural fact. | Native and game tests pending. |
| Shared feedback/result / games 9–11 and `smaran_ai_active_exercise_feedback` | `app/patient/games/result.tsx`, `answer-feedback.tsx` | Group actual accuracy and hint count into icon-led blue/peach metric tiles matching recap composition. Preserve factual attempts, next-level explanation, optional feeling and save/retry controls. | No Mind Sparks, clinical uplift, fictitious latency, physician log or soundscape. Existing automatic advance/save and pause behavior preserved. | Native saved-result and game tests pending. |

## Accessibility and intentional visual accommodations

- Preserve native system fonts for all seven scripts; Plus Jakarta Sans is not
  bundled. Do not shrink the existing 18px secondary/20px body text to the tiny
  labels in the exported montages. OS and app text scaling remain active.
- Preserve minimum 56px controls, wrapping text, generous gaps, explicit selected
  checks and calm wrong-answer feedback. New picture/word columns wrap; number
  controls retain large touch targets. No clipped one-line labels.
- Strong input/interactive boundaries intentionally exceed screenshot subtlety.
  Static card frames can be softer because they do not identify a tap target.
- Dark and high-contrast modes are deliberate accessible adaptations; the ZIP
  provides light-mode references only. Chess text now has explicit contrast
  checks on both square colors in all four palettes (204 checks total).
- Preserve native Back, gesture Back, navigation destinations, all guards and
  data services. No database migrations, API changes or new cloud behavior.
- Supporting family/living-room photos were inspected but are not imported as
  patient records. The existing supplied emblem and Brahmaputra illustration
  remain appropriate brand/decorative assets.

## Verification record

TypeScript and ESLint executed successfully after the initial changes. The
204-pair contrast/component check passed. The full regression suite, final native
captures, navigation, relaunch/persistence, browser checks and final diff/ref
comparison are in progress. Final results replace this paragraph before commit.

The initial sandboxed Android export reached 1,896 modules but could not execute
Hermes (`permission denied`). The permitted retry succeeded: 77 assets and
`entry-c5f9499cc5169732710e7ef1f3771fbb.hbc` (6.41 MB). Fast Refresh interrupted
some early native screenshots; those are not accepted as final visual evidence.
