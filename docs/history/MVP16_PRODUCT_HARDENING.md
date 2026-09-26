# MVP16 product hardening and identity

Date: 2026-09-09. Worktree: `SMARAN-A`. Branch: `feature/mvp16-device-bugs`. Starting HEAD: `cba3715` (`feat: overhaul Smaran AI accessibility navigation and UX`). The starting worktree was clean. APK #3 remains the installed baseline; no APK was built during this milestone.

## Branding

The launcher, adaptive foreground/background, monochrome icon, favicon and splash were Expo starter artwork. They now use the existing Patient Home lotus, the Material Icons `spa` glyph already bundled with `@expo/vector-icons`. This extends the existing identity rather than introducing unrelated artwork. The simple, solid teal mark has no gradients, lettering or fine detail inside the launcher icon.

- Launcher: 1024px opaque warm cream background with teal lotus.
- Adaptive icon: 1024px transparent foreground and matching opaque cream background. All visible foreground pixels fit inside Android's central 66/108 safe circle. The monochrome version has the same silhouette and transparent padding.
- Splash: 512px transparent teal mark on `#F3F0E9`; a separate pale teal mark on `#121616` for system dark mode. Backgrounds match the existing light/dark app palettes. The configured image width remains 200.
- In-app brand: one shared `SmaranBrand` component displays the same asset, tinted to the current palette, with `SMARAN AI`. It appears in bootstrap/recovery, launch routing, initial onboarding, onboarding completion loading, Home and About. The image is decorative; the wordmark remains readable text that can wrap and scale.
- The existing localized tagline, `Memories that stay close.`, is preserved and added to bootstrap, initial onboarding and About.
- The app display name is consistently `SMARAN AI`. Package, scheme, slug, version and EAS identity are unchanged.
- The starter README is replaced by Smaran setup and validation information. `scripts/generate-brand-assets.ps1` reproduces the assets from the installed icon font using Windows drawing APIs; no dependency was added.

Configuration was checked against the [Expo SDK 54 reference](https://docs.expo.dev/versions/v54.0.0/) and [SDK 54 SplashScreen documentation](https://docs.expo.dev/versions/v54.0.0/sdk/splash-screen/), including the SDK 54 source through Context7. Native launch artwork requires a subsequent native build to verify. Expo Go/browser rendering does not certify the installed splash. Native splash follows the system light/dark setting; a saved in-app appearance override is applied after JavaScript/SecureStore startup, so that transition can still differ.

## Copy and screen-state audit

| Screen | Existing behavior retained; focused improvement |
| --- | --- |
| Patient Home | Actual reminders/memories, honest empty states and Add/Open actions, loading and Retry. Shared branding added. Bengali, Meitei, Khasi and Mizo read-error copy now asks for retry instead of asserting data safety after a failed read. |
| Train My Mind | Existing three bundled activities, loading, prepare failure and Retry. The activity list is fixed, so an invented empty catalog state is unnecessary. Activity algorithms and recommendations are unchanged. |
| My Day | Loading, errors, Add/Manage, factual completion and notification recovery retained. Read Aloud now uses the same empty-state scope as the screen: Today says nothing is scheduled today; Manage says nothing is planned yet. |
| My Memories | Existing loading, list failure/Retry, empty explanation, Add Memory, photo fallback and save/remove recovery retained. No sample memories added. |
| My Home | Existing region lookup/loading, invalid or failed lookup/Retry, bundled regional content and image fallback retained. All 32 local licensed images remain unchanged. |
| My Care | Existing loading, Retry, factual activity/reminder/memory counts, empty section actions and medical disclaimers retained. Missing profile now offers a direct Return to setup action. |
| Menu | Existing patient loading/recovery and static navigation groups retained. Shared page failures now say the screen could not open rather than incorrectly referring to Home. |
| Profile | Existing load/Retry, input validation, draft preservation, busy Save and failure recovery retained. Uses the corrected shared page error copy. |
| Settings | Language/text-size/appearance choices now expose disabled state while their existing save lock is active. Failure unlocks choices and tells the user to select again to retry. Voice/reduced-motion switches retain their existing disabled behavior. |
| About / startup | Shared wordmark and localized tagline. Startup retains a calm error and Retry; no exception details appear in product copy. |

The settings failure message is supplied in all seven typed catalogs: English, Hindi, Assamese, Bengali, Meitei, Khasi and Mizo. Four regional loading translations now refer to preparing Smaran, matching the existing English/Hindi/Assamese intent rather than describing saved preferences on every screen. Typed catalog keys and interpolation parity pass. Translation edits still need native-speaker review.

The production screen audit found no need to change cognitive scoring, activity history, medical disclaimers or reminder-completion semantics. Completion continues to mean marked done in Smaran, not verified medicine-taking. No diagnosis, stage, severity, progression, cure or treatment claim was introduced. Unused historical translation keys were not removed from the typed contract.

## Shared UI and accessibility

Existing card hierarchy, spacing, large controls, selected borders/check marks, text wrapping, navigation and five appearance modes are retained. `SelectionCard` now forwards `disabled` to the existing `SmaranCard`, reusing its semantic state and disabled styling. Appearance, language and text-size screens use it during saves. Existing save locks still prevent duplicate writes.

The shared voice button intentionally remains tappable during voice startup so Stop reading can cancel it. Button-loading behavior was inspected across callers and left intact. Existing reduced-motion loading/press behavior, bottom navigation, safe-area rules and high-contrast palettes are unchanged.

## Native/configuration verification

The native-hardening check passed Expo configuration introspection and host boundary regressions:

- Android package and iOS bundle ID: `com.smaran.ai`; slug/scheme: `smaran-ai`; version: `1.0.0`; Android version code: `1`.
- Expo SDK 54, managed workflow, foreign-key build flag and EAS configuration preserved.
- Camera, recording audio, broad external storage, biometric/fingerprint and overlay permissions remain blocked. No active broad media, location, contacts or exact-alarm permission was introduced.
- Photo selection remains the existing system picker with camera and microphone disabled. Notification setup and permission handling are unchanged; no remote push token registration added.
- SecureStore service and SQLite clients are unchanged. Production web SQLite still rejects unsupported native persistence. No browser-storage substitute or test adapter was introduced.
- Dependencies/lockfile and migrations 001-006 have blank diffs. No migration 007. No cloud sync, healthcare-worker architecture, caregiver persistence or cognitive algorithm changes.

## Validation results

All requested regression scripts passed:

```text
node scripts/check-native-hardening.cjs
node scripts/check-product-polish.cjs
node scripts/check-ux-overhaul.cjs
node scripts/check-cognitive-expansion.cjs
node scripts/check-my-care.cjs
node scripts/check-my-home.cjs
node scripts/check-my-memories.cjs
node scripts/check-my-day.cjs
node scripts/check-elderly-ux.cjs
```

The new `node scripts/check-product-hardening.cjs` also passes. It executes actual selection components with controlled hooks/storage promises to verify pending choices, the existing duplicate-write guard, failed-save recovery and successful retry. It verifies Settings disabled props and actual My Day rendered/spoken empty-state agreement. PNG checks verify transparency, adaptive safe-circle bounds and splash palette consistency. These are host contract checks, not native interaction tests.

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` | Pass |
| `npx expo lint` | Pass, no warnings |
| `npx expo-doctor` | 18/18 passed |
| `npx expo install --check` | Dependencies up to date |
| `npx expo config --type public` | Pass; correct identity, permissions and brand paths |
| `npx expo export --platform all --max-workers 2` | Pass; Android/iOS Hermes bundles, web bundle and 28 static routes |
| Required package, migration and web-client diffs | Blank |
| `git diff --check` | Pass |

This fresh worktree had no installed dependencies. `npm ci --ignore-scripts --no-audit --no-fund` restored the existing lockfile packages without changing manifests. Asset rasterization and Hermes compilation initially hit sandbox permission failures; approved retries succeeded. Export emitted the existing unsupported web notifications notice and color-environment warnings. A new web image-tint deprecation warning found during QA was corrected before the final export.

### Browser evidence and limits

The real, unchanged production web boundary was tested at `http://localhost:8081/` using Playwright. No replacement database or SecureStore adapter was used.

- Bootstrap recovery tested at 360, 768 and 1280px widths in system light/dark mode with reduced motion requested. No horizontal overflow; Retry measured 56px high.
- Inspected 360x812 light/dark screenshots: loaded lotus, readable wordmark/tagline, calm recovery text, visible keyboard focus outline. Backgrounds matched `#F3F0E9` and `#121616`.
- Retry was clickable and returned to recovery because web SQLite remains unsupported. This does not claim successful database recovery.
- Six retained network requests all returned HTTP 200; the brand image loaded successfully. The final browser log had two expected development-only SQLite initialization errors and the existing web notifications warning. No image-tint warning remained after reload.
- Patient screens could not be reached through this production web boundary. Their audit and regression results above are source/host evidence; this milestone does not claim browser verification of those screens, seven-language layouts, saved high-contrast modes or extra-large patient text.

Temporary Playwright output is removed after inspection. The ignored `dist/` directory contains the requested production export, not an APK.

## Remaining device tests

1. On a subsequently built APK, inspect launcher readability at small sizes, round/squircle masks, Android 13+ themed monochrome icons, and cold/warm splash in system light/dark mode. Verify the OS-to-saved-appearance transition and system bars.
2. Exercise Home, Train, My Day, Memories, My Home, My Care, Menu, Profile, Settings and About with all five appearance modes and extra-large text. Check small-screen wrapping, keyboard reachability, safe areas and bottom navigation.
3. Use TalkBack to verify wordmark reading, decorative logo suppression, selected/disabled settings announcements, error feedback, focus order and hardware Back.
4. Verify settings save/retry and persistence after force-stop/restart, plus native SQLite and SecureStore reads. Check reduced motion and voice cancellation with actual installed voices.
5. Repeat notification permission/delivery, picker cancellation, photo persistence, offline/airplane mode and completion-history checks. These native behaviors are unchanged, but host tests do not certify them.
6. Have native speakers review the edited seven-language settings message and four regional loading/error translations.

No commit, merge, tag, push, deployment or APK build was performed.
