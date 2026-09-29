# SIH Android evidence

## Phase 5 human-like QA continuation

The existing Android run was continued on the already-running `emulator-5554`; the app was not reset. Earlier genuine captures and results were preserved. The synthetic profile shown in this phase is `Demo QA Patient`.

### Activity results observed

| Activity | Observed result | Outcome |
|---|---|---|
| Memory Match | 100%; level advanced 1 → 2 | PASS |
| Pattern & Shape | 5/6 (83%); no hints; recommended level 2 | PASS |
| Routine Recall | 100%; answer choices appeared blank | PARTIAL — defect |
| Familiar Object | 100%; no hints; recommended level 2 | PASS |
| Sequence Memory | App had already advanced to Picture Recall when this continuation began; score/feedback was not visible | PARTIAL — result unverified |
| Picture Recall | 2/2 (100%); 0 hints; recommended level 2 | PASS |
| Remember Lights | Opened Level 1; could not reach answer controls under the persistent Expo warning overlay; no answers or score | PARTIAL — interaction blocked |
| Number Path | All 5 targets selected correctly; app advanced to Level 2 | PASS |
| Sudoku Lite | 3/3 steps (100%); 3 selections; 0 hints; advanced to level 2 | PASS |
| Chess Puzzle | Six piece-recognition prompts answered and app advanced to Level 2; result summary was not seen | PARTIAL — score unverified |
| Word Match | Three visible pairs matched (Tea/cup, Rain/umbrella, Key/door); app advanced to Level 2; result summary was not seen | PARTIAL — score unverified |

### Other flows and limitations

- **My Day:** Patient view rendered its genuine empty state. Caregiver reminder creation was opened, but the draft was not saved. Completion, edit, and delete were therefore not verified. Reminder notifications displayed an in-app fallback and phone-settings actions.
- **My Memories:** The route showed “Getting Smaran ready…” during inspection; no memory was added. Display/open/remove remain unverified.
- **My Home:** The route showed “Getting Smaran ready…” during inspection. The earlier genuine regional capture showing Assam remains preserved; this continuation did not re-verify regional content or navigation.
- **Caregiver:** The local dashboard opened for `Demo QA Patient`, said activity was stored on this device, showed zero trusted people with local access, and exposed Activity, Reminders, and Reports sections. No cloud/account behavior was inferred.
- **Reports:** The Reports route was opened. A report generated from this continuation’s sessions, its activity summary/details, and the Pattern & Shape vs Memory Match explanatory-text mismatch were not re-verified in this phase. The old Phase 3 report is not evidence for this run.
- **Location/maps/account/sync:** Home showed location sharing paused; My Location did not reach a usable map during the attempted navigation. Caregiver displayed “Saved on this device.” No cloud sync, account service, or live map success was claimed.

Activity outcomes: **6 PASS, 5 PARTIAL, 0 BLOCKED**. Other areas: **0 PASS, 3 PARTIAL, 3 BLOCKED** (My Memories, My Home, and current-run Reports). Combined scope: **6 PASS, 8 PARTIAL, 3 BLOCKED**.

### Phase 5 captures

- [`assets/screenshots/12-picture-recall-result.png`](../assets/screenshots/12-picture-recall-result.png) — live Picture Recall result, 2/2.
- [`assets/screenshots/13-caregiver-reports.png`](../assets/screenshots/13-caregiver-reports.png) — live caregiver Reports route for the synthetic profile.

Fresh Phase 5 recording: [`assets/demo/SMARAN-Android-Demo.mp4`](../assets/demo/SMARAN-Android-Demo.mp4), 2:58 (178.071 seconds), 1,209,441 bytes, 1080 x 2424. It records real navigation in the running app. The MP4 was opened in Google Photos on the emulator and rendered recorded SMARAN screens. The requested flow still has the blockers listed above; the video does not imply those flows succeeded.

## Phase 3 Android evidence (historical)

This evidence was captured from the real SMARAN Android application running on the Android Studio `Pixel_9a` emulator (Android 15 / API 35, `emulator-5554`). ADB reported the emulator as `device`; the installed package was `com.smaran.ai`. No app functionality or source configuration was changed for this capture.

## Evidence files

- **Screenshots:** [`assets/screenshots/`](../assets/screenshots/) contains 13 genuine 1080 x 2424 PNG captures covering the original Phase 3 evidence plus Phase 5 Picture Recall and caregiver Reports. The original launch capture is preserved at [`docs/evidence/android-pixel9a/launch.png`](evidence/android-pixel9a/launch.png).
- **Screen recording:** [SMARAN-Android-Demo.mp4](../assets/demo/SMARAN-Android-Demo.mp4) is the fresh Phase 5 Android recording: 2:58 (178.071 seconds), 1080 x 2424, 1,209,441 bytes. Google Photos opened the indexed MP4 on the emulator and rendered recorded SMARAN screens. This replaces the older Phase 3 demo recording.
- **Capture notes:** [Android evidence details](evidence/android-pixel9a/README.md) lists every screenshot, describes the demo route, and records scope and limitations.

The emulator profile used the synthetic name `Demo Patient`. No personal media or prior PC screenshots/videos were used. The regional image shown is bundled app content.

Two Pattern & Shape sessions were completed, then the app generated a local activity summary. It showed two sessions and 10/10 correct attempts. The detail screen includes generic Memory Match explanatory text that does not match those Pattern & Shape sessions; this discrepancy is documented in the capture notes. Empty My Day and My Memories screens are genuine app states. Location sharing remained paused. The evidence does not verify cloud sync, live maps, account services, or server-backed behavior.

## Final SIH code hardening — 29 September 2026

See [the engineering follow-up](FINAL_SIH_HARDENING.md) for fixes, checks and remaining configuration blockers. The historical captures and QA outcomes above are unchanged; native human confirmation of the fixes is pending.
