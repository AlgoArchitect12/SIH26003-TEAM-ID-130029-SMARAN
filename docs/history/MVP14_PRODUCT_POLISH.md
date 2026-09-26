# MVP-14 Product Polish

Date: 2026-09-08. Branch/HEAD: `feature/mvp13-native-hardening` / `6b1c0f5`.

The user reports the first standalone Android APK was built and installed. This sprint did not build an APK or perform physical-device testing. The older MVP-13 reports retain their original historical results.

## Starting state preserved

Initial tracked diff: `.gitignore`, `app.json`, `components/error-boundary.tsx`, `src/services/my-day.service.ts` (35 insertions, 4 deletions). Initial untracked files: `eas.json`, `scripts/check-native-hardening.cjs`, and the three `docs/MVP13_NATIVE_*.md` documents. SHA-256 comparisons after the sprint confirm all nine are byte-for-byte unchanged from the starting working tree, including EAS linking metadata, package identity, permissions, and notification/privacy hardening.

## High-impact fixes

| Finding | Change |
| --- | --- |
| Home cards used uppercase headings and consumed too much space | Sentence-case headings, smaller decorative icons, consistent compact secondary cards, prominent teal Train My Mind card; greeting and offline context retained |
| Brand presentation was inconsistent | Home uses Smaran AI and `Memories that stay close.`; tagline has matching fixed strings in all seven catalogs |
| Activity hub looked like unrelated text cards | Reused HomeActionCard for Memory Match, Pattern Recognition and Routine Recall, with distinct existing icons and short existing descriptions |
| Result facts were scattered above and below actions | Clear completion mark, one factual summary card, a distinct next-level card, retained optional feedback, explanation and primary return action; save shows a spinner |
| Explanation exposed baseline/pace terminology | Shows the saved recommendation, plain-language explanation, activity facts and the existing explanation that adaptation uses the patient's own history; medical disclaimer retained |
| Back actions could leave duplicate parent screens | Parent-return actions now dismiss to the existing parent; direct-entry fallback verified. Removed duplicate Back/Home controls in My Care and My Home/recovery; explanation Back has a direct-entry fallback |
| Reminder completion was ambiguous; empty Today could imply no reminders exist | Check icon and success surface plus `Marked done in Smaran`; empty Today says no reminders are scheduled today, while Manage retains its all-reminders empty message |
| Loading was often text alone | Shared calm indicator for the hub, selection games, daily-support routes, caregiver view, regional recovery and database startup; reminder load failure no longer also shows an indefinite loading state |
| My Care had too much material before useful records | Patient context first, three at-a-glance metrics, then cognitive/routine/upcoming/memory/history sections; useful empty-state actions; removed future account-linking copy across seven catalogs |
| Mobile spacing and text hierarchy varied | Shared 16dp side padding and 32dp bottom padding; relationship text is secondary on memory list/detail; My Home retains existing image/content presentation |
| Startup recovery lacked the common safe-area wrapper; status-bar contrast did not follow custom high contrast | Startup now uses ScreenWrapper; status-bar text follows the active background; root navigation transitions match existing no-animation stacks |

No adaptive mathematics, telemetry semantics, schema, migrations, notification scheduling, media architecture, role/profile architecture, cultural facts or licensed assets changed. My Day retains the accepted early-Done notification limitation. No medicine-taking claim or clinical assessment was introduced. The requested clinical-term scan of changed production files found no matches; existing nonclinical disclaimers remain intact.

## Verification

All commands below passed on the final production source (temporary browser storage adapters removed):

- `node scripts/check-native-hardening.cjs`
- `node scripts/check-cognitive-expansion.cjs`
- `node scripts/check-my-care.cjs` (device-local, Asia/Kolkata, UTC, America/New_York)
- `node scripts/check-my-home.cjs`
- `node scripts/check-my-memories.cjs`
- `node scripts/check-my-day.cjs`
- `node scripts/check-elderly-ux.cjs`
- `node scripts/check-product-polish.cjs`: 25 screen return actions tested against the installed stack router, including existing-parent preservation and direct entry. This is a host navigation contract check, not hardware Back testing.
- `npx.cmd tsc --noEmit`, `npx.cmd expo lint`
- `npx.cmd expo-doctor`: 18/18
- `npx.cmd expo install --check`: dependencies up to date; the first sandboxed request failed to fetch, then the approved network retry passed
- `npx.cmd expo config --type public`: SDK 54.0.0 and existing identities/config preserved
- `npx.cmd expo export --platform all`: Android/iOS Hermes bundles and 24 static web routes

Android export: `entry-ad5fd7332e8540aef93da0d1163741bd.hbc` (~4.85 MB). This is a JS/assets export, not an APK. Export emitted only non-failing color-environment and unsupported web notification-listener notices.

Browser QA used real production routes at `http://localhost:8081`, with temporary in-memory SQLite and local browser storage standing in for unsupported native web boundaries. Test-only records were created through onboarding and the actual game/reminder/memory flows; no production patient data was modified.

| Browser check | Result / scope |
| --- | --- |
| 375x812 English | Onboarding to Home, hub, all three game completions, save/result, explanation and repeated return navigation passed |
| Factual results | Memory: 3 pairs/3 attempts/0 hints/100%; Pattern: 5 patterns/6 selections/5 hints/83%, including gentle retry; Routine: 2 steps/2 selections/0 hints/100%. Care reflected these three saved activities |
| My Day | Empty Today, add water reminder, Done, manage/edit prefilled title, cancel/back passed; completion label is factual |
| My Memories | Empty state, create without photo, name/relationship/detail presentation, Hear/Stop and back-to-list passed |
| My Home | Local Assam list/detail, familiarity response and Home navigation passed; all 32 licensed assets verified by regression checks |
| My Care | Three actual test sessions, one completed reminder and one saved memory displayed correctly; no-upcoming-appointment state checked |
| 360x812 extra-large/high-contrast/reduced-motion | Home, hub, all games, result, explanation, Day, Memories/list/detail, Home/list/detail and Care checked; no horizontal overflow or controls below 48px. Long labels wrapped. An additional Routine completion at level 2 saved 3 steps/3 hints correctly |
| Seven languages | Home/tagline rendering and hub interaction spot-checked in en/hi/as/bn/mni/kha/lus at 360px with accessibility settings enabled; hub bounding-box checks found no overflow or small controls in any language |
| Recovery | Injected memory-list read failure showed calm copy without SQLite/path/error details; Try Again restored the list. Restored production web boundary showed the expected calm startup recovery |
| Speech/focus/tablet | Hear/Stop and navigation cancellation passed with browser speech; keyboard focus visible; 768x1024 Home respected 680px card maximum |
| Console/network | No unexpected application errors. Expected injected HTTP 500 and unsupported production-web storage failure were isolated recovery tests. Existing web notification/native-animation fallback warnings occurred. Resource hosts were localhost Metro and the temporary loopback bridge only |

Screenshots were inspected for Home, result, caregiver and extra-large Home/game layouts, then removed. Bridge processes, in-memory database, source adapters, backup, browser logs, screenshots and scratch files were removed. `src/db/client.web.ts` has a blank diff; the production SecureStore service is unchanged. Ignored `dist/` contains the requested production export.

## Still requires a physical device / deliberately deferred

- Android status-bar contrast, safe areas/edge-to-edge, hardware Back, keyboard/Save reachability, system font scaling and TalkBack require verification on the next manually rebuilt APK.
- Native notification permission/delivery, early-Done behavior, photo picker cancellation and managed-photo persistence, app reload/airplane mode/restart, and installed voices were not physically tested. Browser QA does not establish those results.
- Icon/splash assets remain the generic Expo artwork. No suitable existing Smaran raster assets were present. Manual design should provide the app icon, adaptive foreground/background/monochrome layers and splash mark before final branding review.
- New tagline translations require native-speaker review. Seven-language key/interpolation parity is verified; linguistic quality is a separate review. Existing English regional/routine bodies and device-dependent voice availability remain explicit.
- No new design system, game features, dependencies, cloud/backend, schema migration or SDK upgrade was added.

## Exact Git scope

MVP-14 modifies these 22 tracked files:

```text
app/_layout.tsx
app/caregiver/home.tsx
app/patient/games/index.tsx
app/patient/games/memory-match.tsx
app/patient/games/result.tsx
app/patient/games/why-level.tsx
app/patient/home.tsx
app/patient/my-day-reminder.tsx
app/patient/my-day.tsx
app/patient/my-home-memory.tsx
app/patient/my-home.tsx
app/patient/my-memories.tsx
app/patient/my-memory-editor.tsx
app/patient/my-memory.tsx
components/games/selection-activity-screen.tsx
components/layout/screen-wrapper.tsx
components/my-home/shared.tsx
components/patient/home-action-card.tsx
components/ui/smaran-button.tsx
src/i18n/care-strings.ts
src/i18n/regional-strings.ts
src/i18n/strings.ts
```

MVP-14 adds `components/ui/smaran-loading.tsx`, `scripts/check-product-polish.cjs`, and this document. Together with the nine preserved MVP-13 files, final Git scope is 26 modified tracked files and 8 untracked files. Tracked diff: 189 insertions, 135 deletions (includes existing MVP-13 work; excludes new files).

`git diff --check` passes. Package files and each migration 001-006 have blank diffs. Branch and HEAD are unchanged. No commit, branch switch, reset, merge, tag, push, deployment or APK build was performed.

References: [Expo SDK 54](https://docs.expo.dev/versions/v54.0.0/), [SDK 54 status bar](https://docs.expo.dev/versions/v54.0.0/sdk/status-bar/), and installed Expo Router/React Navigation stack implementation (return behavior verified against installed code).
