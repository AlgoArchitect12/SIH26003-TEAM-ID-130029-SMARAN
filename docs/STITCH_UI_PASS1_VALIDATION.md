# Stitch UI pass 1 validation

Validated September 30, 2026. Implementation mapping: [STITCH_UI_IMPLEMENTATION_MAP.md](STITCH_UI_IMPLEMENTATION_MAP.md).

## Changes

The existing Expo Router/React Native application now uses the Stitch emblem, warm alabaster canvas, deep teal actions, slate typography, peach listening controls, calm feedback colors, stronger borders and rounded cards. Existing accessibility settings still control sizing, appearance and motion.

- Foundation: `constants/colors.ts`, `layout.ts`, `typography.ts`; `app.json` changes only the adaptive-icon and light splash canvas colors.
- Shared components: `ScreenWrapper`, `SmaranBrand`, `SmaranCard`, `SmaranButton`, `ReadScreenButton`, `OnboardingScreen`, `PatientPage`, `HomeActionCard`, `CareWorkspace`. Added only `PageIntro` and `ProgressIndicator`.
- Core routes: onboarding accessibility/profile/completion; patient Home, games catalogue/results, My Memories, My Home, Settings; caregiver Home, Pairing, Activity and Reports.
- Shared feature surfaces: `SelectionActivityScreen`, `AnswerFeedback`, `MyDayContent`, `LocationPanel`.
- Assets: supplied emblem and Assam river illustration, with provenance in `assets/images/STITCH_ASSETS.md`.
- Checks: new bounded/empty progress regression; existing screen harness renders shared presentation instead of hiding its text; exact native-config expectation updated for the two canvas colors. Existing assertions were retained.

No files under `src/`, dependencies, lockfile, route definitions, database schema, API adapters or game engines changed. No data reset or migration was performed.

## Visual comparison and scope

All 14 exported PNGs and corresponding HTML files were inspected, together with DESIGN.md, PRD and the three supporting images. Native captures were inspected against those references. This is a functional native translation, not a pixel-identical HTML replica. The screenshot links below show actual Android output with synthetic QA data.

| Stitch screen | Result and comparison | Native evidence |
| --- | --- | --- |
| Emblem | Implemented: supplied emblem, teal wordmark, consistent header. Existing OS launcher artwork retained. | [Home](evidence/stitch-pass1/home.png) |
| Senior setup | Implemented: large selected comfort cards, real step progress, reading preview and existing appearance/motion choices. Existing five/six-step flow retained. | [Setup](evidence/stitch-pass1/onboarding-setup.png) |
| Senior profile | Implemented: grouped labelled fields and large native date selectors; optional contacts remain. No fictional identity verification. | [Profile](evidence/stitch-pass1/onboarding-profile.png), [completion](evidence/stitch-pass1/onboarding-complete.png) |
| Home / Companion | Implemented: greeting/date panel, regional photo-led training hero, today's schedule, memories, regional content and location. Actual empty schedule replaces sample appointments. | [Home](evidence/stitch-pass1/home.png) |
| Train My Mind | Implemented: introduction and labelled icon cards with clear arrows. Keeps all eleven real activity names and destinations. | [Train](evidence/stitch-pass1/train.png) |
| 11-activity hub | Partial reference match: catalogue styling implemented; mockup's combined session/recap content remains on the existing separate routes. No fabricated activity count or reward system. | [Train](evidence/stitch-pass1/train.png), [result](evidence/stitch-pass1/exercise-completed.png) |
| Active exercise / feedback | Implemented shared shell: bordered instructions, real progress, wrapping Pause/Restart row, warm hints and sage results. Individual boards remain for the next pass. | [Exercise](evidence/stitch-pass1/exercise-active.png), [result](evidence/stitch-pass1/exercise-completed.png) |
| My Day | Implemented: date/completion panel, time-first bordered timeline rows and existing completion controls. Native QA used an empty schedule; populated/completion behavior is covered by regression scripts. | [Timeline empty state](evidence/stitch-pass1/my-day.png) |
| My Memories | Implemented: introduction, actual personal photo cards and clear empty state. Mock family photos are not patient records. Native QA used the empty state; media CRUD covered by existing tests. | [Memories](evidence/stitch-pass1/memories.png) |
| North-East Heritage | Partial reference match: supplied river illustration for Assam, existing region-specific narrative cards and speech retained; no unavailable soundscape player. | [Heritage](evidence/stitch-pass1/heritage.png) |
| Caregiver Center / Pairing | Partial reference match: cohesive workspace, selected navigation, real scopes and pairing form. Existing account/code-based access retained; no mock QR/P2P interface. | [Caregiver](evidence/stitch-pass1/caregiver.png), [pairing](evidence/stitch-pass1/pairing.png) |
| Reports / Analytics | Partial reference match: real reporting periods, selected controls and grouped factual summaries. No invented clinical graph, physician observation or sample patient metrics. | [Activity](evidence/stitch-pass1/activity.png), [generated report](evidence/stitch-pass1/report-generated.png) |
| Settings / Accessibility | Implemented: reading preview, grouped choices and existing section navigation. Native large text, dark and high-contrast checks retained accessible sizing rather than mockup density. | [Large text](evidence/stitch-pass1/settings-extra-large.png), [dark](evidence/stitch-pass1/settings-dark.png), [contrast](evidence/stitch-pass1/settings-contrast.png) |
| Location / Offline Vault | Partial reference match: privacy panel, actual permissions, battery and location freshness retained. No fictional encrypted vault, background tracking or offline transport. | [Location](evidence/stitch-pass1/location.png) |

Intentional global deviations: native system font because Plus Jakarta Sans is not bundled; larger text/controls than the exported tiny labels; warm canvas from the guide's prose/task instead of conflicting cool-blue HTML tokens; existing five-item patient navigation; larger readable back buttons; scrolling rather than compressing content. Listening controls remain hidden when voice guidance is disabled. No external image hotlinks were added.

Unsupported features deliberately omitted: emergency dispatch, clinical assessment/diagnosis, fabricated analytics/weather/appointments, cloud-sync claims, QR/P2P transport, heritage soundscapes, doctor/dual-language voices, remote battery telemetry, background location, zero-battery guarantees and a fictional offline vault. Existing working cloud/account/location/audio capabilities remain intact.

## Executed checks

| Check | Result |
| --- | --- |
| `npx.cmd tsc --noEmit` | PASS, exit 0 on final source. |
| `npm.cmd run lint` | PASS, exit 0, no lint warnings. |
| `node scripts/check-regressions.cjs` | PASS, **37/37** standalone scripts. [Machine-readable results](evidence/stitch-pass1/regressions.json). |
| `node scripts/check-stitch-ui.cjs` | PASS again after preserving polite progress announcements; empty/partial/full/out-of-range fill and accessibility values agree. |
| `node scripts/check-cognitive-ai.cjs` | PASS after compacting exercise controls; covers real screen flows with native boundaries stubbed. |
| `check-visual-ux.cjs` in full suite | PASS: 196 contrast pairs, five appearance resolutions, state/focus/motion guards. |
| `EXPO_OFFLINE=1 npx.cmd expo export --platform android --output-dir .expo/stitch-android-export` | PASS, final Hermes bundle `entry-5a792df9fa3c75e6904943e93a7c90ee.hbc`, 1,896 modules, 77 assets, approximately 6.4 MB. |
| `git diff --check` | PASS. |

The complete suite required normal local process permissions for its temporary PostgreSQL instances; sandbox-only attempts were not counted as passes. Android export similarly required permission to execute Hermes. Outputs stay in ignored `.expo/` except the selected evidence above.

## Runtime QA

Android: existing Pixel 9a emulator, Android 15/API 35, 1080 x 2424. Installed the existing compatible debug APK with `adb install -r` (preserving data), then loaded current source through Metro. This checks the current JavaScript UI on native modules; it is not a newly signed release APK validation.

- Existing Demo QA Patient loaded with its original data. Patient tabs, deep links, scroll, on-screen Back and Android Back worked across inspected routes.
- Pattern & Shape level 2: instructions, Start, Pause, Resume, five answer selections, completion, 100% factual result and next level 3. Generated a local report from real persisted sessions; no report was sent.
- Senior onboarding: role, language, accessibility, name entry, native day/month/year selection, region, Save and finish, completion and Home. Created a separate synthetic `Stitch QA` profile (01/01/1960) without overwriting the existing profile.
- Force-stop/relaunch restored the new profile. Original Demo QA Patient remained available and was reselected through the profile picker; its saved activity history loaded afterward. The extra synthetic profile and local test activity/report remain on the emulator; no cleanup deleted user records.
- Extra Large, Dark and High contrast light rendered with readable wrapping and reachable controls. Restored Standard text and Use device setting for the original profile. Voice guidance stayed off as originally configured.
- Location displayed its sign-in/cloud requirement and foreground-only limitations. No remote pairing, cloud synchronization, message delivery or location sharing was enabled during QA.
- Final ReactNativeJS/AndroidRuntime error inspection returned no errors. Initial emulator setup needed correction of an old Metro host; no runtime import error remained in the inspected flows.

Browser: actual Playwright run at 360, 768 and 1280 x 900 on the optional account page: no horizontal overflow; labelled Email field reachable by keyboard. Root patient initialization reports the existing unsupported web SQLite boundary. Browser console/network inspected: that expected setup failure and web-notification capability warning were present, with no failed API request in the inspected network list. Native patient flows were verified on Android instead of adding a fake web database.

Limits: no iOS device/gesture-back verification, TalkBack listening session, live cross-device cloud pairing, physical GPS/battery comparison or exhaustive native playthrough of all eleven games. Those capabilities were not rewritten; regression coverage is separate from live-device evidence. Populated timeline and personal-media detail states were not manually recreated in this pass.

## Git scope

Implementation is restricted to `feature/stitch-ui-final-implementation`, starting at `3e692a50eae7ab90a8f19b30318e8e1ee6f90bfc`. The delivery SHA, remote verification and final working-tree status are reported after the commit/push, so this document does not claim a push before it happens.

Protected local references verified unchanged before delivery:

| Reference | Object |
| --- | --- |
| `main` | `e783167ac8178d451df5fb886dc95e617fb6d2f0` |
| `feature/prd-completion` | `3e692a50eae7ab90a8f19b30318e8e1ee6f90bfc` |
| `checkpoint/pre-stitch-ui-final` | `3e692a50eae7ab90a8f19b30318e8e1ee6f90bfc` |
| `pre-stitch-ui-polish-final` | `68d139bccc0772fe31033afef27245bd0cad20ba` |
| `checkpoint/pre-stitch-ui-polish` | `e783167ac8178d451df5fb886dc95e617fb6d2f0` |
| `pre-stitch-ui-polish` | `bca7bf03967ad430260ff9ef09f0fbd5a6a31a48` |

No merge, reset, history rewrite or deployment is part of this pass.
