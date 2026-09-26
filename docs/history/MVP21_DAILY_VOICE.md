# MVP-21: daily reminders and read-aloud

Takeover validation completed on 11 September 2026 in `C:\Users\Dharmin\OneDrive\Desktop\SMARAN-A`, branch `feature/mvp21-daily-voice`. HEAD and `smaran-mvp20-stable` both resolve to `5381c768f02301af982ea206186271e9902173b4`.

The inherited implementation was preserved. This takeover added this handoff and removed temporary QA artifacts; no production source changes were needed after inspection and validation. The worktree remains uncommitted. No branch, commit, merge, tag, APK/native build, dependency installation, permission change, or migration was made.

## Takeover and architecture audit

Initial branch/status/diff/whitespace/untracked checks found 12 modified tracked files, three new implementation/check files, and `.playwright-mcp` logs/snapshots. `.expo/mvp21` contained `setup.cjs`, `bridge.cjs`, and three screenshots. This document did not exist. The prior reported results were checked against source and rerun rather than accepted as evidence.

The existing architecture remains: Expo SDK 54 / React Native 0.81 / React 19.1, Expo Router screens, Zustand transient preferences/session revision, SQLite repositories, SecureStore routing/preferences, `expo-notifications`, and `expo-speech`. The [versioned Expo SDK 54 reference](https://docs.expo.dev/versions/v54.0.0/) and [Speech contract](https://docs.expo.dev/versions/v54.0.0/sdk/speech/) were read. No parallel reminder or voice system was introduced.

The editor uses `src/my-day/presets.ts` to fill existing fields. `my-day.service.ts` serializes mutations and OS scheduling. `my-day.repository.ts` validates and scopes bound SQL to the patient. SQLite remains the reminder/history source of truth. Reminder persistence succeeds independently of optional notification delivery; notification failures retain saved data and expose retry/fallback.

## Five presets and persistence

| Preset | Existing stored type | Editable default | Recurrence default |
| --- | --- | --- | --- |
| Medicine | `medicine` | 08:00 | Daily |
| Water | `hydration` | 10:00 | Daily |
| Meal | `custom` | 12:00 | Daily |
| Activity | `activity` | 16:00 | Daily |
| Appointment | `appointment` | 09:00 | One date |

Other/custom remains available. Presets fill a translated title and schedule for new reminders. All fields remain editable, and a one-date reminder requires a future date/time before saving. These clock defaults are form conveniences, not treatment or lifestyle recommendations. Selecting a preset while editing preserves existing title/time/date fields.

Meal is a custom reminder with a translated default title, not a new persisted category. Reopening it shows Other/custom because no hidden preset metadata exists. The application does not infer a category from the title.

Migration 004 already provides the necessary tables, validation constraints, composite reminder/patient foreign key, unique reminder/day completion index, and append-only event triggers. Migrations 001–007 and their registry are unchanged from the baseline. No new migration exists. `time_of_day` and the time-bearing `scheduled_for` occurrence remain required: truly untimed reminders require a separately approved schema migration and are outside this milestone.

The existing 50-enabled-reminder-per-patient limit, soft removal, notification revision/acknowledgement, daily/one-date schedules, local occurrence dates and UTC audit timestamps remain. Tests cover file-backed SQLite reopen and exact retained history; physical app restart is still unverified.

## Water and medical-safety boundary

Water offers one visible **Drank water** action for a pending scheduled reminder. A successful tap inserts the existing completion event with reminder ID, patient ID, scheduled occurrence, `completed` status, and completion/creation timestamps. Duplicate taps cannot produce a second event for that reminder/day. This is one scheduled occurrence per day, not a running water-consumption counter.

The screen says that the tap does not verify water intake. Completed reminders display **Marked completed at {time}**. No quantity, litres/day advice, hydration target, adequacy assessment, dehydration risk, medical verification, adherence proof, or benefit is stored or inferred. Medicine retains the instruction to follow the healthcare professional's instructions. No clinical validation is claimed.

Events do not snapshot title or category. Completion wording and caregiver history stay generic even after a reminder is edited. Caregiver reporting retains factual schedules, marked completions, counts, and timestamps; it does not fabricate historical medication or hydration categories.

## Patient isolation and stale writes

The inherited fix captures `capturePatientRequest()` **before** entering the service queue. The closure captures a session revision, rather than merely comparing patient IDs. Returning A → B → A cannot revalidate a closure from the first A session. Mutation execution also resolves the active patient and checks ownership.

The repository receives that same validity closure and checks it at transaction entry, after asynchronous reads, before writes, and after writes before the transaction callback completes. A switch detected after SQL execution throws inside the exclusive transaction, causing rollback. Create, edit, enable/disable, remove and completion use these checks. Read-only notification reconciliation retains explicit patient scoping and generic content; it does not create a completion or change another patient's reminder fields.

My Day and its editor capture the session at mount. Stale rendered actions cannot initiate new writes after a switch. Reads and UI updates check validity; My Day also invalidates older refresh requests on blur or replacement. Existing profile selection resets navigation, invalidates the session, clears cognitive state, and requires speech to stop before changing the active patient.

`check-daily-voice.cjs` passed against real disposable SQLite with queued create/edit/toggle/remove/completion rejection, A → B → A invalidation, delayed screen reads, duplicate Water taps, cross-patient completion rejection, and rollback injected at transaction/read/write boundaries. Post-write rollback checks preserve original title, enabled/deleted state, row count and empty completion history. The existing profile-switch and My Day checks also passed. Browser A → B → A showed A's Water reminders only under A and B's Hindi Meal only under B; returning to A retained its original completion timestamp. Editing A's note preserved that timestamp.

## Notification privacy and limitations

Native notification title/body use only translated generic wording: **Smaran reminder** / **Open Smaran to see your reminder.** Neither patient identity, reminder/medication title, note, diagnosis, nor other sensitive details enter visible notification content. The payload contains an opaque reminder ID. Tests compare the entire scheduled content for all seven languages. Existing reconciliation also removes previously presented content that does not match an approved generic translation. There is no new privacy opt-in.

Existing daily/date scheduling, stable identifiers, permission fallback and cancellation retries remain. A notification API failure cannot roll back an already saved reminder. Web reports device notifications unavailable. Physical delivery, lock-screen behavior, reboot, force-stop, timezone changes and battery restrictions remain device checks.

The existing daily-trigger limitation remains: marking a daily reminder completed before its clock time may still allow that day's notification. The recurring alarm is retained so subsequent days continue. One-date completion is canceled on reconciliation. No new early-completion suppression is claimed; see [the My Day scheduling limitation](MVP8_MY_DAY.md).

## TTS and seven-language capability

Read-aloud uses the installed `expo-speech` package. The service enumerates actual device voices, normalizes locale tags, requires a matching language, and passes the selected voice identifier. It never substitutes English for an unavailable regional voice. The romanized Meitei catalog requires an explicitly Latin-script Meitei voice; `mni-IN`, Bengali-script and Meetei-script voices alone are rejected. Romanized UI text does not establish native voice availability or pronunciation quality.

Each start clears previous speech and checks a monotonically increasing request counter after asynchronous boundaries. Stop invalidates pending work and clears speech; old callbacks are ignored. The button separates starting from the engine's start callback, keeps Stop reachable while starting, and clears work on blur/unmount, language/text/preference changes, or backgrounding. Profile switching also calls the required stop path. The [Expo Speech API](https://docs.expo.dev/versions/v54.0.0/sdk/speech/) defines stop as interrupting current speech and removing queued utterances.

Settings displays UI translation availability separately from TTS availability. A failed voice query reports unknown; a completed query without a suitable voice reports unavailable. Check voices again, focus, and app foreground refresh the matrix. Visible text and touch controls remain available without speech input or a matching TTS voice.

Observed in Windows Chrome 152 during this takeover; these are browser findings, not phone guarantees:

| UI language | UI catalog | Matching TTS voice observed | STT in this app |
| --- | --- | --- | --- |
| `en` English | Present | Available: three local `en-US` voices enumerated | Not implemented |
| `hi` Hindi | Present | Unavailable | Not implemented |
| `as` Assamese | Present | Unavailable | Not implemented |
| `bn` Bengali | Present | Unavailable | Not implemented |
| `mni` Meitei | Present, romanized | Unavailable | Not implemented |
| `kha` Khasi | Present | Unavailable | Not implemented |
| `lus` Mizo | Present | Unavailable | Not implemented |

English start/stop was verified through real browser engine state, including `speaking` and an empty pending queue after stop/navigation. Hindi produced the actual localized unavailable message with no speech or pending queue. The automated seven-language voice matrices use simulated voice lists and verify matching logic; they do not prove installed voices for all languages. No listening/pronunciation or native-speaker linguistic validation is claimed.

## STT: not implemented; approval gate remains

Speech input is **not implemented**. No recognizer package, microphone capture, cloud recognizer, wake word, or continuous listening was added. Touch controls are the supported production path. Android still blocks `android.permission.RECORD_AUDIO`; the image-picker microphone option remains false, and no iOS speech/microphone configuration was added.

`expo-speech-recognition 3.1.3` is only a researched future candidate. Its [versioned package manifest](https://github.com/jamsch/expo-speech-recognition/blob/v3.1.3/package.json) lists Expo `~54.0.32` for development, supporting its candidacy for SDK 54; this is not installation or build verification in Smaran.

Future approval must cover the dependency, lockfile, config plugin and native permission changes together. The candidate's [versioned setup and permission documentation](https://github.com/jamsch/expo-speech-recognition/blob/v3.1.3/README.md) describes microphone/speech permission prompts and Android recognition-service visibility configuration. Android would need the current recording-permission block removed plus manifest/runtime microphone authorization; iOS would need microphone and speech usage descriptions (`NSMicrophoneUsageDescription`, `NSSpeechRecognitionUsageDescription`) and applicable runtime authorization. Native integration would require rebuilding the app, separately authorized.

Recognizer service, installed models, OS version and locale determine device/offline support. Models may require downloads; available UI translations cannot guarantee recognition of all seven languages. Android's [SpeechRecognizer documentation](https://developer.android.com/reference/android/speech/SpeechRecognizer) warns that recognition may send audio to remote servers. No future system should label this automatically offline or private without device/service verification.

The planned push-to-talk flow is: explicit touch start → capability/permission check → stop TTS → one recognition request tied to the captured patient revision → show an editable transcript → explicit touch confirmation through the existing validated reminder service. Stop/cancel, navigation, backgrounding and patient switching would abort recognition and invalidate late results. Failure would retain text/touch entry. This is a plan only; no recorder, transcript persistence, recognition adapter or command parser was scaffolded.

## Offline and accessibility evidence

Native reminder reads/writes and touch flows use local SQLite and require no application server. Speech depends on installed OS voices, which can require a download or network; universal offline TTS is not claimed. The existing Bhashini module is an unchanged `available: false` / `not-configured` stub with no network implementation.

Browser QA used `http://127.0.0.1:8087` at 360×800, 768×1024 and 1280×800. The unmodified web client first showed its expected recovery/Retry screen because native storage is unavailable. Only then did the existing temporary harness substitute in-memory SQLite and SecureStore boundaries for synthetic A/B profiles. Actual screens, services and speech engine were exercised. This harness was test-only and was removed; it is not production web persistence or proof of native storage behavior.

Verified: Water create/complete/edit, five visible presets, patient switching and retained timestamps, English speech cancellation, Hindi fallback, voice capability refresh, extra-large text, reduced-motion preference, dark/high-contrast-dark/high-contrast-light themes, and wrapped layouts without horizontal overflow. Presets measured at least 88px high; primary Save/Continue/Drank water controls measured 72px; visible secondary controls/read-aloud measured 60px. Keyboard Enter activated voice refresh and showed a visible focus outline. Shared accessibility roles/labels/selected states, live feedback, ordinary scrolling and visible touch controls were inspected. No hidden gesture or required swipe was introduced.

The console contained the expected initial native-storage bootstrap error and Expo's existing unsupported web push-listener warning. There were no additional page errors or failed requests during the synthetic flows. Browser requests were for the local app and temporary loopback SQLite bridge, not cloud speech. Theme regressions passed 196 contrast pairs. Physical TalkBack/VoiceOver, focus order, touch and audio remain unverified on devices.

## Validation results

Each command below completed with exit code 0. The first visual-UX run correctly failed while QA artifacts existed; its unchanged cleanup assertion passed after cleanup. No test assertion was weakened during takeover. Inherited fixture updates align with the active-patient service boundary and the explicitly authorized MVP-21 source paths; protected dependency/config/migration checks remain.

| Regression command | Result |
| --- | --- |
| `node scripts/check-daily-voice.cjs` | PASS |
| `node scripts/check-cognitive-migration.cjs` | PASS |
| `node scripts/check-cognitive-ai.cjs` | PASS |
| `node scripts/check-profile-switching.cjs` | PASS |
| `node scripts/check-visual-ux.cjs` | PASS after QA cleanup |
| `node scripts/check-privacy-recovery.cjs` | PASS |
| `node scripts/check-analytics.cjs` | PASS |
| `node scripts/check-cognitive-expansion.cjs` | PASS |
| `node scripts/check-my-care.cjs` | PASS |
| `node scripts/check-my-day.cjs` | PASS |
| `node scripts/check-my-memories.cjs` | PASS |
| `node scripts/check-my-home.cjs` | PASS |
| `node scripts/check-native-hardening.cjs` | PASS; native/device checks excluded |
| `node scripts/check-product-hardening.cjs` | PASS |
| `node scripts/check-product-polish.cjs` | PASS |
| `node scripts/check-ux-overhaul.cjs` | PASS |
| `node scripts/check-elderly-ux.cjs` | PASS |

| Toolchain command | Result |
| --- | --- |
| `npx.cmd tsc --noEmit` | PASS |
| `npx.cmd expo lint` | PASS |
| `npx.cmd expo-doctor` | PASS, 18/18 |
| `npx.cmd expo install --check` | PASS, dependencies up to date; no installation |
| `npx.cmd expo config --type public` | PASS, SDK 54, existing microphone block retained |
| `npx.cmd expo export --platform all` | PASS: Android and iOS Hermes bundles, web bundle, 34 static routes |
| `git diff --check` | PASS |

Export is bundling validation, not an APK/native compilation or device test. The existing unsupported web notification-listener warning appeared during export.

## Cleanup, protected paths and changed files

The test browser was closed and the identified MVP-21 bridge/Metro test processes stopped. `.expo/mvp21` and `.playwright-mcp` were deleted after verifying their exact workspace-contained paths. This removed old/new harnesses, screenshots, snapshots and logs; stopping the in-memory bridge discarded only synthetic QA fixtures. No workspace QA browser profile remained. Existing Expo `cache`, `types`, `web`, `devices.json`, and `README.md` were retained as legitimate metadata; `dist` is the requested ignored export output.

Baseline comparison and untracked checks confirm unchanged `package.json`, `package-lock.json`, `app.json`, `eas.json`, `plugins/with-private-backup.cjs`, `src/db/client.web.ts`, and all migrations 001–007 plus the registry. No new migration or dependency/config change exists.

The production scan for conflict markers, loopback hosts, Playwright, recognizer packages, microphone terms and cloud/provider/key terms found only the unchanged unavailable Bhashini stub and existing `RECORD_AUDIO` block / `microphonePermission: false` configuration. No unauthorized recognizer/cloud integration or QA dependency was found. Tests and this document legitimately describe gates and temporary QA.

Final changed-file inventory (12 modified tracked files and four untracked additions):

```text
 M app/patient/my-day-reminder.tsx
 M app/patient/my-day.tsx
 M app/patient/settings.tsx
 M components/accessibility/read-screen-button.tsx
 M components/my-day/shared.tsx
 M scripts/check-my-day.cjs
 M scripts/check-native-hardening.cjs
 M scripts/check-visual-ux.cjs
 M src/db/repositories/my-day.repository.ts
 M src/i18n/my-day-strings.ts
 M src/services/my-day.service.ts
 M src/services/speech.service.ts
?? components/accessibility/voice-capabilities.tsx
?? docs/history/MVP21_DAILY_VOICE.md
?? scripts/check-daily-voice.cjs
?? src/my-day/presets.ts
```

## Remaining physical-device checks and commit assessment

Before release, verify Android/iOS SQLite persistence across restart and background transitions; real rapid A → B → A operations; notification permission denial/retry, private lock-screen content, daily/date delivery, timezone/reboot/force-stop/battery behavior and shared-device scheduling limits; installed voices and offline availability for each language; start/stop/repeat/background/patient-switch audio and empty queues; iOS silent-mode behavior; TalkBack/VoiceOver focus/announcements, large system text, dark/high contrast and reduced motion. Regional translations and pronunciation require fluent-speaker review. No clinical or linguistic certification is implied.

Safe to commit as the scoped MVP-21 scheduled-reminder/TTS milestone with STT and untimed reminders explicitly gated. No blocking source defect was found in the audited paths. This assessment does not certify a native release, and no commit was created.
