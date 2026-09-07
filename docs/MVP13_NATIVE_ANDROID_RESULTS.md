# MVP-13 Native Android Results

Validation date: 2026-09-07. Source baseline: `6b1c0f5`, branch `feature/mvp13-native-hardening`.

## STATIC/BUILD VERIFIED

| Check | Status | Observed evidence / limits |
| --- | --- | --- |
| Baseline | PASS | Expected branch/HEAD/tag, initially clean tree |
| Expo SDK/package compatibility | PASS | Expo ~54.0.36 (installed/locked 54.0.37), RN 0.81.5, React 19.1.0; online `npx.cmd expo install --check`: Dependencies are up to date |
| Expo Doctor | PASS | `npx.cmd expo-doctor`: 18/18 checks passed |
| Public Expo config | PASS | SDK 54.0.0; Smaran AI; smaran-ai; com.smaran.ai |
| Config plugin introspection | PASS | Android SQLite build flag emitted; blocked-permission removal directives; updates ENABLED=false; no generated native directories |
| Cognitive expansion regression | PASS | Host SQLite populated/fresh upgrade, exact historical data, rollback, game/patient isolation, models, reopen and three games |
| My Care regression | PASS | Host SQLite read-only snapshots and device-local/Asia-Kolkata/UTC/America-New_York date scenarios; script wording “device local” means host timezone, not physical Android |
| My Home regression | PASS | 32 local licensed images, eight stored-state mappings, seven catalogs |
| My Memories regression | PASS | Host SQLite/filesystem with mocked Expo boundaries: picker/cancel/failure, relative paths, rollback/cleanup/reopen |
| My Day regression | PASS | Host SQLite with mocked notifications: permissions, cancellation/rescheduling, persistence, early-Done limitation |
| Elderly UX regression | PASS | Seven catalogs, interpolation, mocked voice availability and speech cancellation |
| TypeScript | PASS | `npx.cmd tsc --noEmit`, exit 0 |
| Lint | PASS | `npx.cmd expo lint`, exit 0 |
| All-platform export | PASS | `npx.cmd expo export --platform all`, Android/iOS Hermes bundles and 24 web routes |
| Android bundle | PASS | `_expo/static/js/android/entry-ed63b7c36c476db74b577417c70e02b9.hbc`, approximately 4.85 MB; export only |
| Native hardening regression / Android asset byte check | PASS | `node scripts/check-native-hardening.cjs --export`: config/host regressions and all 32 photos byte-matched in Android export |
| SDK/package/migration preservation and final diff hygiene | PASS | Package files and migrations unchanged; git diff --check clean; four modified and five new files |
| EAS CLI | PASS | `eas-cli/23.2.0 win32-x64 node-v24.19.0`; transient CLI cache only |
| EAS authentication/project link | BLOCKED — USER AUTH REQUIRED | `whoami`: Not logged in; no extra.eas.projectId or owner in app configuration |
| APK build / download / signing | NOT RUN | No account/project/credential decisions made; no build ID or artifact |
| Local Android toolchain | BLOCKED — PHYSICAL DEVICE REQUIRED | Java Temurin 17.0.20 present; adb/Gradle not on PATH; standard Android SDK/Android Studio paths absent; SDK/JAVA_HOME variables unset |

Initial PowerShell `npx` calls failed because script execution is disabled; `.cmd` worked without changing policy. Restricted-network Expo compatibility calls failed with `TypeError: fetch failed`; the same read-only check passed with approved network access. Offline SDK-map comparison also passed, but was not treated as online validation. EAS's first restricted-network lookup failed; approved network access made CLI version and whoami diagnostics usable. No dependency installation into the app occurred. Export emitted non-failing NO_COLOR/FORCE_COLOR and web notification-listener notices.

## PHYSICAL DEVICE VERIFIED

No physical Android tests were performed. Device model / Android API / tester / APK build ID / artifact SHA-256: **NOT RUN**. ADB is unavailable, so connected-device authorization could not be enumerated; do not infer that no phone is physically connected. Acceptance is **BLOCKED — PHYSICAL DEVICE REQUIRED**. An authenticated, linked APK build is also required first.

| Case | Status | Notes |
| --- | --- | --- |
| Standalone APK install, identity, icon/splash | NOT RUN | No APK or authorized device session |
| Cold launch without Metro / Expo Go | NOT RUN | Export is not standalone evidence |
| Android migrations 001–006, populated 006 upgrade | NOT RUN | Host SQLite only; compiled FK default and separate native connection require validation |
| Profile/SecureStore persistence and recovery | NOT RUN | Host boundary tests do not prove Android Keystore behavior |
| Force-stop/reopen with all local data | NOT RUN | No device run |
| Memory Match native navigation/layout/result/Why/feedback | NOT RUN | Algorithm/repository regression only |
| Pattern Recognition native navigation/layout/result/Why/feedback | NOT RUN | Algorithm/repository regression only |
| Routine Recall native navigation/layout/result/Why/feedback | NOT RUN | Algorithm/repository regression only |
| Per-game adaptive persistence / patient isolation | NOT RUN | Host SQL tests only |
| My Day local records / restart | NOT RUN | No device run |
| Android 13+ grant/denial/channel/no repeated prompt | NOT RUN | Mocked OS boundary only |
| One-time/daily delivery, tap, cancellation/rescheduling | NOT RUN | Delivery and timing unobserved |
| Daily early-Done / future schedule behavior | NOT RUN | Accepted same-day notification limitation remains |
| ImagePicker selected/canceled/denied/invalid result | NOT RUN | Native picker unobserved |
| Photo add → close/reopen | NOT RUN | Native managed-file survival unobserved |
| Photo replace → close/reopen | NOT RUN | Native managed-file survival unobserved |
| Photo remove → close/reopen / missing fallback | NOT RUN | Native managed-file survival unobserved |
| My Home all eight regions / 32 images | NOT RUN | Source/export checks only |
| My Care offline/read-only display | NOT RUN | Host service checks only |
| Seven languages / native fonts | NOT RUN | Catalog checks only |
| Extra-large text / compact phone / tablet / high contrast | NOT RUN | Code audit only |
| Reduced motion / haptics | NOT RUN | Code audit only |
| Native TTS available/missing/offline voice and cancellation | NOT RUN | Mocked speech tests only |
| TalkBack | NOT RUN | No screen-reader observation |
| Airplane mode / repeated offline restart | NOT RUN | User must enable airplane mode at checkpoint |
| Optional reboot / restored reminder | NOT RUN | No reboot performed |
| Final merged APK permissions | NOT RUN | Introspection cannot merge all Android libraries |

When updating a physical row to PASS or FAIL, start notes with `Evidence:` and record the device, APK identity, date/tester and observed result. The script checks this format; it cannot authenticate human observations. Full procedures and the exact SIH sequence are in [MVP13_NATIVE_ANDROID_TEST_PLAN.md](MVP13_NATIVE_ANDROID_TEST_PLAN.md).
