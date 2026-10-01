# STITCH LIVE MCP VISUAL FIDELITY AUDIT

Project ID: 8087155631877395463
Project Name: Smaran AI UI/UX Polish

## Screen Mapping & Audit Status

### 1. Home Companion
- **Stitch ID:** 57452b50be0d4d96bbf7461f7f8371e4
- **React Native Route:** `app/patient/home.tsx`
- **Visual differences found:** Header layout, Date widget, Schedule list, Hero card all differed from new design system.
- **Changes made:** Applied surface colors, updated `PageIntro` and `HomeActionCard` to match Stitch layout. Transformed single-item schedule into a multi-item list matching Stitch.
- **Intentional deviations:** "Mind Vitality This Week" is excluded as it requires fabricating analytics/streaks which is prohibited by rules. The "Direct Dial" was adapted to existing memory/regional components rather than fabricating a phone integration.
- **Validation status:** Pending build/lint

### 2. Train My Mind & 11 Cognitive Activities Hub
- **Stitch ID:** 7ef160b5c9894929badd2ba1b53384d7 / 36761f0434a244029a9888115738ac55
- **React Native Route:** `app/patient/games/index.tsx`
- **Visual differences found:** Header, Adaptive Difficulty banner were missing. Game list lacked new styling (handled via `HomeActionCard`).
- **Changes made:** Replaced `PageIntro` with custom `Cognitive Fitness` block and `Adaptive Difficulty` banner. The game list now leverages the updated `HomeActionCard`.
- **Intentional deviations:** Monthly visual consistency chart and categorization tabs are excluded as they require fabricating logic/analytics.
- **Validation status:** Pending build/lint

### 3. Active Exercise & Feedback (Games 1-11)
- **Stitch IDs:** 17852642a3604a23905f347835265dc8 (Active Exercise), 5acd884ef39f42bdb96669d095172619 (Games 1-4), ad94cd1d252d4a189ca4f198a87f0076 (Games 5-8), 383bc29f6f0c4af29516afa90f799c35 (Games 9-11 & Results)
- **React Native Routes:** `components/games/selection-activity-screen.tsx`
- **Visual differences found:** Header layout, prompt banner styling, and progress tracker were lacking Stitch's clean, separated layout.
- **Changes made:** Updated `selection-activity-screen.tsx` header to include `spa` icon and merged progress indicator. Updated prompt area to match the "Activity Prompt" styling.
- **Intentional deviations:** None, adapted existing logic to fit visual containers.
- **Validation status:** Pending build/lint

### 4. Daily Timeline (My Day)
- **Stitch ID:** e00a70ae920545aab2338824f7f36f72
- **React Native Route:** `components/my-day/my-day-content.tsx`
- **Visual differences found:** The original `PageIntro` and basic card styling lacked the Day & Cultural Welcoming block and prominent "Today's Journey" header.
- **Changes made:** Applied Stitch header styling (sun icon, uppercase day Intro) and replaced generic card inner layouts with a structured timeline layout (Time pill, Done badge, icon container).
- **Intentional deviations:** The 4-day interactive picker and deep offline/caregiver sync guarantee banners were omitted as they require new architectural implementations beyond UI updates.
- **Validation status:** Pending build/lint

### 5. My Memories & Regional Reminiscence
- **Stitch ID:** 3f0065f544b4405c96adc0a22c161471
- **React Native Route:** `app/patient/my-memories.tsx`
- **Visual differences found:** Header was missing cultural identifiers and offline security reassurances. Memory cards were basic boxes rather than structured media cards.
- **Changes made:** Applied Stitch layout replacing PageIntro with "Smriti-Kotha" banner. Converted generic memory cards to media-rich cards with floating relationship badges and explicit primary actions.
- **Intentional deviations:** Dynamic filter pills (e.g., "Family & Loved Ones", "Voice Notes") omitted as they require new filtering mechanisms on the backend.
- **Validation status:** Pending build/lint

### 6. North-East Heritage & My Home
- **Stitch ID:** 87b816e940204266ad2dfb9d1d92cbc6
- **React Native Route:** `app/patient/my-home.tsx` / `my-home-memory.tsx`
- **Visual differences found:** Pending
- **Changes made:** Pending
- **Intentional deviations:** None yet
- **Validation status:** Not started

### 7. Caregiver Center, Pairing, Reports & Analytics
- **Stitch IDs:** b0dcf9357b1e413bb2d0f1e3e3c0ee49, 39e89872dfcf49588b8ebd58b61dd4e8
- **React Native Route:** `app/caregiver/*`, `app/add-person.tsx`
- **Visual differences found:** Pending
- **Changes made:** Pending
- **Intentional deviations:** None yet
- **Validation status:** Not started

### 8. Location Permissions & Map States
- **Stitch IDs:** 33ca04e93c2d4ac49a7c2b25e04347cd, 8323ba33743e46bfa78ceec259295f83
- **React Native Route:** `app/patient/location.tsx`
- **Visual differences found:** Pending
- **Changes made:** Pending
- **Intentional deviations:** None yet
- **Validation status:** Not started

### 9. Account, Auth, Profile & Settings
- **Stitch IDs:** 34af6f7f494e4c638459eb772865e328, 8e5a5fe60d484c2ebe3b082e06b3af8d, 546a9822feda4f5aa0420a216e83dae0, a8ac22608dd444a898eb055e60d1ea4c, 0b1a7f3ab1f34e499699ae9b039d1669
- **React Native Route:** `app/account.tsx`, `app/auth/*`, `app/onboarding/*`, `app/patient/profile.tsx`, `app/patient/settings.tsx`
- **Visual differences found:** Pending
- **Changes made:** Pending
- **Intentional deviations:** None yet
- **Validation status:** Not started
