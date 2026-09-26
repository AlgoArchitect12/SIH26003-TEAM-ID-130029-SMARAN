# MVP-15 UX overhaul

## Scope and problems addressed

Continued the existing MVP-15 working tree on `feature/mvp15-ux-overhaul` without replacing the Expo SDK 54 architecture. The changes address unclear onboarding, manually entered age, weak visual hierarchy and contrast, scattered navigation, and a crowded Patient Home. No dependencies, cloud services, database migrations, or APK builds were added. No commit, merge, tag, or branch change was performed.

## DOB and profile

Onboarding collects Name and DOB in DD/MM/YYYY format. Strict calendar validation rejects impossible and future dates. Age is calculated from DOB using the local calendar; it is never entered or persisted separately. A February 29 birthday advances on March 1 in a non-leap year.

DOB is stored as an ISO date in the existing expo-secure-store service under `smaran.dob.${patientId}`. SQLite schema and migrations 001-006 are unchanged; there is no migration 007. Legacy age-bracket data is preserved, and older patients without DOB remain valid. Profile lets the user add or correct DOB and edit existing profile fields.

Onboarding persists the profile/settings, then DOB, before setting completion flags. It retains the newly created patient ID for a failed-save retry in the current onboarding session. Completion displays and reads aloud DOB and derived age. Profile and onboarding show visible save errors and allow retries without losing the draft. SQLite and SecureStore writes are separate, so this is not an atomic cross-store transaction; a process termination between writes is a remaining recovery boundary.

## Appearance

The existing shared palette and theme hook now support System, Light, Dark, High Contrast Light, and High Contrast Dark. The app-level selection is saved in SecureStore under `smaran.appearance`, loaded during bootstrap, and applied to screens, shared controls, navigation, and status-bar styling. System follows the device color scheme. The legacy high-contrast preference is honored when no new mode has been saved.

A failed appearance write shows a visible error and does not falsely apply a saved selection. Contrast regression checks cover text against shared surfaces (at least 4.5:1), control boundaries (at least 3:1), and action-label pairs (at least 4.5:1).

## Navigation

Existing Expo Router Stack routes are retained. A shared bottom bar is visible only on the exact Home, Train index, My Day, Memories, Menu, Profile, Settings, Support, and My Home browsing routes. It is hidden on gameplay, results, explanations, detail/edit routes, and the caregiver dashboard; these screens retain their bottom safe-area inset. Both the bar and screen wrapper use the same visibility predicate. The bar offers Home, Train, My Day, Memories, and Menu, with icons, localized labels, and accessible selected states. Menu groups Profile, My Home, My Care, Settings, and Support destinations. Settings contains language, appearance, accessibility, and voice controls; Support provides help and app information.

Primary section changes first dismiss to Home, then navigate to the selected section. This preserves a Home parent and avoids accumulating duplicate sections. Browser QA exposed and corrected an earlier dismiss-to-target implementation that could discard Home. Menu Back explicitly returns Home; other patient pages use the existing parent with a safe fallback. Direct patient entry is protected by onboarding state. On web the tab bar supports roving focus and Arrow Left/Right, Home, and End keys. Safe-area handling reserves space for the bar.

## Patient Home

Home now starts with a greeting and local numeric date. Today shows the next actual pending reminder or an honest empty/completed state. Train My Mind is prominent. Familiar Memory uses the patient's actual saved memory or an empty state. From Your Home uses existing licensed regional content for the saved region, with localized region/category labels. Loading failures offer a visible retry. No invented patient activity, scores, memories, or reminders are displayed.

## Shared UI and accessibility

Shared cards, typography, surfaces, borders, fields, buttons, and loading states provide consistent contrast and hierarchy. Fields expose labels and visible keyboard focus. Buttons and navigation have large targets, selected states use borders and semantic state as well as color, and long text can wrap. Extra-large text remains scrollable. Reduced motion suppresses shared loading/press animation, and Read Aloud respects the voice setting. Main onboarding actions precede the secondary Read Aloud action.

## Multilingual coverage

New UX strings are integrated into the existing typed catalogs for English (en), Hindi (hi), Assamese (as), Bengali (bn), Meitei (mni), Khasi (kha), and Mizo (lus). Browser spot-checks covered all seven; long Khasi labels wrapped and Indic/Meitei text rendered in the tested browser. These are functional and visual checks, not native-speaker certification. Native-speaker review remains required. Existing regional stories retain their existing English content; this work localizes surrounding controls and category/region labels.

## Browser QA evidence

QA used an isolated source copy under `.expo/mvp15-finish-qa`, with copied-only web adapters to an in-memory SQLite/SecureStore substitute. No production web database or SecureStore adapter was changed for QA. Records were created through the real UI inside that disposable environment. This validates UI flows and application contracts, not Android SecureStore or SQLite implementation behavior.

| Check | Observed result |
| --- | --- |
| Five appearance modes, standard text, 375x812 | Passed layout checks; screenshots inspected for the four explicit palettes; System followed emulated light/dark changes |
| Seven languages x three widths x Home/Menu/Profile | 63 extra-large/high-contrast-light checks passed at 360px, 375x812, and 768x1024 |
| Train, My Day, Memories, My Home, My Care, Appearance, Help, About x three widths | 24 extra-large layout checks passed |
| Home/Menu/Profile, extra-large/high-contrast-dark, 375x812 | Three additional layout checks passed |
| Layout measurements | No horizontal overflow, controls below 48px, out-of-width controls, or clipped leaf text in the measured screens |
| Visual inspection | Appearance screenshots, Hindi Profile, Meitei Menu, Khasi Profile, and tablet regional Home inspected |
| Onboarding | Impossible/future DOB rejected; valid DOB and derived age appeared in completion; DOB survived browser reload |
| DOB/appearance failure | Injected write failures produced visible errors; retry succeeded; saved values survived reload |
| Profile edit | Failed DOB write retained the draft; retry and reload showed the corrected DOB/age; keyboard focus visible |
| Navigation | All requested destinations visited; repeated switches kept one patient parent and Home plus the selected section; Menu/Profile Back and keyboard Arrow Right checked |
| Direct entry | Valid patient entry had a Home parent; missing active/completed state redirected to onboarding |
| Patient Home data | Empty state checked, then UI-created reminder and memory appeared; injected read failure showed retry and recovered |
| Reduced motion/voice | Pressed selection had no transform with reduced motion; voice off removed Read Aloud |
| Console/network | Final page had zero console errors and the existing web notifications warning; six bridge HTTP 500 responses corresponded to intentional failure injection, with no other failed requests in the retained network log |

The browser environment, helper processes, screenshots, and Playwright artifacts were removed after QA. No browser localStorage adapter was used. Production `src/db/client.web.ts` has no diff, and `secure-storage.service.ts` still uses expo-secure-store with only the legitimate appearance and patient-scoped DOB key additions.

## Validation

All requested checks passed:

- `node scripts/check-native-hardening.cjs`
- `node scripts/check-product-polish.cjs`
- `node scripts/check-ux-overhaul.cjs`
- `node scripts/check-cognitive-expansion.cjs`
- `node scripts/check-my-care.cjs`
- `node scripts/check-my-home.cjs`
- `node scripts/check-my-memories.cjs`
- `node scripts/check-my-day.cjs`
- `node scripts/check-elderly-ux.cjs`
- `npx tsc --noEmit`
- `npx expo lint` (no warnings)
- `npx expo-doctor` (18/18)
- `npx expo install --check` (up to date)
- `npx expo config --type public` (SDK 54 preserved)
- `npx expo export --platform all --max-workers 2` (Android/iOS Hermes bundles, web bundle, 28 static routes)

The export initially encountered a sandbox permission error launching the installed Hermes compiler. The approved retry passed. This was an asset export, not an APK build. Final package/package-lock and migration diffs are blank. `git diff --check` passed. The new UX check covers calendar boundaries, patient-scoped DOB persistence and failures, five-mode appearance persistence and failures, contrast, and primary-stack Back behavior using the installed navigation router.

## Remaining physical Android checks

- TalkBack reading/focus order, labels, selected tabs, and error announcements.
- Hardware Back through patient, caregiver, nested game, and direct-entry routes.
- Status/navigation bars, safe areas, small screens, rotation, OS font scaling, and the actual software keyboard with long forms.
- Real SecureStore DOB/appearance persistence after force-stop and restart; interrupted onboarding across the separate SQLite/SecureStore writes.
- Actual notification, photo-picker, and voice behavior, including permissions, unavailable voices, and airplane mode.

These physical checks were not performed or claimed as passed. No APK was built.
