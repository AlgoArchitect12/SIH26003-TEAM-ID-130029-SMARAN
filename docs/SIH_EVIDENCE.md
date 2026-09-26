# SIH Phase 3 Android evidence

This evidence was captured from the real SMARAN Android application running on the Android Studio `Pixel_9a` emulator (Android 15 / API 35, `emulator-5554`). ADB reported the emulator as `device`; the installed package was `com.smaran.ai`. No app functionality or source configuration was changed for this capture.

## Evidence files

- **Screenshots:** [`assets/screenshots/`](../assets/screenshots/) contains 11 genuine 1080 x 2424 PNG captures covering onboarding, home, cognitive training and feedback, My Day, Memories, regional content, caregiver support, and the locally generated report. The original launch capture is preserved at [`docs/evidence/android-pixel9a/launch.png`](evidence/android-pixel9a/launch.png).
- **Screen recording:** [SMARAN-Android-Demo.mp4](../assets/demo/SMARAN-Android-Demo.mp4) is a continuous 1:58 Android screen recording (1080 x 2424, 738,510 bytes). Android Photos opened the indexed MP4 and visibly rendered recorded SMARAN screens during playback. Android MediaStore reports 118,520 ms duration and 1080 x 2424 resolution.
- **Capture notes:** [Android evidence details](evidence/android-pixel9a/README.md) lists every screenshot, describes the demo route, and records scope and limitations.

The emulator profile used the synthetic name `Demo Patient`. No personal media or prior PC screenshots/videos were used. The regional image shown is bundled app content.

Two Pattern & Shape sessions were completed, then the app generated a local activity summary. It showed two sessions and 10/10 correct attempts. The detail screen includes generic Memory Match explanatory text that does not match those Pattern & Shape sessions; this discrepancy is documented in the capture notes. Empty My Day and My Memories screens are genuine app states. Location sharing remained paused. The evidence does not verify cloud sync, live maps, account services, or server-backed behavior.
