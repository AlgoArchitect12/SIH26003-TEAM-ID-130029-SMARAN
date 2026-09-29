# SMARAN Phase 5 human-like QA

**Run state:** Continued on the already-running Pixel 9a emulator (`emulator-5554`, Android 15 / API 35, package `com.smaran.ai`). The app was not reset. Profile: `Demo QA Patient`. No Google Drive access was used.

## Cognitive activities

| Activity | Result from genuine interaction | Status |
|---|---|---|
| Memory Match | 100%; level advanced 1 → 2 | PASS |
| Pattern & Shape | 5/6 (83%); no hints; recommended level 2 | PASS |
| Routine Recall | 100%; blank answer choices were visibly observed | PARTIAL |
| Familiar Object | 100%; no hints; recommended level 2 | PASS |
| Sequence Memory | This continuation opened on Picture Recall, after Sequence Memory had already advanced; its score/feedback was not visible | PARTIAL |
| Picture Recall | 2/2 (100%); 0 hints; recommended level 2 | PASS |
| Remember Lights | Opened Level 1; controls could not be reached under the Expo warning overlay; no answer or score | PARTIAL |
| Number Path | Correctly selected all 5 targets; app advanced to Level 2 | PASS |
| Sudoku Lite | 3/3 steps (100%); 3 selections, 0 hints; advanced to level 2 | PASS |
| Chess Puzzle | Answered six piece-recognition prompts; app advanced to Level 2; no result summary observed | PARTIAL |
| Word Match | Matched Tea/cup, Rain/umbrella, and Key/door; app advanced to Level 2; no result summary observed | PARTIAL |

**Activity totals:** 6 PASS, 5 PARTIAL, 0 BLOCKED.

## Other product flows

| Area | Actual observation | Status |
|---|---|---|
| My Day | Patient view showed no reminders. Caregiver Add reminder opened the three-step wizard, but the draft was not saved. Completion, edit, and delete could not be exercised. Notification UI offered in-app reminders and phone settings. | PARTIAL |
| My Memories | Route remained on “Getting Smaran ready…”; no synthetic memory was created or opened/removed. | BLOCKED |
| My Home | Route remained on “Getting Smaran ready…”. Prior Assam capture is historical evidence only; this run did not verify regional content/navigation. | BLOCKED |
| Caregiver | Local dashboard opened for the synthetic profile; showed activity stored on this device, zero trusted people with local access, and Activity/Reminders/Reports entries. | PARTIAL |
| Reports | Reports route opened, but this run’s report list, summary, and details were not verified. The prior Phase 3 report was not reused as evidence. Pattern & Shape vs Memory Match explanatory copy was not re-checked. | BLOCKED |
| Permissions, location, maps, account, sync | Location sharing showed paused; My Location did not reach a usable map. Caregiver said “Saved on this device.” Cloud/account/map success was not established. | PARTIAL |

**Other-flow totals:** 0 PASS, 3 PARTIAL, 3 BLOCKED. **Combined totals:** 6 PASS, 8 PARTIAL, 3 BLOCKED (17 tracked items).

## Defects and blockers

1. Routine Recall displayed blank answer choices during a 100% attempt.
2. A persistent Expo debugger warning overlay obstructed Remember Lights answer controls; no genuine score was produced.
3. My Memories and My Home remained on the app’s “Getting Smaran ready…” loading state during this inspection.
4. The current-run report contents and the previously observed Pattern & Shape / Memory Match explanatory-text mismatch were not re-verified.
5. Sequence Memory, Chess Puzzle, and Word Match result summaries were not visible, so their scores are not claimed.
6. Reminder creation was left unsaved; reminder completion/edit/delete behavior was not verified.

## Evidence

The 11 original captures remain unchanged. Phase 5 added:

- [12-picture-recall-result.png](../assets/screenshots/12-picture-recall-result.png) — actual Picture Recall result, 2/2.
- [13-caregiver-reports.png](../assets/screenshots/13-caregiver-reports.png) — actual caregiver Reports route for the synthetic profile.

The fresh [SMARAN-Android-Demo.mp4](../assets/demo/SMARAN-Android-Demo.mp4) records real app navigation from this run. Duration is 2:58 (178.071 seconds), size 1,209,441 bytes, and resolution 1080 x 2424. Google Photos opened the indexed MP4 on the emulator and rendered recorded SMARAN screens. The video shows the real loading states where routes remained blocked; it does not imply success for them.

Detailed historical and phase-specific evidence is in [SIH_EVIDENCE.md](SIH_EVIDENCE.md). No Git commit was created; a commit is not required unless requested.

## Coding follow-up — 29 September 2026

Routine labels, stale loading requests, persistent result summaries and report explanation mapping now have code fixes and regression coverage. See [Final SIH hardening](FINAL_SIH_HARDENING.md) for exact checks, the remaining legacy test failure and external blockers. The original observations/statuses above are preserved; physical-phone confirmation is still pending.
