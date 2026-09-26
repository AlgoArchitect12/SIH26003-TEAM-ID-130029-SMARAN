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

## Demo recording

`assets/demo/SMARAN-Android-Demo.mp4` is a continuous Android `screenrecord` capture made while SMARAN was foregrounded. It follows the patient home into Train My Mind, plays Pattern & Shape sessions, shows completion feedback, and advances to the next level. The MP4 is 1080 x 2424, 1:58, and 738,510 bytes. Android Photos opened the indexed MP4 and visibly rendered recorded SMARAN screens during playback. Android MediaStore reports 118,520 ms duration and 1080 x 2424 resolution.

## Scope and caveats

Two Pattern & Shape sessions were completed on the emulator before the local caregiver summary was generated. The report showed two sessions, 10/10 correct attempts, 100% accuracy, and zero hints/errors. The report detail screen also contains a generic explanatory paragraph referring to two-card Memory Match attempts; that paragraph does not describe the Pattern & Shape sessions captured here. The screenshots preserve the app as implemented, including this mismatch.

The My Day and My Memories captures show real empty states. Location sharing remained paused. This evidence covers the local emulator flow; it does not establish remote sync, live maps, account services, or server-backed behavior.
