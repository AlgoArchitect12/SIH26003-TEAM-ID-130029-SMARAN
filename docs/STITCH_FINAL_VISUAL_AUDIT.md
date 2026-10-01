# SMARAN AI - Final Stitch Visual Audit

**Objective:** This document outlines the remaining visual gaps between the live Stitch design project (ID: 8087155631877395463) and the actual React Native implementation. The application currently implements the functional requirements using generic, shared UI components, but lacks the premium, bespoke visual polish, contextual banners, and rich layouts defined in the Stitch UI pass.

**Note on Cognitive Games:** The 11 specific cognitive games were previously polished and are deliberately excluded from this list unless shared shell components affect them.

---

## 1. Home Dashboard
* **Stitch Screen:** `57452b50be0d4d96bbf7461f7f8371e4` (Home Companion)
* **React Native Route:** `app/patient/home.tsx`
* **Current Status:** Meaningfully Mismatched
* **Specific Mismatches:**
  * **"Mind Vitality This Week" Chart:** Entirely missing.
  * **"Family Faces & Voices / TAP-TO-CALL":** Missing side-by-side layout; RN uses a vertically stacked generic memory card.
  * **"Morning Memory Garden" Card:** Missing the rich dark green gradient overlay and bottom-aligned orange button.
  * **Audio Summary Banner:** Stitch features a prominent orange banner ("Listen to today's summary"). RN uses a standard, small `ReadScreenButton` in the header.
  * **Offline Indicator:** Missing bottom banner.
* **Implementation Change:** 
  * "Mind Vitality This Week" Chart: Omitted (no underlying vitality metric data exists).
  * "Family Faces & Voices": Implemented side-by-side rich layout.
  * "Morning Memory Garden" Card: Added dark green overlay `rgba(10, 40, 20, 0.5)` to `HomeActionCard` to approximate the Stitch gradient without adding new dependencies.
  * Audio Summary Banner: Created large prominent banner variant in `ReadScreenButton` and used it in the Home page.
  * Offline Indicator: Upgraded to a full-width bottom banner.
* **Priority:** COMPLETED (Pass 3A)

## 2. Train My Mind (Hub)
* **Stitch Screen:** `7ef160b5c9894929badd2ba1b53384d7` (Train My Mind)
* **React Native Route:** `app/patient/games/index.tsx`
* **Current Status:** Meaningfully Mismatched
* **Specific Mismatches:**
  * **Adaptive Difficulty Widget:** Missing the visual progress/level track indicator and "Pastoral Mode Active" badge.
  * **Filter Chips:** Missing ("All Exercises", "Visual", "Auditory").
  * **Game Cards:** Missing rich tagging (e.g., `[Visual Memory]`, `[Level 2]`), large 16:9 cover images, and contextual completion banners. RN uses a basic icon/title layout.
  * **Activity Graph:** "Your activity beat 4 past days" graph is missing.
* **Implementation Change:** 
  * Adaptive Difficulty Widget: Removed the hardcoded/fake widget from `games/index.tsx`. Omitted the tracker since the app only tracks difficulty per game, not globally for the patient.
  * Filter Chips: Omitted (no category schema exists in the data model).
  * Activity Graph: Omitted (no underlying graph data exists).
  * Game Cards: Omitted 16:9 rich imagery (no local assets exist). Kept the existing `HomeActionCard` list.
* **Priority:** COMPLETED (Pass 3A)

## 3. My Day (Timeline)
* **Stitch Screen:** `e00a70ae920545aab2338824f7f36f72` (Daily Timeline)
* **React Native Route:** `components/my-day/my-day-content.tsx`
* **Current Status:** Partially Matched
* **Specific Mismatches:**
  * **Header:** Missing the prominent, large date cards and blue background pill for completion status.
  * **Upcoming Item Tags:** Missing the distinctive red "Up Next in 20 mins" tag; RN uses basic text state badges.
  * **Caregiver Presence Banner:** Missing inline banners (e.g., "Rohan is joining you...").
  * **Inline Media:** Missing inline audio play buttons for specific activities.
  * **Footer:** Missing "Offline-Guaranteed Alarms" banner.
* **Implementation Change:** Upgrade timeline card UI to support highlighted "Up Next" states, inline caregiver banners, and media buttons.
* **Priority:** HIGH

## 4. My Memories & Regional Reminiscence
* **Stitch Screens:** `3f0065f544b4405c96adc0a22c161471`, `87b816e940204266ad2dfb9d1d92cbc6`
* **React Native Route:** `app/patient/my-memories.tsx`, `app/patient/my-home.tsx`
* **Current Status:** Meaningfully Mismatched
* **Specific Mismatches:**
  * **Memory Cards:** RN uses basic lists. Stitch uses immersive, edge-to-edge image cards with location tags, "Cherished Detail" quote blocks, and inline audio playback widgets (e.g., "Aarav's Warm Laugh").
* **Implementation Change:** Build a bespoke `RichMemoryCard` component supporting quote blocks, audio widgets, and full-bleed imagery.
* **Priority:** HIGH

## 5. Caregiver Center, Reports & Pairing
* **Stitch Screens:** `39e89872dfcf49588b8ebd58b61dd4e8`, `b0dcf9357b1e413bb2d0f1e3e3c0ee49`
* **React Native Route:** `app/caregiver/*.tsx`
* **Current Status:** Meaningfully Mismatched
* **Specific Mismatches:**
  * RN relies on generic, text-heavy cards. Stitch features rich dashboards with distinct visual charts for vitality and completion.
  * Pairing screen lacks the premium layout and clear visual hierarchy for the QR code display.
* **Implementation Change:** Implement charting components (SVG or library) for reports. Redesign the pairing flow layout.
* **Priority:** HIGH

## 6. Onboarding & Senior Setup
* **Stitch Screens:** `546a9822feda4f5aa0420a216e83dae0`, `8e5a5fe60d484c2ebe3b082e06b3af8d`
* **React Native Route:** `app/onboarding/*.tsx`
* **Current Status:** Partially Matched (Structural differences)
* **Specific Mismatches:**
  * **Structure:** Stitch shows a unified, long-scrolling setup. RN uses discrete, step-by-step screens. *(Note: This split may be deliberate to reduce cognitive load for seniors).*
  * **Visuals:** Missing rich banners ("Dignified Support Available", "Device - Safe Guarantee"), specific large toggle switches, and the prominent orange "Audio Read Aloud" header banner. RN uses basic `BinaryPreference` (on/off text).
* **Implementation Change:** Retain discrete screens if deliberate, but apply the premium Stitch styling to the radio buttons, toggles, and add the missing reassurance banners.
* **Priority:** MEDIUM

## 7. Active Exercise & Result Shell
* **Stitch Screen:** `17852642a3604a23905f347835265dc8`
* **React Native Route:** `app/patient/games/result.tsx`
* **Current Status:** Meaningfully Mismatched
* **Specific Mismatches:**
  * RN uses basic text results. Stitch features a premium success screen with calming gradients, clear "Play Again (Relaxed)" primary actions, and detailed score breakdowns.
* **Implementation Change:** Redesign the shared `result.tsx` shell to match the calming, gradient-rich Stitch aesthetic.
* **Priority:** HIGH

## 8. Settings, Maps, Sync & Auth States
* **Stitch Screens:** `a8ac22608dd444a898eb055e60d1ea4c`, `33ca04e93c2d4ac49a7c2b25e04347cd`, `0b1a7f3ab1f34e499699ae9b039d1669`
* **React Native Route:** `app/patient/settings.tsx`, `components/location/*.tsx`
* **Current Status:** Partially Matched
* **Specific Mismatches:**
  * RN uses basic lists and standard map views. Stitch includes "Offline Vault" styling, rich battery indicators, and beautiful modal/sheet states for Sync and Network.
* **Implementation Change:** Add bespoke cards for accessibility settings, improve map overlay styling, and implement styled bottom sheets for sync states.
* **Priority:** MEDIUM
