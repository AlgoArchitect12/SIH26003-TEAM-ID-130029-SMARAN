# Documentation

Use the [SIH validation report](validation/SIH_VALIDATION.md) for the recorded verification scope and outstanding acceptance work. Product briefs and milestone documents describe intentions or their named baselines; current source and configuration determine implemented behavior.

| Directory | Contents |
|---|---|
| [product/](product/) | [Requirements](product/PRD.md), [design system](product/DESIGN.md), and [regional content/image sources](product/NER_CONTENT_SOURCES.md) |
| [architecture/](architecture/) | [Technology choices](architecture/TECHSTACK.md) and [sync behavior](architecture/SYNC_STATUS.md); technology intentions are not proof of deployed integrations |
| [testing/](testing/) | [Native Android test procedures](testing/MVP13_NATIVE_ANDROID_TEST_PLAN.md), retained from MVP13 |
| [validation/](validation/) | [SIH validation](validation/SIH_VALIDATION.md) and [historical MVP13 Android results](validation/MVP13_NATIVE_ANDROID_RESULTS.md) |
| [deployment/](deployment/) | [Release 1.0.1 notes](deployment/RELEASE_1.0.1.md) |
| [history/](history/) | Milestone reports, the original roadmap, and the dated SIH requirement assessment; these are historical records, not current acceptance results |

Executable checks remain in [scripts/](../scripts/), backend fixtures in [supabase/tests/](../supabase/tests/), and build profiles in [eas.json](../eas.json). The [MVP24 auth/cloud notes](history/MVP24_AUTH_CLOUD_HARDENING.md) contain historical setup guidance; review the [current migrations](../supabase/migrations/) before deploying.
