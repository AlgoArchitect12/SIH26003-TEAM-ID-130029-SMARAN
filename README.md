# SMARAN AI

Memories that stay close.

Smaran supports cognitive activities, familiar memories and daily routines in seven languages. It does not diagnose conditions or provide medical advice.

## Development

Validated with Node.js 24.19. Run `npm ci` and `npx expo start`. This project uses Expo SDK 54, Expo Router, local SQLite and SecureStore. Patient flows require a supported native runtime; the web build intentionally shows recovery when native storage is unavailable. The regression scripts use Node's built-in SQLite support.

Run `npx tsc --noEmit`, `npx expo lint` and the regression scripts in `scripts/`. See [MVP16 product hardening](docs/MVP16_PRODUCT_HARDENING.md) for validation and remaining device checks, and [the Android test plan](docs/MVP13_NATIVE_ANDROID_TEST_PLAN.md) for native testing.

Optional Supabase accounts, structured offline sync, configuration, validation evidence, and remaining cloud/device checks are documented in [MVP22 auth and sync](docs/MVP22_AUTH_SYNC.md). Local patient use requires no account; personal photos remain device-only.

See [Caregiver Sync Status](docs/SYNC_STATUS.md) for the connectivity indicator, owner/patient guards, automatic retry behavior, validation results, and physical Android checks.

See [MVP24 auth and cloud hardening](docs/MVP24_AUTH_CLOUD_HARDENING.md) for secure email/Google callbacks, explicit backup consent, paused sync, regression results, and the native/cloud validation checklist.

See [MVP26 database verification](docs/MVP26_LIVE_DATABASE_VERIFICATION.md) for executable SQLite/PostgreSQL lifecycle evidence, sync-status repairs, and the outstanding hosted migration/authentication prerequisites. Run `node scripts/check-live-database-sync.cjs` with installed PostgreSQL binaries (`SMARAN_PG_BIN` can select their directory); it creates and removes only disposable local databases and performs a read-only hosted audit.

The eleven-activity catalog includes Sudoku / Number Grid, Chess Puzzle and Word Match. See [MVP25 three cognitive games](docs/MVP25_THREE_COGNITIVE_GAMES.md) for gameplay, difficulty, migration 012, the forward cloud validators, validation evidence and remaining device checks. The [extra games report](docs/EXTRA_COGNITIVE_GAMES.md) covers Remember the Lights and Number Path.

## Brand assets

The teal lotus extends the existing Home mark: Material Icons `spa`, bundled with `@expo/vector-icons`. Launcher, adaptive, monochrome, splash and favicon PNGs are generated from that same glyph. On Windows, regenerate with `powershell -NoProfile -File scripts/generate-brand-assets.ps1` after installing dependencies. No new runtime dependency is needed.
