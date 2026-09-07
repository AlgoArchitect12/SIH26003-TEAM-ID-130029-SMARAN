# MVP-13 Native Android Test Plan

All physical cases start **NOT RUN**. Use only a standalone `preview` APK for release acceptance. Expo Go verification != standalone verification; Expo export PASS != standalone APK PASS. Host SQLite checks do not execute Android's SQLite library.

Record each case in `MVP13_NATIVE_ANDROID_RESULTS.md`: PASS / FAIL / NOT RUN, tester, date/time/timezone, device model/Android version, APK build ID/hash, steps, expected/actual result and evidence. Never mark a case PASS based only on code review, Expo Go, host tests or export. Use synthetic patient data in evidence.

## Build and installation checkpoint

Current status: **BLOCKED — USER AUTH REQUIRED** / **BLOCKED — PHYSICAL DEVICE REQUIRED**.

From the project directory in PowerShell (use `.cmd` because this machine blocks the PowerShell npx shim):

```powershell
npx.cmd eas-cli login
npx.cmd eas-cli whoami
npx.cmd eas-cli init
npx.cmd eas-cli project:info
npx.cmd eas-cli build --platform android --profile preview
```

During `init`, the user must choose the correct account/project. Link an existing project if appropriate; create one only after deliberately confirming ownership. Review the new `extra.eas.projectId`/owner and any signing-credential decision. No project, login or signing credentials were created in this milestone. EAS uses internet for building/downloading; core operation uses bundled assets/local storage.

Download the resulting APK to ignored `release-artifacts/`, outside tracked source. Record build ID, status, profile, version `1.0.0`, versionCode `1`, package `com.smaran.ai`, APK SHA-256 and signing identity. Inspect the final APK's merged permissions with Android SDK `apkanalyzer manifest permissions <apk>` and confirm the SQLite compile flag in the build log. Config introspection is not the merged APK manifest.

When Android platform tools and an authorized device are available:

```powershell
adb version
adb devices
adb install -r .\release-artifacts\smaran-preview.apk
```

Install only the verified Smaran APK. Stop on signing/package/version conflict; do not uninstall or clear data to work around it. Alternatively, the user can download and install the APK on the phone. Do not change global phone settings automatically.

## Physical cases

Each unchecked item has status **NOT RUN** until its procedure is observed. Record notes even when a case is blocked. Install a matching APK on a spare test phone for fresh-install cases; preserve existing user data.

- [ ] **INSTALLATION** — Install APK; verify installed display name Smaran AI, package/version, launch icon and splash. Record device/API level and artifact. Status: NOT RUN. Notes: ____.
- [ ] **COLD START** — Launch from launcher without Expo Go; reach onboarding on a fresh install, or the actual patient home on an existing install. No blank screen, redbox or indefinite splash. Status: NOT RUN. Notes: ____.
- [ ] **NO METRO** — Stop development servers, disconnect USB, turn off Wi-Fi, launch the APK from its icon. No Metro prompt, Expo Go or same-network requirement. Status: NOT RUN. Notes: ____.
- [ ] **FRESH INSTALL / MIGRATIONS 001–006** — On a spare clean installation, complete onboarding; verify no fabricated profile, sessions, model or caregiver metrics before entering data. Exercise every local feature. Native migration inspection must show versions 1–6 once each and no FK violations; if that inspection is unavailable, keep the internal migration case NOT RUN even if onboarding succeeds. Status: NOT RUN. Notes: ____.
- [ ] **POPULATED UPGRADE / MIGRATION 006** — Use a backed-up synthetic database from the matching signed stable APK; update with `adb install -r`. Compare exact historical Memory Match/session/model fields, profile/settings, reminders and memories; repeat launch. Native SQL diagnostics on an authorized test installation should read `PRAGMA foreign_keys` on both shared and exclusive-transaction handles (=1), `PRAGMA foreign_key_check` (empty), migration ledger (1–6), both cognitive indexes and `(patient_id, game_type)` PK. Do not copy development SQLite files over patient data. If no safe diagnostic access to this binary exists, internal SQL inspection remains NOT RUN. Status: NOT RUN. Notes: ____.
- [ ] **PROFILE PERSISTENCE** — Create a synthetic named patient, language, region and accessibility choices; close/reopen. Same profile/settings; no fallback patient. Test unavailable or inconsistent SecureStore only on a disposable test installation with an authorized failure harness. Status: NOT RUN. Notes: ____.
- [ ] **APP DATA PRESERVATION / RESTART** — Create profile + one completed session of each game + one reminder + one memory/photo. Force-stop Smaran, then relaunch manually. All recorded state survives, without duplicate writes. Do not clear storage. Status: NOT RUN. Notes: ____.
- [ ] **STARTUP RECOVERY** — With an authorized test-only storage failure, verify calm retry UI without raw database errors; remove fault and retry. Never corrupt a user's database for this test. Status: NOT RUN. Notes: ____.
- [ ] **MEMORY MATCH** — Train My Mind → Memory Match; play complete session, hints/retries, result, Why This Level, feedback; return to Train My Mind. Verify large tap targets, no blocked layout, one persisted session and bounded recommended level. Status: NOT RUN. Notes: ____.
- [ ] **PATTERN RECOGNITION** — Repeat navigation, all choice interactions, hints/retries, completion, result, Why This Level, feedback and return; verify own game type and history. Status: NOT RUN. Notes: ____.
- [ ] **ROUTINE RECALL** — Repeat with ordered tap selections (no drag required), gentle incorrect-choice response, completion/result/Why/feedback/return; verify own history. Status: NOT RUN. Notes: ____.
- [ ] **ADAPTIVE PERSISTENCE** — Record Memory Match next recommendation, feedback and history; force-close/reopen; check persisted result/history and the next session's recommendation. Repeat Pattern and Routine. Inspect per-game model snapshots via authorized diagnostics if available: Pattern must not change Memory Match; Routine must not change either sibling. Keep unobservable internal model claims NOT RUN. Status: NOT RUN. Notes: ____.
- [ ] **PATIENT ISOLATION** — On an authorized synthetic multi-patient fixture, verify profiles cannot read/edit each other's sessions, reminders or memories; compare per-game model rows. Do not add a patient-switching feature for QA. Status: NOT RUN. Notes: ____.
- [ ] **MY DAY** — Add/edit/disable/enable/delete reminders of supported categories; mark Done twice; check one completion. Reopen and verify state/history. Core in-app reminders work without OS notification permission. Status: NOT RUN. Notes: ____.
- [ ] **ANDROID 13+ PERMISSION DENIAL** — Fresh test install: ordinary launch/navigation must not prompt. Open My Day and tap Allow notifications deliberately; deny. Add/edit/Done still work; revisit/restart/Retry must not repeatedly prompt. Status: NOT RUN. Notes: ____.
- [ ] **NOTIFICATION PERMISSION GRANT / CHANNEL** — On a separate fresh fixture, grant from My Day; check Android channel `my-day`, name `Smaran reminders`, default importance and user-controlled sound. If previously denied, user may enable notifications in app settings, then return and Retry. No broad storage/camera/mic/overlay/exact-alarm request. Status: NOT RUN. Notes: ____.
- [ ] **ONE-TIME NOTIFICATION** — Set a one-time reminder 3–5 minutes ahead, leave app in background, optionally lock screen; observe delivery time and tap. App must open/resume safely (no reminder-specific deep-link promise). Do not force-stop before delivery: Android suppresses alarms for force-stopped apps until manually reopened. Inexact alarms/Doze can delay delivery; record actual delay. Status: NOT RUN. Notes: ____.
- [ ] **DAILY NOTIFICATION** — Set a daily reminder 3–5 minutes ahead; background app and observe delivery once, safe tap, and future repeating behavior. Check restart/timezone reconciliation without duplicates. Status: NOT RUN. Notes: ____.
- [ ] **EARLY DONE LIMITATION** — Mark a daily reminder Done before its time: it may still notify later the same day. Confirm next day's schedule survives; do not report same-day suppression. For a one-time reminder, mark Done, let synchronization finish, and check its future schedule is canceled. Status: NOT RUN. Notes: ____.
- [ ] **CANCEL / RESCHEDULE / REVOKE** — Move a future reminder, disable or delete it; observe old notification is canceled and new schedule behaves correctly. Revoke permission manually, reopen; in-app data survives and no crash. Status: NOT RUN. Notes: ____.
- [ ] **MY MEMORIES PICKER** — Tap Choose photo; modern system picker opens without broad library permission. Cancel safely, then select a local image; save name/relationship/description. Test permission/provider failure and invalid/missing cache source via an authorized test harness; old data must survive. Status: NOT RUN. Notes: ____.
- [ ] **PHOTO ADD SURVIVAL** — Add a memory photo → save → close/force-stop → manually reopen → My Memories → same photo appears. Picker cache URI must not be the database photo path. Status: NOT RUN. Notes: ____.
- [ ] **PHOTO REPLACEMENT SURVIVAL** — Edit that memory → replace photo → save → close/reopen → new photo appears. Old photo is cleaned only after the new database value commits. Status: NOT RUN. Notes: ____.
- [ ] **PHOTO REMOVAL SURVIVAL** — Remove photo → save → close/reopen → fallback appears and memory text remains. Then delete the synthetic memory and verify it stays deleted. Status: NOT RUN. Notes: ____.
- [ ] **PHOTO FAILURE / MISSING FILE** — In an authorized disposable fixture simulate failed copy/save/cleanup or missing managed file. Calm fallback/retry; existing photo survives failed replacement; no cross-patient cleanup. Do not delete user photos manually. Status: NOT RUN. Notes: ____.
- [ ] **MY HOME ALL 8 STATES** — Verify all four bundled items/images per state (32 total): Arunachal Pradesh, Assam, Manipur, Meghalaya, Mizoram, Nagaland, Sikkim, Tripura. Use each stored region on test profiles; no Assam fallback for an unrelated/invalid state. All images open offline. Status: NOT RUN. Notes: ____.
- [ ] **MY CARE** — Visit caregiver dashboard with empty and populated local records; cognitive sessions, routine completions, memories and upcoming reminders match entered data. Repeated focus refresh does not mutate records or schedule notifications. No remote-caregiver or medical assessment claims. Status: NOT RUN. Notes: ____.
- [ ] **ALL 7 LANGUAGES** — English, Hindi, Assamese, Bengali, Manipuri, Khasi and Mizo: onboarding, patient home, three games/results/Why, My Day, My Memories, My Home and My Care render translations without missing keys. Native fonts/scripts and wrapping need observation. Status: NOT RUN. Notes: ____.
- [ ] **EXTRA-LARGE TEXT / TABLET** — Use extra-large app text and larger system font; check compact phone and tablet widths, portrait, keyboard, edge-to-edge insets, scrolling, visible actions, no clipped game choices. Status: NOT RUN. Notes: ____.
- [ ] **HIGH CONTRAST** — Enable contrast preference; check text/actions/focus/selection and every game without relying on color alone. Status: NOT RUN. Notes: ____.
- [ ] **REDUCED MOTION / HAPTICS** — Enable reduced motion; check calm transitions and all actions visually understandable with haptics unavailable/off. No harsh error vibration. Status: NOT RUN. Notes: ____.
- [ ] **VOICE** — Explicit Read screen → Stop; navigate away during voice lookup/playback and confirm cancellation. Test each language with installed voices and without one. Offline voice availability varies by Android TTS engine/downloaded voice; translations stay visible, no claim of unsupported voices. Status: NOT RUN. Notes: ____.
- [ ] **TALKBACK** — User enables TalkBack; navigate all major screens and three games with labels/roles/state announcements and sufficient targets. No drag-only or unlabeled mandatory action. Status: NOT RUN. Notes: ____.
- [ ] **AIRPLANE MODE / APP RESTART WHILE OFFLINE** — Follow the exact SIH sequence below. Status: NOT RUN. Notes: ____.
- [ ] **OPTIONAL REBOOT** — Schedule a future reminder; user chooses when to reboot; observe reboot receiver/future notification behavior and local data after unlock. Never reboot automatically. Status: NOT RUN. Notes: ____.

## Exact SIH airplane-mode sequence

1. Install the standalone preview APK and launch once. Complete a synthetic profile with selected language/region/preferences.
2. Complete Memory Match, Pattern Recognition and Routine Recall; note each result and next recommendation. Add one future reminder and one memory with a local photo.
3. Close Metro/Expo development servers; disconnect USB. The user manually enables airplane mode and confirms Wi-Fi is off.
4. Force-stop **Smaran AI only**, then manually launch its installed icon. Do not clear data, uninstall, reboot or reset the phone.
5. Verify profile/preferences and Patient Home; open Train My Mind, play all three games, view results/Why/feedback and verify histories/models remain independent.
6. Open My Day and verify local reminders/completions; add a future one-time reminder. Background the app (do not force-stop) and observe notification delivery if permission is granted.
7. Open My Memories and existing photos; perform add/restart, replace/restart, remove/restart sequences above using local images.
8. Open My Home, all items for the selected region (repeat stored-region fixtures for all eight); open My Care and check local recorded activity and the medical-safety statements.
9. Force-close/reopen again while still offline. Repeat navigation, check saved state and absence of Metro/network prompts. Record each observed outcome separately.
10. Leave device settings under user control. Record failures/delays honestly; stop if any data/signing conflict needs a decision.

Smaran shows activity recorded in this app. These records are not a medical assessment. Smaran does not diagnose or assess dementia.
