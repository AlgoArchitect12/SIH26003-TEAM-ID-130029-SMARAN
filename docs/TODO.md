# SMARAN AI — Engineering Roadmap & Master TODO

> **Status**: Ready for Implementation (Awaiting Phase 0 Approval)  
> **Platform**: React Native (Expo SDK 54, React 19, New Architecture enabled)  
> **Core Architectural Paradigm**: Offline-First, Local SQLite Persistence, On-Device Adaptive AI, Zero-Harm Accessibility, Non-Diagnostic HealthTech  
> **Target Audience**: Elderly individuals experiencing cognitive decline (specifically localized for North-East India) and their family caregivers.

---

## Engineering Principles & Critical Rules

1. **Offline-First Patient Functionality**: The local patient application must be 100% operational without internet connectivity. SQLite is the primary database, not a cache.
2. **Local Before Cloud**: Complete the entire local patient experience (Phases 0–12) before introducing cloud dependencies (Phases 13–14).
3. **Elderly Accessibility is Mandatory**: Minimum 56px touch targets (72px+ for primary patient cards), high contrast, 18–34px typography, icon + clear text labels, no hidden gestures, reduced motion support.
4. **Strict Medical Safety**: Never diagnose dementia, stage cognitive impairment, prescribe medication, or make fake clinical claims. Language must remain encouraging, non-clinical, and observational.
5. **No Fake or Random AI**: Cognitive personalization must rely on genuine recorded session interaction metrics (accuracy, latency, error repetition, hint dependency) processed through an explainable on-device algorithm. No naive heuristics (`if (score > 80) level++`).
6. **Encouraging Feedback Only**: Incorrect responses must receive gentle, reassuring prompts ("Almost! Let's try once more"), never negative or punitive alerts ("WRONG", "FAILED").
7. **Culturally Distinct North-East Content**: North-East India consists of 8 distinct cultures and languages. Regional content packs must decouple cultural assets from game mechanics, starting with an Assam demo pack.
8. **TypeScript Strictness**: `strict: true` must be maintained without `any` escapes.
9. **Zero Placeholder Screens**: Every screen in the primary Smart India Hackathon (SIH) demo pathway must be fully implemented and functional.

---

## Master Dependency Graph & Phase Overview

```
PHASE 0: Repository Cleanup & Foundation
  └── PHASE 1: Design System & Accessible Tokens
        ├── PHASE 2: Splash & Onboarding (Role, Language, Region, A11y, Profile)
        │     └── PHASE 3: Patient Application Shell (Home, Navigation, Hubs)
        └── PHASE 4: Offline Data Architecture (SQLite, Repositories, Migrations)
              ├── PHASE 5: Memory Match (Playable Cognitive Engine & Telemetry)
              │     └── PHASE 6: Adaptive AI Engine (Feature Extraction, Online Model, Explainer)
              │           └── PHASE 7: Additional Cognitive Activities (Pattern, Routine)
              ├── PHASE 8: My Day (Reminders, Hydration, Notifications, Tracking)
              ├── PHASE 9: My Memories (Reminiscence Cards, Audio Notes, Recall)
              ├── PHASE 10: North-East Localization (Regional Content Packs)
              └── PHASE 11: Voice & Multilingual Experience (Expo Speech, Assamese/Hindi/English)
                    └── PHASE 12: Caregiver Application (Dashboard, Trends, Non-Diagnostic Attention)
                          └── PHASE 13: Offline Synchronization System (Sync Queue, Conflict Engine)
                                └── PHASE 14: Supabase Backend (PostgreSQL, RLS, Storage, Auth)
                                      └── PHASE 15: Security & Privacy Hardening
                                            └── PHASE 16: Accessibility Hardening (WCAG AAA)
                                                  └── PHASE 17: Comprehensive QA & Verification
                                                        └── PHASE 18: SIH Demo Golden Path Preparation
```

---

## PHASE 0 — Repository Cleanup & Engineering Foundation

### TASK-000-A: Project Manifest & Configuration Alignment
- **Objective**: Standardize `package.json` and `app.json` metadata, package naming, orientation constraints, and build scripts.
- **Dependencies**: None.
- **Files/Folders Affected**:
  - `package.json`
  - `app.json`
- **Implementation Requirements**:
  - Update `package.json` name from `"expo-temp"` to `"smaran-ai"`.
  - Remove deprecated `"reset-project"` script from `package.json`.
  - Ensure `app.json` contains proper bundle identifier (`com.smaran.ai`), scheme (`smaran-ai`), orientation locks (`portrait`), and splash screen configuration.
  - Verify that `newArchEnabled: true` is aligned with Expo SDK 54 requirements.
- **Acceptance Criteria**:
  - `package.json` reflects `"name": "smaran-ai"`.
  - `npm run reset-project` script is removed.
  - `app.json` configuration passes validation without warnings.
- **Validation Method**: Run `npx expo config --type public` to verify parsed app configuration.
- **Risks**: Modifying package name must not corrupt `node_modules` resolution.

---

### TASK-000-B: Starter Code Deprecation & Removal
- **Objective**: Remove boilerplate template files generated by `create-expo-app` to avoid dead code and conflicting routes.
- **Dependencies**: TASK-000-A.
- **Files/Folders Affected**:
  - `scripts/reset-project.js` [DELETE]
  - `components/hello-wave.tsx` [DELETE]
  - `components/parallax-scroll-view.tsx` [DELETE]
  - `components/external-link.tsx` [DELETE]
  - `components/ui/collapsible.tsx` [DELETE]
  - `assets/images/partial-react-logo.png` [DELETE]
  - `assets/images/react-logo.png` [DELETE]
  - `assets/images/react-logo@2x.png` [DELETE]
  - `assets/images/react-logo@3x.png` [DELETE]
  - `app/(tabs)/index.tsx` [DELETE]
  - `app/(tabs)/explore.tsx` [DELETE]
  - `app/(tabs)/_layout.tsx` [DELETE]
  - `app/modal.tsx` [DELETE]
- **Implementation Requirements**:
  - Safely remove unused starter components and template assets.
  - Establish a clean, minimal placeholder `app/_layout.tsx` and `app/index.tsx` so the app remains runnable without bundle errors.
- **Acceptance Criteria**:
  - Zero references to `HelloWave`, `ParallaxScrollView`, or React starter logos.
  - No broken imports or missing module errors.
- **Validation Method**: Run `npx expo start` and ensure bundler compiles with 0 missing module errors.
- **Risks**: Breaking the initial Expo Router entry point if `app/_layout.tsx` is cleared incorrectly.

---

### TASK-000-C: Production Dependencies Installation & Alignment
- **Objective**: Install and lock all required runtime dependencies for local persistence, audio, state management, and notifications using exact Expo SDK 54 compatible versions.
- **Dependencies**: TASK-000-B.
- **Files/Folders Affected**:
  - `package.json`
  - `package-lock.json`
- **Implementation Requirements**:
  - Install dependencies using `npx expo install`:
    - `expo-sqlite` (offline database)
    - `expo-secure-store` (secure credentials)
    - `expo-speech` (multilingual text-to-speech)
    - `expo-notifications` (local scheduled alarms/reminders)
    - `@react-native-community/netinfo` (network state detection)
    - `zustand` (lightweight in-memory state management)
    - `@supabase/supabase-js` (future cloud sync)
  - Verify version compatibility with Expo SDK 54 and React 19.
- **Acceptance Criteria**:
  - All packages present in `package.json` with compatible semver tags.
  - `package-lock.json` cleanly generated without dependency peer conflicts.
- **Validation Method**: Execute `npx expo-doctor` and verify 0 compatibility warnings.
- **Risks**: React 19 peer dependency conflicts with third-party native libraries.

---

### TASK-000-D: TypeScript Configuration & Path Aliasing
- **Objective**: Configure strict type checking, compiler rules, and modular path aliases.
- **Dependencies**: TASK-000-C.
- **Files/Folders Affected**:
  - `tsconfig.json`
- **Implementation Requirements**:
  - Ensure `compilerOptions.strict` is set to `true`.
  - Configure comprehensive path aliases:
    - `@/*` -> `./*`
    - `@components/*` -> `./components/*`
    - `@constants/*` -> `./constants/*`
    - `@db/*` -> `./src/db/*`
    - `@services/*` -> `./src/services/*`
    - `@ai/*` -> `./src/ai/*`
    - `@types/*` -> `./src/types/*`
    - `@i18n/*` -> `./src/i18n/*`
  - Ensure `.expo/types` and `expo-env.d.ts` are included.
- **Acceptance Criteria**:
  - `tsconfig.json` compiles cleanly with strict mode.
  - Path alias resolution works seamlessly across components and utilities.
- **Validation Method**: Run `npx tsc --noEmit` and check for clean exit code 0.
- **Risks**: Misconfigured path mappings causing bundler resolution failure.

---

### TASK-000-E: Global Error Boundary & Graceful Crash UI
- **Objective**: Prevent unhandled JavaScript exceptions from crashing the app, displaying an elderly-friendly, calming recovery screen instead.
- **Dependencies**: TASK-000-D.
- **Files/Folders Affected**:
  - `components/error-boundary.tsx` [NEW]
  - `app/_layout.tsx`
- **Implementation Requirements**:
  - Create a React ErrorBoundary wrapping the root stack.
  - Implement a reassuring fallback UI: "Everything is safe. Let's return to your home screen."
  - Provide a large 56px "Return Home" recovery button.
  - Log error details locally to SQLite debug log table without displaying technical stack traces to the patient.
- **Acceptance Criteria**:
  - Uncaught component errors trigger the calming fallback screen.
  - Pressing "Return Home" resets state and navigates back to `/`.
- **Validation Method**: Create a deliberate throw in a test screen and verify recovery.
- **Risks**: Error loop if the error boundary itself fails to render.

---

## PHASE 1 — Design System & Accessible Foundation

### TASK-001-A: Color Palette & Semantic Design Tokens
- **Objective**: Implement the calming, high-contrast HealthTech color palette specified in `/docs/DESIGN.md`.
- **Dependencies**: PHASE 0.
- **Files/Folders Affected**:
  - `constants/theme.ts`
  - `constants/colors.ts` [NEW]
- **Implementation Requirements**:
  - Define color tokens:
    - Primary: Deep calming teal (`#0B4F56`, dark: `#148A96`)
    - Secondary: Warm sage (`#5B8266`, dark: `#7DA88A`)
    - Accent: Soft amber (`#D9822B`, dark: `#E5A054`)
    - Background: Warm off-white (`#F9F8F5`, dark: `#121616`)
    - Surface: White (`#FFFFFF`, dark: `#1C2222`)
    - Success: Gentle green (`#2E7D32`)
    - Warning: Warm amber (`#ED6C02`)
    - Error: Muted terracotta red (`#C62828`)
    - Text: Dark charcoal (`#1C2526`, dark: `#F0F4F4`)
    - Border / Outline: Soft stone (`#D8DCD6`, dark: `#2C3636`)
  - Avoid pure black (`#000000`) for text; ensure minimum 7:1 contrast ratio against background for patient readability (WCAG AAA).
- **Acceptance Criteria**:
  - All tokens exported with full TypeScript typings.
  - Light and dark themes defined with WCAG AAA compliant contrast pairings.
- **Validation Method**: Automated contrast ratio calculation script on defined pairs.
- **Risks**: Insufficient contrast if accent colors are used behind white text.

---

### TASK-001-B: Accessible Typography System
- **Objective**: Establish the elderly-friendly typography scale with dynamic scaling support.
- **Dependencies**: TASK-001-A.
- **Files/Folders Affected**:
  - `constants/typography.ts` [NEW]
  - `components/themed-text.tsx`
- **Implementation Requirements**:
  - Define patient scale:
    - Heading 1 (Screen title): 32–34px, Bold, Line Height 42px
    - Heading 2 (Card title): 24–28px, SemiBold, Line Height 34px
    - Primary Action / Button: 20–24px, SemiBold, Line Height 28px
    - Body Text: 18–20px, Regular, Line Height 26px
    - Caption / Secondary: 16–18px, Medium, Line Height 22px
  - Support user text scaling overrides (Normal, Large, Extra Large) from accessibility preferences.
- **Acceptance Criteria**:
  - Minimum body font size is 18px for all patient-facing views.
  - Text scales gracefully without clipping, truncation, or layout overflow.
- **Validation Method**: Verify visual rendering on simulated device with system font scaling enabled.
- **Risks**: Large text causing layout breaks on smaller screens.

---

### TASK-001-C: Spacing, Touch Target & Elevation Utilities
- **Objective**: Provide geometric constants enforcing elderly touch targets and calming soft shadows.
- **Dependencies**: TASK-001-B.
- **Files/Folders Affected**:
  - `constants/layout.ts` [NEW]
- **Implementation Requirements**:
  - Minimum touch target: 56px x 56px.
  - Primary patient card target: 72px–96px height.
  - Minimum spacing between interactive targets: 16px to prevent accidental taps.
  - Soft elevations: low-blur, low-opacity shadows avoiding harsh visual edges.
  - Border radius: 16px–24px for cards, 28px for pills/buttons (soft, approachable corners).
- **Acceptance Criteria**:
  - Layout tokens include `minTouchTarget: 56`, `cardMinHeight: 72`, `buttonHeight: 60`.
  - Spacing scales exported: `xs: 4`, `sm: 8`, `md: 16`, `lg: 24`, `xl: 32`, `xxl: 48`.
- **Validation Method**: Static lint/check verifying minimum dimensions.
- **Risks**: Excessive padding overflowing small phone viewports.

---

### TASK-001-D: SmaranButton Component
- **Objective**: Build the standard accessible button component with high contrast, tactile feedback, and accessible roles.
- **Dependencies**: TASK-001-C.
- **Files/Folders Affected**:
  - `components/ui/smaran-button.tsx` [NEW]
- **Implementation Requirements**:
  - Variants: `primary` (deep teal), `secondary` (warm sage), `accent` (soft amber), `outline`.
  - Sizes: `normal` (56px height) and `large` (68px height).
  - Explicit pressed state using subtle scaling (`0.98`) and gentle opacity shift.
  - Haptic feedback trigger on tap (`expo-haptics`).
  - Required `accessibilityLabel` and `accessibilityRole="button"`.
  - Strictly prohibit icon-only primary actions: button must always pair icon with clear, descriptive text.
- **Acceptance Criteria**:
  - Button height is >= 56px under all conditions.
  - Haptic feedback occurs on tap.
  - Label text is >= 20px.
- **Validation Method**: Jest unit tests checking component props, accessibility traits, and height constraints.
- **Risks**: Haptic engine delay on older devices.

---

### TASK-001-E: SmaranCard & ScreenWrapper Components
- **Objective**: Build the foundational layout wrappers providing safe areas, reassuring background tones, and consistent navigation anchors.
- **Dependencies**: TASK-001-D.
- **Files/Folders Affected**:
  - `components/ui/smaran-card.tsx` [NEW]
  - `components/layout/screen-wrapper.tsx` [NEW]
- **Implementation Requirements**:
  - `SmaranCard`: 16px–24px padding, rounded corners (16px), subtle border, accessible touch target if clickable, tactile feedback.
  - `ScreenWrapper`: SafeAreaView wrapper with warm off-white background, optional scrollview with keyboard dismissal, built-in top header containing persistent "Back" and "Home" actions, and optional Voice Assist icon.
- **Acceptance Criteria**:
  - Screen content is padded from device notches and home indicator.
  - Header actions are always >= 56px in size.
- **Validation Method**: Component test and visual inspection across Android and iOS viewports.
- **Risks**: Double padding when nested inside native tab bars.

---

### TASK-001-F: EncouragementBanner & Non-Punitive Feedback Utilities
- **Objective**: Create visual and verbal feedback components adhering to the design principle of non-punitive, warm encouragement.
- **Dependencies**: TASK-001-E.
- **Files/Folders Affected**:
  - `components/feedback/encouragement-banner.tsx` [NEW]
  - `constants/encouragement-messages.ts` [NEW]
- **Implementation Requirements**:
  - Success cues: "Wonderful! ❤️", "Well done!", "You remembered it!", "Splendid work!"
  - Correction/Retry cues: "Almost! Let's try once more.", "That's okay. Here's a little help.", "Take your time, you're doing great."
  - Blacklisted terms: "FAILED", "WRONG", "ERROR", "GAME OVER", "BAD SCORE", "INCORRECT".
  - Gentle animated entrance (fade and slide-up) with reduced-motion bypass.
- **Acceptance Criteria**:
  - No punitive vocabulary in any string table or banner.
  - Banner supports voice readout via Expo Speech trigger.
- **Validation Method**: Automated unit tests checking string dictionary against blacklisted words.
- **Risks**: Text length causing multi-line banner reflow.

---

### TASK-001-G: Reduced Motion & Sensory Accommodation Utilities
- **Objective**: Implement centralized hooks to respect device accessibility settings and user preferences for animations.
- **Dependencies**: TASK-001-F.
- **Files/Folders Affected**:
  - `hooks/use-reduced-motion.ts` [NEW]
  - `hooks/use-haptics.ts` [NEW]
- **Implementation Requirements**:
  - Detect OS `isReduceMotionEnabled` state and allow user override in Smaran settings.
  - When reduced motion is active, disable spring/timing animations or replace with instant state swaps.
  - Provide configurable haptic intensity (Off, Gentle, Standard).
- **Acceptance Criteria**:
  - All custom animations respect `useReducedMotion()`.
  - Haptic utility gracefully no-ops when disabled or on unsupported hardware.
- **Validation Method**: Toggle reduced motion in simulator and verify animated components render statically.
- **Risks**: Reanimated worklet crashes if animation configuration evaluates to invalid durations.

---

## PHASE 2 — Splash & Onboarding Flow

### TASK-002-A: Onboarding State Store & Persistent Flags
- **Objective**: Manage onboarding step progression, user preferences, and completion flags in local storage.
- **Dependencies**: PHASE 1, TASK-000-C.
- **Files/Folders Affected**:
  - `src/stores/onboarding.store.ts` [NEW]
  - `src/types/onboarding.types.ts` [NEW]
- **Implementation Requirements**:
  - Track: `role` (patient | caregiver), `language` ('en' | 'hi' | 'as'), `region` (8 NER states), `accessibility` (textSize, highContrast, speechAssistance, reducedMotion), `profile` (name, ageBracket, emergencyContact).
  - Persist progress in `expo-secure-store` / SQLite so incomplete onboarding can resume seamlessly.
- **Acceptance Criteria**:
  - Store holds complete onboarding model with full type safety.
  - Flags survive app restarts.
- **Validation Method**: Unit tests for store mutations and storage hydration.
- **Risks**: Incomplete hydration causing flash of initial onboarding screen.

---

### TASK-002-B: Calming Splash Screen
- **Objective**: Deliver a dignified, warm splash screen with the Smaran AI identity.
- **Dependencies**: TASK-002-A.
- **Files/Folders Affected**:
  - `app/index.tsx` [MODIFY]
  - `assets/images/smaran-logo.png` [NEW]
- **Implementation Requirements**:
  - Display calming teal logo with the tagline: "Smaran AI — Mindful Memory & Daily Care".
  - Subtitle: "Thoughtfully crafted for you and your family".
  - Automatic check of onboarding status: if completed, route to `/patient/home` or `/caregiver/dashboard`; if new, route to `/onboarding/role`.
  - Smooth 600ms fade transition; zero flashing or jarring splash dismissals.
- **Acceptance Criteria**:
  - Splash displays cleanly for minimum 1.2 seconds while local DB initializes.
  - Routes correctly based on persisted onboarding completion flag.
- **Validation Method**: Test both first-launch and return-launch route redirection.
- **Risks**: Blank screen if database initialization hangs.

---

### TASK-002-C: Role Selection Screen
- **Objective**: Allow users or family members to select between Patient and Caregiver modes with large, clear, distinguishable cards.
- **Dependencies**: TASK-002-B.
- **Files/Folders Affected**:
  - `app/onboarding/role.tsx` [NEW]
- **Implementation Requirements**:
  - Two prominent cards (height >= 120px each):
    1. "I am using this for myself" (Patient mode — gentle, large text, calming teal icon).
    2. "I am caring for someone" (Caregiver mode — dashboard access, warm sage icon).
  - Clear explanations beneath each choice.
  - Large "Continue" button enabled once a card is selected.
- **Acceptance Criteria**:
  - Screen has only 2 primary selection options (complying with patient UI simplicity principles).
  - Selection saves role into `onboarding.store`.
- **Validation Method**: Component test checking role assignment and routing to `/onboarding/language`.
- **Risks**: User accidentally selecting the wrong role; must provide easy back navigation.

---

### TASK-002-D: Multilingual Selection Screen
- **Objective**: Present language choices with native script typography and voice playback preview.
- **Dependencies**: TASK-002-C.
- **Files/Folders Affected**:
  - `app/onboarding/language.tsx` [NEW]
  - `src/constants/languages.ts` [NEW]
- **Implementation Requirements**:
  - Initial supported languages:
    - English ("English")
    - Hindi ("हिन्दी")
    - Assamese ("অসমীয়া")
  - Each language option has a prominent card with a speaker icon that speaks: "Namaste / Welcome / নমস্কাৰ" using Expo Speech.
  - Card touch target >= 72px height.
- **Acceptance Criteria**:
  - Tapping a language highlights it and plays audio greeting.
  - Selected language instantly updates app locale context.
- **Validation Method**: Verify audio triggers on selection and string catalog updates.
- **Risks**: Missing TTS voices on certain Android devices; must handle speech error gracefully.

---

### TASK-002-E: North-Eastern Region (NER) Selection Screen
- **Objective**: Enable selection of the user's home state across the North-East to localize cultural imagery, motifs, and activities.
- **Dependencies**: TASK-002-D.
- **Files/Folders Affected**:
  - `app/onboarding/region.tsx` [NEW]
  - `src/constants/regions.ts` [NEW]
- **Implementation Requirements**:
  - Support all 8 NER states:
    1. Assam (অসম) — Featured with cultural icon (Gamusa / Rhinoceros / Tea Leaf)
    2. Arunachal Pradesh
    3. Manipur
    4. Meghalaya
    5. Mizoram
    6. Nagaland
    7. Sikkim
    8. Tripura
  - Explicit UI note: "We celebrate the unique heritage of each state in the North-East."
  - Never group NER into a single homogeneous bucket.
- **Acceptance Criteria**:
  - All 8 states clearly selectable.
  - Assam selected by default for SIH demo flow.
  - State preference saved to SQLite and onboarding store.
- **Validation Method**: Verify selected region propagates to regional content pack provider.
- **Risks**: Grid clutter on small screens; use an accessible vertical list with large cards.

---

### TASK-002-F: Accessibility Preferences Setup Screen
- **Objective**: Empower elderly users or caregivers to calibrate visual and auditory assistance before reaching the main app.
- **Dependencies**: TASK-002-E.
- **Files/Folders Affected**:
  - `app/onboarding/accessibility.tsx` [NEW]
- **Implementation Requirements**:
  - Calibration controls:
    - Text Size: Standard | Large | Extra Large (with live preview text)
    - High Contrast: On | Off
    - Voice Guidance: Read instructions automatically (On | Off)
    - Reduced Motion: Calm transitions only (On | Off)
  - Pre-configure defaults to elderly-friendly settings (Large text, Voice Guidance On).
- **Acceptance Criteria**:
  - Changing text size immediately re-renders the live preview box.
  - Settings persisted to `patient_settings` in SQLite.
- **Validation Method**: Manual UI test verifying real-time scaling and toggle responses.
- **Risks**: Complex UI; keep controls to 4 simple, spaced toggle rows.

---

### TASK-002-G: Patient Profile Setup Screen
- **Objective**: Collect essential, non-clinical personal details (preferred name, emergency contact) with least-data principles.
- **Dependencies**: TASK-002-F.
- **Files/Folders Affected**:
  - `app/onboarding/profile.tsx` [NEW]
- **Implementation Requirements**:
  - Fields:
    - "What should we call you?" (Preferred name / Nickname, e.g., "Dharmin" or "Dada / Aita")
    - Age bracket (60-70, 70-80, 80+) — optional, non-clinical
    - Emergency contact name & phone number
  - Large keyboard-friendly text inputs (height >= 60px, font >= 20px).
  - "Finish Setup" button routes patient to `/patient/home`.
- **Acceptance Criteria**:
  - Profile saved into SQLite `patient_profile` table.
  - Onboarding marked complete.
- **Validation Method**: Check SQLite record creation and successful routing to `/patient/home`.
- **Risks**: Keyboard obscuring inputs; wrap in `KeyboardAvoidingView`.

---

## PHASE 3 — Patient Application Shell

### TASK-003-A: Patient Navigation Shell & Master Layout
- **Objective**: Implement the persistent patient top/bottom layout with simple, unambiguous navigation anchors.
- **Dependencies**: PHASE 2.
- **Files/Folders Affected**:
  - `app/patient/_layout.tsx` [NEW]
  - `components/navigation/patient-header.tsx` [NEW]
  - `components/navigation/patient-bottom-bar.tsx` [NEW]
- **Implementation Requirements**:
  - Header: Always displays "Home", emergency contact speed-dial icon, and "Read Screen" voice assist button.
  - Navigation: Fixed, high-contrast bottom bar with 4 core icons + large text:
    1. Home (`/patient/home`)
    2. My Day (`/patient/day`)
    3. My Memories (`/patient/memories`)
    4. Train Mind (`/patient/games`)
  - Touch target >= 64px for bottom bar items.
  - Avoid hidden gestures, swipe-to-dismiss, or hamburger menus.
- **Acceptance Criteria**:
  - Navigation bar stays fixed at the bottom with clear active indicators.
  - "Home" button is accessible from every nested screen.
- **Validation Method**: Tab switching tests with TalkBack/VoiceOver enabled.
- **Risks**: Android system navigation bar overlapping bottom tab items.

---

### TASK-003-B: Patient Home Screen
- **Objective**: Create a tranquil, uncluttered home dashboard focused on the patient's daily rhythm.
- **Dependencies**: TASK-003-A.
- **Files/Folders Affected**:
  - `app/patient/home.tsx` [NEW]
  - `components/home/greeting-header.tsx` [NEW]
  - `components/home/primary-action-card.tsx` [NEW]
- **Implementation Requirements**:
  - Warm personalized greeting: "Good Morning, [Name] 🌸" (time-of-day aware in chosen language).
  - Max 4 primary action cards on screen:
    1. **Train My Mind**: "Play today's memory activity" (Badged with AI recommended level)
    2. **My Day**: "Next: Morning Medicine at 9:00 AM" (Live countdown/reminder card)
    3. **My Memories**: "Visit family moments & photos"
    4. **My Home**: "Explore stories & songs from Assam"
  - Generous vertical card layout (height >= 84px per card).
- **Acceptance Criteria**:
  - Greeting dynamically reflects morning/afternoon/evening.
  - Cards navigate to respective feature hubs.
  - Strict compliance with max 3–5 simultaneous choices rule.
- **Validation Method**: Visual verification and usability walkthrough.
- **Risks**: Information overload if reminder details are too dense.

---

### TASK-003-C: "Train My Mind" Cognitive Hub Screen
- **Objective**: Provide a welcoming entryway for cognitive activities, displaying the patient's personalized recommendation.
- **Dependencies**: TASK-003-B.
- **Files/Folders Affected**:
  - `app/patient/games/index.tsx` [NEW]
- **Implementation Requirements**:
  - Top featured card: "Today's Recommended Activity" (Memory Match, with difficulty recommended by Adaptive AI).
  - "Why this activity?" explanation chip triggering the explainable AI modal.
  - Secondary activities list: Pattern Recognition, Routine Recall (marked with friendly status tags).
  - Encouraging, pressure-free copy: "Take your time. There are no timers or scores to worry about."
- **Acceptance Criteria**:
  - Featured game card routes directly to `/patient/games/memory-match`.
  - Explainer chip opens `/patient/games/why-level` modal.
- **Validation Method**: Route transition and screen reader label verification.
- **Risks**: Presenting too many game options at once.

---

### TASK-003-D: "My Day" Routine Hub Screen
- **Objective**: Present today's medicines, meals, hydration, and appointments in chronological order.
- **Dependencies**: TASK-003-B.
- **Files/Folders Affected**:
  - `app/patient/day/index.tsx` [NEW]
  - `components/day/routine-timeline-item.tsx` [NEW]
- **Implementation Requirements**:
  - Chronological sections: Morning, Afternoon, Evening, Night.
  - Large interactive check-off cards for medicines and hydration.
  - Audio button on each reminder: reads out "Time for your blood pressure tablet with water."
- **Acceptance Criteria**:
  - Completed items display gentle green checkmark with "Done! ❤️".
  - One-tap toggle to mark complete or undo.
- **Validation Method**: Checklist interaction tests with local persistence.
- **Risks**: Accidental double-taps marking reminders done prematurely.

---

### TASK-003-E: "My Memories" Reminiscence Hub Screen
- **Objective**: Display family photos, loved ones, and personal memory cards in a gentle, comforting gallery.
- **Dependencies**: TASK-003-B.
- **Files/Folders Affected**:
  - `app/patient/memories/index.tsx` [NEW]
  - `components/memories/memory-card.tsx` [NEW]
- **Implementation Requirements**:
  - Grid of large, rounded memory cards with photos of family members, ancestral home, celebrations.
  - Card displays photo, name, and relationship tag ("Rahul — Your Son").
  - Tapping a card opens the detailed reminiscence view with voice message playback.
- **Acceptance Criteria**:
  - Photos render with high quality and cached local storage.
  - Accessible name and relationship announced by screen reader.
- **Validation Method**: Render gallery with sample memories and verify responsiveness.
- **Risks**: Memory leak when rendering multiple high-resolution photos.

---

### TASK-003-F: "My Home" Cultural Connection Hub Screen
- **Objective**: Celebrate North-Eastern heritage with state-specific cultural content (Assam demo).
- **Dependencies**: TASK-003-B.
- **Files/Folders Affected**:
  - `app/patient/regional/index.tsx` [NEW]
  - `components/regional/cultural-tile.tsx` [NEW]
- **Implementation Requirements**:
  - Content sections for Assam:
    - Folk Tales & Proverbs (e.g., Burhi Aair Xadhu snippets)
    - Cultural Symbols (Gamusa, Xorai, Bihu dhol)
    - Flora & Fauna (One-horned Rhinoceros, Muga silk)
    - Gentle regional music / soothing ambient sounds
  - Voice narration available for every cultural snippet.
- **Acceptance Criteria**:
  - Content authentically reflects selected region (Assam).
  - Cultural assets load completely offline from local bundle.
- **Validation Method**: Offline mode verification with audio playback.
- **Risks**: Large audio files ballooning APK size; use compressed AAC formats.

---

### TASK-003-G: "My Care" Wellbeing & Support Hub Screen
- **Objective**: Give the patient immediate, comforting access to caregiver contact info and simple check-ins.
- **Dependencies**: TASK-003-B.
- **Files/Folders Affected**:
  - `app/patient/care/index.tsx` [NEW]
- **Implementation Requirements**:
  - Prominent caregiver card: Photo, Name, "Your Primary Caregiver".
  - Large 68px "Call [Caregiver Name]" button (initiates native phone call via `expo-linking`).
  - Emergency SOS speed-dial button.
  - "How are you feeling today?" simple 3-mood check-in (Peaceful, Okay, Tired) storing non-diagnostic comfort logs.
- **Acceptance Criteria**:
  - Phone call triggers correctly with confirmation dialog.
  - Mood check-in provides immediate warm reassuring quote.
- **Validation Method**: Test `Linking.openURL('tel:...')` handler.
- **Risks**: Accidental emergency dialing; require 2-second hold or confirmation step.

---

## PHASE 4 — Offline Data Architecture

### TASK-004-A: SQLite Client & Migration Engine
- **Objective**: Initialize `expo-sqlite` with a robust, forward-compatible versioned migration runner.
- **Dependencies**: PHASE 0.
- **Files/Folders Affected**:
  - `src/db/client.ts` [NEW]
  - `src/db/migrations/index.ts` [NEW]
  - `src/db/migrations/001_initial_schema.ts` [NEW]
- **Implementation Requirements**:
  - Database file: `smaran_offline.db`.
  - Migration tracker table `schema_migrations` tracking `version`, `name`, `applied_at`.
  - Transactional execution: each migration runs inside a SQLite transaction.
  - Foreign keys enabled (`PRAGMA foreign_keys = ON;`).
  - WAL mode enabled (`PRAGMA journal_mode = WAL;`) for high-performance concurrent reads.
- **Acceptance Criteria**:
  - Migrations apply sequentially and idempotently on database startup.
  - Database opens in under 150ms on cold start.
- **Validation Method**: Run migration runner against empty database and inspect `sqlite_master`.
- **Risks**: Migration failures bricking existing local data; must wrap each migration in rollback transaction.

---

### TASK-004-B: Core Relational Schema Definition
- **Objective**: Create the core relational tables for profiles, reminders, sessions, memories, and sync events.
- **Dependencies**: TASK-004-A.
- **Files/Folders Affected**:
  - `src/db/migrations/001_initial_schema.ts`
  - `src/db/schema.types.ts` [NEW]
- **Implementation Requirements**:
  - Tables:
    - `patient_profiles` (id, preferred_name, age_bracket, emergency_name, emergency_phone, created_at, updated_at)
    - `patient_settings` (id, patient_id, language, region, text_size, high_contrast, voice_guidance, reduced_motion)
    - `cognitive_sessions` (id, patient_id, game_type, difficulty_level, accuracy, total_time_ms, mistake_count, hint_count, raw_events_json, created_at, synced)
    - `reminders` (id, patient_id, title, category, scheduled_time, recurrence, is_completed, last_completed_at, synced)
    - `personal_memories` (id, patient_id, person_name, relationship, description, photo_uri, audio_uri, memory_date, synced)
    - `adaptive_model_state` (id, patient_id, game_type, weights_json, bias, session_count, updated_at)
    - `sync_queue` (id, table_name, record_id, action, payload_json, status, retry_count, created_at)
- **Acceptance Criteria**:
  - All 7 tables created with proper indexes on `patient_id`, `created_at`, `synced`, `status`.
  - Complete TypeScript types matching SQLite columns.
- **Validation Method**: Unit tests running schema verification queries.
- **Risks**: Type mismatches between SQLite string/integer types and TypeScript models.

---

### TASK-004-C: Patient & Settings Repository
- **Objective**: Provide strongly-typed data access methods for patient profile and preferences.
- **Dependencies**: TASK-004-B.
- **Files/Folders Affected**:
  - `src/db/repositories/patient.repository.ts` [NEW]
- **Implementation Requirements**:
  - Methods: `getProfile()`, `upsertProfile()`, `getSettings()`, `updateSettings()`.
  - In-memory caching layer to avoid redundant disk reads for active settings.
  - Sanitization of text fields before persistence.
- **Acceptance Criteria**:
  - Full CRUD operations tested with SQLite mock or live in-memory DB.
  - Zero SQL injection vulnerability (enforce parameterized queries).
- **Validation Method**: Automated repository unit tests.
- **Risks**: Stale cached settings if updated from another component.

---

### TASK-004-D: Cognitive Sessions Repository
- **Objective**: Persist and query granular cognitive activity sessions and performance metrics.
- **Dependencies**: TASK-004-B.
- **Files/Folders Affected**:
  - `src/db/repositories/cognitive.repository.ts` [NEW]
- **Implementation Requirements**:
  - Methods: `saveSession(sessionData)`, `getRecentSessions(gameType, limit)`, `getAllSessionStats()`, `getUnsyncedSessions()`.
  - Store both aggregate metrics (accuracy, latency) and granular event stream in `raw_events_json`.
  - Transactional insert into both `cognitive_sessions` and `sync_queue`.
- **Acceptance Criteria**:
  - Session records written safely within 50ms of activity completion.
  - Unsynced query returns only records where `synced = 0`.
- **Validation Method**: Automated tests inserting 50 sessions and querying recent trends.
- **Risks**: JSON payload serialization overhead if event arrays are excessively large.

---

### TASK-004-E: Reminders & Routine Repository
- **Objective**: Manage daily routine schedules, completion states, and adherence tracking.
- **Dependencies**: TASK-004-B.
- **Files/Folders Affected**:
  - `src/db/repositories/reminders.repository.ts` [NEW]
- **Implementation Requirements**:
  - Methods: `getTodayReminders()`, `addReminder()`, `markCompleted(id)`, `undoCompleted(id)`, `deleteReminder(id)`.
  - Automatic daily reset logic: recurring reminders reset completion status at midnight.
  - Enqueue change into `sync_queue` whenever a reminder status updates.
- **Acceptance Criteria**:
  - Correctly categorizes reminders into Morning / Afternoon / Evening / Night.
  - Adherence calculation returns accurate percentage for caregiver insights.
- **Validation Method**: Unit tests simulating day boundaries and completion toggles.
- **Risks**: Timezone discrepancies causing midnight reset failures.

---

### TASK-004-F: Personal Memories Repository
- **Objective**: Persist family reminiscence cards, photo file paths, and voice note references.
- **Dependencies**: TASK-004-B.
- **Files/Folders Affected**:
  - `src/db/repositories/memories.repository.ts` [NEW]
- **Implementation Requirements**:
  - Methods: `getAllMemories()`, `getMemoryById(id)`, `addMemory()`, `updateMemory()`, `deleteMemory()`.
  - Manage local file storage: copy uploaded images to `FileSystem.documentDirectory/memories/` and persist relative URI.
- **Acceptance Criteria**:
  - Memories load reliably even if original gallery photo was deleted from device.
- **Validation Method**: Test file copy and URI persistence in sandbox.
- **Risks**: Broken image paths if absolute filesystem paths change on app updates.

---

### TASK-004-G: Adaptive AI Model State Repository
- **Objective**: Persist and restore per-patient mathematical weights, biases, and historical hyperparameters for on-device learning.
- **Dependencies**: TASK-004-B.
- **Files/Folders Affected**:
  - `src/db/repositories/adaptive-ai.repository.ts` [NEW]
- **Implementation Requirements**:
  - Methods: `getModelState(gameType)`, `saveModelState(gameType, weights, bias, sessionCount)`.
  - Initialize default weights on first run if no state exists.
  - Guarantee atomic updates so model state is never corrupted mid-write.
- **Acceptance Criteria**:
  - Model weights persist across app restarts without precision loss.
- **Validation Method**: Save floating-point weight vector, reload, and assert exact equality (`toBeCloseTo`).
- **Risks**: Floating point serialization rounding issues.

---

## PHASE 5 — Memory Match (Playable Cognitive Activity)

### TASK-005-A: Memory Match Pure Game Engine
- **Objective**: Implement clean, deterministic card matching game mechanics separated from UI rendering.
- **Dependencies**: PHASE 1, PHASE 4.
- **Files/Folders Affected**:
  - `src/games/memory-match/engine.ts` [NEW]
  - `src/games/memory-match/types.ts` [NEW]
- **Implementation Requirements**:
  - State machine: `IDLE` -> `PREVIEW` -> `PLAYING` -> `MATCH_CELEBRATION` -> `SESSION_COMPLETE`.
  - Actions: `flipCard(index)`, `requestHint()`, `restart()`.
  - Match detection: if two flipped cards match, lock them as matched; if not, reveal briefly then flip back.
  - Zero timer pressure: game does not count down or time out.
- **Acceptance Criteria**:
  - Engine accurately evaluates matches, mismatches, and game victory.
  - 100% test coverage on game logic transitions.
- **Validation Method**: Headless unit tests simulating complete game runs.
- **Risks**: Rapid consecutive taps causing race conditions in flip evaluations.

---

### TASK-005-B: Difficulty Matrix & Asset Configuration
- **Objective**: Parameterize 5 gentle difficulty tiers tailored for elderly accessibility.
- **Dependencies**: TASK-005-A.
- **Files/Folders Affected**:
  - `src/games/memory-match/difficulty.ts` [NEW]
  - `src/games/memory-match/assets.ts` [NEW]
- **Implementation Requirements**:
  - Tier 1: 2x2 grid (2 pairs, 4 cards) — ultra-simple introductory
  - Tier 2: 2x3 grid (3 pairs, 6 cards) — gentle
  - Tier 3: 2x4 grid (4 pairs, 8 cards) — moderate
  - Tier 4: 3x4 grid (6 pairs, 12 cards) — engaging
  - Tier 5: 4x4 grid (8 pairs, 16 cards) — advanced
  - Assets: High-contrast cultural motifs (Assamese Rhino, Gamusa, Tea Cup, Lotus, Xorai).
- **Acceptance Criteria**:
  - Grid dimensions and card counts scale correctly per tier.
  - Cards use large, easily distinguishable iconography with distinct color accents.
- **Validation Method**: Layout verification for all 5 tiers on various screen widths.
- **Risks**: 4x4 grid cards being too small on compact phone screens; enforce minimum 56px card size.

---

### TASK-005-C: Real-Time Telemetry & Event Collection
- **Objective**: Accurately capture granular behavioral interaction metrics required by the adaptive AI engine.
- **Dependencies**: TASK-005-B.
- **Files/Folders Affected**:
  - `src/games/memory-match/telemetry.ts` [NEW]
- **Implementation Requirements**:
  - Metrics collected:
    - `responseTimePerTurn`: Array of millisecond timestamps between flips
    - `totalMistakes`: Total unmatched pair attempts
    - `repeatedMistakes`: Attempts on the exact same unmatched pair (indicators of working memory fatigue)
    - `hintsUsed`: Number of times the patient tapped "Give me a hint"
    - `idleTimeBeforeFirstFlip`: Latency before initiating interaction
    - `accuracy`: `(matchedPairs / totalAttempts) * 100`
- **Acceptance Criteria**:
  - Telemetry object correctly populated at the conclusion of every session.
  - No synthetic or fabricated metrics: values must be derived strictly from real user touches.
- **Validation Method**: Unit tests asserting telemetry accuracy against simulated user touch events.
- **Risks**: Millisecond clock drift if app is backgrounded mid-game; pause timer on backgrounding.

---

### TASK-005-D: Memory Match UI & Accessible Card Component
- **Objective**: Build the visual, tactile game board with large cards and calm animations.
- **Dependencies**: TASK-005-C.
- **Files/Folders Affected**:
  - `app/patient/games/memory-match.tsx` [NEW]
  - `components/games/memory-card.tsx` [NEW]
- **Implementation Requirements**:
  - Card touch target >= 72px x 72px on Tiers 1–3, >= 56px on Tiers 4–5.
  - Smooth card flip animation using React Native Reanimated (with instant flip fallback if Reduced Motion is enabled).
  - Tactile haptic buzz on card flip.
  - Prominent "Hint" button with lightbulb icon: reveals one matching pair with a soft glowing border.
  - Always-present "Leave Game" button returning safely to home with no penalty.
- **Acceptance Criteria**:
  - Cards flip smoothly without frame drops.
  - Accessible labels state "Card [row] [col], face down" or "Card [motif name], matched".
- **Validation Method**: Manual play testing across device sizes and screen reader inspection.
- **Risks**: Reanimated flip glitches on Android if layout recalculates mid-flip.

---

### TASK-005-E: Non-Punitive Feedback & Completion Celebration
- **Objective**: Provide soothing, encouraging visual and auditory feedback on matches, retries, and game completion.
- **Dependencies**: TASK-005-D.
- **Files/Folders Affected**:
  - `components/games/game-celebration-modal.tsx` [NEW]
- **Implementation Requirements**:
  - Match event: Gentle green pulse, soft chime sound, warm text: "You found a match! 🌸"
  - Mismatch event: Gentle wobble, zero harsh red flashes, warm text: "Almost! Let's try once more."
  - Completion modal:
    - Celebration banner: "Wonderful memory work! ❤️"
    - Clear summary: "You completed this in [X] gentle steps."
    - "Continue" button leading to the Adaptive AI explanation screen.
- **Acceptance Criteria**:
  - Zero negative sounds or failure banners.
  - Modal automatically initiates telemetry handoff to the Adaptive AI engine.
- **Validation Method**: Visual and audio verification of match/mismatch flows.
- **Risks**: Congratulatory modal appearing too quickly before the last card finishes flipping.

---

### TASK-005-F: Session Persistence & SQLite Storage
- **Objective**: Write completed game session telemetry to SQLite and update patient records.
- **Dependencies**: TASK-005-E, TASK-004-D.
- **Files/Folders Affected**:
  - `src/games/memory-match/session-service.ts` [NEW]
- **Implementation Requirements**:
  - Save full session record: `game_type: 'memory-match'`, `difficulty_level`, `accuracy`, `total_time_ms`, `mistake_count`, `hint_count`, `raw_events_json`.
  - Return saved session ID for subsequent Adaptive AI evaluation.
- **Acceptance Criteria**:
  - Session verified in SQLite within 100ms of game completion.
  - Unsynced sync queue entry generated automatically.
- **Validation Method**: Query SQLite table directly post-game to confirm record insertion.
- **Risks**: App termination before save completes; save synchronously in game completion handler.

---

## PHASE 6 — Adaptive AI Engine (Explainable On-Device Personalization)

### TASK-006-A: Feature Extraction Pipeline
- **Objective**: Convert raw game telemetry into normalized mathematical feature vectors for on-device learning.
- **Dependencies**: PHASE 5.
- **Files/Folders Affected**:
  - `src/ai/feature-extractor.ts` [NEW]
  - `src/ai/types.ts` [NEW]
- **Implementation Requirements**:
  - Input: Current session telemetry + historical moving averages of last 5 sessions.
  - Normalized features (range `[0.0, 1.0]`):
    1. $x_1$ (`accuracy`): Normalized accuracy score.
    2. $x_2$ (`speed_score`): Speed factor based on age-appropriate response latency baseline.
    3. $x_3$ (`working_memory_score`): $1.0 - (\text{repeated\_mistakes} / \text{total\_turns})$.
    4. $x_4$ (`independence_score`): $1.0 - (\text{hints\_used} / \text{total\_pairs})$.
    5. $x_5$ (`stability_trend`): Performance change relative to patient's 5-session moving average.
- **Acceptance Criteria**:
  - Pure mathematical function returning clean 5-dimensional feature vector.
  - Guarded against division by zero and NaN values.
- **Validation Method**: Unit tests running edge-case inputs (0 turns, 100% mistakes, 0 hints).
- **Risks**: Latency spikes on older hardware; calculations must remain $O(1)$.

---

### TASK-006-B: Explainable Adaptive Difficulty Algorithm
- **Objective**: Implement the on-device mathematical difficulty recommendation model with transparent factor attribution.
- **Dependencies**: TASK-006-A.
- **Files/Folders Affected**:
  - `src/ai/adaptive-engine.ts` [NEW]
- **Implementation Requirements**:
  - Core algorithm: Multi-factor weighted regression model:
    $$\text{Cognitive Engagement Index (CEI)} = \sigma\left( \sum_{i=1}^5 w_i x_i + b \right)$$
    where $\sigma(z) = \frac{1}{1 + e^{-z}}$ is the logistic sigmoid mapping to $[0.0, 1.0]$.
  - Difficulty mapping:
    - $\text{CEI} < 0.35$: Recommend lower difficulty (gentler, reduced cards) to prevent frustration.
    - $0.35 \le \text{CEI} \le 0.75$: Maintain current difficulty (optimal engagement zone).
    - $\text{CEI} > 0.75$: Recommend next difficulty level (comfortable progression).
  - Strict Rule: Max difficulty step change per session is $+1$ or $-1$ (gradual, predictable transitions).
  - Explicit non-heuristic: Do NOT implement fake `if (score > 80) level++`.
- **Acceptance Criteria**:
  - Model produces deterministic difficulty recommendation and factor contribution scores ($w_i x_i$).
  - Smooth difficulty adjustments verified mathematically.
- **Validation Method**: Run 100 synthetic test cases across varying accuracies and latencies.
- **Risks**: Extreme weights causing model lock-in; clamp weights within $[-2.0, 2.0]$.

---

### TASK-006-C: Per-Patient Model State & Online Learning
- **Objective**: Adapt model weights locally to the unique interaction profile of each patient after every session.
- **Dependencies**: TASK-006-B, TASK-004-G.
- **Files/Folders Affected**:
  - `src/ai/online-trainer.ts` [NEW]
- **Implementation Requirements**:
  - Online gradient descent update:
    $$w_i \leftarrow w_i + \eta \cdot (\text{target} - \text{predicted}) \cdot x_i$$
    where $\eta = 0.05$ (conservative learning rate ensuring gradual adaptation).
  - Target value derived from patient feedback (e.g., patient marked activity "Comfortable" vs. "Challenging").
  - Persist updated weights and session count to SQLite `adaptive_model_state`.
- **Acceptance Criteria**:
  - Weights update incrementally post-session.
  - Weights remain stable and bounded after 50 continuous updates.
- **Validation Method**: Automated convergence tests with simulated patient trajectories.
- **Risks**: Gradient explosion; implement gradient clipping.

---

### TASK-006-D: Transparent "Why This Level?" Explanation Generator
- **Objective**: Translate mathematical feature contributions into calm, human-readable, non-diagnostic natural language explanations.
- **Dependencies**: TASK-006-C.
- **Files/Folders Affected**:
  - `src/ai/explainer.ts` [NEW]
- **Implementation Requirements**:
  - Identify top 2 positive and top 1 challenge factors from model output:
    - High accuracy: "You matched the pairs with great confidence."
    - Smooth latency: "You took your time and found the cards comfortably."
    - Low hints: "You remembered the cards independently today."
    - Challenging: "You seemed a bit tired today, so we're keeping things light and calm."
  - Synthesize clear explanation: "Because you matched cards smoothly with 88% accuracy and used very few hints, Level 3 will keep you comfortably engaged."
  - Multilingual support: explanations generated in English, Hindi, and Assamese.
- **Acceptance Criteria**:
  - Generated explanations strictly avoid clinical/diagnostic jargon.
  - Explanations accurately mirror the underlying mathematical factor weights.
- **Validation Method**: Unit tests verifying natural language output against known weight vectors.
- **Risks**: Clunky machine-translated sentences; use pre-approved dignified phrase templates.

---

### TASK-006-E: "Why This Level?" Modal UI
- **Objective**: Build the accessible explanation modal allowing patients and caregivers to inspect AI recommendations.
- **Dependencies**: TASK-006-D.
- **Files/Folders Affected**:
  - `app/patient/games/why-level.tsx` [NEW]
  - `components/ai/factor-breakdown-card.tsx` [NEW]
- **Implementation Requirements**:
  - Header: "Why Level [N] for You?"
  - Warm summary banner with natural language explanation.
  - Visual factor breakdown: 3 simple progress bars (Accuracy, Pacing, Independence) without technical formulas.
  - Voice button: reads the explanation aloud in the patient's language.
  - Reassuring footer: "Smaran AI personalizes activities to keep your mind active and relaxed. This is not a medical evaluation."
- **Acceptance Criteria**:
  - Modal renders in < 100ms when opened.
  - Voice readout reads the full explanation accurately.
- **Validation Method**: End-to-end flow test from game completion to explanation modal.
- **Risks**: Text clipping on small screens; make modal body scrollable.

---

### TASK-006-F: Medical Safety & Non-Diagnostic Guardrails
- **Objective**: Implement automated checks preventing the adaptive engine from ever generating medical claims or diagnostic labels.
- **Dependencies**: TASK-006-E.
- **Files/Folders Affected**:
  - `src/ai/safety-guardrails.ts` [NEW]
- **Implementation Requirements**:
  - Static assertion regex scanning output strings for prohibited terms: `dementia`, `alzheimer`, `mild cognitive impairment`, `mci`, `diagnosis`, `stage`, `deterioration`, `clinical`, `score`, `failed`, `deficient`.
  - Throw error and fallback to generic reassuring copy if any violation is detected.
  - Embed mandatory disclaimer on all AI surfaces: "Smaran AI is a cognitive engagement tool and does not provide medical diagnosis."
- **Acceptance Criteria**:
  - 100% clean pass on automated vocabulary audit.
  - Runtime sanitizer guarantees safe string output.
- **Validation Method**: Unit tests injecting malicious/clinical strings to verify sanitizer suppression.
- **Risks**: False positives blocking legitimate benign words; refine regex boundaries carefully.

---

### TASK-006-G: Adaptive Engine Comprehensive Unit & Stress Tests
- **Objective**: Validate numerical stability, edge cases, and continuous learning behavior under automated test runners.
- **Dependencies**: TASK-006-F.
- **Files/Folders Affected**:
  - `src/ai/__tests__/adaptive-engine.test.ts` [NEW]
  - `src/ai/__tests__/online-trainer.test.ts` [NEW]
- **Implementation Requirements**:
  - Test suites:
    1. Zero input telemetry (all 0s) -> Handles gracefully without NaN.
    2. Perfect telemetry (100% accuracy, instantaneous speed) -> Recommends gradual +1 level increment.
    3. Repeated poor performance -> Recommends gentle step down without dropping below Level 1.
    4. 500-session continuous training simulation -> Weights remain bounded in $[-2.0, 2.0]$.
- **Acceptance Criteria**:
  - All test suites pass with 0 failures under `npm test`.
- **Validation Method**: Execute Jest test runner and review test report.
- **Risks**: Flaky test assertions if floating point tolerances are too tight; use `toBeCloseTo()`.

---

## PHASE 7 — Additional Cognitive Activities

### TASK-007-A: Pattern Recognition Game Engine & Content
- **Objective**: Implement visual sequence and pattern completion mechanics using culturally familiar motifs.
- **Dependencies**: PHASE 6.
- **Files/Folders Affected**:
  - `src/games/pattern-recognition/engine.ts` [NEW]
  - `src/games/pattern-recognition/types.ts` [NEW]
  - `src/games/pattern-recognition/patterns.ts` [NEW]
- **Implementation Requirements**:
  - Mechanics: Patient is shown a repeating sequence of 3–4 cultural symbols with 1 missing item (e.g., `[Gamusa, Rhino, Gamusa, ?]`).
  - Patient chooses the matching item from 3 large options.
  - Difficulty scales from 2-symbol AB patterns to 3-symbol ABC and AABB patterns.
  - Full telemetry tracking: latency, hints, first-try accuracy.
- **Acceptance Criteria**:
  - Clean state transitions and telemetry recording.
  - Culturally authentic motifs from Assam content pack.
- **Validation Method**: Headless engine tests verifying correct choice evaluation.
- **Risks**: Ambiguous pattern logic causing patient confusion; keep visual rules obvious.

---

### TASK-007-B: Pattern Recognition UI & Screen
- **Objective**: Render the tactile Pattern Recognition screen with large choices and encouraging feedback.
- **Dependencies**: TASK-007-A.
- **Files/Folders Affected**:
  - `app/patient/games/pattern-recognition.tsx` [NEW]
  - `components/games/pattern-display.tsx` [NEW]
- **Implementation Requirements**:
  - Large sequence display boxes (height >= 80px).
  - Choice buttons >= 68px height with clear borders and haptic feedback.
  - "Read Pattern" voice button describing the sequence: "Gamusa, Rhino, Gamusa... what comes next?"
  - Seamless persistence to SQLite `cognitive_sessions` table.
- **Acceptance Criteria**:
  - Interactive screen operates smoothly with complete voice assistance.
  - Completed session feeds into Adaptive AI engine.
- **Validation Method**: UI play testing and telemetry persistence check.
- **Risks**: Layout crowding on horizontal sequences; allow responsive horizontal wrapping.

---

### TASK-007-C: Routine Recall Activity Engine & UI
- **Objective**: Provide a practical memory activity helping patients reconstruct everyday sequence steps.
- **Dependencies**: TASK-007-B.
- **Files/Folders Affected**:
  - `src/games/routine-recall/engine.ts` [NEW]
  - `app/patient/games/routine-recall.tsx` [NEW]
- **Implementation Requirements**:
  - Everyday scenarios:
    - "Making Morning Assam Tea" (Boil water -> Add tea leaves -> Pour milk -> Strain into cup)
    - "Tending to the Garden" (Put on hat -> Take watering can -> Water plants)
    - "Preparing for a Morning Walk" (Put on shoes -> Take walking stick -> Close door)
  - Interactive cards that the patient taps in chronological order.
  - Zero timer pressure; gentle audio hints on tap.
- **Acceptance Criteria**:
  - Validates correct routine ordering with encouraging feedback.
  - Persists session telemetry to SQLite.
- **Validation Method**: End-to-end playthrough of all 3 sample routines.
- **Risks**: Complex multi-step drag and drop; use simple, accessible tapping order instead.

---

### TASK-007-D: Multi-Game Adaptive Weight Integration
- **Objective**: Harmonize adaptive difficulty tracking across all three games within the patient's unified cognitive state.
- **Dependencies**: TASK-007-C.
- **Files/Folders Affected**:
  - `src/ai/multi-game-adapter.ts` [NEW]
- **Implementation Requirements**:
  - Maintain separate per-game weight vectors in `adaptive_model_state`.
  - Calculate unified patient cognitive engagement score across activities.
  - Update "Train My Mind" hub to dynamically recommend the game best suited for today's session.
- **Acceptance Criteria**:
  - Each game preserves its independent difficulty tuning.
  - Hub dynamically badges the recommended daily game.
- **Validation Method**: Simulate sessions across games and inspect SQLite state table.
- **Risks**: Cross-contamination of game-specific difficulty scales.

---

## PHASE 8 — My Day (Routines, Medicines & Reminders)

### TASK-008-A: Reminder Scheduling & Local Notifications Manager
- **Objective**: Schedule reliable local push notifications that fire on-device without internet or server connection.
- **Dependencies**: PHASE 4.
- **Files/Folders Affected**:
  - `src/services/notification.service.ts` [NEW]
- **Implementation Requirements**:
  - Use `expo-notifications` with local calendar/time-interval triggers.
  - Request user notification permissions gracefully during onboarding or initial reminder setup.
  - Sound: gentle melodic tone; avoid harsh alarming buzzers.
  - Reschedule pending reminders on app launch to maintain accuracy across OS restarts.
- **Acceptance Criteria**:
  - Local notification successfully triggers at exact scheduled time.
  - Tapping notification opens app directly to the relevant reminder card.
- **Validation Method**: Schedule test notification for $+10$ seconds and verify trigger.
- **Risks**: Android OEM battery optimization killing background notification workers; prompt user to whitelist app.

---

### TASK-008-B: My Day Timeline UI & Categorization
- **Objective**: Display the patient's daily schedule categorized into Morning, Afternoon, Evening, and Night blocks.
- **Dependencies**: TASK-008-A.
- **Files/Folders Affected**:
  - `app/patient/day/index.tsx` [MODIFY]
  - `components/day/day-section-block.tsx` [NEW]
- **Implementation Requirements**:
  - 4 distinct time blocks with cheerful iconography (Sunrise, Sun, Sunset, Moon).
  - Cards highlight: Medicine name, dosage, with/without food instruction, scheduled time.
  - High visual distinction between pending items and completed items.
- **Acceptance Criteria**:
  - Current time block automatically expands by default.
  - Cards have minimum 72px height and 20px typography.
- **Validation Method**: Visual verification against morning/evening mock schedules.
- **Risks**: Empty time blocks looking desolate; show comforting message: "Nothing pending for this afternoon. Relax and enjoy your day 🌸".

---

### TASK-008-C: One-Tap Completion & Gentle Undo Mechanics
- **Objective**: Allow patients to mark reminders done with a single large tap, offering instant celebratory feedback and undo capability.
- **Dependencies**: TASK-008-B.
- **Files/Folders Affected**:
  - `components/day/reminder-card.tsx` [NEW]
- **Implementation Requirements**:
  - Large checkbox target (minimum 56px x 56px).
  - On tap: Gentle green check animation, warm sound, banner: "Completed! Well done ❤️".
  - Instant write to SQLite `reminders` table (`is_completed = 1`, `last_completed_at = now()`).
  - 5-second gentle "Undo" toast in case of accidental tap.
- **Acceptance Criteria**:
  - Reminder toggles state instantly on screen.
  - Persistence verified in SQLite.
- **Validation Method**: Toggle reminder complete, restart app, verify persisted completion state.
- **Risks**: Accidental taps; undo banner must be prominent and easy to reach.

---

### TASK-008-D: Hydration Tracking with Visual Cup Interface
- **Objective**: Provide an ultra-simple visual water tracker helping elderly patients maintain daily hydration.
- **Dependencies**: TASK-008-C.
- **Files/Folders Affected**:
  - `components/day/hydration-tracker.tsx` [NEW]
- **Implementation Requirements**:
  - Display 6–8 rounded water glass icons representing daily goal.
  - Tapping an empty glass fills it with a gentle blue wave animation and soft water sound.
  - Tapping a filled glass gives option to undo.
  - Encouraging milestone message: "4 glasses of water today! Wonderful for your health 💧".
- **Acceptance Criteria**:
  - Glass count updates instantly in SQLite.
  - Resets automatically at midnight.
- **Validation Method**: Tap 4 glasses, verify SQLite persistence, inspect visual layout.
- **Risks**: Small glass icons; ensure each glass button is >= 56px wide.

---

### TASK-008-E: Adherence Event Logging for Caregiver Sync
- **Objective**: Generate structured adherence events to populate caregiver trend charts upon synchronization.
- **Dependencies**: TASK-008-D.
- **Files/Folders Affected**:
  - `src/services/adherence.service.ts` [NEW]
- **Implementation Requirements**:
  - Calculate daily adherence percentage: $(\text{completedReminders} / \text{totalScheduled}) \times 100$.
  - Record timestamped events: `MEDICINE_TAKEN`, `MEDICINE_MISSED`, `HYDRATION_LOGGED`.
  - Queue events into `sync_queue` table for subsequent caregiver dashboard consumption.
- **Acceptance Criteria**:
  - Adherence metrics accurately reflect completed vs. missed items.
  - Zero cloud dependency for local logging.
- **Validation Method**: Unit tests verifying adherence calculation across multiple scenarios.
- **Risks**: Missing reminders when app is closed; calculate missed items retroactively on next launch.

---

## PHASE 9 — My Memories (Reminiscence Support)

### TASK-009-A: Personal Memory Data Architecture & Storage
- **Objective**: Manage local sandboxed photo and audio asset storage linked to SQLite memory metadata.
- **Dependencies**: PHASE 4.
- **Files/Folders Affected**:
  - `src/services/memory-storage.service.ts` [NEW]
- **Implementation Requirements**:
  - Store photos in `FileSystem.documentDirectory + 'memories/images/'`.
  - Store audio clips in `FileSystem.documentDirectory + 'memories/audio/'`.
  - Metadata: `id`, `patient_id`, `person_name`, `relationship`, `description`, `photo_uri`, `audio_uri`, `memory_date`.
  - Provide helper to load bundled seed memories for initial demo experience.
- **Acceptance Criteria**:
  - Files saved with unique UUID filenames.
  - Storage paths resolve reliably offline.
- **Validation Method**: Save sample image, query URI, and render in `<Image />` component.
- **Risks**: Android internal storage permissions; use standard Expo app data directory.

---

### TASK-009-B: Memory Card Gallery UI
- **Objective**: Display family and personal memories in an accessible, warm, dignified visual layout.
- **Dependencies**: TASK-009-A.
- **Files/Folders Affected**:
  - `app/patient/memories/index.tsx` [MODIFY]
  - `components/memories/memory-grid-card.tsx` [NEW]
- **Implementation Requirements**:
  - Large photo card (min height 180px) with rounded corners.
  - Prominent relationship chip: "Your Daughter — Priya 🌸" in 20px bold font.
  - Short, familiar description: "Celebrating Bihu together in Guwahati, 2024".
  - Audio indicator badge if a family voice note is attached.
- **Acceptance Criteria**:
  - Photos render crisply with smooth loading placeholders.
  - Accessible description read aloud by screen reader.
- **Validation Method**: Populate 6 sample memories and inspect visual presentation.
- **Risks**: Heavy memory usage with multiple photos; implement thumbnail caching.

---

### TASK-009-C: Detailed Reminiscence & Voice Message Playback View
- **Objective**: Provide a full-screen, intimate memory contemplation view featuring voice message playback.
- **Dependencies**: TASK-009-B.
- **Files/Folders Affected**:
  - `app/patient/memories/[id].tsx` [NEW]
  - `components/memories/audio-player-card.tsx` [NEW]
- **Implementation Requirements**:
  - Full-screen high-contrast photo display.
  - Large audio playback bar: "Listen to Priya's Message" with 68px Play/Pause button.
  - Playback using Expo Audio / AV with smooth progress bar.
  - Audio transcript text displayed below player for hearing-impaired users.
- **Acceptance Criteria**:
  - Audio plays reliably through device speaker.
  - Play/Pause state is visually obvious.
- **Validation Method**: Play test audio file and verify pause, resume, and completion triggers.
- **Risks**: Audio failure on silent mode; configure audio session category to playback.

---

### TASK-009-D: Gentle Recall Reminiscence Activity
- **Objective**: Provide a non-stressful memory engagement exercise based on personal family photos.
- **Dependencies**: TASK-009-C.
- **Files/Folders Affected**:
  - `app/patient/memories/recall.tsx` [NEW]
- **Implementation Requirements**:
  - Displays a familiar family photo: "Who is smiling with you here?"
  - 3 large, friendly choice buttons: e.g., "Rahul (Son)", "Amit (Brother)", "Priya (Daughter)".
  - If correct: "Yes! That is Rahul visiting you last winter ❤️".
  - If wrong: "That's Rahul! Look at his warm smile. Let's hear his voice message." (zero failure language).
- **Acceptance Criteria**:
  - Always reinforces the correct answer with warmth and connection.
  - Never assigns a "failed" score or penalty.
- **Validation Method**: Play through recall activity with intentional wrong taps.
- **Risks**: Frustrating the patient if photo is unfamiliar; allow caregiver to select "core familiar photos".

---

### TASK-009-E: Caregiver Memory Management UI
- **Objective**: Allow family members to add new photos, set relationship labels, and record voice notes.
- **Dependencies**: TASK-009-D.
- **Files/Folders Affected**:
  - `app/caregiver/memories/add.tsx` [NEW]
- **Implementation Requirements**:
  - Pick photo from device library using `expo-image-picker`.
  - Enter name, relationship, and comforting description.
  - Built-in audio recorder to record a 30-second voice note for the patient.
  - Save to local database with sync queue entry.
- **Acceptance Criteria**:
  - Successfully captures photo, audio, and metadata.
  - Newly added memory immediately appears in patient's memory gallery.
- **Validation Method**: Add memory in caregiver view, switch to patient mode, verify appearance.
- **Risks**: Large uncompressed photos; compress images to max 1080p before saving.

---

## PHASE 10 — North-East Regional Localization (NER Content Architecture)

### TASK-010-A: Regional Content Schema & Decoupled Architecture
- **Objective**: Architect a pluggable regional content system that cleanly separates cultural data from core application logic.
- **Dependencies**: PHASE 1.
- **Files/Folders Affected**:
  - `src/content/regional/types.ts` [NEW]
  - `src/content/regional/index.ts` [NEW]
- **Implementation Requirements**:
  - Schema interface `RegionalContentPack`:
    - `stateId`: 'assam' | 'arunachal' | 'manipur' | 'meghalaya' | 'mizoram' | 'nagaland' | 'sikkim' | 'tripura'
    - `stateName`: Localized names in English and native scripts
    - `culturalMotifs`: Array of icon assets and descriptions
    - `proverbs`: Soothing traditional wisdom and sayings
    - `folkStories`: Short, calming, nostalgic cultural narratives
    - `landmarks`: Culturally cherished places and landscapes
    - `audioCues`: Traditional ambient musical snippets
  - Strict Rule: Never treat the 8 North-Eastern states as one homogeneous culture.
- **Acceptance Criteria**:
  - Architecture cleanly supports adding new state content packs without touching game code.
- **Validation Method**: TypeScript interface check and mock pack registration.
- **Risks**: Bloating app bundle with excessive audio/image assets; bundle core demo assets and prepare remote pack download for future states.

---

### TASK-010-B: Assam Regional Demo Pack Implementation
- **Objective**: Implement the complete, rich cultural content pack for Assam for the primary SIH demonstration.
- **Dependencies**: TASK-010-A.
- **Files/Folders Affected**:
  - `src/content/regional/packs/assam.ts` [NEW]
  - `assets/regional/assam/` [NEW]
- **Implementation Requirements**:
  - Cultural motifs:
    - Assamese Gamusa (ঐতিহ্যমণ্ডিত গামোচা)
    - Kaziranga One-Horned Rhino (এশিঙীয়া গঁড়)
    - Traditional Brass Xorai (পিতলৰ শৰাই)
    - Fresh Assam Tea Cup (একাপ সুগন্ধি চাহ)
    - Bihu Dhol (বিহু ঢোল)
    - Jaapi (জাপি)
  - Stories: Excerpts from Lakshminath Bezbaroa's folklore (Burhi Aair Xadhu), Majuli island tales, Brahmaputra river memories.
  - Audio: Soothing flute and gentle traditional melodies.
- **Acceptance Criteria**:
  - All motifs have authentic Assamese and English titles and descriptions.
  - Assets bundled in app and load instantly offline.
- **Validation Method**: Inspect loaded pack in Assam region mode.
- **Risks**: Inaccurate cultural nuances; cross-reference authentic folklore and iconography.

---

### TASK-010-C: Multi-State NER Manifest & Extensibility Skeleton
- **Objective**: Establish configuration skeletons for the remaining 7 North-Eastern states to demonstrate architectural readiness.
- **Dependencies**: TASK-010-B.
- **Files/Folders Affected**:
  - `src/content/regional/packs/arunachal.ts` [NEW]
  - `src/content/regional/packs/manipur.ts` [NEW]
  - `src/content/regional/packs/meghalaya.ts` [NEW]
  - `src/content/regional/packs/mizoram.ts` [NEW]
  - `src/content/regional/packs/nagaland.ts` [NEW]
  - `src/content/regional/packs/sikkim.ts` [NEW]
  - `src/content/regional/packs/tripura.ts` [NEW]
- **Implementation Requirements**:
  - Define state manifests with proper native names, major festivals, and landmark references for all 7 states:
    - Arunachal Pradesh: Tawang Monastery, Hornbill motifs, Losar festival.
    - Manipur: Loktak Lake, Sangai deer, Manipuri classical dance.
    - Meghalaya: Living Root Bridges, Cherrapunji, Khasi drums.
    - Mizoram: Cheraw dance, Dampa hills, Chapchar Kut.
    - Nagaland: Hornbill festival, Naga shawls, Dzukou Valley.
    - Sikkim: Kanchenjunga peaks, Rhododendron blossoms, Rumtek.
    - Tripura: Ujjayanta Palace, Unakoti rock carvings, Garia puja.
- **Acceptance Criteria**:
  - Selecting any of the 8 states in onboarding dynamically loads the corresponding state manifest.
- **Validation Method**: Toggle through all 8 states in settings and verify header/content updates.
- **Risks**: Incomplete placeholder packs; ensure each skeleton has at least 3 authentic cultural symbols.

---

### TASK-010-D: Cultural Separation Layer in Cognitive Games
- **Objective**: Dynamically inject regional motifs into Memory Match and Pattern Recognition based on the patient's selected region.
- **Dependencies**: TASK-010-C, PHASE 5.
- **Files/Folders Affected**:
  - `src/games/memory-match/card-factory.ts` [NEW]
- **Implementation Requirements**:
  - Abstract card asset retrieval: `getCardsForRegion(stateId, count)`.
  - When patient has selected Assam, game cards dynamically feature Xorai, Gamusa, Rhino, and Tea.
  - When patient has selected Manipur, game cards feature Sangai, Loktak, and Manipuri textiles.
- **Acceptance Criteria**:
  - Game logic operates completely agnostic of specific cultural motifs.
  - Zero hardcoded game card filenames in the game engine.
- **Validation Method**: Switch region in settings and verify game cards immediately reflect new regional assets.
- **Risks**: Missing asset for a newly added region; fallback gracefully to default calming nature pack.

---

## PHASE 11 — Voice & Multilingual Experience

### TASK-011-A: Localization Architecture & String Catalogs
- **Objective**: Establish the multi-language dictionary system supporting English, Hindi, and Assamese.
- **Dependencies**: PHASE 1.
- **Files/Folders Affected**:
  - `src/i18n/index.ts` [NEW]
  - `src/i18n/locales/en.json` [NEW]
  - `src/i18n/locales/hi.json` [NEW]
  - `src/i18n/locales/as.json` [NEW]
- **Implementation Requirements**:
  - Complete translations for all patient navigation, button labels, encouragement copy, and settings.
  - Strongly-typed translation key provider: `t('patient.home.greeting')`.
  - Fallback mechanism: if an Assamese key is missing, fallback to English without throwing errors.
- **Acceptance Criteria**:
  - 100% translation coverage across all 3 initial languages for all primary demo screens.
  - Dynamic locale switching updates UI instantly without app reload.
- **Validation Method**: Automated script checking key parity between `en.json`, `hi.json`, and `as.json`.
- **Risks**: Truncated text in Assamese/Hindi due to longer word lengths; test all UI at maximum string length.

---

### TASK-011-B: Expo Speech Integration & Voice Engine
- **Objective**: Wrap `expo-speech` with an elderly-friendly audio service configured for clear, slow articulation.
- **Dependencies**: TASK-011-A.
- **Files/Folders Affected**:
  - `src/services/speech.service.ts` [NEW]
- **Implementation Requirements**:
  - Speech settings:
    - Speaking rate: `0.8` (slow, deliberate, dignified pacing for elderly comprehension).
    - Pitch: `1.0` (natural, warm pitch).
  - Language routing:
    - English: `'en-IN'` or `'en-US'`
    - Hindi: `'hi-IN'`
    - Assamese: `'as-IN'` (or graceful fallback if native voice missing on device)
  - Helper functions: `speak(text, options)`, `stop()`, `isSpeaking()`.
- **Acceptance Criteria**:
  - Speech service speaks sentences with elderly-appropriate cadence.
  - Audio stops immediately when navigating away from a screen.
- **Validation Method**: Play test speech sentences and verify listener comfort.
- **Risks**: Assamese voice not installed in Android TTS engine; must implement fallback.

---

### TASK-011-C: Multilingual Voice Fallback System
- **Objective**: Gracefully handle missing device TTS voices without crashing or failing silently.
- **Dependencies**: TASK-011-B.
- **Files/Folders Affected**:
  - `src/services/speech-fallback.service.ts` [NEW]
- **Implementation Requirements**:
  - Query device available voices via `Speech.getAvailableVoicesAsync()`.
  - If `'as-IN'` is unavailable, check for `'hi-IN'`; if neither is available, fallback to `'en-IN'`.
  - Provide pre-recorded audio bundle clips for critical patient commands ("Welcome", "Time for medicine", "Wonderful memory work") as guaranteed offline audio fallback.
- **Acceptance Criteria**:
  - Zero unhandled exceptions when requesting speech for unsupported locales.
  - Guaranteed audio feedback even on stripped-down Android Go devices.
- **Validation Method**: Mock empty TTS voice array and verify fallback pre-recorded audio plays.
- **Risks**: Large audio bundle size; only bundle core top-10 essential phrases.

---

### TASK-011-D: Global "Read Screen" Accessibility Trigger
- **Objective**: Provide a ubiquitous, accessible speaker button on all patient screens that narrates the current screen.
- **Dependencies**: TASK-011-C, PHASE 3.
- **Files/Folders Affected**:
  - `components/voice/read-screen-button.tsx` [NEW]
- **Implementation Requirements**:
  - Floating or header-anchored prominent button with audio wave / speaker icon (size >= 56px).
  - On tap: Narrates screen title, primary instructions, and pending action cards in sequence.
  - Active speaking animation: pulsing warm amber aura.
  - Tapping again immediately silences speech.
- **Acceptance Criteria**:
  - Present and functional on Patient Home, Games Hub, Game Board, and My Day.
  - Clearly announces interactive options to low-vision or illiterate users.
- **Validation Method**: Tap "Read Screen" on Patient Home and verify audible speech output.
- **Risks**: Audio reading out technical IDs or URLs; pass curated display text only.

---

## PHASE 12 — Caregiver Application

### TASK-012-A: Caregiver Navigation & Layout Structure
- **Objective**: Build the multi-tab layout tailored for family caregivers.
- **Dependencies**: PHASE 4, PHASE 6.
- **Files/Folders Affected**:
  - `app/caregiver/_layout.tsx` [NEW]
  - `components/navigation/caregiver-bottom-bar.tsx` [NEW]
- **Implementation Requirements**:
  - 4 navigation tabs:
    1. Dashboard (`/caregiver/dashboard`)
    2. Routine Manager (`/caregiver/routines`)
    3. Memories (`/caregiver/memories`)
    4. Settings & Care (`/caregiver/settings`)
  - Clean, information-dense (yet dignified) interface utilizing soft elevation and clear typography.
- **Acceptance Criteria**:
  - Tab navigation functions cleanly.
  - Header displays linked patient name and last active status.
- **Validation Method**: Tab switching test and route inspection.
- **Risks**: Caregiver accessing patient screens accidentally; maintain distinct layout routes.

---

### TASK-012-B: Caregiver Dashboard & Linked Patient Header
- **Objective**: Display an executive overview of the patient's daily wellbeing, routines, and cognitive engagement.
- **Dependencies**: TASK-012-A.
- **Files/Folders Affected**:
  - `app/caregiver/dashboard.tsx` [NEW]
  - `components/caregiver/patient-status-hero.tsx` [NEW]
- **Implementation Requirements**:
  - Linked patient summary card:
    - Patient Name: "Dharmin (Father)"
    - Status Badge: "Active 25 mins ago" (derived from SQLite session/reminder timestamps)
    - Sync Badge: "Ready offline" or "Synced 5 mins ago"
  - Quick action buttons: "Call Patient", "Add Medicine", "Add Memory".
- **Acceptance Criteria**:
  - Status updates dynamically from local SQLite database.
  - Call button initiates phone dialer.
- **Validation Method**: Query latest SQLite session timestamp and verify relative time display ("X mins ago").
- **Risks**: Stale status if app was running in background; refresh on screen focus.

---

### TASK-012-C: Cognitive Session Trends & Engagement Charts
- **Objective**: Visualize the patient's cognitive engagement trends without claiming clinical diagnoses.
- **Dependencies**: TASK-012-B.
- **Files/Folders Affected**:
  - `components/caregiver/cognitive-trends-card.tsx` [NEW]
  - `components/charts/simple-line-chart.tsx` [NEW]
- **Implementation Requirements**:
  - 7-day engagement chart:
    - Metric: Number of cognitive sessions played per day.
    - Metric: Average accuracy trend across games.
    - Metric: Average response latency (seconds per match).
  - Accessible, SVG-based lightweight chart without heavy external charting bloat.
  - Clear label: "Cognitive Engagement & Activity History (Non-Diagnostic)".
- **Acceptance Criteria**:
  - Chart renders cleanly with real data points from `cognitive_sessions` table.
  - Displays empty state gracefully when no sessions exist yet.
- **Validation Method**: Insert 7 days of synthetic SQLite test sessions and verify chart rendering.
- **Risks**: Over-interpreting normal cognitive fluctuations; include helper tooltip explaining that variations are normal.

---

### TASK-012-D: Daily Routine Adherence Log
- **Objective**: Display detailed completion history for medicines, meals, and hydration.
- **Dependencies**: TASK-012-C.
- **Files/Folders Affected**:
  - `components/caregiver/routine-adherence-card.tsx` [NEW]
- **Implementation Requirements**:
  - Daily completion donut / progress bar: e.g., "4 of 5 routines completed today (80%)".
  - Detailed breakdown list:
    - "Blood Pressure Tablet (Morning) — Taken at 9:15 AM ✅"
    - "Water Intake — 6 of 8 glasses logged 💧"
    - "Evening Walk — Pending ⏳"
- **Acceptance Criteria**:
  - Live data bound to SQLite `reminders` table.
  - Accurately reports taken vs. missed times.
- **Validation Method**: Mark medicine complete in patient mode, switch to caregiver mode, assert log updates.
- **Risks**: Clock differences between patient and caregiver devices; timestamps must be stored in UTC ISO-8601.

---

### TASK-012-E: Non-Diagnostic Attention Indicators
- **Objective**: Present actionable, caring observations to the caregiver when patterns deviate significantly.
- **Dependencies**: TASK-012-D.
- **Files/Folders Affected**:
  - `components/caregiver/attention-indicators.tsx` [NEW]
- **Implementation Requirements**:
  - Behavioral pattern detection:
    - If 2 consecutive morning medicines were missed: "Dharmin missed his morning medicines yesterday and today. Consider a gentle phone check-in."
    - If game response latency increased by > 40% over 3 days: "Reaction speed was a little slower on recent games. A restful afternoon or hydration might help."
    - If hydration is below 50% target: "Water intake has been low today."
  - Strict Rule: NEVER say "Patient is deteriorating" or "Signs of dementia worsening". Always recommend supportive, caring human connection.
- **Acceptance Criteria**:
  - Suggestions are non-diagnostic, compassionate, and actionable.
  - Trigger logic verified with unit test scenarios.
- **Validation Method**: Unit tests injecting missed medicine events and verifying observation text.
- **Risks**: Causing unnecessary caregiver panic; language must remain warm and advisory.

---

### TASK-012-F: Caregiver Routine & Medicine Management
- **Objective**: Enable caregivers to create, edit, and delete scheduled reminders for the patient.
- **Dependencies**: TASK-012-E.
- **Files/Folders Affected**:
  - `app/caregiver/routines/index.tsx` [NEW]
  - `app/caregiver/routines/add.tsx` [NEW]
- **Implementation Requirements**:
  - Form to add new reminder:
    - Title / Medicine name
    - Category: Medicine | Meal | Hydration | Activity | Appointment
    - Time of day picker
    - Frequency: Daily | Specific Days | Once
    - Dosage instructions (e.g., "1 tablet after food with water")
  - Writes directly to SQLite `reminders` table and enqueues sync event.
- **Acceptance Criteria**:
  - Newly scheduled reminder immediately triggers local notification setup.
  - Appears in patient's "My Day" screen.
- **Validation Method**: Add reminder in caregiver tab, verify notification is scheduled, verify display in patient day view.
- **Risks**: Conflicting reminder times; warn caregiver if two medicines are scheduled at identical times.

---

## PHASE 13 — Offline Synchronization System

### TASK-013-A: Network Connectivity Monitor & Status Badge
- **Objective**: Monitor real-time device network connectivity and display reassuring status badges.
- **Dependencies**: PHASE 4.
- **Files/Folders Affected**:
  - `src/services/network.service.ts` [NEW]
  - `components/common/offline-status-badge.tsx` [NEW]
- **Implementation Requirements**:
  - Integrate `@react-native-community/netinfo`.
  - Track `isConnected` and `isInternetReachable`.
  - Design principle: Offline is a core capability, not an error.
  - When offline, display: "Ready offline 🛡️" with soft green/teal badge.
  - Never display alarming warnings like "NO INTERNET CONNECTION!".
  - When sync is pending, display: "Saved safely on your device. We'll sync when you're connected."
- **Acceptance Criteria**:
  - Badge updates instantly when toggling Airplane Mode.
  - Calming, positive tone maintained across all network states.
- **Validation Method**: Airplane mode simulation and NetInfo listener verification.
- **Risks**: Flaky network connections causing badge flicker; debounce status changes by 1.5 seconds.

---

### TASK-013-B: Sync Queue Manager & Change Tracking
- **Objective**: Capture and queue all local data modifications in an append-only SQLite sync table.
- **Dependencies**: TASK-013-A, TASK-004-E.
- **Files/Folders Affected**:
  - `src/services/sync-queue.service.ts` [NEW]
- **Implementation Requirements**:
  - Table: `sync_queue` (id, table_name, record_id, action: 'INSERT'|'UPDATE'|'DELETE', payload_json, status: 'PENDING'|'PROCESSING'|'FAILED', retry_count, created_at).
  - Repository write interceptors automatically log mutations.
  - Deduplication: if multiple updates occur to the same record before sync, consolidate into the latest payload.
- **Acceptance Criteria**:
  - Every local change enqueues a valid sync item.
  - Zero loss of user edits while offline.
- **Validation Method**: Perform 10 offline edits and assert 10 pending records in `sync_queue`.
- **Risks**: Queue bloat if offline for weeks; limit queue to 500 records and prioritize latest state.

---

### TASK-013-C: Conflict Resolution Engine
- **Objective**: Reconcile data differences between local device changes and remote cloud modifications.
- **Dependencies**: TASK-013-B.
- **Files/Folders Affected**:
  - `src/services/conflict-resolver.ts` [NEW]
- **Implementation Requirements**:
  - Conflict rules:
    1. Patient Adherence / Reminders completed: **Client-Wins** (patient's physical completion on-device always supersedes cloud state).
    2. Caregiver Schedule Changes: **Server-Wins** (caregiver schedule modifications made remotely take precedence over outdated local times).
    3. Cognitive Sessions: **Append-Only** (sessions are unique immutable events, never overwritten).
    4. Personal Memories: **Last-Write-Wins** based on UTC timestamp.
- **Acceptance Criteria**:
  - Conflict rules execute deterministically without data loss.
  - Unit tests verify all 4 conflict scenarios.
- **Validation Method**: Automated test suite simulating simultaneous client and server edits.
- **Risks**: Clock skew between client and server; utilize ISO-8601 UTC server timestamps where available.

---

### TASK-013-D: Resilient Batch Sync Worker
- **Objective**: Dispatch pending queued changes to the backend in atomic batches with exponential backoff retry.
- **Dependencies**: TASK-013-C.
- **Files/Folders Affected**:
  - `src/services/sync-worker.service.ts` [NEW]
- **Implementation Requirements**:
  - Batch size: Max 25 records per sync request to preserve mobile bandwidth.
  - Trigger conditions: Network reconnects, app foregrounded, or explicit "Sync Now" tap.
  - Retry logic: Exponential backoff ($1\text{s}, 2\text{s}, 4\text{s}, 8\text{s}, \dots, \max 60\text{s}$) on HTTP 5xx or network timeout.
  - Once confirmed by server, mark `sync_queue` item as `'COMPLETED'` and update local record `synced = 1`.
- **Acceptance Criteria**:
  - Flawless recovery from network interruption mid-sync.
  - Zero duplicate record insertions on retry (idempotent upserts).
- **Validation Method**: Mock unstable network that fails 50% of requests and verify eventual consistency.
- **Risks**: Excessive battery drain if worker retries in tight loops; enforce exponential backoff.

---

## PHASE 14 — Supabase Backend & Cloud Integration

> **Mandatory Rule**: The local patient application (Phases 0–12) must be completely working and validated before this cloud layer is connected.

### TASK-014-A: Supabase Client & Secure Credentials
- **Objective**: Initialize `@supabase/supabase-js` using environment variables and secure token storage.
- **Dependencies**: PHASE 13.
- **Files/Folders Affected**:
  - `src/services/supabase.client.ts` [NEW]
  - `.env.example` [NEW]
- **Implementation Requirements**:
  - Configure Supabase client with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
  - Persist authentication session tokens inside `expo-secure-store` rather than standard `AsyncStorage`.
  - Auto-refresh tokens on expiration.
- **Acceptance Criteria**:
  - Client initializes cleanly without exposing secrets.
  - SecureStore securely handles JWT persistence.
- **Validation Method**: Test token storage and retrieval via SecureStore wrapper.
- **Risks**: Secret keys leaked into Git; enforce `.gitignore` on `.env`.

---

### TASK-014-B: PostgreSQL Database Schema & Cloud Migrations
- **Objective**: Create cloud PostgreSQL schema mirroring local SQLite entities.
- **Dependencies**: TASK-014-A.
- **Files/Folders Affected**:
  - `supabase/migrations/001_initial_cloud_schema.sql` [NEW]
- **Implementation Requirements**:
  - Tables:
    - `profiles` (id references auth.users, role, full_name, created_at)
    - `patient_profiles` (id, user_id, preferred_name, age_bracket, emergency_phone, created_at)
    - `caregiver_links` (id, caregiver_id, patient_id, status: 'ACTIVE'|'PENDING', created_at)
    - `cognitive_sessions` (id uuid primary key, patient_id, game_type, difficulty, accuracy, total_time_ms, raw_events, created_at)
    - `reminders` (id uuid primary key, patient_id, title, category, scheduled_time, is_completed, last_completed_at)
    - `personal_memories` (id uuid primary key, patient_id, person_name, relationship, description, photo_url, audio_url)
- **Acceptance Criteria**:
  - SQL script executes cleanly in Supabase PostgreSQL instance.
  - Foreign key constraints enforce referential integrity.
- **Validation Method**: Run migration in local Supabase CLI or staging instance.
- **Risks**: UUID vs. SQLite autoincrement ID mismatch; use UUIDv4 across both SQLite and PostgreSQL.

---

### TASK-014-C: Row-Level Security (RLS) Policies
- **Objective**: Enforce strict data isolation so caregivers and patients can only access their authorized records.
- **Dependencies**: TASK-014-B.
- **Files/Folders Affected**:
  - `supabase/migrations/002_row_level_security.sql` [NEW]
- **Implementation Requirements**:
  - Enable RLS on all tables (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`).
  - Patient policy: Patients can read and write only rows where `patient_id = auth.uid()`.
  - Caregiver policy: Caregivers can read rows of patients where an active link exists in `caregiver_links` (`caregiver_id = auth.uid() AND status = 'ACTIVE'`).
  - Prohibit public read/write access completely.
- **Acceptance Criteria**:
  - Unauthorized queries return empty sets or permission denied.
  - Verified with multi-user SQL test scripts.
- **Validation Method**: Execute tests with two different user JWTs and assert isolation.
- **Risks**: Overly permissive RLS rules leaking patient health data.

---

### TASK-014-D: Supabase Storage Buckets Setup
- **Objective**: Configure encrypted cloud storage buckets for family photos and voice notes.
- **Dependencies**: TASK-014-C.
- **Files/Folders Affected**:
  - `supabase/migrations/003_storage_buckets.sql` [NEW]
  - `src/services/cloud-storage.service.ts` [NEW]
- **Implementation Requirements**:
  - Buckets:
    - `memory-photos` (private, max file size 5MB, MIME: image/jpeg, image/png)
    - `memory-audio` (private, max file size 10MB, MIME: audio/m4a, audio/mp4, audio/aac)
  - Storage RLS: Only linked caregiver and patient can upload/read objects within their assigned folder (`/patient_id/*`).
- **Acceptance Criteria**:
  - File upload and signed URL download work end-to-end.
  - Cross-tenant access is blocked by storage policies.
- **Validation Method**: Upload sample image via API and verify signed URL retrieval.
- **Risks**: Unsigned public URLs exposing patient family photographs.

---

### TASK-014-E: Caregiver Authentication & Patient Pairing Flow
- **Objective**: Implement secure caregiver sign-in and QR code / 6-digit linking code to pair caregiver with patient.
- **Dependencies**: TASK-014-D.
- **Files/Folders Affected**:
  - `app/caregiver/auth/login.tsx` [NEW]
  - `app/caregiver/auth/pair.tsx` [NEW]
  - `app/patient/care/pairing-code.tsx` [NEW]
- **Implementation Requirements**:
  - Caregiver: Email / Password or Phone OTP login via Supabase Auth.
  - Patient: Displays a simple 6-digit numeric pairing code (e.g., `834-291`) valid for 15 minutes.
  - Caregiver enters code to establish `caregiver_links` record in Supabase.
  - Patient device does not require complex passwords or email verification.
- **Acceptance Criteria**:
  - Pairing establishes secure relationship in PostgreSQL.
  - Caregiver immediately gains authorized visibility to patient telemetry.
- **Validation Method**: Pair test caregiver account with test patient profile and verify data sync.
- **Risks**: Elderly patient struggling with pairing codes; allow caregiver to set up patient device directly.

---

## PHASE 15 — Security & Privacy Hardening

### TASK-015-A: Secure Storage & Cryptographic Key Management
- **Objective**: Ensure session tokens, encryption keys, and sensitive local configuration are secured using hardware keystore.
- **Dependencies**: PHASE 14.
- **Files/Folders Affected**:
  - `src/services/secure-storage.service.ts` [NEW]
- **Implementation Requirements**:
  - Store auth tokens in Android Keystore / iOS Keychain via `expo-secure-store`.
  - Validate that sensitive tokens are never written to standard `AsyncStorage` or unencrypted SQLite text fields.
  - Provide secure wipe utility on account logout.
- **Acceptance Criteria**:
  - Tokens survive app restarts.
  - Uninstallation cleanly wipes sensitive local credentials.
- **Validation Method**: Inspect stored keys using native file explorer on rooted/debug emulator.
- **Risks**: Keystore invalidation if user changes device lock screen PIN.

---

### TASK-015-B: Role-Based Route Guards in Expo Router
- **Objective**: Prevent patients from stumbling into caregiver dashboards and vice versa.
- **Dependencies**: TASK-015-A.
- **Files/Folders Affected**:
  - `app/_layout.tsx` [MODIFY]
  - `src/services/auth-guard.ts` [NEW]
- **Implementation Requirements**:
  - Evaluate active role before rendering stack screens.
  - If role is `'patient'`, accessing `/caregiver/*` redirects back to `/patient/home`.
  - If role is `'caregiver'`, accessing `/patient/*` without explicit "Patient Mode Switch" redirects to `/caregiver/dashboard`.
  - Simple PIN protection on caregiver access to prevent confused patients from modifying medication schedules.
- **Acceptance Criteria**:
  - Direct deep links to unauthorized roles are blocked and safely redirected.
- **Validation Method**: Trigger deep links to `/caregiver/settings` in patient mode and assert redirect.
- **Risks**: Patient getting locked out of app if PIN is forgotten; provide simple caregiver recovery option.

---

### TASK-015-C: Input Validation & Sanitization Pipeline
- **Objective**: Protect SQLite and backend APIs against malformed data, buffer overflows, and injection attacks.
- **Dependencies**: TASK-015-B.
- **Files/Folders Affected**:
  - `src/utils/validation.ts` [NEW]
- **Implementation Requirements**:
  - Create strict validation schemas for all inputs (names, phone numbers, dosages, notes).
  - Enforce phone number format matching Indian telecom standards (`+91` or 10 digits).
  - Strip HTML and script tags from text inputs before SQLite write.
  - Reject excessively long strings to prevent memory exhaustion.
- **Acceptance Criteria**:
  - Invalid inputs produce clear, accessible error messages.
  - 100% of repository inputs validated prior to database queries.
- **Validation Method**: Fuzzing test feeding malformed strings to validation functions.
- **Risks**: Overly aggressive regex rejecting valid regional names; support Unicode scripts.

---

### TASK-015-D: Privacy Audit & Least-Data Compliance
- **Objective**: Review data schemas to guarantee zero unnecessary medical data collection.
- **Dependencies**: TASK-015-C.
- **Files/Folders Affected**:
  - `docs/PRIVACY_AUDIT.md` [NEW]
- **Implementation Requirements**:
  - Confirm: No collection of Aadhaar numbers, detailed clinical diagnostics, psychiatric records, or GPS continuous location.
  - Confirm: Telemetry strictly captures interaction mechanics (timing, accuracy) rather than sensitive surveillance.
  - Document privacy commitments for hackathon jury.
- **Acceptance Criteria**:
  - Audit document completed.
  - Codebase verified free of invasive trackers or analytics SDKs.
- **Validation Method**: Static code grep for unauthorized device sensors and data collection APIs.
- **Risks**: Third-party libraries bundling undisclosed analytics; audit dependency tree.

---

## PHASE 16 — Accessibility Hardening (WCAG AAA for Elderly Users)

### TASK-016-A: Dynamic Type & Large Text Scaling Audit
- **Objective**: Guarantee that all patient-facing text remains fully readable at 150%–200% system font scaling without truncation.
- **Dependencies**: PHASE 1.
- **Files/Folders Affected**:
  - `components/themed-text.tsx` [MODIFY]
  - All patient screens
- **Implementation Requirements**:
  - Eliminate all fixed `height` constraints on text containers; use `minHeight` and flex layout.
  - Ensure `numberOfLines` is only used where appropriate expansion triggers exist.
  - Prevent text clipping on buttons and headers at maximum OS font size.
- **Acceptance Criteria**:
  - Zero text truncation or ellipsis on Patient Home, Memory Match, and My Day at 200% font scale.
- **Validation Method**: Manual visual pass with device font size set to maximum accessibility level.
- **Risks**: Button text wrapping onto 3 lines; allow buttons to expand vertically.

---

### TASK-016-B: Touch Target & Motor Accessibility Audit
- **Objective**: Enforce 56px minimum touch targets and 16px interactive separation across every touchable surface.
- **Dependencies**: TASK-016-A.
- **Files/Folders Affected**:
  - `components/ui/smaran-button.tsx`
  - `components/ui/smaran-card.tsx`
  - All interactive icons
- **Implementation Requirements**:
  - Verify every `Pressable`, `TouchableOpacity`, and button meets minimum `56px x 56px`.
  - Use `hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}` on smaller icon buttons.
  - Ensure minimum 16px margin between adjacent buttons to eliminate accidental mis-taps.
- **Acceptance Criteria**:
  - Automated linter or test asserts zero interactive elements below 56px touch footprint.
- **Validation Method**: Automated layout geometry tests on rendered component trees.
- **Risks**: Dense toolbars; redesign into vertical button stacks where space is constrained.

---

### TASK-016-C: High Contrast & Color-Blindness Verification
- **Objective**: Validate WCAG AAA contrast compliance across all screens in both light and dark modes.
- **Dependencies**: TASK-016-B.
- **Files/Folders Affected**:
  - `constants/colors.ts`
- **Implementation Requirements**:
  - Contrast ratio >= 7:1 for body text against backgrounds.
  - Contrast ratio >= 4.5:1 for large headings and prominent icons.
  - Interactive card borders must be visually distinct without relying solely on color (use 2px solid outlines).
  - Verify accessibility under Protanopia, Deuteranopia, and Tritanopia color blindness filters.
- **Acceptance Criteria**:
  - 100% of text and card borders pass WCAG AAA automated contrast checks.
- **Validation Method**: Run automated contrast calculation script across all token pairings.
- **Risks**: Subtle sage secondary color failing 7:1 against light gray; adjust shade to deeper green-sage.

---

### TASK-016-D: Screen Reader & Accessibility Traits Integration
- **Objective**: Provide comprehensive TalkBack (Android) and VoiceOver (iOS) labels and hints.
- **Dependencies**: TASK-016-C.
- **Files/Folders Affected**:
  - All components in `components/` and `app/patient/`
- **Implementation Requirements**:
  - Add `accessible={true}`, `accessibilityLabel`, `accessibilityHint`, and `accessibilityRole` to all interactive elements.
  - Memory Match: Announce "Card at row 1, column 2. Currently face down. Double tap to flip."
  - My Day: Announce "Morning blood pressure tablet, scheduled for 9:00 AM. Currently not completed. Double tap to mark done."
- **Acceptance Criteria**:
  - Screen reader can navigate the complete golden path smoothly without confusing unlabelled buttons.
- **Validation Method**: Complete full walkthrough with Android TalkBack enabled.
- **Risks**: Overly verbose labels annoying users; keep descriptions concise, warm, and helpful.

---

### TASK-016-E: Cognitive Load & Calm Pacing Review
- **Objective**: Audit screens to guarantee zero visual clutter, no time pressure, and a calming atmosphere.
- **Dependencies**: TASK-016-D.
- **Files/Folders Affected**:
  - All screens in `app/patient/`
- **Implementation Requirements**:
  - Enforce rule: Max 3–5 simultaneous choices on any patient screen.
  - Zero countdown timers, blinking lights, or rapid animations.
  - Back and Home buttons must remain in predictable, identical screen locations.
- **Acceptance Criteria**:
  - UX checklist signed off confirming minimal cognitive load.
- **Validation Method**: Cognitive walkthrough heuristic evaluation.
- **Risks**: Adding "just one more feature" to patient home; ruthlessly prune non-essential elements.

---

## PHASE 17 — Quality Assurance & Verification

### TASK-017-A: TypeScript Strictness & Typecheck Pipeline
- **Objective**: Verify zero type errors across the entire codebase under strict TypeScript compiler flags.
- **Dependencies**: ALL PRIOR PHASES.
- **Files/Folders Affected**:
  - Entire repository
- **Implementation Requirements**:
  - Run `npx tsc --noEmit`.
  - Zero `any` casts without explicit architect sign-off.
  - Verify all Expo Router typed routes compile cleanly (`experiments.typedRoutes: true`).
- **Acceptance Criteria**:
  - TypeScript compiles with 0 errors and 0 warnings.
- **Validation Method**: Execute `npx tsc --noEmit` in CI/local terminal.
- **Risks**: Untyped third-party packages; write custom ambient declarations (`.d.ts`).

---

### TASK-017-B: ESLint & Code Cleanliness Pipeline
- **Objective**: Enforce code formatting, hooks rules, and import hygiene.
- **Dependencies**: TASK-017-A.
- **Files/Folders Affected**:
  - Entire repository
- **Implementation Requirements**:
  - Execute `npx expo lint`.
  - Fix all React hooks dependency array warnings (`react-hooks/exhaustive-deps`).
  - Ensure zero unused imports or dead variables.
- **Acceptance Criteria**:
  - `npx expo lint` exits with code 0.
- **Validation Method**: Automated lint check.
- **Risks**: False positive warnings on circular component imports; resolve circularities cleanly.

---

### TASK-017-C: Expo Doctor Health Check
- **Objective**: Ensure all native dependencies and configurations are completely aligned with Expo SDK 54.
- **Dependencies**: TASK-017-B.
- **Files/Folders Affected**:
  - `package.json`
  - `app.json`
- **Implementation Requirements**:
  - Execute `npx expo-doctor`.
  - Validate that all dependencies match their official Expo SDK 54 compatible versions.
  - Verify that native configurations for New Architecture (`newArchEnabled: true`) are valid.
- **Acceptance Criteria**:
  - `npx expo-doctor` reports 100% clean check.
- **Validation Method**: Run command and assert zero advisories.
- **Risks**: Version drift in transitive dependencies; pin exact versions.

---

### TASK-017-D: Automated Unit Test Suite Execution
- **Objective**: Execute comprehensive Jest test suite covering DB, AI, games, and state management.
- **Dependencies**: TASK-017-C.
- **Files/Folders Affected**:
  - All test files in `__tests__/`
- **Implementation Requirements**:
  - Run `npm test`.
  - Test coverage:
    - SQLite repositories and migrations (100% schema coverage).
    - Adaptive AI mathematical engine & explainer (100% logic coverage).
    - Memory Match game engine state machine.
    - Localization string dictionary completeness.
- **Acceptance Criteria**:
  - 100% of unit tests pass cleanly.
- **Validation Method**: Jest test runner exit code 0.
- **Risks**: Slow test runs due to SQLite in-memory setup; mock SQLite native bridge appropriately.

---

### TASK-017-E: End-to-End Offline Simulation Testing
- **Objective**: Validate that the complete patient application functions flawlessly with zero internet connectivity.
- **Dependencies**: TASK-017-D.
- **Files/Folders Affected**:
  - Complete application runtime
- **Implementation Requirements**:
  - Place device / emulator into strict Airplane Mode with Wi-Fi disabled.
  - Test sequence:
    1. Cold launch app -> loads splash and navigates to patient home.
    2. Play complete Memory Match session -> evaluates adaptive AI -> displays "Why this level?".
    3. View and listen to family memories -> audio notes play from local cache.
    4. View "My Day" -> mark medicine completed -> undo -> re-mark completed.
    5. View "My Home" cultural stories -> text and regional audio play offline.
    6. Switch to Caregiver dashboard -> local session history and adherence stats render accurately.
- **Acceptance Criteria**:
  - Zero crashes, zero network error popups, zero infinite loading spinners.
- **Validation Method**: Physical or simulated device execution in Airplane Mode.
- **Risks**: Network calls hanging without timeout; ensure all network operations have strict 3-second timeouts and offline short-circuits.

---

### TASK-017-F: Android Device Build & Emulation Verification
- **Objective**: Produce and test a standalone development build / release APK on physical Android hardware.
- **Dependencies**: TASK-017-E.
- **Files/Folders Affected**:
  - `android/`
  - EAS build configuration
- **Implementation Requirements**:
  - Verify build compilation on Android SDK 34/35.
  - Test native capabilities: hardware back button handling, local push notification delivery, haptic vibration engine, audio speaker output.
  - Ensure app cold start is under 2.0 seconds on mid-range Android hardware.
- **Acceptance Criteria**:
  - Release APK installs and runs smoothly on target Android device.
- **Validation Method**: Install APK via ADB and perform live walkthrough.
- **Risks**: Native crash on Android 14 edge-to-edge layout; verify `edgeToEdgeEnabled: true` compatibility in `app.json`.

---

## PHASE 18 — SIH Demo Preparation & Golden Path Rehearsal

### TASK-018-A: Demo Seed Data Generator
- **Objective**: Preload realistic, dignified patient data into SQLite to make the hackathon demonstration immediately compelling.
- **Dependencies**: ALL PRIOR PHASES.
- **Files/Folders Affected**:
  - `src/utils/demo-seed.ts` [NEW]
- **Implementation Requirements**:
  - Seed dataset includes:
    - Patient Profile: "Dharmin (Dada)", Age 72, Region: Assam, Language: Assamese / English.
    - 5 past cognitive sessions with realistic accuracies (80%, 85%, 75%, 90%, 88%) establishing an authentic adaptive history.
    - 4 realistic daily reminders: Morning Blood Pressure (9:00 AM), Midday Hydration (1:00 PM), Afternoon Walk (5:00 PM), Evening Memory Game (7:00 PM).
    - 3 rich personal memories: Son Rahul visiting Majuli, Granddaughter Diya's birthday, Traditional Bihu celebration at ancestral home (with bundled audio clips).
  - Provide hidden 3-tap trigger on settings logo to reset and re-seed clean demo data instantly.
- **Acceptance Criteria**:
  - Fresh demo seed populates SQLite in under 300ms.
  - Allows repeatable, pristine hackathon demonstrations.
- **Validation Method**: Execute seed function and verify all tables populated.
- **Risks**: Seeding wiping live user test data; only allow in development/demo mode.

---

### TASK-018-B: Golden Path Step-by-Step Validation Checklist
- **Objective**: Validate and rehearse the exact SIH presentation flow without a single stutter or placeholder.
- **Dependencies**: TASK-018-A.
- **Files/Folders Affected**:
  - `docs/SIH_DEMO_SCRIPT.md` [NEW]
- **Implementation Requirements**:
  - Execute and verify this EXACT sequential flow:
    1. **Splash Screen**: Warm branding, graceful transition.
    2. **Role Selection**: Select "I am using this for myself" (Patient).
    3. **Language Selection**: Select "Assamese" or "English" with live voice greeting.
    4. **Region Selection**: Select "Assam" (acknowledging distinct North-East identity).
    5. **Accessibility Setup**: Show large text preview and voice guidance enabled.
    6. **Patient Home**: Warm greeting "Good Morning, Dada 🌸", 4 clear cards visible.
    7. **Memory Match**: Launch game -> cards feature Assamese motifs (Xorai, Rhino, Gamusa) -> play match -> soothing celebration.
    8. **Adaptive AI Result**: Display evaluated session metrics derived from real gameplay telemetry.
    9. **"Why this level?"**: Open explainer modal -> show transparent, non-diagnostic reasoning: "Because you matched cards smoothly with 88% accuracy, Level 3 will keep you comfortably engaged."
    10. **My Memories**: Open gallery -> tap family photo -> listen to daughter's soothing voice note.
    11. **My Day Reminder**: View timeline -> mark morning medicine complete -> see gentle green check and encouraging banner.
    12. **Offline Demonstration**: Toggle phone to Airplane Mode -> demonstrate that games, memories, and reminders remain 100% functional.
    13. **Caregiver Dashboard**: Switch to Caregiver view -> show live updated session trends, adherence percentage, and caring non-diagnostic attention indicator.
- **Acceptance Criteria**:
  - Zero placeholder screens or mock alerts encountered along the golden path.
  - Complete flow executes flawlessly in under 5 minutes.
- **Validation Method**: Complete 3 consecutive full rehearsals timed against stopwatch.
- **Risks**: Presenter fumbling screen navigation; document exact presentation script with talking points in `docs/SIH_DEMO_SCRIPT.md`.

---

## Roadmap Summary & Dependency Order Verification

| Phase | Description | Prerequisite Phases | Key Deliverable |
|---|---|---|---|
| **Phase 0** | Repository Cleanup & Engineering Foundation | None | Clean baseline, SDK 54 dependencies, TS strictness |
| **Phase 1** | Design System & Accessible Foundation | Phase 0 | Tokens, WCAG AAA typography, `SmaranButton`, cards |
| **Phase 2** | Splash & Onboarding Flow | Phase 1 | Role, Language, NER Region, A11y, Profile |
| **Phase 3** | Patient Application Shell | Phase 2 | Persistent header/nav, Home, Games Hub, Day, Memories, Care |
| **Phase 4** | Offline Data Architecture | Phase 0, 1 | SQLite client, schema migrations, repositories |
| **Phase 5** | Memory Match (Playable Game) | Phase 1, 4 | Deterministic engine, 5 tiers, real telemetry, audio feedback |
| **Phase 6** | Adaptive AI Engine | Phase 5 | Feature extraction, logistic model, explainer, safety guardrails |
| **Phase 7** | Additional Cognitive Activities | Phase 6 | Pattern Recognition, Routine Recall, multi-game adapter |
| **Phase 8** | My Day (Routines & Reminders) | Phase 4 | Local notifications, timeline, 1-tap completion, hydration |
| **Phase 9** | My Memories (Reminiscence Support) | Phase 4 | Sandboxed photos, voice playback, gentle recall activity |
| **Phase 10** | North-East Regional Localization | Phase 1 | Pluggable NER schema, Assam demo pack, 8-state skeletons |
| **Phase 11** | Voice & Multilingual Experience | Phase 1, 3 | EN/HI/AS string catalogs, Expo Speech, Read Screen button |
| **Phase 12** | Caregiver Application | Phase 4, 6 | Dashboard, trends charts, adherence log, attention alerts |
| **Phase 13** | Offline Synchronization System | Phase 4 | NetInfo monitor, sync queue, conflict resolver, batch worker |
| **Phase 14** | Supabase Backend & Cloud Integration | Phase 13 | PostgreSQL, RLS, Storage, Caregiver Auth & Pairing |
| **Phase 15** | Security & Privacy Hardening | Phase 14 | SecureStore tokens, route guards, validation, privacy audit |
| **Phase 16** | Accessibility Hardening (WCAG AAA) | Phase 1, 3 | 200% dynamic font test, 56px targets, TalkBack integration |
| **Phase 17** | Quality Assurance & Verification | All | TS check, ESLint, Expo Doctor, offline test, Android APK |
| **Phase 18** | SIH Demo Preparation & Golden Path | All | Demo seed generator, 13-step golden path rehearsal |

---

*Document prepared by Lead Software Architect & Engineer for SMARAN AI.*  
*Awaiting user review and authorization to proceed with Phase 0.*
