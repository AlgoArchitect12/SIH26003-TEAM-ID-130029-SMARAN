# Stitch UI implementation — pass 1

## Reference and baseline

- Branch: `feature/stitch-ui-final-implementation`; starting HEAD: `3e692a50eae7ab90a8f19b30318e8e1ee6f90bfc` (clean).
- Source located at `C:\Users\Dharmin\Downloads\stitch_smaran_ai_ui_ux_polish (1).zip`, root `stitch_smaran_ai_ui_ux_polish/`.
- Inspected all 14 screen PNGs and their HTML structures/content, `smaran_dignified_memory/DESIGN.md`, the export PRD, and all three supporting PNGs. Extracted references stay in ignored `.expo/stitch-reference/`.
- Read Expo SDK 54 reference before editing: https://docs.expo.dev/versions/v54.0.0/.
- Existing architecture: Expo Router stacks, persistent patient navigation, Zustand preferences/session guards, native SQLite repositories, optional Supabase services. Web intentionally has no patient SQLite adapter.

## Screen mapping and implementation decisions

All design directory names below are relative to the archive root. These are visual translations onto existing routes, not new product modules.

| Stitch design | Existing route / component | Pass 1 treatment and supported behavior |
| --- | --- | --- |
| `smaran_ai_emblem` | `components/ui/smaran-brand.tsx` | Bundle the supplied emblem; retain textual brand. No unrelated stock artwork. |
| `smaran_ai_onboarding_senior_setup` | `app/onboarding/accessibility.tsx`, `components/onboarding/onboarding-screen.tsx`, `selection-card.tsx` | Bordered comfort cards, reading preview, actual step progress, prominent existing read-aloud. Preserve role → language → accessibility → profile → region flow and caregiver step. |
| `smaran_ai_senior_onboarding_profile` | `app/onboarding/profile.tsx` | Group persistent labels and validated profile fields into a calm card. Preserve date-of-birth validation and optional emergency contact. No fictional verified identity or restore button. |
| `smaran_ai_home_companion` | `app/patient/home.tsx`, `home-action-card.tsx` | Greeting/date/audio panel, featured training card, actual daily schedule and personal/regional memories. Keep location status. No sample weather, clinical score, or fabricated patient photo. |
| `smaran_ai_train_my_mind` | `app/patient/games/index.tsx` | Intro/audio panel and tactile activity catalogue. Keep all eleven existing activities; do not replace them with the four fictional mockup games. |
| `smaran_ai_11_cognitive_activities_hub` | Same catalogue, existing result and why-level routes | Use labelled icon rows and real game names. The mockup mixes catalogue, active session, and recap; these remain separate existing routes. No clinical validation claims or Mind Sparks. |
| `smaran_ai_active_exercise_feedback` | `components/games/selection-activity-screen.tsx`, `app/patient/games/result.tsx`, shared feedback | Calm prompt/progress/feedback panels, actual progress, existing pause/restart/listen/hint controls and factual results. No engine rewrites or countdown presentation. Memory Match retains its separate working board. |
| `smaran_ai_daily_timeline_my_day` | `components/my-day/my-day-content.tsx` | Date/completion summary and chronological time-first cards; retain real reminders, completion handlers, caregiver-only management and notification states. No fake medication, snooze, BP values or arrivals. |
| `smaran_ai_my_memories_regional_reminiscence` | `app/patient/my-memories.tsx`, memory detail/editor | Memory intro/audio, photo-led cards and warm empty state. Real personal photos only; supplied family photograph must not masquerade as the person's family. Existing recording/detail workflow stays intact. |
| `smaran_ai_north_east_heritage_my_home` | `app/patient/my-home.tsx`, regional detail | Regional intro, featured landscape and narrative cards using existing eight-state content. The supplied Brahmaputra illustration is appropriate only for Assam. Retain image credits and existing speech; no soundscape player. |
| `smaran_ai_caregiver_center_pairing` | `app/caregiver/home.tsx`, `pairing.tsx`, `components/caregiver/*` | Consistent caregiver header, actual identity/status, bordered metrics and pairing panels. Retain real account-based expiring codes/scopes/revocation. No QR/P2P simulation. |
| `smaran_ai_caregiver_reports_analytics` | `app/caregiver/reports.tsx`, `activity.tsx`, `care-workspace.tsx` | Clear reporting periods, factual report sections, selected states and existing export controls. No invented physician observations, stability curve or latency baseline. |
| `smaran_ai_settings_accessibility` | `app/patient/settings.tsx`, menu, appearance controls | Reading preview, section navigation, selected settings and shared header. Keep all existing text scaling, four appearance modes, language, voice capabilities and reduced motion. No invented dual-language voice/speed/doctor voice. |
| `smaran_ai_location_offline_vault` | `app/patient/location.tsx`, `components/location/location-panel.tsx`, caregiver location | Privacy/consent panel, actual device battery and actual location freshness/map. Keep account/permission requirements and foreground-only sharing. No encrypted-vault guarantee, background schedule, zero-battery claim or fake offline queue. |

## Reuse and visual rules

- Refine existing `ScreenWrapper`, `SmaranBrand`, `SmaranButton`, `SmaranCard`, `Field`, `SelectionCard`, `ReadScreenButton`, `ThemedText` and theme tokens. Add only a shared page introduction and progress primitive needed by multiple screens.
- Use warm alabaster `#FAF8F5`, deep teal `#0F766E` / `#005C55`, slate ink, terracotta memory accents, sage completion and gentle attention surfaces. The design guide's warm-canvas prose and task instructions take precedence over its conflicting cool-blue generated token block.
- Maintain at least 56px controls, 18px body/secondary text, generous line height and strong visible borders; preserve larger text and high contrast. Do not copy the mockups' 10–13px labels.
- Plus Jakarta Sans is not currently bundled. Retain the native system font fallback without adding a font dependency in this pass.
- Keep navigation semantics, Android/gesture back, deep links, loading/retry states and persistence. No route removals, data migrations, service changes or dependency upgrades.
- Supplied illustration assets are decorative only, never patient records. No external image hotlinks.

## Validation

Results, screenshot comparisons, limitations and final Git state will be recorded in `docs/STITCH_UI_PASS1_VALIDATION.md` after implementation. Android export is bundle evidence, not proof of device behavior; web cannot validate native SQLite flows.
