# Android evidence capture

## Runtime

- Device: Android Studio AVD `Pixel_9a`, connected as `emulator-5554`
- Android: 15, API 35
- Display captures: 1080 x 2424 PNG
- Installed application: `com.smaran.ai`, launched in its native Android activity
- The profile is synthetic (`Demo Patient`); no personal media was used. The regional home image is bundled app content.

## Captured screens

All images in `assets/screenshots/` were taken from the live emulator using Android screen captures. `docs/evidence/android-pixel9a/launch.png` preserves the initial onboarding capture.

| File | Screen shown |
|---|---|
| `01-onboarding.png` | Initial role selection (same original capture preserved as `launch.png`) |
| `02-home.png` | Patient home |
| `03-train-my-mind.png` | Cognitive activity catalogue |
| `04-cognitive-activity.png` | Pattern & Shape, level 1 |
| `05-adaptive-feedback.png` | Completed Pattern & Shape session and adaptive next-level feedback |
| `06-my-day.png` | My Day empty state |
| `07-my-memories.png` | My Memories empty state; no personal photos were added |
| `08-my-home-regional.png` | My Home with Assam regional content |
| `09-caregiver-support.png` | Local caregiver dashboard for the synthetic profile |
| `10-local-report.png` | Locally generated activity summary |
| `11-report-details.png` | Saved activity totals in the report detail view |
| `12-picture-recall-result.png` | Phase 5 live Picture Recall result (2/2, 100%) |
| `13-caregiver-reports.png` | Phase 5 caregiver Reports route for the synthetic profile |

The 11 original Phase 3 captures were preserved. Phase 5 continued in the existing emulator without resetting the app. See [`docs/HUMAN_QA_REPORT.md`](../../HUMAN_QA_REPORT.md) for actual results and blockers. My Memories and My Home remained on a loading screen during the continuation; the new Reports capture shows the route but does not verify this run's report contents.

## Demo recording

`assets/demo/SMARAN-Android-Demo.mp4` is the fresh Phase 5 Android `screenrecord` capture. It records real navigation through patient and caregiver routes. The MP4 is 1080 x 2424, 2:58 (178.071 seconds), and 1,209,441 bytes. Google Photos opened the indexed MP4 on the emulator and rendered recorded SMARAN screens during playback. The previous Phase 3 demo file was replaced.

## Scope and caveats

Two Pattern & Shape sessions were completed on the emulator before the local caregiver summary was generated. The report showed two sessions, 10/10 correct attempts, 100% accuracy, and zero hints/errors. The report detail screen also contains a generic explanatory paragraph referring to two-card Memory Match attempts; that paragraph does not describe the Pattern & Shape sessions captured here. The screenshots preserve the app as implemented, including this mismatch.

The My Day and My Memories captures show real empty states. Location sharing remained paused. This evidence covers the local emulator flow; it does not establish remote sync, live maps, account services, or server-backed behavior.

## Code follow-up — 29 September 2026

[Final SIH hardening notes](../../FINAL_SIH_HARDENING.md) record the subsequent code fixes and automated checks. No new screenshots or recordings were captured. The evidence above predates those fixes and does not verify their native behavior.
