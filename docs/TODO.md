# SMARAN AI — Engineering Roadmap & Master TODO

> **Status**: Ready for Implementation (Awaiting Phase 0 Approval)  
> **Platform**: React Native (Expo SDK 54, React 19, New Architecture enabled)  
> **Core Architectural Paradigm**: Offline-First, Local SQLite Persistence, On-Device Adaptive AI, Zero-Harm Accessibility, Non-Diagnostic HealthTech  
> **Target Audience**: Elderly individuals experiencing cognitive decline (specifically localized for North-East India) and their family caregivers.

---

## TOMORROW DEMO MVP TRACK

To guarantee a flawless, high-impact Smart India Hackathon (SIH) live presentation, development is strictly split into an immediate **DEMO MVP TRACK** and a **POST-DEMO TRACK**.

### Priority Execution Track (Demo MVP)

| Milestone | Scope | Deliverable & Validation |
|---|---|---|
| **MVP-0** | Foundation & Clean Baseline | Clean Expo 54 skeleton, package renaming, path aliases, console error boundary. Zero cloud dependencies. |
| **MVP-1** | Core Accessible Design System | Color tokens (Teal/Sage/Amber), 18–34px typography scale, 56px+ `SmaranButton`, `SmaranCard`, `ScreenWrapper`, `expo-haptics`. |
| **MVP-2** | Minimal SQLite Foundation | `src/db/client.ts`, bootstrap migration (`001_core_bootstrap.ts`), `patient_profiles` and `patient_settings` tables and repository. |
| **MVP-3** | Splash & Onboarding Flow | Splash $\to$ Role (Patient/Caregiver) $\to$ Language (EN/HI/AS with voice preview) $\to$ Region (Assam featured) $\to$ Accessibility Setup $\to$ Profile Setup (persisted in SQLite). |
| **MVP-4** | Patient Application Shell | Calm Patient Home (`/patient/home`) with 4 primary cards, persistent navigation header with Home/Back/Voice anchors. |
| **MVP-5** | Memory Match (Live Game) | 5 accessibility tiers, 72px+ cards, Assamese motifs, genuine turn-by-turn telemetry (latency, errors, hints), encouraging non-punitive audio feedback. |
| **MVP-6** | Adaptive AI & Explainer | Real telemetry feature extraction, `Adaptive Readiness` evaluation, optional post-session feedback ("Easy / Comfortable / Challenging"), curated allow-listed "Why this level?" modal. |
| **MVP-7** | My Day (Local Routines) | Local timeline (Morning/Afternoon/Evening), 1-tap medicine check-off generating append-only adherence events, visual water tracker. |
| **MVP-8** | My Memories (Reminiscence) | Local sandboxed photo cards, family relationship tags ("Son — Rahul"), audio message playback, gentle photo-recall prompt. |
| **MVP-9** | Assam Cultural Demo Pack | Authentic Assamese motifs (Xorai, Rhino, Gamusa, Tea Leaf), folklore snippets, slow/clear Expo Speech voice narration. |
| **MVP-10** | Local Caregiver Dashboard | Real-time dashboard reading directly from local SQLite: patient status, recent game performance, reminder adherence, non-diagnostic attention indicators. |
| **MVP-11** | Airplane-Mode Offline Verification | Complete golden path executed with Wi-Fi/Cellular disabled. 0 network calls, 0 loading freezes, 100% offline capability. |
| **MVP-12** | Standalone Android Build & Rehearsal | Android APK verified on device, 13-step rehearsed SIH golden path script with explicit distinction between live telemetry and synthetic seed data. |

---

### Post-Demo Track (Deferred unless surplus time permits)

The following modules are explicitly deferred until the Local Demo MVP is 100% complete and verified:
- **Full Supabase Cloud Backend** (PostgreSQL cloud instances, cloud Auth).
- **Remote Cloud Synchronization Transport** (HTTP sync worker, remote replication).
- **Remote Caregiver Pairing & Cloud Auth** (SMS OTP, Supabase Auth sessions).
- **Cloud Media Buckets** (Uploading photos/audio to Supabase Storage).
- **Remaining 7 NER Regional Packs** (Full cultural content beyond Assam skeletons).
- **Additional Cognitive Games** (Pattern Recognition and Routine Recall beyond Memory Match).
- **Automated CI/CD EAS Cloud Pipelines**.

---

## Engineering Principles & Critical Rules

1. **Offline-First Patient Functionality**: The local patient application must be 100% operational without internet connectivity. SQLite is the primary local database, not an ephemeral cache.
2. **Local Before Cloud**: Complete the entire local patient and caregiver experience (Phases 0–12) before introducing cloud dependencies (Phase 14).
3. **Elderly Accessibility is Mandatory Everywhere**: Minimum 56px touch targets (72px+ for primary patient cards), high contrast (WCAG AAA 7:1), 18–34px typography, icon + clear text labels, no hidden gestures, reduced motion support. Accessibility is required in every phase, not just Phase 16.
4. **Strict Medical Safety Boundary**: Never diagnose dementia, stage cognitive impairment, estimate disease severity, prescribe medication, or infer mental state/tiredness. Language must remain encouraging, non-clinical, and strictly observational.
5. **No Fake or Random AI**: Cognitive personalization must rely on genuine recorded session interaction metrics (accuracy, latency, error repetition, hint dependency) processed through an explainable on-device algorithm. No naive heuristics (`if (score > 80) level++`).
6. **Encouraging Feedback Only**: Incorrect responses must receive gentle, reassuring prompts ("Almost! Let's try once more"), never negative or punitive alerts ("WRONG", "FAILED").
7. **Curated Safety Explanations**: Use allow-listed explanation templates populated with measured telemetry rather than unconstrained text generation. Regex scanning serves as a secondary test audit.
8. **Culturally Distinct North-East Content**: North-East India consists of 8 distinct cultures and languages. Regional content packs must decouple cultural assets from game mechanics, starting with an Assam demo pack.
9. **Correct Sync Data Model**: Reminder schedules are mutable versioned records; reminder completions are append-only adherence events. Cognitive sessions are immutable. Sync queue compaction must never drop sessions or completions.
10. **Foundational Security & Privacy**: SecureStore token management, input sanitization, least-data collection, and role isolation must be implemented at the point of feature creation, with Phase 15 acting as an audit and hardening phase.
11. **TypeScript Strictness**: `strict: true` must be maintained across all files without `any` escapes.
12. **Zero Placeholder Screens**: Every screen in the primary SIH demo pathway must be fully implemented and functional.

---

## Master Dependency Graph & Phase Overview

```
PHASE 0: Repository Cleanup & Engineering Foundation (Console Logging, Base Types)
  └── PHASE 1: Design System & Accessible Tokens (expo-haptics, Colors, Typography, SmaranButton)
        └── PHASE 2: Core Database Bootstrap & Patient Onboarding
              ├── Minimal SQLite Client, Migration 001, Patient & Settings Repository (expo-sqlite, expo-secure-store)
              └── Splash, Role, Language (expo-speech), Region, Accessibility Setup, Profile Setup
                    └── PHASE 3: Patient Application Shell (Navigation, Home, Feature Hubs)
                          └── PHASE 4: Extended Offline Data Architecture & Domain Repositories
                                ├── Migration 002 (Sessions, Reminder Schedules, Adherence Events, Memories, Sync Queue)
                                ├── Repositories & Local Storage (expo-file-system)
                                ├── PHASE 5: Memory Match (Playable Engine, Real Telemetry, Optional Feedback)
                                │     └── PHASE 6: Adaptive AI Engine (Adaptive Readiness, Explainer, Guardrails)
                                │           └── PHASE 7: Additional Cognitive Activities [Post-Demo]
                                ├── PHASE 8: My Day (expo-notifications, Timeline, Adherence Events, Hydration)
                                ├── PHASE 9: My Memories (Sandboxed Photos, Audio Player, Gentle Recall)
                                ├── PHASE 10: North-East Localization (Assam Demo Pack, NER Skeletons)
                                └── PHASE 11: Voice & Multilingual Experience (EN/HI/AS Catalogs, Speech Fallback)
                                      └── PHASE 12: Caregiver Application (Local Dashboard, Adherence, Trends)
                                            └── PHASE 13: Offline Synchronization System (NetInfo, Local Queue, Conflict Model)
                                                  └── PHASE 14: Supabase Backend & Remote Sync [Post-Demo]
                                                        └── PHASE 15: Security Hardening & Privacy Audit
                                                              └── PHASE 16: Accessibility Hardening (WCAG AAA Audit)
                                                                    └── PHASE 17: Quality Assurance & Verification
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

### TASK-000-C: Production Dependencies Installation & Alignment (Local Foundation Only)
- **Objective**: Install and lock base local runtime dependencies for state management and layout using exact Expo SDK 54 compatible versions. Keep cloud packages out.
- **Dependencies**: TASK-000-B.
- **Files/Folders Affected**:
  - `package.json`
  - `package-lock.json`
- **Implementation Requirements**:
  - Install dependencies using `npx expo install`:
    - `zustand` (lightweight in-memory client state management)
  - **Explicit Rule**: DO NOT install `@supabase/supabase-js` in Phase 0. Supabase is deferred to Phase 14 (Local Before Cloud).
  - Specific native device packages (`expo-haptics`, `expo-sqlite`, `expo-secure-store`, `expo-speech`, `expo-file-system`, `expo-notifications`, `@react-native-community/netinfo`) will be introduced in the specific phases where their features are built.
- **Acceptance Criteria**:
  - `zustand` present in `package.json` with compatible semver tag.
  - Zero cloud backend dependencies in manifest.
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

### TASK-000-E: Global Error Boundary & Graceful Crash UI (Development/Console Logging)
- **Objective**: Prevent unhandled JavaScript exceptions from crashing the app, displaying an elderly-friendly, calming recovery screen with development console logging.
- **Dependencies**: TASK-000-D.
- **Files/Folders Affected**:
  - `components/error-boundary.tsx` [NEW]
  - `app/_layout.tsx`
- **Implementation Requirements**:
  - Create a React ErrorBoundary wrapping the root stack.
  - Implement a reassuring fallback UI: "Everything is safe. Let's return to your home screen."
  - Provide a large 56px "Return Home" recovery button.
  - **Explicit Rule**: Use `console.error` and in-memory development logging only. Do NOT attempt SQLite error logging in Phase 0 because the database layer does not yet exist. Persistent SQLite error logging will be wired in Phase 4.
- **Acceptance Criteria**:
  - Uncaught component errors trigger the calming fallback screen.
  - Pressing "Return Home" resets state and navigates back to `/`.
  - Zero database calls inside Phase 0 error boundary.
- **Validation Method**: Create a deliberate throw in a test screen and verify console output and UI recovery.
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

### TASK-001-D: Haptics Utility & SmaranButton Component
- **Objective**: Account for `expo-haptics` and build the standard accessible button component with high contrast, tactile feedback, and accessible roles.
- **Dependencies**: TASK-001-C.
- **Files/Folders Affected**:
  - `package.json`
  - `hooks/use-haptics.ts` [NEW]
  - `components/ui/smaran-button.tsx` [NEW]
- **Implementation Requirements**:
  - Verify and install `expo-haptics` before components use haptic feedback.
  - Wrap `expo-haptics` in `useHaptics` hook with support for graceful no-op and user disabling.
  - Variants: `primary` (deep teal), `secondary` (warm sage), `accent` (soft amber), `outline`.
  - Sizes: `normal` (56px height) and `large` (68px height).
  - Explicit pressed state using subtle scaling (`0.98`) and gentle opacity shift.
  - Tactile feedback trigger on tap via `useHaptics`.
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
  - Banner supports voice readout hook trigger.
- **Validation Method**: Automated unit tests checking string dictionary against blacklisted words.
- **Risks**: Text length causing multi-line banner reflow.

---

### TASK-001-G: Reduced Motion System
- **Objective**: Implement centralized hooks to respect device accessibility settings and user preferences for animations.
- **Dependencies**: TASK-001-F.
- **Files/Folders Affected**:
  - `hooks/use-reduced-motion.ts` [NEW]
- **Implementation Requirements**:
  - Detect OS `isReduceMotionEnabled` state and allow user override in Smaran settings.
  - When reduced motion is active, disable spring/timing animations or replace with instant state swaps.
- **Acceptance Criteria**:
  - All custom animations respect `useReducedMotion()`.
- **Validation Method**: Toggle reduced motion in simulator and verify animated components render statically.
- **Risks**: Reanimated worklet crashes if animation configuration evaluates to invalid durations.

---

## PHASE 2 — Core Database Bootstrap & Patient Onboarding

> **Architectural Order Note**: A minimal SQLite client, bootstrap migration, and patient profile/settings persistence must exist *before* onboarding screens run, so that onboarding persists into actual working storage rather than forward-dependent placeholders.

### TASK-002-A: Core SQLite Client & Bootstrap Migration (MVP-2)
- **Objective**: Install `expo-sqlite` and `expo-secure-store`, initialize the local SQLite database client, and execute the core bootstrap schema migration.
- **Dependencies**: PHASE 1.
- **Files/Folders Affected**:
  - `package.json`
  - `src/db/client.ts` [NEW]
  - `src/db/migrations/index.ts` [NEW]
  - `src/db/migrations/001_core_bootstrap.ts` [NEW]
- **Implementation Requirements**:
  - Install `expo-sqlite` and `expo-secure-store` via `npx expo install`.
  - Database file: `smaran_offline.db`.
  - Initialize migration runner with `schema_migrations` table (`version`, `name`, `applied_at`).
  - Migration `001_core_bootstrap.ts` executes within a transaction and creates:
    - `patient_profiles` (`id TEXT PRIMARY KEY`, `user_id TEXT`, `preferred_name TEXT NOT NULL`, `age_bracket TEXT`, `emergency_name TEXT`, `emergency_phone TEXT`, `created_at TEXT`, `updated_at TEXT`)
    - `patient_settings` (`id TEXT PRIMARY KEY`, `patient_id TEXT`, `language TEXT NOT NULL DEFAULT 'en'`, `region TEXT NOT NULL DEFAULT 'assam'`, `text_size TEXT NOT NULL DEFAULT 'large'`, `high_contrast INTEGER NOT NULL DEFAULT 0`, `voice_guidance INTEGER NOT NULL DEFAULT 1`, `reduced_motion INTEGER NOT NULL DEFAULT 0`, `updated_at TEXT`)
  - Enable foreign keys (`PRAGMA foreign_keys = ON;`) and WAL mode (`PRAGMA journal_mode = WAL;`).
- **Acceptance Criteria**:
  - SQLite database initializes on app launch in < 100ms.
  - Core tables verified in `sqlite_master`.
- **Validation Method**: Automated test opening database and verifying table creation.
- **Risks**: Database lock on startup; use single shared connection instance.

---

### TASK-002-B: Patient Profile & Settings Repository (Foundational Security & Validation)
- **Objective**: Provide strongly-typed data access methods for patient profile and settings with built-in input sanitization and secure token storage.
- **Dependencies**: TASK-002-A.
- **Files/Folders Affected**:
  - `src/db/repositories/patient.repository.ts` [NEW]
  - `src/services/secure-storage.service.ts` [NEW]
  - `src/utils/validation.ts` [NEW]
- **Implementation Requirements**:
  - Input validation: Sanitize names (strip HTML/tags, Unicode regional character support), validate Indian phone format (`+91` or 10 digits).
  - Secure storage: Wrap `expo-secure-store` to persist local onboarding flags and auth session identifiers.
  - Repository methods: `getProfile()`, `upsertProfile()`, `getSettings()`, `updateSettings()`.
  - Strictly use parameterized SQL queries to prevent SQL injection.
- **Acceptance Criteria**:
  - Full CRUD operations functional on `patient_profiles` and `patient_settings`.
  - Input validation blocks script injection or malformed data before database write.
- **Validation Method**: Unit tests verifying sanitization and SQLite write/read parity.
- **Risks**: Race conditions during onboarding writes; wrap multi-table updates in transactions.

---

### TASK-002-C: Onboarding State Machine & Storage Hydration
- **Objective**: Manage onboarding step progression in Zustand and hydrate state from SQLite / SecureStore on launch.
- **Dependencies**: TASK-002-B.
- **Files/Folders Affected**:
  - `src/stores/onboarding.store.ts` [NEW]
  - `src/types/onboarding.types.ts` [NEW]
- **Implementation Requirements**:
  - State fields: `role` ('patient' | 'caregiver'), `language` ('en' | 'hi' | 'as'), `region` (8 NER states), `accessibility`, `profile`.
  - Hydrate active state from SQLite `patient_settings` and `patient_profiles` on startup.
  - Expose clean action methods: `setRole()`, `setLanguage()`, `setRegion()`, `setAccessibility()`, `setProfile()`, `completeOnboarding()`.
- **Acceptance Criteria**:
  - Store holds validated onboarding state.
  - State hydrates automatically from SQLite.
- **Validation Method**: Unit tests for store mutations and persistence hydration.
- **Risks**: Incomplete hydration flashing onboarding on return users; hold splash until hydrated.

---

### TASK-002-D: Calming Splash Screen & Route Resolution
- **Objective**: Deliver a dignified splash screen with the Smaran AI identity that resolves routing based on real persisted SQLite state.
- **Dependencies**: TASK-002-C.
- **Files/Folders Affected**:
  - `app/index.tsx` [MODIFY]
  - `assets/images/smaran-logo.png` [NEW]
- **Implementation Requirements**:
  - Calming teal logo with tagline: "Smaran AI — Mindful Memory & Daily Care".
  - Subtitle: "Thoughtfully crafted for you and your family".
  - Query SQLite: if onboarding is complete and profile exists, route to `/patient/home` (or `/caregiver/dashboard`); if not, route to `/onboarding/role`.
  - Smooth 600ms fade transition; zero jarring dismissals.
- **Acceptance Criteria**:
  - Splash stays visible for minimum 1.0s while database initializes.
  - Correctly routes based on persisted SQLite onboarding status.
- **Validation Method**: Test both initial clean launch and return-user launch.
- **Risks**: App freeze if database query hangs; implement 3s fallback timeout.

---

### TASK-002-E: Role Selection Screen
- **Objective**: Allow users or family members to choose between Patient and Caregiver modes with large, distinct, accessible cards.
- **Dependencies**: TASK-002-D.
- **Files/Folders Affected**:
  - `app/onboarding/role.tsx` [NEW]
- **Implementation Requirements**:
  - Two prominent cards (height >= 120px):
    1. "I am using this for myself" (Patient mode — gentle teal theme).
    2. "I am caring for someone" (Caregiver mode — warm sage theme).
  - Clear explanations below each choice; large "Continue" button.
  - Saves selection in `onboarding.store` and routes to `/onboarding/language`.
- **Acceptance Criteria**:
  - Only 2 primary options on screen (minimal cognitive load).
  - Selected role persisted to state.
- **Validation Method**: Manual UI test and navigation transition verification.
- **Risks**: Accidental role selection; provide clear Back navigation.

---

### TASK-002-F: Multilingual Selection Screen (Expo Speech Preview)
- **Objective**: Present language choices with native script typography and audible voice preview.
- **Dependencies**: TASK-002-E.
- **Files/Folders Affected**:
  - `package.json`
  - `app/onboarding/language.tsx` [NEW]
  - `src/constants/languages.ts` [NEW]
  - `src/services/speech.service.ts` [NEW]
- **Implementation Requirements**:
  - Install `expo-speech` via `npx expo install`.
  - Languages: English ("English"), Hindi ("हिन्दी"), Assamese ("অসমীয়া").
  - Speaker icon plays gentle audio greeting: "Namaste / Welcome / নমস্কাৰ" at slow articulation (rate: `0.8`).
  - Card touch target >= 72px height.
  - Selected language immediately updates active locale in `patient_settings`.
- **Acceptance Criteria**:
  - Tapping language card plays audio greeting and updates active locale.
  - Settings persisted to SQLite.
- **Validation Method**: Test audio trigger and inspect SQLite `patient_settings.language`.
- **Risks**: Missing TTS engine; wrap in graceful speech error catch.

---

### TASK-002-G: North-Eastern Region (NER) Selection Screen
- **Objective**: Enable selection of the user's home state across the North-East to localize cultural imagery and motifs.
- **Dependencies**: TASK-002-F.
- **Files/Folders Affected**:
  - `app/onboarding/region.tsx` [NEW]
  - `src/constants/regions.ts` [NEW]
- **Implementation Requirements**:
  - All 8 NER states presented: Assam (Featured demo with Rhino/Gamusa icon), Arunachal Pradesh, Manipur, Meghalaya, Mizoram, Nagaland, Sikkim, Tripura.
  - Explanatory subtitle: "We celebrate the unique heritage of each state in the North-East."
  - Never group NER into a single homogeneous category.
  - Selected region persists to SQLite `patient_settings.region`.
- **Acceptance Criteria**:
  - All 8 states selectable.
  - Assam selected by default for demo.
  - Persisted in SQLite.
- **Validation Method**: Verify selected region row in SQLite `patient_settings`.
- **Risks**: Vertical list scrolling; keep card layout spacious and clean.

---

### TASK-002-H: Accessibility Preferences Setup Screen
- **Objective**: Allow elderly users or caregivers to configure visual and audio assistance before reaching the main app.
- **Dependencies**: TASK-002-G.
- **Files/Folders Affected**:
  - `app/onboarding/accessibility.tsx` [NEW]
- **Implementation Requirements**:
  - Controls:
    - Text Size: Standard | Large | Extra Large (with live preview text)
    - High Contrast: On | Off
    - Voice Guidance: Read instructions automatically (On | Off)
    - Reduced Motion: Calm transitions only (On | Off)
  - Pre-configure defaults to elderly-friendly settings (Large text, Voice Guidance On).
  - Persist choices to SQLite `patient_settings`.
- **Acceptance Criteria**:
  - Changing text size immediately re-renders the live preview box.
  - Settings saved to SQLite.
- **Validation Method**: Visual check of dynamic font preview and SQLite query check.
- **Risks**: Overwhelming options; format into 4 spaced toggle rows.

---

### TASK-002-I: Patient Profile Setup Screen
- **Objective**: Collect essential non-clinical details with validated inputs and persist directly to SQLite.
- **Dependencies**: TASK-002-H.
- **Files/Folders Affected**:
  - `app/onboarding/profile.tsx` [NEW]
- **Implementation Requirements**:
  - Fields:
    - Preferred Name / Nickname (e.g., "Dharmin" or "Dada / Aita")
    - Age bracket (60-70, 70-80, 80+) — optional, non-clinical
    - Emergency contact name & phone number
  - Large keyboard-friendly text inputs (height >= 60px, font >= 20px).
  - On submit: validate inputs via `validation.ts`, execute `patientRepository.upsertProfile()`, mark onboarding completed in SecureStore, route to `/patient/home`.
- **Acceptance Criteria**:
  - Profile saved directly to SQLite `patient_profiles` table.
  - App navigates to `/patient/home`.
- **Validation Method**: Verify newly inserted row in SQLite and subsequent route arrival.
- **Risks**: Virtual keyboard covering input; wrap in `KeyboardAvoidingView`.

---

## PHASE 3 — Patient Application Shell

### TASK-003-A: Patient Navigation Shell & Master Layout
- **Objective**: Implement the persistent patient top/bottom layout with simple, unambiguous navigation anchors and basic role route protection.
- **Dependencies**: PHASE 2.
- **Files/Folders Affected**:
  - `app/patient/_layout.tsx` [NEW]
  - `components/navigation/patient-header.tsx` [NEW]
  - `components/navigation/patient-bottom-bar.tsx` [NEW]
- **Implementation Requirements**:
  - Top Header: Always displays "Home", Emergency Contact speed-dial button, and "Read Screen" voice assist button.
  - Bottom Navigation Bar: Fixed, high-contrast bar with 4 core icons + text:
    1. Home (`/patient/home`)
    2. My Day (`/patient/day`)
    3. My Memories (`/patient/memories`)
    4. Train Mind (`/patient/games`)
  - Touch target >= 64px for bottom bar items.
  - Role guard: If active role is not `'patient'`, safely redirect to caregiver dashboard.
- **Acceptance Criteria**:
  - Navigation bar fixed at bottom with prominent active state.
  - "Home" button accessible from all nested screens.
- **Validation Method**: Tab switching test with TalkBack enabled.
- **Risks**: Screen real estate on smaller devices; ensure bottom bar height is balanced.

---

### TASK-003-B: Patient Home Screen (MVP-4)
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
    2. **My Day**: "Next: Morning Medicine at 9:00 AM" (Live reminder summary)
    3. **My Memories**: "Visit family moments & photos"
    4. **My Home**: "Explore stories & songs from Assam"
  - Generous vertical card layout (height >= 84px per card).
- **Acceptance Criteria**:
  - Greeting dynamically reflects morning/afternoon/evening.
  - Cards navigate to respective feature hubs.
  - Strictly follows max 3–5 simultaneous choices rule.
- **Validation Method**: Visual verification and usability walkthrough.
- **Risks**: Clutter from too many reminder details; display only the immediate next reminder.

---

### TASK-003-C: "Train My Mind" Cognitive Hub Screen
- **Objective**: Provide a welcoming entryway for cognitive activities, displaying the personalized recommendation.
- **Dependencies**: TASK-003-B.
- **Files/Folders Affected**:
  - `app/patient/games/index.tsx` [NEW]
- **Implementation Requirements**:
  - Top featured card: "Today's Recommended Activity" (Memory Match, with difficulty recommended by Adaptive AI).
  - "Why this activity?" chip opening the transparent explanation modal.
  - Secondary activities list (Pattern Recognition, Routine Recall) with clear status tags.
  - Calm copy: "Take your time. There are no timers or scores to worry about."
- **Acceptance Criteria**:
  - Featured game card routes directly to `/patient/games/memory-match`.
  - Explainer chip opens `/patient/games/why-level` modal.
- **Validation Method**: Route transition and accessibility label verification.
- **Risks**: Information overload; keep secondary games subdued.

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
  - Audio button on each reminder: reads out reminder details.
- **Acceptance Criteria**:
  - Completed items display gentle green checkmark with "Done! ❤️".
  - One-tap toggle to mark complete or undo.
- **Validation Method**: Checklist interaction tests.
- **Risks**: Double-taps; debounce touch events by 500ms.

---

### TASK-003-E: "My Memories" Reminiscence Hub Screen
- **Objective**: Display family photos, loved ones, and personal memory cards in a gentle gallery.
- **Dependencies**: TASK-003-B.
- **Files/Folders Affected**:
  - `app/patient/memories/index.tsx` [NEW]
  - `components/memories/memory-card.tsx` [NEW]
- **Implementation Requirements**:
  - Grid of large, rounded memory cards with photos of family members and life moments.
  - Card displays photo, name, and relationship tag ("Rahul — Your Son").
  - Tapping opens detailed reminiscence view with voice message playback.
- **Acceptance Criteria**:
  - Photos render with high quality and cached local storage.
  - Accessible name and relationship announced by screen reader.
- **Validation Method**: Render gallery with sample memories and verify responsiveness.
- **Risks**: High-resolution image lag; use thumbnail resizing.

---

### TASK-003-F: "My Home" Cultural Connection Hub Screen
- **Objective**: Celebrate North-Eastern heritage with state-specific cultural content (Assam demo).
- **Dependencies**: TASK-003-B.
- **Files/Folders Affected**:
  - `app/patient/regional/index.tsx` [NEW]
  - `components/regional/cultural-tile.tsx` [NEW]
- **Implementation Requirements**:
  - Content sections for Assam: Folk Tales & Proverbs, Cultural Symbols, Flora & Fauna, Soothing ambient melodies.
  - Voice narration available for every cultural snippet.
- **Acceptance Criteria**:
  - Content authentically reflects selected region (Assam).
  - Cultural assets load completely offline from local bundle.
- **Validation Method**: Offline mode verification with audio playback.
- **Risks**: Audio format incompatibilities; use AAC/M4A format.

---

### TASK-003-G: "My Care" Wellbeing & Support Hub Screen
- **Objective**: Give the patient immediate access to caregiver contact info and simple daily check-ins.
- **Dependencies**: TASK-003-B.
- **Files/Folders Affected**:
  - `app/patient/care/index.tsx` [NEW]
- **Implementation Requirements**:
  - Caregiver card: Photo, Name, "Your Primary Caregiver".
  - Large 68px "Call [Caregiver Name]" button (native phone call via `expo-linking`).
  - Emergency SOS speed-dial button.
  - "How are you feeling today?" simple 3-mood check-in (Peaceful, Okay, Tired) storing non-diagnostic comfort logs.
- **Acceptance Criteria**:
  - Phone call triggers correctly with confirmation dialog.
  - Mood check-in provides immediate warm reassuring quote.
- **Validation Method**: Test `Linking.openURL('tel:...')` handler.
- **Risks**: Accidental emergency dialing; require confirmation step.

---

## PHASE 4 — Extended Offline Data Architecture & Domain Repositories

### TASK-004-A: Domain Schema Migration (Migration 002)
- **Objective**: Expand the SQLite database with the full domain schema for sessions, reminder schedules, append-only adherence events, memories, and sync tracking.
- **Dependencies**: PHASE 2, PHASE 3.
- **Files/Folders Affected**:
  - `src/db/migrations/002_domain_schema.ts` [NEW]
  - `src/db/schema.types.ts` [NEW]
- **Implementation Requirements**:
  - Execute within a transaction:
    - `cognitive_sessions` (`id TEXT PRIMARY KEY`, `patient_id TEXT`, `game_type TEXT`, `difficulty_level INTEGER`, `accuracy REAL`, `total_time_ms INTEGER`, `mistake_count INTEGER`, `hint_count INTEGER`, `user_feedback TEXT`, `raw_events_json TEXT`, `is_demo_seed INTEGER NOT NULL DEFAULT 0`, `created_at TEXT`, `synced INTEGER NOT NULL DEFAULT 0`)
    - `reminders` (Mutable schedule definitions: `id TEXT PRIMARY KEY`, `patient_id TEXT`, `title TEXT`, `category TEXT`, `scheduled_time TEXT`, `recurrence TEXT`, `version INTEGER NOT NULL DEFAULT 1`, `updated_at TEXT`, `synced INTEGER NOT NULL DEFAULT 0`)
    - `reminder_completions` (Append-only adherence events: `id TEXT PRIMARY KEY`, `reminder_id TEXT`, `patient_id TEXT`, `completed_at TEXT NOT NULL`, `synced INTEGER NOT NULL DEFAULT 0`)
    - `personal_memories` (`id TEXT PRIMARY KEY`, `patient_id TEXT`, `person_name TEXT`, `relationship TEXT`, `description TEXT`, `photo_uri TEXT`, `audio_uri TEXT`, `memory_date TEXT`, `synced INTEGER NOT NULL DEFAULT 0`)
    - `adaptive_model_state` (`id TEXT PRIMARY KEY`, `patient_id TEXT`, `game_type TEXT`, `weights_json TEXT`, `bias REAL`, `session_count INTEGER`, `updated_at TEXT`)
    - `sync_queue` (`id TEXT PRIMARY KEY`, `table_name TEXT`, `record_id TEXT`, `action TEXT`, `payload_json TEXT`, `status TEXT`, `retry_count INTEGER`, `created_at TEXT`)
    - `app_error_logs` (`id TEXT PRIMARY KEY`, `error_message TEXT`, `stack_trace TEXT`, `created_at TEXT`)
- **Acceptance Criteria**:
  - Migration executes cleanly and idempotently.
  - Proper foreign keys and indexes on `patient_id`, `created_at`, `synced`.
- **Validation Method**: Inspect table structure and test rollback in unit test.
- **Risks**: Schema lock during execution; wrap in atomic transaction.

---

### TASK-004-B: Cognitive Sessions Repository (Demo Seed Transparency)
- **Objective**: Persist and query cognitive activity sessions, supporting transparent differentiation between live runtime telemetry and synthetic demo seed data.
- **Dependencies**: TASK-004-A.
- **Files/Folders Affected**:
  - `src/db/repositories/cognitive.repository.ts` [NEW]
- **Implementation Requirements**:
  - Methods: `saveSession(sessionData)`, `getRecentSessions(gameType, limit)`, `getAllSessionStats()`, `getUnsyncedSessions()`.
  - Field `is_demo_seed`: Live gameplay always writes `is_demo_seed = 0`. Preloaded demo history writes `is_demo_seed = 1`.
  - Transactional insert into both `cognitive_sessions` and `sync_queue`.
  - Sessions are strictly append-only and immutable.
- **Acceptance Criteria**:
  - Session records written safely in < 50ms.
  - Queries can filter by `is_demo_seed` to ensure transparency during SIH evaluation.
- **Validation Method**: Automated unit tests saving both live and seed sessions.
- **Risks**: Payload serialization overhead; optimize JSON parsing.

---

### TASK-004-C: Reminders Schedule & Adherence Repositories (Split Semantics)
- **Objective**: Separate mutable reminder schedule operations from append-only reminder completion events.
- **Dependencies**: TASK-004-A.
- **Files/Folders Affected**:
  - `src/db/repositories/reminders.repository.ts` [NEW]
  - `src/db/repositories/adherence.repository.ts` [NEW]
- **Implementation Requirements**:
  - `RemindersRepository`: Manages schedules (`addReminder`, `updateSchedule`, `deleteReminder`). Increments `version` and enqueues `UPDATE` sync events.
  - `AdherenceRepository`: Manages completions (`recordCompletion(reminderId, timestamp)`, `undoCompletion(reminderId)`). Writes append-only completion records to `reminder_completions` and enqueues `INSERT` sync events.
  - **Rule**: Patient completion events NEVER overwrite a caregiver's updated reminder schedule.
- **Acceptance Criteria**:
  - Schedules and completions managed in distinct, dedicated repositories.
  - Correct adherence percentage calculated: $(\text{completedEvents} / \text{scheduledCount}) \times 100$.
- **Validation Method**: Unit test verifying schedule updates do not delete adherence history.
- **Risks**: Orphaned completion records if a reminder is deleted; use soft delete (`is_deleted = 1`).

---

### TASK-004-D: Personal Memories Repository & File Storage
- **Objective**: Account for `expo-file-system` and manage local sandboxed photo/audio storage linked to SQLite memory records.
- **Dependencies**: TASK-004-A.
- **Files/Folders Affected**:
  - `package.json`
  - `src/services/file-storage.service.ts` [NEW]
  - `src/db/repositories/memories.repository.ts` [NEW]
- **Implementation Requirements**:
  - Install `expo-file-system` via `npx expo install`.
  - Helper functions to copy photos to `FileSystem.documentDirectory + 'memories/images/'` and audio to `memories/audio/'`.
  - Repository methods: `getAllMemories()`, `getMemoryById(id)`, `addMemory()`, `updateMemory()`.
  - Store relative file paths so paths remain valid across app updates.
- **Acceptance Criteria**:
  - Memories load reliably offline from local filesystem sandbox.
- **Validation Method**: Save sample image, query URI, render in Image component.
- **Risks**: Storage space exhaustion; compress images to max 1080p.

---

### TASK-004-E: Adaptive AI Model State Repository
- **Objective**: Persist and restore per-patient mathematical weights, biases, and hyperparameters.
- **Dependencies**: TASK-004-A.
- **Files/Folders Affected**:
  - `src/db/repositories/adaptive-ai.repository.ts` [NEW]
- **Implementation Requirements**:
  - Methods: `getModelState(gameType)`, `saveModelState(gameType, weights, bias, sessionCount)`.
  - Initialize default weights on first run if no state exists.
  - Guarantee atomic updates to prevent weight corruption.
- **Acceptance Criteria**:
  - Model weights persist across restarts with exact precision.
- **Validation Method**: Save floating-point vector, reload, and assert `toBeCloseTo()`.
- **Risks**: Floating point serialization rounding issues; use strict precision formatting.

---

### TASK-004-F: Persistent SQLite Error Logger
- **Objective**: Wire up persistent SQLite crash and error logging now that the database layer exists.
- **Dependencies**: TASK-004-A.
- **Files/Folders Affected**:
  - `src/services/logger.service.ts` [NEW]
  - `components/error-boundary.tsx` [MODIFY]
- **Implementation Requirements**:
  - Create logger service writing uncaught exceptions to `app_error_logs`.
  - Connect `ErrorBoundary` to logger service without exposing technical stack traces to the patient.
- **Acceptance Criteria**:
  - Uncaught UI errors logged to SQLite table for debugging.
  - Patient sees only calming recovery screen.
- **Validation Method**: Trigger test error and assert new row in `app_error_logs`.
- **Risks**: Logger throwing error when handling an error; wrap logger in try/catch.

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

### TASK-005-B: Difficulty Matrix & Cultural Asset Configuration
- **Objective**: Parameterize 5 gentle difficulty tiers tailored for elderly accessibility using Assamese motifs.
- **Dependencies**: TASK-005-A.
- **Files/Folders Affected**:
  - `src/games/memory-match/difficulty.ts` [NEW]
  - `src/games/memory-match/assets.ts` [NEW]
- **Implementation Requirements**:
  - Tier 1: 2x2 grid (2 pairs, 4 cards) — introductory
  - Tier 2: 2x3 grid (3 pairs, 6 cards) — gentle
  - Tier 3: 2x4 grid (4 pairs, 8 cards) — moderate
  - Tier 4: 3x4 grid (6 pairs, 12 cards) — engaging
  - Tier 5: 4x4 grid (8 pairs, 16 cards) — advanced
  - Assets: Assamese Rhino, Gamusa, Tea Cup, Lotus, Xorai.
- **Acceptance Criteria**:
  - Grid scales correctly per tier. Minimum card size >= 56px on all tiers (>= 72px on Tiers 1–3).
- **Validation Method**: Layout verification across screen widths.
- **Risks**: Card shrinkage on small screens; clamp grid width.

---

### TASK-005-C: Real-Time Telemetry & Behavioral Metric Capture
- **Objective**: Accurately capture granular behavioral interaction metrics required by the adaptive AI engine.
- **Dependencies**: TASK-005-B.
- **Files/Folders Affected**:
  - `src/games/memory-match/telemetry.ts` [NEW]
- **Implementation Requirements**:
  - Metrics collected:
    - `responseTimePerTurn`: Array of millisecond timestamps between flips
    - `totalMistakes`: Total unmatched pair attempts
    - `repeatedMistakes`: Attempts on the exact same unmatched pair (indicators of working memory load)
    - `hintsUsed`: Number of times the patient tapped "Give me a hint"
    - `idleTimeBeforeFirstFlip`: Latency before initiating interaction
    - `accuracy`: `(matchedPairs / totalAttempts) * 100`
  - Strict Rule: No synthetic or fabricated metrics: values must be derived strictly from real user touches.
- **Acceptance Criteria**:
  - Telemetry object correctly populated at the conclusion of every session.
- **Validation Method**: Unit tests asserting telemetry accuracy against simulated user touch events.
- **Risks**: Clock drift if app is backgrounded; pause timing on background state.

---

### TASK-005-D: Memory Match UI & Accessible Card Grid (MVP-5)
- **Objective**: Build the visual, tactile game board with large cards, haptic feedback, and calm animations.
- **Dependencies**: TASK-005-C.
- **Files/Folders Affected**:
  - `app/patient/games/memory-match.tsx` [NEW]
  - `components/games/memory-card.tsx` [NEW]
- **Implementation Requirements**:
  - Card touch target >= 72px x 72px on Tiers 1–3, >= 56px on Tiers 4–5.
  - Smooth card flip animation using Reanimated (instant flip fallback if Reduced Motion is enabled).
  - Tactile haptic buzz on flip via `useHaptics`.
  - Prominent "Hint" button with glowing border around a matching pair.
  - Safe "Leave Game" button returning to home with zero penalty.
- **Acceptance Criteria**:
  - Cards flip smoothly without frame drops.
  - Accessible screen reader labels state card position and flip state.
- **Validation Method**: Play test across device viewports.
- **Risks**: Animation glitches on layout recalculation; test on Android emulator.

---

### TASK-005-E: Optional Post-Session Feedback & Soothing Celebration
- **Objective**: Provide soothing completion feedback and an accessible, optional 1-tap feedback prompt.
- **Dependencies**: TASK-005-D.
- **Files/Folders Affected**:
  - `components/games/game-celebration-modal.tsx` [NEW]
  - `components/games/post-activity-feedback.tsx` [NEW]
- **Implementation Requirements**:
  - Match event: Gentle green pulse, soft chime sound, warm text: "You found a match! 🌸"
  - Mismatch event: Gentle wobble, warm text: "Almost! Let's try once more." (zero failure language).
  - Celebration Modal:
    - Banner: "Wonderful memory work! ❤️"
    - Summary: "You completed this in [X] gentle steps."
    - Optional Feedback Question: **"How did this activity feel?"**
    - 3 large accessible buttons (height >= 56px):
      - **"Easy"**
      - **"Comfortable"**
      - **"A little challenging"**
    - "Skip" option available; zero forced input.
- **Acceptance Criteria**:
  - Post-activity feedback captured if tapped, or marked `SKIPPED` if bypassed.
  - Zero punitive language or failure cues.
- **Validation Method**: Test both feedback selection and skip paths.
- **Risks**: Patient feeling tested; keep feedback phrasing warm and completely optional.

---

### TASK-005-F: Session Persistence & Live Data Tagging
- **Objective**: Write completed game session telemetry to SQLite with `is_demo_seed = 0`.
- **Dependencies**: TASK-005-E, TASK-004-B.
- **Files/Folders Affected**:
  - `src/games/memory-match/session-service.ts` [NEW]
- **Implementation Requirements**:
  - Write record to `cognitive_sessions`: `game_type: 'memory-match'`, `difficulty_level`, `accuracy`, `total_time_ms`, `mistake_count`, `hint_count`, `user_feedback`, `is_demo_seed: 0`.
  - Pass saved session record to Adaptive AI engine for evaluation.
- **Acceptance Criteria**:
  - Session verified in SQLite within 100ms of game completion.
  - Tagged explicitly as genuine live data (`is_demo_seed = 0`).
- **Validation Method**: Query SQLite table directly post-game.
- **Risks**: App termination before save; execute save synchronously on modal launch.

---

## PHASE 6 — Adaptive AI Engine (Explainable On-Device Personalization)

### TASK-006-A: Feature Extraction Pipeline (Patient-Relative Baseline)
- **Objective**: Convert raw game telemetry into normalized mathematical feature vectors without clinical age baselines.
- **Dependencies**: PHASE 5.
- **Files/Folders Affected**:
  - `src/ai/feature-extractor.ts` [NEW]
  - `src/ai/types.ts` [NEW]
- **Implementation Requirements**:
  - **Explicit Rule**: Do NOT use an "age-appropriate response latency baseline". We have no clinical age baseline.
  - Normalize response pace strictly using:
    1. The patient's own previous session history (moving average of last 5 sessions).
    2. A neutral cold-start/default calibration for new patients.
    3. Game-specific interaction complexity (number of cards on board).
  - Normalized features (range `[0.0, 1.0]`):
    - $x_1$ (`accuracy`): Normalized accuracy score.
    - $x_2$ (`relative_pace`): Normalized response pace relative to patient's personal moving average and cold-start baseline.
    - $x_3$ (`working_memory_score`): $1.0 - (\text{repeated\_mistakes} / \text{total\_turns})$.
    - $x_4$ (`independence_score`): $1.0 - (\text{hints\_used} / \text{total\_pairs})$.
    - $x_5$ (`stability_trend`): Performance change relative to patient's recent moving average.
- **Acceptance Criteria**:
  - Pure mathematical function returning clean 5-dimensional feature vector.
  - Fully guarded against division by zero and NaN values.
- **Validation Method**: Unit tests running edge-case inputs (0 turns, 100% mistakes, 0 hints).
- **Risks**: Cold-start distortion; default calibration values must be neutral and forgiving.

---

### TASK-006-B: Adaptive Readiness Model & Explainable Algorithm (MVP-6)
- **Objective**: Implement the on-device mathematical difficulty recommendation model using neutral engineering terminology.
- **Dependencies**: TASK-006-A.
- **Files/Folders Affected**:
  - `src/ai/adaptive-engine.ts` [NEW]
- **Implementation Requirements**:
  - Neutral Terminology: Rename internal index to **`Adaptive Readiness`** (or `Activity Fit Probability`). Do NOT use medical-sounding terms like "Cognitive Engagement Index".
  - Core algorithm: Multi-factor weighted logistic model:
    $$\text{Adaptive Readiness} = \sigma\left( \sum_{i=1}^5 w_i x_i + b \right)$$
    where $\sigma(z) = \frac{1}{1 + e^{-z}}$ is the logistic sigmoid mapping to $[0.0, 1.0]$.
  - Difficulty mapping:
    - $\text{Readiness} < 0.35$: Recommend lower difficulty (gentler support, fewer cards).
    - $0.35 \le \text{Readiness} \le 0.75$: Maintain current difficulty (optimal engagement zone).
    - $\text{Readiness} > 0.75$: Recommend next difficulty level (+1 tier).
  - Step limit: Max difficulty change is strictly $+1$ or $-1$ per session.
  - Do NOT implement fake `if (score > 80) level++`.
  - **Explicit Rule**: Never display a numerical clinical-sounding score to patients.
- **Acceptance Criteria**:
  - Model produces deterministic difficulty recommendation and factor contribution scores ($w_i x_i$).
  - Zero clinical terminology in code or outputs.
- **Validation Method**: Run 100 synthetic test cases across varying accuracies and latencies.
- **Risks**: Weight divergence; clamp weights within $[-2.0, 2.0]$.

---

### TASK-006-C: Per-Patient Model State & Online Learning
- **Objective**: Adapt model weights locally using optional patient feedback as target signal, with documented conservative fallback.
- **Dependencies**: TASK-006-B, TASK-004-E.
- **Files/Folders Affected**:
  - `src/ai/online-trainer.ts` [NEW]
- **Implementation Requirements**:
  - Target signal derivation:
    - If patient selected **"Easy"**: Target = $0.90$ (encourages gentle progression).
    - If patient selected **"Comfortable"**: Target = $0.55$ (maintains steady engagement).
    - If patient selected **"A little challenging"**: Target = $0.25$ (recommends gentler support).
    - If feedback was **Skipped**: Use documented conservative fallback derived strictly from observed interaction metrics (high accuracy & fast pace $\implies 0.75$; low accuracy & many hints $\implies 0.30$; else $0.50$). Do NOT fabricate guesses about the patient's feelings.
  - Online gradient descent update:
    $$w_i \leftarrow w_i + \eta \cdot (\text{target} - \text{predicted}) \cdot x_i$$
    where $\eta = 0.05$ (conservative learning rate ensuring gradual adaptation).
  - Persist updated weights and session count to SQLite `adaptive_model_state`.
- **Acceptance Criteria**:
  - Weights update incrementally post-session.
  - Documented fallback behaves deterministically when feedback is skipped.
- **Validation Method**: Automated unit tests simulating feedback vs skipped feedback runs.
- **Risks**: Over-adaptation on a single anomalous session; conservative $\eta = 0.05$ prevents over-reaction.

---

### TASK-006-D: Curated Allow-Listed Explanation Architecture (No Unsupported Inferences)
- **Objective**: Generate transparent natural language explanations using pre-approved, allow-listed templates describing observed interaction behavior only.
- **Dependencies**: TASK-006-C.
- **Files/Folders Affected**:
  - `src/ai/explainer.ts` [NEW]
  - `src/constants/explanation-templates.ts` [NEW]
- **Implementation Requirements**:
  - **Explicit Rule**: The adaptive engine may NOT infer tiredness, cognitive decline, dementia progression, mental state, or disease severity.
  - Replace speculative language like *"You seemed a bit tired today"* with:
    *"This activity needed a little more support today, so we'll keep the next one gentle."*
  - Curated template library:
    - High accuracy: *"You matched the cards smoothly with great confidence."*
    - Steady pacing: *"You took your time and found the cards comfortably."*
    - High independence: *"You remembered the pairs independently today."*
    - More support needed: *"This activity needed a little more support today, so we'll keep the next one gentle."*
  - Multilingual support: Templates available in English, Hindi, and Assamese.
  - Explanations describe observed interaction behavior only.
- **Acceptance Criteria**:
  - 100% of explanation outputs use allow-listed templates.
  - Zero inference of tiredness, mood, or clinical cognitive decline.
- **Validation Method**: Unit tests asserting explanation strings against allow-list and safety dictionary.
- **Risks**: Template repetition; maintain 3 variations of each allow-listed template.

---

### TASK-006-E: "Why This Level?" Modal UI
- **Objective**: Build the accessible explanation modal allowing patients and caregivers to inspect AI recommendations.
- **Dependencies**: TASK-006-D.
- **Files/Folders Affected**:
  - `app/patient/games/why-level.tsx` [NEW]
  - `components/ai/factor-breakdown-card.tsx` [NEW]
- **Implementation Requirements**:
  - Header: "Why Level [N] for You?"
  - Reassuring summary banner with natural language explanation from allow-listed template.
  - Visual factor breakdown: 3 simple progress bars (Accuracy, Pacing, Independence) without technical formulas.
  - Voice button: reads explanation aloud in the patient's language.
  - Mandatory disclaimer: "Smaran AI personalizes activities to keep your mind active and relaxed. This is not a medical evaluation."
- **Acceptance Criteria**:
  - Modal renders in < 100ms when opened.
  - Voice readout reads the full explanation accurately.
- **Validation Method**: End-to-end flow test from game completion to explanation modal.
- **Risks**: Text clipping on small screens; body must be scrollable.

---

### TASK-006-F: Automated Safety Guardrail & Test Verification
- **Objective**: Provide automated regex scanning and unit test assertions verifying that no clinical or diagnostic language can ever be generated.
- **Dependencies**: TASK-006-E.
- **Files/Folders Affected**:
  - `src/ai/safety-guardrails.ts` [NEW]
  - `src/ai/__tests__/adaptive-engine.test.ts` [NEW]
  - `src/ai/__tests__/online-trainer.test.ts` [NEW]
- **Implementation Requirements**:
  - Secondary automated scanner regex blocking prohibited terms: `dementia`, `alzheimer`, `mild cognitive impairment`, `mci`, `diagnosis`, `stage`, `deterioration`, `clinical`, `score`, `failed`, `tired`, `tiredness`, `mental state`, `deficient`.
  - Test suites:
    1. Zero input telemetry -> Handles gracefully without NaN.
    2. High accuracy / comfortable feedback -> Recommends gradual +1 level increment.
    3. Repeated difficulty -> Recommends gentle step down without dropping below Level 1.
    4. 500-session continuous simulation -> Weights remain bounded in $[-2.0, 2.0]$.
    5. Allow-list compliance -> 100% of generated explanations match pre-approved templates.
- **Acceptance Criteria**:
  - All unit tests pass with 0 failures under `npm test`.
- **Validation Method**: Execute Jest test runner.
- **Risks**: Regex false positives; define word boundaries carefully (`\b`).

---

## PHASE 7 — Additional Cognitive Activities [Post-Demo]

> **Priority Note**: Memory Match is the primary cognitive activity for the SIH demo. Phase 7 activities are implemented only after the core demo flow is verified.

### TASK-007-A: Pattern Recognition Game Engine & Motifs
- **Objective**: Implement visual sequence and pattern completion mechanics using Assamese motifs.
- **Dependencies**: PHASE 6.
- **Files/Folders Affected**:
  - `src/games/pattern-recognition/engine.ts` [NEW]
  - `src/games/pattern-recognition/types.ts` [NEW]
- **Implementation Requirements**:
  - Sequences of 3–4 cultural symbols with 1 missing item (e.g., `[Gamusa, Rhino, Gamusa, ?]`).
  - Choose matching item from 3 large options.
  - Track response latency, hints, and first-try accuracy.
- **Acceptance Criteria**:
  - Headless engine evaluates correct choices and outputs standard session telemetry.
- **Validation Method**: Headless unit tests.
- **Risks**: Ambiguous patterns; keep visual rules clear.

---

### TASK-007-B: Pattern Recognition UI & Screen
- **Objective**: Render the tactile Pattern Recognition screen with large choices and encouraging feedback.
- **Dependencies**: TASK-007-A.
- **Files/Folders Affected**:
  - `app/patient/games/pattern-recognition.tsx` [NEW]
  - `components/games/pattern-display.tsx` [NEW]
- **Implementation Requirements**:
  - Large sequence boxes (height >= 80px), choice buttons >= 68px.
  - "Read Pattern" voice button describing sequence.
  - Persists session telemetry to SQLite `cognitive_sessions`.
- **Acceptance Criteria**:
  - Operates smoothly with voice assistance and feeds telemetry into Adaptive AI.
- **Validation Method**: UI play testing.
- **Risks**: Small screen crowding; enable horizontal wrapping.

---

### TASK-007-C: Routine Recall Activity Engine & UI
- **Objective**: Provide an everyday sequence reconstruction activity (making tea, tending garden).
- **Dependencies**: TASK-007-B.
- **Files/Folders Affected**:
  - `src/games/routine-recall/engine.ts` [NEW]
  - `app/patient/games/routine-recall.tsx` [NEW]
- **Implementation Requirements**:
  - Everyday scenarios: "Making Morning Assam Tea" (Boil water -> Add tea leaves -> Pour milk -> Strain).
  - Tapping cards in chronological order with zero timer pressure.
- **Acceptance Criteria**:
  - Validates correct ordering with warm feedback.
  - Persists session telemetry to SQLite.
- **Validation Method**: End-to-end walkthrough.
- **Risks**: Complex drag/drop; use simple tapping order.

---

### TASK-007-D: Multi-Activity Adaptive Model Harmonization
- **Objective**: Maintain separate per-game weight vectors in `adaptive_model_state` while harmonizing daily game recommendations.
- **Dependencies**: TASK-007-C.
- **Files/Folders Affected**:
  - `src/ai/multi-game-adapter.ts` [NEW]
- **Implementation Requirements**:
  - Independent difficulty tuning per game.
  - Daily recommendation badging in Train My Mind hub.
- **Acceptance Criteria**:
  - Games preserve independent weight states.
- **Validation Method**: Simulate multi-game sessions and inspect SQLite state.
- **Risks**: Cross-contamination of difficulty tiers.

---

## PHASE 8 — My Day (Routines, Medicines & Reminders)

### TASK-008-A: Local Notifications Scheduling Manager
- **Objective**: Install `expo-notifications` and schedule reliable local push notifications that fire on-device without internet.
- **Dependencies**: PHASE 4.
- **Files/Folders Affected**:
  - `package.json`
  - `src/services/notification.service.ts` [NEW]
- **Implementation Requirements**:
  - Install `expo-notifications` via `npx expo install`.
  - Request notification permissions gracefully.
  - Schedule local calendar/time-interval alarms with gentle melodic sounds.
  - Reschedule pending reminders on app startup to survive OS reboots.
- **Acceptance Criteria**:
  - Local notification fires at exact scheduled time offline.
- **Validation Method**: Schedule test notification for $+10$ seconds and verify trigger.
- **Risks**: Android battery optimization; advise user to allow background execution.

---

### TASK-008-B: My Day Timeline UI & Categorization (MVP-7)
- **Objective**: Display the patient's daily schedule categorized into Morning, Afternoon, Evening, and Night blocks.
- **Dependencies**: TASK-008-A.
- **Files/Folders Affected**:
  - `app/patient/day/index.tsx` [MODIFY]
  - `components/day/day-section-block.tsx` [NEW]
- **Implementation Requirements**:
  - 4 distinct time blocks with cheerful iconography (Sunrise, Sun, Sunset, Moon).
  - Cards highlight: Medicine name, dosage, with/without food instruction, scheduled time.
  - High visual distinction between pending and completed items.
- **Acceptance Criteria**:
  - Current time block automatically expands by default.
  - Cards have minimum 72px height and 20px typography.
- **Validation Method**: Visual check against mock morning/evening schedules.
- **Risks**: Empty sections; display calming message: "Nothing pending for this afternoon. Relax and enjoy your day 🌸".

---

### TASK-008-C: One-Tap Completion & Append-Only Adherence Logging
- **Objective**: Allow patients to mark reminders done with one large tap, generating append-only adherence records in `reminder_completions`.
- **Dependencies**: TASK-008-B.
- **Files/Folders Affected**:
  - `components/day/reminder-card.tsx` [NEW]
- **Implementation Requirements**:
  - Large checkbox target (minimum 56px x 56px).
  - On tap: Gentle green check animation, warm sound, celebratory banner: "Completed! Well done ❤️".
  - Write append-only record to SQLite `reminder_completions` table (`completed_at = now()`).
  - 5-second gentle "Undo" toast in case of accidental tap.
  - **Explicit Rule**: Patient completion events never overwrite a caregiver's updated reminder schedule.
- **Acceptance Criteria**:
  - Reminder toggles state instantly on screen.
  - Completion record appended to SQLite `reminder_completions`.
- **Validation Method**: Toggle reminder complete, restart app, verify completion status.
- **Risks**: Accidental taps; keep undo button accessible.

---

### TASK-008-D: Hydration Tracking with Visual Cup Interface
- **Objective**: Provide an ultra-simple visual water tracker helping elderly patients maintain daily hydration.
- **Dependencies**: TASK-008-C.
- **Files/Folders Affected**:
  - `components/day/hydration-tracker.tsx` [NEW]
- **Implementation Requirements**:
  - Display 6–8 rounded water glass icons representing daily goal.
  - Tapping empty glass fills it with gentle wave animation and water chime.
  - Milestone message: "4 glasses of water today! Wonderful for your health 💧".
  - Resets automatically at midnight.
- **Acceptance Criteria**:
  - Glass count updates in SQLite.
- **Validation Method**: Tap 4 glasses, verify SQLite persistence.
- **Risks**: Small icons; ensure each glass button is >= 56px wide.

---

### TASK-008-E: Adherence Metrics Service for Caregiver View
- **Objective**: Calculate daily routine adherence rates from `reminder_completions` for caregiver reporting.
- **Dependencies**: TASK-008-D.
- **Files/Folders Affected**:
  - `src/services/adherence.service.ts` [NEW]
- **Implementation Requirements**:
  - Calculate adherence percentage: $(\text{completedEvents} / \text{scheduledCount}) \times 100$.
  - Record adherence events into `sync_queue` for caregiver consumption.
- **Acceptance Criteria**:
  - Accurate adherence reporting without cloud dependence.
- **Validation Method**: Unit tests verifying adherence rate calculation across scenarios.
- **Risks**: Timezone calculation errors; store UTC timestamps.

---

## PHASE 9 — My Memories (Reminiscence Support)

### TASK-009-A: Local Seed Memories & Sandboxed Storage (MVP-8)
- **Objective**: Pre-bundle realistic local demo memories and establish sandboxed file storage.
- **Dependencies**: PHASE 4.
- **Files/Folders Affected**:
  - `src/content/memories/demo-memories.ts` [NEW]
  - `assets/memories/` [NEW]
- **Implementation Requirements**:
  - Pre-bundle 3 rich demo memories with local photos and authentic audio clips:
    1. Son Rahul visiting Majuli island.
    2. Granddaughter Diya's birthday celebration.
    3. Traditional Bihu celebration at ancestral home.
  - Copy to app sandbox on database seeding.
- **Acceptance Criteria**:
  - Memories load reliably offline from sandbox storage.
- **Validation Method**: Query memories repository and verify images render.
- **Risks**: Large media files; compress bundled demo audio.

---

### TASK-009-B: Memory Card Gallery UI
- **Objective**: Display family memories in an accessible, warm, dignified visual layout.
- **Dependencies**: TASK-009-A.
- **Files/Folders Affected**:
  - `app/patient/memories/index.tsx` [MODIFY]
  - `components/memories/memory-grid-card.tsx` [NEW]
- **Implementation Requirements**:
  - Large photo card (min height 180px) with rounded corners.
  - Prominent relationship chip: "Your Daughter — Priya 🌸" in 20px bold font.
  - Short familiar description: "Celebrating Bihu together in Guwahati".
  - Audio badge if family voice note is attached.
- **Acceptance Criteria**:
  - Photos render crisply with smooth loading placeholders.
  - Accessible description read aloud by screen reader.
- **Validation Method**: Populate sample memories and inspect visual presentation.
- **Risks**: High memory usage with multiple photos; implement thumbnail caching.

---

### TASK-009-C: Detailed Reminiscence & Voice Playback View
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

### TASK-009-E: Caregiver Memory Management UI [Post-Demo]
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

### TASK-010-A: Pluggable Regional Content Schema
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
  - Strict Rule: Never treat the 8 North-Eastern states as one homogeneous culture.
- **Acceptance Criteria**:
  - Architecture cleanly supports adding new state content packs without touching game code.
- **Validation Method**: TypeScript interface check and mock pack registration.
- **Risks**: Bloating app bundle with excessive audio/image assets; bundle core demo assets and prepare remote pack download for future states.

---

### TASK-010-B: Assam Regional Demo Pack Implementation (MVP-9)
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
  - Stories: Excerpts from Lakshminath Bezbaroa's folklore (Burhi Aair Xadhu), Majuli island tales, Brahmaputra river memories.
- **Acceptance Criteria**:
  - All motifs have authentic Assamese and English titles and descriptions.
  - Assets bundled in app and load instantly offline.
- **Validation Method**: Inspect loaded pack in Assam region mode.
- **Risks**: Inaccurate cultural nuances; cross-reference authentic folklore and iconography.

---

### TASK-010-C: Multi-State NER Manifest Skeletons
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
  - Define state manifests with proper native names, major festivals, and landmark references for all 7 states.
- **Acceptance Criteria**:
  - Selecting any of the 8 states in onboarding dynamically loads the corresponding state manifest.
- **Validation Method**: Toggle through all 8 states in settings and verify header/content updates.
- **Risks**: Incomplete placeholder packs; ensure each skeleton has at least 3 authentic cultural symbols.

---

### TASK-010-D: Cultural Separation Layer in Cognitive Games
- **Objective**: Dynamically inject regional motifs into Memory Match based on the patient's selected region.
- **Dependencies**: TASK-010-C, PHASE 5.
- **Files/Folders Affected**:
  - `src/games/memory-match/card-factory.ts` [NEW]
- **Implementation Requirements**:
  - Abstract card asset retrieval: `getCardsForRegion(stateId, count)`.
  - When patient has selected Assam, game cards dynamically feature Xorai, Gamusa, Rhino, and Tea.
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

### TASK-011-B: Expo Speech Integration & Elderly Articulation
- **Objective**: Configure `expo-speech` with slow, clear articulation for elderly comprehension.
- **Dependencies**: TASK-011-A.
- **Files/Folders Affected**:
  - `src/services/speech.service.ts` [MODIFY]
- **Implementation Requirements**:
  - Speech settings:
    - Speaking rate: `0.8` (slow, deliberate, dignified pacing).
    - Pitch: `1.0` (natural, warm pitch).
  - Language routing: English (`en-IN` / `en-US`), Hindi (`hi-IN`), Assamese (`as-IN` with fallback).
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
  - Provide pre-recorded audio bundle clips for critical patient commands as guaranteed offline audio fallback.
- **Acceptance Criteria**:
  - Zero unhandled exceptions when requesting speech for unsupported locales.
  - Guaranteed audio feedback even on stripped-down Android Go devices.
- **Validation Method**: Mock empty TTS voice array and verify fallback pre-recorded audio plays.
- **Risks**: Large audio bundle size; only bundle core top-10 essential phrases.

---

### TASK-011-D: Global "Read Screen" Accessibility Trigger
- **Objective**: Provide a ubiquitous speaker button on all patient screens that narrates the current screen.
- **Dependencies**: TASK-011-C, PHASE 3.
- **Files/Folders Affected**:
  - `components/voice/read-screen-button.tsx` [NEW]
- **Implementation Requirements**:
  - Prominent button with speaker icon (size >= 56px).
  - On tap: Narrates screen title, primary instructions, and pending action cards in sequence.
  - Tapping again immediately silences speech.
- **Acceptance Criteria**:
  - Present and functional on Patient Home, Games Hub, Game Board, and My Day.
- **Validation Method**: Tap "Read Screen" on Patient Home and verify audible speech output.
- **Risks**: Audio reading out technical IDs or URLs; pass curated display text only.

---

## PHASE 12 — Caregiver Application (Local-First Experience)

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
  - Clean, information-dense interface utilizing soft elevation and clear typography.
- **Acceptance Criteria**:
  - Tab navigation functions cleanly.
  - Header displays linked patient name and last active status.
- **Validation Method**: Tab switching test and route inspection.
- **Risks**: Caregiver accessing patient screens accidentally; maintain distinct layout routes.

---

### TASK-012-B: Caregiver Dashboard & Linked Patient Header (MVP-10)
- **Objective**: Display an executive overview of the patient's daily wellbeing, routines, and cognitive engagement directly from local SQLite.
- **Dependencies**: TASK-012-A.
- **Files/Folders Affected**:
  - `app/caregiver/dashboard.tsx` [NEW]
  - `components/caregiver/patient-status-hero.tsx` [NEW]
- **Implementation Requirements**:
  - Linked patient summary card:
    - Patient Name: "Dharmin (Dada)"
    - Status Badge: "Active 25 mins ago" (derived from local SQLite session/reminder timestamps)
    - Sync Badge: "Ready offline" or "Synced"
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
  - 7-day engagement chart: Number of cognitive sessions played per day, average accuracy trend, average response latency.
  - Accessible, SVG-based lightweight chart without heavy external charting bloat.
  - Clear label: "Cognitive Engagement & Activity History (Non-Diagnostic)".
- **Acceptance Criteria**:
  - Chart renders cleanly with real data points from `cognitive_sessions` table.
  - Displays empty state gracefully when no sessions exist yet.
- **Validation Method**: Insert 7 days of synthetic SQLite test sessions and verify chart rendering.
- **Risks**: Over-interpreting normal cognitive fluctuations; include helper tooltip explaining that variations are normal.

---

### TASK-012-D: Daily Routine Adherence Log
- **Objective**: Display detailed completion history for medicines, meals, and hydration from `reminder_completions`.
- **Dependencies**: TASK-012-C.
- **Files/Folders Affected**:
  - `components/caregiver/routine-adherence-card.tsx` [NEW]
- **Implementation Requirements**:
  - Daily completion donut / progress bar: e.g., "4 of 5 routines completed today (80%)".
  - Detailed breakdown list:
    - "Blood Pressure Tablet (Morning) — Taken at 9:15 AM ✅"
    - "Water Intake — 6 of 8 glasses logged 💧"
- **Acceptance Criteria**:
  - Live data bound to SQLite `reminder_completions` table.
  - Accurately reports taken vs. missed times.
- **Validation Method**: Mark medicine complete in patient mode, switch to caregiver mode, assert log updates.
- **Risks**: Clock differences; store timestamps in UTC ISO-8601.

---

### TASK-012-E: Non-Diagnostic Attention Indicators
- **Objective**: Present actionable, caring observations to the caregiver when patterns deviate significantly.
- **Dependencies**: TASK-012-D.
- **Files/Folders Affected**:
  - `components/caregiver/attention-indicators.tsx` [NEW]
- **Implementation Requirements**:
  - Pattern detection:
    - Missed medicines: "Dharmin missed his morning medicines yesterday and today. Consider a gentle phone check-in."
    - Pacing change: "Reaction speed was a little slower on recent games. A restful afternoon or hydration might help."
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
  - Form to add new reminder (title, category, time, recurrence, dosage instructions).
  - Writes directly to SQLite `reminders` table and enqueues sync event.
- **Acceptance Criteria**:
  - Newly scheduled reminder immediately triggers local notification setup.
  - Appears in patient's "My Day" screen.
- **Validation Method**: Add reminder in caregiver tab, verify notification is scheduled, verify display in patient day view.
- **Risks**: Conflicting reminder times; warn caregiver if two medicines are scheduled at identical times.

---

## PHASE 13 — Offline Synchronization System (Local Queue & Mutation Engine)

### TASK-013-A: Network Connectivity Monitor & Status Badge (MVP-11)
- **Objective**: Install `@react-native-community/netinfo`, monitor connectivity, and display reassuring status badges.
- **Dependencies**: PHASE 4.
- **Files/Folders Affected**:
  - `package.json`
  - `src/services/network.service.ts` [NEW]
  - `components/common/offline-status-badge.tsx` [NEW]
- **Implementation Requirements**:
  - Install `@react-native-community/netinfo` via `npx expo install`.
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

### TASK-013-B: Sync Queue Manager & Compaction Rules
- **Objective**: Capture and queue all local data modifications in an append-only SQLite sync table with strict compaction rules.
- **Dependencies**: TASK-013-A, TASK-004-E.
- **Files/Folders Affected**:
  - `src/services/sync-queue.service.ts` [NEW]
- **Implementation Requirements**:
  - Table: `sync_queue` (id, table_name, record_id, action, payload_json, status, retry_count, created_at).
  - **Explicit Rule**: Never drop unsynchronized cognitive sessions or adherence completions because a queue limit is reached.
  - Queue compaction rule: Compaction may ONLY merge redundant mutable `UPDATE` operations (e.g. repeated settings changes); it must NEVER drop or truncate append-only session or completion records.
- **Acceptance Criteria**:
  - Every local change enqueues a valid sync item.
  - Compaction leaves immutable sessions and completion events intact.
- **Validation Method**: Perform 10 offline edits, run compaction, assert all sessions and completions preserved.
- **Risks**: Queue bloat; compaction safely merges redundant mutable setting records.

---

### TASK-013-C: Conflict Resolution Engine (Split Semantics)
- **Objective**: Reconcile data differences between local device changes and remote cloud modifications.
- **Dependencies**: TASK-013-B.
- **Files/Folders Affected**:
  - `src/services/conflict-resolver.ts` [NEW]
- **Implementation Requirements**:
  - Conflict rules:
    1. **Reminder Completions**: **Client-Wins** (patient's physical completion on-device always supersedes cloud state).
    2. **Reminder Schedules**: **Server-Wins** (caregiver schedule modifications made remotely take precedence over outdated local times).
    3. **Cognitive Sessions**: **Append-Only** (sessions are unique immutable events, never overwritten).
    4. **Personal Memories**: **Last-Write-Wins** based on UTC timestamp.
- **Acceptance Criteria**:
  - Conflict rules execute deterministically without data loss.
  - Unit tests verify all 4 conflict scenarios.
- **Validation Method**: Automated test suite simulating simultaneous client and server edits.
- **Risks**: Clock skew; use ISO-8601 UTC timestamps.

---

## PHASE 14 — Supabase Backend & Remote Sync [Post-Demo]

> **Mandatory Rule**: The local patient application (Phases 0–12) must be completely working and validated before this cloud layer is connected.

### TASK-014-A: Supabase Client & Secure Credentials
- **Objective**: Install `@supabase/supabase-js` and configure the client using environment variables and SecureStore.
- **Dependencies**: PHASE 13.
- **Files/Folders Affected**:
  - `package.json`
  - `src/services/supabase.client.ts` [NEW]
  - `.env.example` [NEW]
- **Implementation Requirements**:
  - Install `@supabase/supabase-js` via `npm install @supabase/supabase-js`.
  - Configure Supabase client with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
  - Persist authentication session tokens inside `expo-secure-store`.
  - Auto-refresh tokens on expiration.
- **Acceptance Criteria**:
  - Client initializes cleanly without exposing secrets.
  - SecureStore securely handles JWT persistence.
- **Validation Method**: Test token storage and retrieval via SecureStore wrapper.
- **Risks**: Secret keys leaked into Git; enforce `.gitignore` on `.env`.

---

### TASK-014-B: PostgreSQL Database Schema & Cloud Migrations
- **Objective**: Create cloud PostgreSQL schema mirroring local SQLite entities with explicit user mapping.
- **Dependencies**: TASK-014-A.
- **Files/Folders Affected**:
  - `supabase/migrations/001_initial_cloud_schema.sql` [NEW]
- **Implementation Requirements**:
  - Tables:
    - `profiles` (id references auth.users, role, full_name, created_at)
    - `patient_profiles` (id uuid primary key, user_id uuid references auth.users, preferred_name, age_bracket, emergency_phone, created_at)
    - `caregiver_links` (id uuid primary key, caregiver_id uuid references auth.users, patient_id uuid references patient_profiles(id), status: 'ACTIVE'|'PENDING', created_at)
    - `cognitive_sessions` (id uuid primary key, patient_id uuid references patient_profiles(id), game_type, difficulty, accuracy, total_time_ms, raw_events, is_demo_seed, created_at)
    - `reminders` (id uuid primary key, patient_id uuid references patient_profiles(id), title, category, scheduled_time, recurrence, version, updated_at)
    - `reminder_completions` (id uuid primary key, reminder_id uuid references reminders(id), patient_id uuid, completed_at, created_at)
    - `personal_memories` (id uuid primary key, patient_id uuid references patient_profiles(id), person_name, relationship, description, photo_url, audio_url)
- **Acceptance Criteria**:
  - SQL script executes cleanly in Supabase PostgreSQL instance.
  - Foreign keys enforce referential integrity.
- **Validation Method**: Run migration in Supabase CLI or staging instance.
- **Risks**: UUID vs SQLite ID mismatch; use UUIDv4 across both SQLite and PostgreSQL.

---

### TASK-014-C: Row-Level Security (RLS) & Least-Privilege Permissions
- **Objective**: Enforce strict data isolation using explicit identity mapping and least-privilege permissions.
- **Dependencies**: TASK-014-B.
- **Files/Folders Affected**:
  - `supabase/migrations/002_row_level_security.sql` [NEW]
- **Implementation Requirements**:
  - Enable RLS on all tables (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`).
  - **Identity Mapping**: Use `patient_profiles.user_id = auth.uid()` rather than assuming `patient_id = auth.uid()`.
  - **Patient Policy**: Patients can read and write only their own records.
  - **Caregiver Policy**:
    - Caregivers can read linked patient profile, reminders, and reminder completions.
    - Caregivers can write/update `reminders` schedule.
    - **Explicit Rule**: Caregivers have **READ-ONLY** access to cognitive session history; caregivers must NOT receive write or edit permissions on cognitive sessions.
- **Acceptance Criteria**:
  - Caregiver write access to cognitive sessions is blocked by PostgreSQL RLS.
  - Verified with multi-user SQL test scripts.
- **Validation Method**: Execute tests with two different user JWTs and assert isolation.
- **Risks**: Overly permissive RLS rules leaking patient health data.

---

### TASK-014-D: Remote Batch Sync Worker
- **Objective**: Dispatch pending queued changes to Supabase in atomic batches with exponential backoff retry.
- **Dependencies**: TASK-014-C.
- **Files/Folders Affected**:
  - `src/services/sync-worker.service.ts` [NEW]
- **Implementation Requirements**:
  - Batch size: Max 25 records per sync request.
  - Retry logic: Exponential backoff ($1\text{s}, 2\text{s}, 4\text{s}, \dots, \max 60\text{s}$) on failure.
  - Once confirmed by server, mark `sync_queue` item as `'COMPLETED'` and update local record `synced = 1`.
- **Acceptance Criteria**:
  - Flawless recovery from network interruption mid-sync.
  - Idempotent upserts prevent duplicate records.
- **Validation Method**: Mock unstable network and verify eventual consistency.
- **Risks**: Battery drain if worker retries in tight loops; enforce exponential backoff.

---

## PHASE 15 — Security Hardening & Privacy Audit

> **Architectural Order Note**: Foundational security (SecureStore token management, input validation, least-data collection, role isolation) is implemented throughout Phases 1–14 as features are created. Phase 15 is a dedicated hardening and verification audit.

### TASK-015-A: Secure Storage & Key Management Audit
- **Objective**: Audit hardware keystore integration ensuring zero sensitive tokens are exposed in plain text.
- **Dependencies**: PHASE 14.
- **Files/Folders Affected**:
  - `src/services/secure-storage.service.ts`
- **Implementation Requirements**:
  - Verify that session tokens, user credentials, and encryption keys are stored exclusively in Android Keystore / iOS Keychain via `expo-secure-store`.
  - Assert zero sensitive tokens in standard `AsyncStorage` or unencrypted SQLite text fields.
  - Provide secure wipe utility on account logout / reset.
- **Acceptance Criteria**:
  - Zero sensitive tokens found in plain text database dumps.
- **Validation Method**: Inspect stored database files on debug emulator.
- **Risks**: Keystore invalidation if user changes device lock screen PIN.

---

### TASK-015-B: Role-Based Route Guard Hardening
- **Objective**: Audit Expo Router navigation guards to ensure complete role separation.
- **Dependencies**: TASK-015-A.
- **Files/Folders Affected**:
  - `app/_layout.tsx`
  - `src/services/auth-guard.ts`
- **Implementation Requirements**:
  - Verify route guards prevent patients from accessing caregiver dashboards.
  - Simple PIN protection on caregiver access to prevent confused patients from modifying medication schedules.
- **Acceptance Criteria**:
  - Direct deep links to unauthorized roles are blocked and safely redirected.
- **Validation Method**: Trigger deep links to `/caregiver/settings` in patient mode and assert redirect.
- **Risks**: Patient getting locked out of app; provide simple caregiver recovery option.

---

### TASK-015-C: Comprehensive Input Sanitization Audit
- **Objective**: Audit all repository insert/update points against injection and malformed payloads.
- **Dependencies**: TASK-015-B.
- **Files/Folders Affected**:
  - `src/utils/validation.ts`
- **Implementation Requirements**:
  - Verify parameterized queries across 100% of SQLite and Supabase operations.
  - Fuzz text inputs with HTML, script tags, and extreme string lengths.
- **Acceptance Criteria**:
  - 100% of repository inputs validated prior to database queries.
- **Validation Method**: Automated fuzzing test script.
- **Risks**: Overly aggressive regex rejecting valid regional names; support Unicode scripts.

---

### TASK-015-D: Privacy Audit & Least-Data Compliance
- **Objective**: Review data schemas to guarantee zero unnecessary medical data collection.
- **Dependencies**: TASK-015-C.
- **Files/Folders Affected**:
  - `docs/PRIVACY_AUDIT.md` [NEW]
- **Implementation Requirements**:
  - Confirm: No collection of Aadhaar numbers, clinical diagnostics, psychiatric records, or GPS continuous location.
  - Confirm: Telemetry strictly captures interaction mechanics (timing, accuracy).
  - Document privacy commitments for hackathon jury.
- **Acceptance Criteria**:
  - Audit document completed. Codebase verified free of invasive trackers.
- **Validation Method**: Static code grep for unauthorized device sensors and data collection APIs.
- **Risks**: Third-party libraries bundling undisclosed analytics; audit dependency tree.

---

## PHASE 16 — Accessibility Hardening (WCAG AAA Audit)

> **Architectural Order Note**: Accessibility is a mandatory requirement built into every phase (Phases 1, 2, 3, 5, 8, 9, 10, 11, 12). Phase 16 is a comprehensive audit and hardening pass.

### TASK-016-A: Dynamic Type & Large Text Scaling Audit
- **Objective**: Guarantee that all patient-facing text remains fully readable at 150%–200% system font scaling without truncation.
- **Dependencies**: PHASE 1.
- **Files/Folders Affected**:
  - `components/themed-text.tsx` [MODIFY]
  - All patient screens
- **Implementation Requirements**:
  - Eliminate fixed `height` constraints on text containers; use `minHeight` and flex layout.
  - Prevent text clipping on buttons and headers at maximum OS font size.
- **Acceptance Criteria**:
  - Zero text truncation on Patient Home, Memory Match, and My Day at 200% font scale.
- **Validation Method**: Visual pass with device font size set to maximum accessibility level.
- **Risks**: Button text wrapping onto 3 lines; allow buttons to expand vertically.

---

### TASK-016-B: Touch Target & Motor Accessibility Audit
- **Objective**: Enforce 56px minimum touch targets and 16px interactive separation across every touchable surface.
- **Dependencies**: TASK-016-A.
- **Files/Folders Affected**:
  - All interactive buttons and cards
- **Implementation Requirements**:
  - Verify every `Pressable`, `TouchableOpacity`, and button meets minimum `56px x 56px`.
  - Use `hitSlop` on smaller icon buttons.
  - Ensure minimum 16px margin between adjacent buttons to eliminate accidental mis-taps.
- **Acceptance Criteria**:
  - Zero interactive elements below 56px touch footprint.
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

### TASK-016-D: Screen Reader & TalkBack/VoiceOver Audit
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
- **Risks**: Overly verbose labels; keep descriptions concise, warm, and helpful.

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
- **Risks**: Adding non-essential elements; prune ruthlessly.

---

## PHASE 17 — Quality Assurance & Verification

### TASK-017-A: TypeScript Strictness Pipeline
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
- **Validation Method**: Execute `npx tsc --noEmit`.
- **Risks**: Untyped third-party packages; write custom ambient declarations (`.d.ts`).

---

### TASK-017-B: ESLint & Code Cleanliness Pipeline
- **Objective**: Enforce code formatting, hooks rules, and import hygiene.
- **Dependencies**: TASK-017-A.
- **Files/Folders Affected**:
  - Entire repository
- **Implementation Requirements**:
  - Execute `npx expo lint`.
  - Fix all React hooks dependency array warnings.
  - Ensure zero unused imports or dead variables.
- **Acceptance Criteria**:
  - `npx expo lint` exits with code 0.
- **Validation Method**: Automated lint check.
- **Risks**: False positive warnings on circular component imports; resolve cleanly.

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
- **Risks**: Version drift; pin exact versions.

---

### TASK-017-D: Automated Test Suite Execution
- **Objective**: Execute comprehensive Jest test suite covering DB, AI, games, and state management.
- **Dependencies**: TASK-017-C.
- **Files/Folders Affected**:
  - All test files in `__tests__/`
- **Implementation Requirements**:
  - Run `npm test`.
  - Test coverage: SQLite migrations, repositories, Adaptive AI mathematical engine & explainer, Memory Match engine, and localization dictionary parity.
- **Acceptance Criteria**:
  - 100% of unit tests pass cleanly.
- **Validation Method**: Jest test runner exit code 0.
- **Risks**: Slow test runs; optimize SQLite mock harness.

---

### TASK-017-E: End-to-End Offline Simulation Testing (MVP-11)
- **Objective**: Validate that the complete patient application functions flawlessly with zero internet connectivity.
- **Dependencies**: TASK-017-D.
- **Files/Folders Affected**:
  - Complete application runtime
- **Implementation Requirements**:
  - Place device into strict Airplane Mode with Wi-Fi disabled.
  - Test sequence: Cold launch $\to$ splash $\to$ patient home $\to$ Memory Match play $\to$ Adaptive AI evaluation $\to$ "Why this level?" modal $\to$ family memories $\to$ My Day check-off $\to$ Assam cultural stories $\to$ Caregiver dashboard inspection.
- **Acceptance Criteria**:
  - Zero crashes, zero network error popups, zero infinite loading spinners.
- **Validation Method**: Physical or simulated device execution in Airplane Mode.
- **Risks**: Network calls hanging without timeout; ensure all network operations have strict timeouts.

---

### TASK-017-F: Standalone Android APK Build Verification (MVP-12)
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
- **Risks**: Android 14 edge-to-edge layout issues; verify `edgeToEdgeEnabled: true` in `app.json`.

---

## PHASE 18 — SIH Demo Preparation & Golden Path Rehearsal

### TASK-018-A: Demo Seed Data Generator (Transparent Synthetic Tagging)
- **Objective**: Preload realistic, dignified patient data into SQLite with explicit synthetic tagging (`is_demo_seed = 1`).
- **Dependencies**: ALL PRIOR PHASES.
- **Files/Folders Affected**:
  - `src/utils/demo-seed.ts` [NEW]
- **Implementation Requirements**:
  - Preloaded dataset:
    - Patient Profile: "Dharmin (Dada)", Age 72, Region: Assam, Language: Assamese / English.
    - 5 past cognitive sessions with realistic accuracies (80%, 85%, 75%, 90%, 88%) explicitly tagged with `is_demo_seed = 1`.
    - 4 realistic daily reminders: Morning Blood Pressure (9:00 AM), Midday Hydration (1:00 PM), Afternoon Walk (5:00 PM), Evening Memory Game (7:00 PM).
    - 3 rich personal memories with bundled audio clips.
  - **Explicit Rule**: Do NOT present seeded historic percentages as measurements from a real patient. The current live Memory Match session shown to judges must use genuine runtime telemetry (`is_demo_seed = 0`).
  - Provide hidden 3-tap trigger on settings logo to reset and re-seed clean demo data instantly.
- **Acceptance Criteria**:
  - Fresh demo seed populates SQLite in under 300ms.
  - Explicit distinction between live telemetry and synthetic seed data preserved.
- **Validation Method**: Inspect SQLite records to confirm `is_demo_seed` tags.
- **Risks**: Seeding live user data; only allow in development/demo mode.

---

### TASK-018-B: Golden Path Step-by-Step Validation & Rehearsal (MVP-12)
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
    9. **"Why this level?"**: Open explainer modal -> show transparent, non-diagnostic reasoning from allow-listed template.
    10. **My Memories**: Open gallery -> tap family photo -> listen to daughter's soothing voice note.
    11. **My Day Reminder**: View timeline -> mark morning medicine complete -> see gentle green check and encouraging banner.
    12. **Offline Demonstration**: Toggle phone to Airplane Mode -> demonstrate that games, memories, and reminders remain 100% functional.
    13. **Caregiver Dashboard**: Switch to Caregiver view -> show live updated session trends, adherence percentage, and caring non-diagnostic attention indicator.
- **Acceptance Criteria**:
  - Zero placeholder screens or mock alerts encountered along the golden path.
  - Complete flow executes flawlessly in under 5 minutes.
  - Script clearly notes distinction between live game telemetry and seeded historical background data.
- **Validation Method**: Complete 3 consecutive full rehearsals timed against stopwatch.
- **Risks**: Presenter hesitation; document exact presentation script with talking points in `docs/SIH_DEMO_SCRIPT.md`.

---

## Roadmap Summary & Dependency Order Verification

| Phase | Description | Prerequisite Phases | Key Deliverable |
|---|---|---|---|
| **Phase 0** | Repository Cleanup & Engineering Foundation | None | Clean baseline, console error boundary, path aliases |
| **Phase 1** | Design System & Accessible Foundation | Phase 0 | Tokens, WCAG AAA typography, `SmaranButton`, `expo-haptics` |
| **Phase 2** | Core Database Bootstrap & Patient Onboarding | Phase 1 | `expo-sqlite`, `expo-secure-store`, `expo-speech`, Splash, Role, Lang, Region, Profile |
| **Phase 3** | Patient Application Shell | Phase 2 | Persistent header/nav, Home, Games Hub, Day, Memories, Care |
| **Phase 4** | Extended Offline Data Architecture | Phase 2, 3 | Domain schema (Migration 002), repositories, `expo-file-system`, error logger |
| **Phase 5** | Memory Match (Playable Game) | Phase 1, 4 | Deterministic engine, 5 tiers, real telemetry, post-activity feedback |
| **Phase 6** | Adaptive AI Engine | Phase 5 | Feature extraction, Adaptive Readiness, allow-listed explainer, guardrails |
| **Phase 7** | Additional Cognitive Activities [Post-Demo] | Phase 6 | Pattern Recognition, Routine Recall, multi-game adapter |
| **Phase 8** | My Day (Routines & Reminders) | Phase 4 | `expo-notifications`, timeline, adherence events, hydration |
| **Phase 9** | My Memories (Reminiscence Support) | Phase 4 | Sandboxed photos, voice playback, gentle recall activity |
| **Phase 10** | North-East Regional Localization | Phase 1 | Pluggable NER schema, Assam demo pack, 8-state skeletons |
| **Phase 11** | Voice & Multilingual Experience | Phase 1, 3 | EN/HI/AS string catalogs, Expo Speech, Read Screen button |
| **Phase 12** | Caregiver Application (Local) | Phase 4, 6 | Dashboard, trends charts, adherence log, attention alerts |
| **Phase 13** | Offline Synchronization System (Local Queue) | Phase 4 | `NetInfo` monitor, sync queue compaction, conflict resolver |
| **Phase 14** | Supabase Backend & Remote Sync [Post-Demo] | Phase 13 | PostgreSQL, RLS, Storage, Caregiver Auth & Batch Worker |
| **Phase 15** | Security Hardening & Privacy Audit | Phase 14 | SecureStore tokens, route guards, validation, privacy audit |
| **Phase 16** | Accessibility Hardening (WCAG AAA Audit) | Phase 1, 3 | 200% dynamic font test, 56px targets, TalkBack audit |
| **Phase 17** | Quality Assurance & Verification | All | TS check, ESLint, Expo Doctor, offline test, Android APK |
| **Phase 18** | SIH Demo Preparation & Golden Path | All | Demo seed generator, 13-step golden path rehearsal |

---

*Document prepared by Lead Software Architect & Engineer for SMARAN AI.*  
*Awaiting user review and authorization to proceed with Phase 0.*
