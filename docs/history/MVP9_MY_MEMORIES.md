# MVP9 — My Memories final report

Completed in the existing `feature/mvp9-my-memories` working tree, based on `ff79ac0` (`feat: add offline My Day reminders`). Validation date: 2026-09-06. No commit, staging, reset, or next milestone. Native Android ImagePicker/FileSystem: **NOT NATIVE VERIFIED**.

1. **Files created — 12:**

   ```text
   app/patient/my-memories.tsx
   app/patient/my-memory.tsx
   app/patient/my-memory-editor.tsx
   components/memories/memory-photo.tsx
   src/db/migrations/005_my_memories.ts
   src/db/repositories/memories.repository.ts
   src/memories/types.ts
   src/services/memories.service.ts
   src/services/memory-media.service.ts
   src/i18n/memory-strings.ts
   scripts/check-my-memories.cjs
   docs/history/MVP9_MY_MEMORIES.md
   ```

2. **Files modified — 9:**

   ```text
   app.json
   app/patient/home.tsx
   components/accessibility/read-screen-button.tsx
   package.json
   package-lock.json
   scripts/check-my-day.cjs
   src/db/migrations/index.ts
   src/i18n/strings.ts
   src/i18n/regional-strings.ts
   ```

   No production files deleted. The My Day script only changes the two expected migration counts from four to five and its migration-range output; its existing assertions remain intact. Two retry-effect lint warnings were fixed by using an explicit focus dependency with `useEffect`. Browser QA also identified and fixed the empty-name photo accessibility label. The new photo placeholder uses the supported style-level `pointerEvents` property.

3. **Dependencies:** Added SDK-compatible `expo-image-picker ~17.0.11` and direct `expo-file-system ~19.0.24` using Expo install. Reused existing `expo-image`, router, SQLite, state, speech, and UI dependencies. No other direct dependency added. The lockfile records the compatible transitive changes.

4. **Migration 005:** Appended to the existing production migration registry. The real 001–005 chain passes both fresh initialization and an upgrade containing existing patient, settings, cognitive, adaptive-model, reminder and completion-event rows. Running the migration runner twice leaves exactly five migration records and does not recreate the table. Existing data snapshots compare identically before and after 005. No existing database was reset or reseeded.

5. **Schema:** `personal_memories` contains `id`, `patient_id`, `name`, `relationship`, `description`, nullable unique `photo_path`, `created_at`, and `updated_at`. Required name is bounded to 100 characters; optional relationship and description are bounded to 100 and 500. The patient FK uses `ON DELETE RESTRICT`; photo paths have a patient-relative prefix constraint. An index supports patient-scoped ordering by most recently updated, then ID. No image BLOB or picker URI is stored.

6. **Repository:** `memoriesRepository` provides generated IDs, patient-scoped get/list/save/remove, bound SQL values, Unicode NFC normalization, trimmed boundary whitespace, input limits and strict managed-path validation. Create/update use the existing exclusive transaction API. Updates preserve `createdAt`. The save function returns committed values directly, so a later read failure cannot incorrectly trigger photo rollback after a successful commit. SQL column/parameter order was inspected and distinct-field CRUD values were verified against real SQLite. Other repositories were not modified.

7. **Managed media:** `memoryMedia` is the single picker/filesystem boundary, using SDK 54 `File`, `Directory`, and `Paths`. `memoriesService` coordinates the existing repository and media boundary. A single local promise queue serializes copy/save/cleanup operations; concurrent replacement checks pass. UI uses the small typed selected-photo/change values, not raw picker result objects. The implementation follows the [SDK 54 FileSystem API](https://docs.expo.dev/versions/v54.0.0/sdk/filesystem/).

8. **Stored path:** `memories/<patient-id>/<32-lowercase-hex-generated-id>.<extension>`, resolved against `Paths.document` at runtime. Supported extensions are jpg, png, webp, heic, heif, avif and gif; jpeg is normalized to jpg. Filenames never derive from the entered name, relationship or story. The source must be an existing nonempty picker-cache file of at most 20 MiB.

9. **Path protection:** The repository and media boundary reject absolute paths, unmanaged prefixes, another patient's directory, traversal, percent-encoded traversal, backslashes, unexpected suffixes and arbitrary filenames. The resolved file must remain under the validated patient's memories directory. Cleanup deletes only individually validated files, never a directory. Tests confirm that invalid deletion attempts do not reach the filesystem delete operation. These checks protect application inputs; no claim of protection against an attacker controlling the native app sandbox is made.

10. **Photo permission behavior:** Only the existing-image library picker is invoked after an explicit button press. The system picker grants access to the selection; no broad library permission request, camera, microphone or contacts API is called. Configuration explicitly disables camera and microphone permissions. Expo config introspection confirms Android CAMERA/RECORD_AUDIO removal directives and no iOS camera/microphone purpose entries. The iOS photo-library purpose string is configured. Expo's generated Android configuration retains its legacy READ/WRITE_EXTERNAL_STORAGE declarations; this feature does not request them at runtime. These are inspected contracts/configuration, not tested device prompts. See the [SDK 54 ImagePicker contract](https://docs.expo.dev/versions/v54.0.0/sdk/imagepicker/).

11. **Import:** Image-only, one selection, no editing, no requested EXIF/base64. Cancel leaves the current selection untouched. Denial/failure/unavailability show localized, optional-photo recovery. Import copies the cache file into persistent managed documents storage, refuses an existing destination, checks copied existence and byte count, and cleans a partial destination after copy failure. Real temporary files verified copy/resolve/delete through the production media code with only Expo's native boundary replaced. This does not certify Expo's implementation on Android. EXIF is not requested as a picker result; copying is not a guarantee that embedded metadata is stripped.

12. **Create-with-photo rollback:** Passed with an actual SQLite INSERT trigger injecting failure. Sequence was copy → failed transaction/rollback → staged-file deletion. No memory row remained and the file inventory returned to its baseline. The picker source was preserved. If staged-file cleanup also fails, the service returns a cleanup error and the localized UI reports the failed save/cleanup; it does not claim success.

13. **Replacement rollback:** Passed with an actual SQLite UPDATE trigger injecting failure. New photo is copied first; on update failure the old database row and old photo remain unchanged and the newly staged file is removed. Successful replacement produces copy → commit → old-file deletion. File/database reopen checks preserve the new path and updated content. A failed update that removes a photo also leaves the prior file untouched.

14. **Remove-photo behavior:** The database first commits `photo_path = NULL`, then the old file is cleaned. If cleanup fails, the memory remains valid without a photo, the file remains unreferenced on this device, and the detail screen displays the localized saved-with-cleanup-warning message. The test verifies this exact order and result. There is no automatic orphan sweeper or cleanup retry.

15. **Memory removal:** A patient-scoped database delete occurs before file cleanup. A failed database delete leaves the memory and photo intact. Successful delete plus failed cleanup returns `cleanupFailed`, keeps the record removed, and shows the localized warning on the list. Normal removal deletes both the record and its managed photo. Removed records remain absent after database reopen. Filesystem and SQLite changes are not a single atomic transaction; a process termination between operations can leave an unreferenced file.

16. **Missing-file fallback:** A missing, empty or rejected stored file resolves to no image. Image-decoding failure also shows a calm fallback. Name, relationship, description, Hear, Edit and Back remain available. Real filesystem missing-file checks and browser missing/undecodable-image checks passed. A missing memory ID has a separate recovery message.

17. **Patient isolation:** With distinct real patient rows, Patient B receives no list/get result for Patient A's memory and cannot update or remove it by guessed ID. The coordinating service also rejects cross-patient replacement/removal before copying or deleting files. Missing-patient inserts fail the real FK. `PRAGMA foreign_keys = ON` is asserted on every opened test connection; `foreign_key_check` is empty. No FK was silenced.

18. **Reopen persistence:** Text creation, photo path, edits, replacement and removals were verified across closing/reopening the real SQLite file. Managed test files survive database reopen and resolve through the real media code with the filesystem boundary substituted. Native application restart, native document-directory survival, reinstall and OS backup behavior have not been tested.

19. **Memory list:** Home's My Memories action now opens `/patient/my-memories`. The empty state contains no fake entries and offers Add a memory. Populated cards show a dominant photo/fallback, full wrapping name, optional relationship and labeled Open memory action. List loading/failure/retry were exercised. Content is a single column capped at 640px.

20. **Detail:** `/patient/my-memory` presents the large image/fallback, full name, relationship and description, Hear this memory, Edit, Remove and obvious navigation. It shows no database timestamps, filenames, scores or analytics. User text remains untranslated; the documented Unicode/whitespace validation is the only text normalization.

21. **Add flow:** `/patient/my-memory-editor` uses four short steps: optional photo, required person's name, optional relationship, optional familiar details. Each step has Back, localized progress, large Continue/Save and existing read-aloud assistance. Empty required name is rejected. A failed save retains the entered fields, and retry was exercised through the UI. No suggested fake person/story is seeded.

22. **Edit flow:** The same four-step editor loads the patient-owned memory and supports changing all text, replacing a photo, removing it or retaining it. Picker cancellation preserves the existing selection. Field content wraps and the original values remain available after failure. The name/relationship fields accept free text rather than a restricted family taxonomy.

23. **Remove flow:** An explicit inline confirmation explains removal from Smaran on this device and offers Keep memory before Remove memory. Both cancel and confirm were exercised in every language. Buttons disable during the operation, and a ref prevents duplicate submission.

24. **Hear this memory:** Reuses the existing `speech.service.ts`; only an optional label key was added to the existing shared button. The localized introduction plus entered name/relationship/description are spoken only after pressing Hear. Browser instrumentation of Expo's speech boundary confirmed Start, Stop, navigation cancellation, selected language for en/hi/as/bn/mni/kha/lus, and calm unavailable-voice recovery. The existing speech cancellation regression script passes. Actual audible output and installed phone voices were not tested. No second TTS service or Bhashini call was added; the feature has no application network request for private content. Device/offline voice availability remains platform-dependent.

25. **Seven languages:** 38 typed My Memories keys are supplied for en, hi, as, bn, mni, kha and lus and merged into the existing catalogs. Compile-time parity and runtime key/interpolation checks pass. All seven underwent browser layout checks. The photo preview before a name is entered now announces localized Selected photo; a named photo announces Photo of the entered name. A native-speaker translation review, including Manipuri transliteration and regional phrasing, remains outstanding.

26. **Elderly UX:** Existing large typography, theme, contrast preferences, generous spacing, large buttons, explicit Back, vertical scrolling and reduced-motion behavior are reused. Photos use a stable 4:3 frame and no transition. Text is not restricted to one line. Long unbroken 100-character name and relationship inputs wrapped in the phone view. Normal-theme and high-contrast views were inspected.

27. **Accessibility:** Browser accessible names convey name, relationship and Open memory; images use localized photo labels or visible fallback text. Decorative icons are hidden. Critical actions have text labels and tested targets of at least 56px. Keyboard Tab reached Hear with a visible solid focus outline. Screen-reader semantics were inspected in the browser; physical TalkBack/VoiceOver behavior was not tested. Reduced-motion checks found no running animation on the checked memory detail.

28. **375×812 QA:** Real Expo web screens at `http://localhost:8081`, with extra-large text, high contrast and reduced motion. Each of seven languages passed 13 matrix states: empty list, four add steps, populated list, detail, four edit steps, removal confirmation and missing-photo fallback (91 matrix checks). DOM overflow/target measurements found no horizontal overflow or sub-56px controls. Primary actions were reached through scrolling and used during the flows. Screenshots were inspected, including script rendering and long content. Additional checks covered failed save with retained input, retry, picker cancel/denial/unavailability, unnamed photo label, no-photo save, photo removal, corrupt image, missing record and speech recovery.

29. **768px QA:** Repeated the full 13-state matrix in English and Manipuri at 768×1024 with extra-large text, high contrast and reduced motion (26 checks). No detected horizontal overflow or small controls. The centered maximum content width kept photo/card sizing bounded. This is browser layout evidence, not a physical tablet certification.

30. **Regression QA:** Browser smoke checks passed all six onboarding screens, Patient Home, My Day, actual Memory Match play to all three matched pairs, Result, Skip feedback and Why This Level. The game/adaptive code ran unchanged; only storage boundaries supplied temporary browser data. The result and safe explanation rendered successfully. `check-elderly-ux.cjs` and `check-my-day.cjs` pass, including real reminder completion, duplicate prevention, foreign keys, append-only history, patient isolation and notification scheduling request checks. The existing daily early-Done notification limitation remains as documented in MVP8.

31. **Native Android status:** **NOT NATIVE VERIFIED.** `adb` was unavailable. No physical gallery selection, permission prompt, native copy/delete, app restart survival, TalkBack, installed-voice or notification delivery success is claimed. Production web SQLite/file persistence remains intentionally unsupported. Browser fixtures were runtime-only visual test substitutes, never production adapters. Core native storage is designed for offline SQLite + managed files; native airplane-mode certification remains outstanding.

32. **Final validation after removing temporary browser fixtures/artifacts:**

   | Command | Result |
   | --- | --- |
   | `npx tsc --noEmit` | PASS, 0 errors |
   | `npx expo lint` | PASS, 0 errors/warnings |
   | `npx expo-doctor` | PASS, 18/18 |
   | `npx expo config --type public` | PASS |
   | `npx expo export --platform all` | PASS, Android/iOS Hermes bundles and 18 static web routes |
   | `node scripts/check-elderly-ux.cjs` | PASS |
   | `node scripts/check-my-day.cjs` | PASS |
   | `node scripts/check-my-memories.cjs` | PASS, real SQLite/files with native boundaries substituted |
   | `git diff --check` | PASS |

   Windows used `npx.cmd` because PowerShell script execution blocks the npx `.ps1` shim. Public config and native compiler execution succeeded. Config introspection separately confirmed camera/microphone removal configuration. No forced dependency audit fix was run.

33. **Warnings/risks:** Native behavior and regional linguistic review remain unverified. Cleanup failure/process termination can leave an unreferenced private file; no automatic orphan recovery is implemented. There is no added encryption or guaranteed metadata stripping. Photos above 20 MiB are rejected, and platform-unsupported encodings fall back. Browser diagnostics showed the intentional unsupported-web SQLite bootstrap error before fixtures, Expo's unsupported web notification-listener warning, and a React Native Web pointerEvents deprecation during QA; the new component's deprecated prop was replaced. No external network request or failed HTTP resource was observed in the final browser inspection. Export reported terminal NO_COLOR/FORCE_COLOR and web notification-listener warnings; Git reported LF/CRLF policy notices. Installation reported 27 dependency audit findings (18 moderate, 9 high) and an unrs-resolver build-script approval notice; dependency remediation was outside this milestone and no audit fix was applied.

34. **Git status:** Branch remains `feature/mvp9-my-memories`, HEAD remains `ff79ac0`. Nine modified tracked files and twelve new untracked deliverables, listed above; nothing staged. The dirty tree is the requested milestone work. No production file deletion or unrelated work was discarded.

35. **`git diff --stat`:** Tracked-file output is `9 files changed, 64 insertions(+), 19 deletions(-)`. Git excludes the twelve untracked deliverables from that statistic. `git diff --name-status` lists the nine modified files from item 2. All new files remain unstaged and reviewable.

36. **Migrations 001–004 unchanged:** Explicit diffs of `001_core_bootstrap.ts`, `002_cognitive_adaptation.ts`, `003_multilingual_expansion.ts` and `004_my_day.ts` are blank. Only migration 005 and its registry entry were added.

37. **My Day still passes:** Confirmed by its full script. Its repository, notification service, difficulty-independent data and existing migration are unchanged. Only the migration-count assertions/output in its QA script were updated for registry version five.

38. **Adaptive AI unchanged:** Diffs are blank for `src/ai`, `src/games`, `app/patient/games`, `components/games`, the existing speech service and Bhashini service boundary. No model, telemetry math, game difficulty, persistence behavior or extra game was changed.

39. **No fake personal memories:** No production seed, fabricated relative, family photo or personal story. Test content was explicitly synthetic, held in temporary test databases or browser memory. The demo must use memories entered by its user.

40. **No Cognia material:** No Cognia code, files or assets were copied or incorporated. No face recognition, identity inference or generated personal memories were added.

41. **No adjacent milestone:** My Home and My Care remain safe informational Home interactions, verified by clicking them without route changes. No caregiver dashboard, extra game, Supabase, cloud sync, contacts import or new My Day work was added.

42. **Temporary QA cleanup:** Browser runtime fixtures were discarded, the browser closed, the owned development server stopped and this run's `.playwright-mcp` screenshots/logs removed. The SQLite/filesystem script closes and removes its verified temporary directory in `finally`. No test adapter or QA identity remains in production source. The retained regression script and this report are intentional deliverables, not temporary adapters. Final exports remain in ignored `dist/`.

Stopped at My Memories. No commit. No next milestone.
