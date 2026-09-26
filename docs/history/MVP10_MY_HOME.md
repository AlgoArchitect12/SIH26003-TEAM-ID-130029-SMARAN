# MVP-10: offline My Home

Continuation completed on 7 September 2026 on `feature/mvp10-my-home`, based on `65d5684` (`feat: add offline My Memories`). The existing working tree was continued, without restarting or replacing the feature. No commit, push, deployment or next milestone was performed.

This continuation completed browser QA and the final asset/content audit, narrowed two image accessibility descriptions, strengthened the existing source-document regression check, and wrote this report. The previously verified content research and selected assets were retained.

1. **Files created relative to the stable base:** 41 new deliverables: `app/patient/my-home.tsx`, `app/patient/my-home-memory.tsx`, `components/my-home/shared.tsx`, `src/my-home/content.ts`, `src/my-home/image-credits.json`, `src/i18n/my-home-strings.ts`, `scripts/check-my-home.cjs`, `docs/product/NER_CONTENT_SOURCES.md`, this report, and the 32 JPEGs in `assets/my-home/`. Each image filename is its item ID in the pack table below plus `.jpg`. This report is the only newly created production/documentation file in the continuation; the other feature files already existed in the supplied working tree.

2. **Files modified relative to the stable base:** `app/patient/home.tsx` connects My Home; `components/accessibility/read-screen-button.tsx` accepts an optional speech language; `src/i18n/strings.ts` and `src/i18n/regional-strings.ts` merge the feature catalog. The continuation also updated the already-untracked content, source document and regression script. Loktak's image description no longer asserts a viewpoint that the selected photo does not establish. Bihu's description identifies performers, clothing and instruments without claiming that the posed photograph shows dancing. No image or factual paragraph was replaced in this continuation.

3. **Files deleted:** No production source, documentation or selected asset was deleted. The temporary `.playwright-mcp/` directory contained 19 screenshots, snapshots and logs from this and the prior QA session; these were removed after review. Runtime browser fixtures were discarded by closing the browser.

4. **Dependency changes:** None. `git diff -- package.json package-lock.json` is blank. No dependency installation, upgrade or audit fix was applied to the project.

5. **No migration:** My Home reads existing patient settings and bundled content. It adds no database table, column, migration or persisted familiarity response. The migration registry is unchanged.

6. **Regional architecture:** One typed, read-only catalog in `src/my-home/content.ts` contains stable IDs, the existing `Region` values, categories, English copy, optional reflection prompts, local image references and source/credit references. Small lookup functions return a pack, one item or a category subset. Invalid regions return an empty pack instead of defaulting to Assam or another state. `components/my-home/shared.tsx` shares persisted-patient resolution, recovery, image fallback and the bounded layout between the two screens.

7. **All eight state packs:**

   | State | Stored ID | Four item IDs and subjects |
   | --- | --- | --- |
   | Arunachal Pradesh | `arunachal` | `arunachal-ziro`: Rice fields of Ziro; `arunachal-tawang`: Tawang Monastery; `arunachal-weaving`: Idu Mishmi weaving; `arunachal-sela`: Sela Lake |
   | Assam | `assam` | `assam-tea`: Tea gardens; `assam-bihu`: Rongali Bihu; `assam-silk`: Silk work in Sualkuchi; `assam-masks`: Mask making in Majuli |
   | Manipur | `manipur` | `manipur-loktak`: Loktak Lake; `manipur-market`: Ima Keithel; `manipur-dance`: Manipuri dance; `manipur-pottery`: Longpi pottery |
   | Meghalaya | `meghalaya` | `meghalaya-bridge`: Living root bridges; `meghalaya-wangala`: Wangala; `meghalaya-weaving`: Weaving in Meghalaya; `meghalaya-umiam`: Umiam Lake |
   | Mizoram | `mizoram` | `mizoram-reiek`: Reiek hills; `mizoram-cheraw`: Cheraw; `mizoram-puan`: Puan cloth; `mizoram-chapchar`: Chapchar Kut |
   | Nagaland | `nagaland` | `nagaland-dzukou`: Dzükou Valley; `nagaland-hornbill`: Hornbill Festival; `nagaland-shawl`: Woven shawls; `nagaland-morung`: Morungs at Kisama |
   | Sikkim | `sikkim` | `sikkim-tsomgo`: Tsomgo Lake; `sikkim-rumtek`: Rumtek Monastery; `sikkim-carpet`: Carpet weaving; `sikkim-temi`: Tea from Temi |
   | Tripura | `tripura` | `tripura-neermahal`: Neermahal; `tripura-hojagiri`: Hojagiri dance; `tripura-bamboo`: Bamboo handicrafts; `tripura-ujjayanta`: Ujjayanta Palace |

8. **Item count per state:** Exactly four per state, 32 unique items in total. The permanent regression checks IDs, asset inventory, exact pack membership and persisted-state resolution. The eight states remain distinct even when they share a UI language.

9. **Categories:** Nature: 8; familiar places/landmarks: 6; crafts and textiles: 9; traditions and music: 7; everyday life: 2. These are editorial categories, not difficulty levels or scored activities. A category lookup exists, but the screen keeps the four-item list simple.

10. **Content verification:** All 32 final explanations and prompts were reviewed against the already-verified source records. Narrow factual claims use government tourism, district administrations, cultural institutions and RIWATCH. No invented folklore, unsupported superlatives, clinical benefit claim or political narrative was added. Communities are named where relevant; Dzükou is explicitly a Nagaland–Manipur border landscape. Four examples cannot represent every community in a state. The earlier careful weaving/carpet descriptions were preserved.

11. **Source documentation:** [NER_CONTENT_SOURCES.md](../product/NER_CONTENT_SOURCES.md) covers every item with state, ID, factual organization, source URL, final explanation, optional prompt and bundled image. It separately records each image's filename, original page, creator, original source credit, license URL, attribution requirements and modifications. The permanent script now checks that each final explanation, prompt, factual source and complete image credit occurs in that document, normalizing whitespace for multiline creator credits.

12. **Image licensing and final visual audit:** The 6 September source-page licensing verification was retained, as requested. All 32 final files were visually inspected in four contact sheets and decoded successfully in the real screens. Their subjects agree with the retained source records; there was no further visibly unusable/blurry selection requiring replacement. Natural haze, shadow and portrait aspect ratios remain in some photographs. Licenses are CC0, CC BY 2.0, CC BY-SA 3.0 or CC BY-SA 4.0, as individually recorded. Attribution includes original and derivative creators for Dzükou. ShareAlike requirements are documented per applicable image. The detail screen exposes offline credits and selectable, wrapping source/license references. No unverified or rejected candidate remains in the 32-file asset directory.

13. **Asset size impact:** Exactly **3,482,233 bytes (3.32 MiB)** of bundled JPEGs, measured from the files and matched to credit metadata. This replaces the approximate handoff estimate of 3.27 MiB. Assets are at most 800 pixels on the longer edge and individually below 200,000 bytes. This is the raw image addition, not a measured installed APK/IPA size delta. No asset was added or replaced by this continuation.

14. **Patient Home integration:** The existing My Home card now opens `/patient/my-home` and announces the localized opening hint. The remaining Home actions retain their existing behavior. Each of the eight state flows entered through this actual Home card rather than rendering an isolated component.

15. **My Home screen:** Shows explicit Back, the localized My Home heading and saved-state context, a short introduction, English-copy disclosure when appropriate, Read aloud, four regional cards and Return Home. Each card has its local image, complete English title, localized category, short description and a labeled Open memory action. Titles have no truncation/line cap.

16. **Detail screen:** `/patient/my-home-memory?id=...` shows the local image, English title, localized state, language disclosure, full explanation, optional prompt, Hear, familiarity response, Return Home and expandable photo credits. Back returns to My Home. A missing or other-state item ID displays recovery instead of another state's content. Every one of the 32 details and its credit panel was opened at both requested widths.

17. **Saved-state personalization:** The shared hook resolves the active patient through the existing service and patient repository, reads persisted settings, and applies language/accessibility preferences. Region is independent of onboarding draft or language. The permanent test exercises the real resolver and repository with real in-memory SQLite for all eight regions while deliberately keeping Bengali as the language. Browser tests supplied synthetic rows only at the SQLite/SecureStore boundary, leaving mapping, validation and screen logic intact.

18. **Familiarity response:** Both Yes and Not today produce the same calm invitation to take time, stay or open another memory. No score, correctness signal, timer, stored answer or adaptive input exists. Browser checks exercised both responses and verified that reopening the detail makes the choices available again.

19. **Speech:** Reuses `speech.service.ts` and `ReadScreenButton`; there is no second TTS service or external translation/speech call. The optional `speechLanguage` defaults to the UI language for existing callers; My Home explicitly supplies English. At both widths and in all seven UI languages, browser instrumentation of Expo's speech boundary verified explicit Read/Hear only, English request content/language, Stop, unavailable-voice feedback and detail-navigation cancellation. The permanent elderly-UX test also checks cancellation during pending voice lookup. Actual audible output and native/offline installed voices were not tested.

20. **Seven-language UI:** English (`en`), Hindi (`hi`), Assamese (`as`), Bengali (`bn`), Manipuri (`mni`), Khasi (`kha`) and Mizo (`lus`) are merged into the existing typed catalogs. Compile-time/catalog checks cover parity and interpolation. Browser checks cover localized controls, categories, disclosure, recovery and photo-credit layout at phone and tablet widths. Manipuri follows existing catalog conventions, including a mixture of existing script labels and romanized feature copy; linguistic consistency remains a review item.

21. **English cultural-body-copy strategy:** Titles, descriptions, full cultural explanations, prompts and image descriptions stay in reviewed editorial English. The six non-English interfaces explicitly say that this material is written and read in English while buttons use the chosen language. Text is not presented as a verified regional translation. English text carries the existing accessibility-language annotation where supported. Body copy is authored and bundled, not translated at runtime.

22. **Elderly UX:** Reuses existing typography, buttons, cards, vertical scrolling, spacing and preferences. Extra-large text remains readable, titles and state names wrap, and every Open/Hear/Home action is reachable by scrolling. There is no timed task, pressure to recall, animated image transition or scored response. Shared components were retained rather than introducing a separate design system.

23. **Accessibility:** Critical controls measured at least 56px in each dimension throughout the matrix. Accessible names combine cultural title, state, category and opening action. Images have subject descriptions; failures retain text and speech actions. Heading/recovery/live-region semantics were inspected. Keyboard Tab/Shift+Tab reached Hear with a visible solid focus outline. This is browser evidence; physical TalkBack/VoiceOver and native system-font scaling have not been certified.

24. **High contrast:** Persisted high contrast was enabled across all state and language matrix checks, together with extra-large text. The inspected screenshots show readable text, distinct filled/outlined controls and a visible focus outline. Existing theme colors are reused. No new color palette was introduced.

25. **Reduced motion:** Persisted reduced motion was enabled throughout the matrix, with browser reduced-motion emulation during the state checks. Images use `transition={0}` and a stable 4:3 frame. DOM animation inspection found zero running animations in the audited views.

26. **Offline behavior:** Factual content, prompts, pictures and credits are bundled. A warmed browser successfully opened the Assam detail and returned Home with networking disabled, then networking was restored. This checks the loaded browser flow, not a cold native launch or OS airplane-mode certification. Production persistence remains native SQLite/SecureStore. Voice availability remains dependent on the device's installed speech support.

27. **Invalid-region recovery:** Browser checks injected an invalid saved-state row at the temporary storage boundary; the production resolver rejected it and the screen offered calm recovery and Home. A simulated storage read failure showed retry, which recovered after restoring the boundary. A Tripura item requested for the Assam patient showed the missing-in-pack message. All three recovery layouts had zero overflow, clipping or undersized actions at 375×812. Invalid inputs and missing saved settings also pass permanent regression checks.

28. **Asset fallback:** Injecting an undecodable data URI into the browser-only item object triggered the actual image-error path. The picture-unavailable message appeared and the title, body, Hear and navigation remained reachable, with no overflow or small controls. The original runtime image reference was restored, and all fixtures were later discarded. Bundled files were never replaced for this test.

29. **All-eight-state QA:** At `http://localhost:8081`, every state followed synthetic persisted row → real Patient Home → real My Home → exact four-item pack → each detail → Back → Return Home. State IDs, all visible titles, image decoding, buttons and credits were checked. No cross-state mapping was observed. Each row below represents ten layout measurements: Home, list, four details and four credit panels.

   | State | 375×812 | 768×1024 | Detail/credit pairs per width |
   | --- | --- | --- | --- |
   | Arunachal Pradesh | PASS | PASS | 4 |
   | Assam | PASS | PASS | 4 |
   | Manipur | PASS | PASS | 4 |
   | Meghalaya | PASS | PASS | 4 |
   | Mizoram | PASS | PASS | 4 |
   | Nagaland | PASS | PASS | 4 |
   | Sikkim | PASS | PASS | 4 |
   | Tripura | PASS | PASS | 4 |

30. **375×812 QA:** 80 state-matrix measurements plus 28 language-matrix measurements (seven languages × list, detail, speech-unavailable state and expanded credits). Zero detected horizontal overflow, clipped state/title/body/control text, sub-56px critical targets or running animations. All 32 Open actions were used; every detail's Hear was scrolled into reach. Four additional recovery/fallback measurements also passed. Phone screenshots were visually inspected for English and Manipuri, including the long Arunachal Pradesh context, wrapping controls, body text and keyboard focus. Scrolling is expected with extra-large text; actions below the viewport remain reachable.

31. **768px QA:** Repeated all eight states and all 32 detail/credit pairs at 768×1024 (80 measurements), then the same seven-language set (28 measurements). Zero detected overflow/clipping/undersized controls. The centered content caps at 640px; list image frames measured about 589×441px and a detail frame about 638×478px, preserving containment rather than stretching the source. Tablet screenshots of list and localized detail were inspected for spacing, readable text and reachable actions. Portrait pictures intentionally have space beside them in the 4:3 frame.

32. **Regression results:** All four permanent scripts passed after temporary QA cleanup: `node scripts/check-elderly-ux.cjs`, `node scripts/check-my-day.cjs`, `node scripts/check-my-memories.cjs`, and `node scripts/check-my-home.cjs`. Coverage includes real SQLite migrations/FKs/isolation and existing My Day/My Memories behavior, speech cancellation/fallback, 32 local assets/credits, all eight stored-state mappings, seven UI catalogs, invalid inputs and source-document completeness. No test was weakened.

33. **Full production validation after cleanup:**

   | Command | Result |
   | --- | --- |
   | `npx tsc --noEmit` | PASS, 0 errors |
   | `npx expo lint` | PASS, 0 errors/warnings |
   | `npx expo-doctor` | PASS, 18/18 checks |
   | `npx expo config --type public` | PASS |
   | `npx expo export --platform all` | PASS: iOS/Android Hermes bundles and 20 static web routes |
   | `git diff --check` | PASS after the final report update |

   Commands use `npx.cmd` on Windows because PowerShell blocks the `.ps1` shim. Doctor initially hit sandbox npm/network `EACCES`; export initially hit a sandbox permission denial when executing the bundled Hermes compiler. Both were retried with approved elevated tool permissions. No project dependency or configuration change was needed. The [Expo SDK 54 documentation](https://docs.expo.dev/versions/v54.0.0/) was read before editing, as required by `AGENTS.md`. Build/export results do not substitute for native-device testing.

34. **Factual-review status:** Source-based editorial review is complete for all final items; the prior 6 September research was retained and final copy/asset consistency was reviewed on 7 September. This is not independent endorsement by source organizations or a community review. No new unsupported cultural claim was added to resolve uncertainty.

35. **Regional linguistic-review status:** Native-speaker/community review remains outstanding for regional UI wording, spelling, script consistency and cultural appropriateness. The English-body strategy avoids fabricating reviewed translations. No claim of linguistic certification is made.

36. **Warnings and risks:** Native cold-start persistence, actual audible TTS, installed offline voices, native font scaling and device screen readers remain unverified. Browser fixtures only substituted storage and Expo speech boundaries; they do not establish production web support. The browser showed the intentional unsupported-web SQLite bootstrap error before substitution and Expo's existing unsupported-web notifications warning. One QA-only `dismissAll` call on an empty stack caused a development `POP_TO_TOP` warning; product navigation in the checked flows worked. The final browser diagnostics contained only the intentional bootstrap error and existing warning; all 11 recorded HTTP requests were local and successful. Metro also logged a closed-response-stream error during development loading; subsequent loading and browser flows succeeded. Terminal color-policy and Git LF/CRLF notices are environmental. Final doctor/export details are recorded in item 33.

37. **Git status:** `feature/mvp10-my-home`, HEAD `65d5684`; nothing staged or committed. Four modified tracked files and 41 untracked new deliverables (including the 32 assets) constitute this milestone. No temporary untracked files remain. Full file inventory is in items 1–2; the final status was inspected after validation.

38. **Git diff summary:** `git diff --stat` reports `4 files changed, 15 insertions(+), 5 deletions(-)`. It excludes all untracked deliverables. `git diff --name-status` lists only the four modified tracked files from item 2. The source document, report, content, screens, script, catalog, shared feature component and images remain untracked and reviewable. No staging was used to alter this statistic.

39. **Migrations 001–005 unchanged:** Explicit individual diffs of `001_core_bootstrap.ts`, `002_cognitive_adaptation.ts`, `003_multilingual_expansion.ts`, `004_my_day.ts` and `005_my_memories.ts` are blank. The registry is unchanged. Tests migrate only their own temporary/in-memory databases; no patient database was reset or mutated by QA.

40. **Adaptive AI unchanged:** Diffs are blank for `src/ai`, `src/games`, `app/patient/games` and `components/games`. No scoring, adaptation math, game telemetry, difficulty, model or game persistence change was made. No new game was started.

41. **My Day still passes:** The full regression script passes. Its routes, shared feature component, repository and service are unchanged, as is migration 004. This continuation did not perform new My Day feature work.

42. **My Memories still passes:** The full regression script passes. Its screens, memory component, repository, coordinating service and media service are unchanged, as is migration 005. The only shared feature extension is the optional speech-language prop, defaulting to previous caller behavior; there was no shared regression fix changing My Memories semantics.

43. **No fake personal memories:** The catalog contains shared regional cultural subjects and optional prompts, not invented relatives, personal events or assertions about the patient's past. Synthetic QA profile rows existed only in temporary test databases or browser runtime memory. Nothing is seeded into production personal memories.

44. **No caregiver or extra-game work:** My Care remains the existing informational Home action. No caregiver dashboard, other game, cloud sync or next milestone was started. Work stops at MVP-10 and remains uncommitted.

45. **No runtime network dependency:** My Home contains no fetch, image-search request, translation service or remote content load. Fact and license URLs are bundled references displayed as selectable text, not automatically fetched. The final browser request list contained only the local development document, bundle, icon font and bundled images. Optional OS speech capability is the existing device service; offline voice availability is not guaranteed by this feature.

46. **No temporary QA artifacts:** No production SQLite/SecureStore adapter was written. Browser substitutions and test image/speech overrides lived only in the browser runtime, which was closed. The owned development-server session was stopped, `.playwright-mcp/` was removed after verifying its resolved workspace path, and the workspace was searched for temporary/research/fixture/adapter filenames. None remain. `scripts/check-my-home.cjs` is retained as the requested permanent regression script. Final production export output stays in ignored `dist/`; no temporary QA export is retained.

Stopped at My Home. No commit. No My Care. No next milestone.
