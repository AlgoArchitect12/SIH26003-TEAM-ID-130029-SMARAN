# SMARAN AI

Memories that stay close.

SMARAN AI is an offline-first Android and iOS app for cognitive activities, familiar memories, daily routines and caregiver support. It includes regional content for North-East India and seven language catalogs. It does not diagnose conditions or provide medical advice.

## Requirements

- Node.js 20.19 or newer (the repository was validated with Node.js 24.19)
- npm
- For Android/iOS native runs: the relevant platform toolchain and device/emulator. Patient flows use native SQLite and SecureStore; the web app is limited and shows recovery when native storage is unavailable.
- For cloud builds and backend features: an Expo/EAS account and the Supabase setup described in [MVP22](docs/MVP22_AUTH_SYNC.md) and [MVP24](docs/MVP24_AUTH_CLOUD_HARDENING.md).

## Setup and run

```sh
npm ci
cp .env.example .env
npx expo start
```

On Windows PowerShell, replace the copy command with `Copy-Item .env.example .env`. Start an Android or iOS development build with `npx expo start --android` or `npx expo start --ios`.

The app works locally without cloud configuration. Optional public client settings in `.env` are:

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL for optional accounts and sync |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable client key; never use a service-role key here |
| `GOOGLE_MAPS_API_KEY` | Android native Maps key, restricted to this app and its signing certificate |
| `GOOGLE_MAPS_IOS_API_KEY` | Optional iOS native Maps key, restricted to the app bundle ID |

Keep `.env` local. Server and provider secrets belong in Supabase Edge Function secrets, not in the app or a shared `.env`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `AI_PROVIDER`, `AI_API_URL`, `AI_API_KEY`, `AI_MODEL`, and (for report delivery) `SUPABASE_SERVICE_ROLE_KEY`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`. Only configure secrets for functions and providers you enable.

## Checks

```sh
npx tsc --noEmit
npm run lint
node scripts/check-regressions.cjs
```

The regression command runs every `scripts/check-*.cjs` sequentially and writes detailed logs under the ignored `.expo/regressions/` directory. Some checks depend on PostgreSQL; see [MVP26](docs/MVP26_LIVE_DATABASE_VERIFICATION.md) for database prerequisites and previously observed legacy failures. SQL fixtures are under `supabase/tests/`.

## Builds

EAS profiles are defined in [eas.json](eas.json). Configure the platform Maps key in the matching EAS `preview` or `production` environment before building:

```sh
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform android --profile production
```

The `preview` profile creates an installable APK; `production` creates an Android App Bundle. An iOS archive can be built with `npx eas-cli build --platform ios --profile production` after configuring iOS signing and its Maps key. A static web export is `npx expo export --platform web`; web export does not replace native-device verification.

## Project map

| Path | Contents |
| --- | --- |
| `app/` | Expo Router screens and navigation |
| `components/`, `hooks/`, `constants/` | Shared UI, hooks and design tokens |
| `src/` | SQLite, repositories, services, games, adaptive logic, cloud sync and translations |
| `supabase/` | Edge Functions, migrations and SQL fixtures |
| `assets/` | App icons, regional images and notification sound |
| `scripts/` | Regression/contract checks and asset generation |
| `docs/` | Product, architecture, release and verification notes |

## Troubleshooting

- **Expo reports a version or module mismatch:** run `npm ci`, then `npx expo start --clear`.
- **Cloud features are unavailable:** confirm the two public Supabase variables and complete the backend/RLS setup in [MVP22](docs/MVP22_AUTH_SYNC.md) and [MVP24](docs/MVP24_AUTH_CLOUD_HARDENING.md). Core local use does not require an account.
- **Native Maps are blank or an EAS build stops:** configure a valid platform key in the selected EAS environment, restrict it to the app identifier and signing certificate, then rebuild.
- **A database regression cannot start:** install PostgreSQL tools or set `SMARAN_PG_BIN` to their directory. The live database check uses disposable local databases; hosted audit modes are read-only.

## Further documentation

- [Product requirements](docs/PRD.md)
- [Technology stack](docs/TECHSTACK.md)
- [Release 1.0.1 notes](docs/RELEASE_1.0.1.md)
- [Caregiver sync status](docs/SYNC_STATUS.md)
- [Android native test plan](docs/MVP13_NATIVE_ANDROID_TEST_PLAN.md)
- [Live database verification and known limitations](docs/MVP26_LIVE_DATABASE_VERIFICATION.md)
