# Smaran AI 1.0.1 audit and release evidence

Baseline: `db5d9f0`, version 1.0.0 / Android 1; initially clean worktree. No PPT was provided. Parity refers to the supplied release brief and the historical SIH requirement matrix, whose implementation inventory predates the current app.

## Audit before implementation

| Area | Existing behavior / material gap | Decision |
| --- | --- | --- |
| Patient, onboarding, settings, navigation | Local profile, seven languages, scalable type, contrast and reduced motion; patient assistant is in Menu | Preserve; expose location on Home and Menu |
| Caregiver, roles, person switching | Shared-device dashboard; account-based remote pairing is separate; request revision guards prevent stale person results | Reuse guards; remote location must work without creating a local patient |
| Pairing / Care Circle | Expiring hashed codes, explicit membership scopes, revocation, local contacts | Add an explicit remote location scope; never infer permission from a local contact |
| Games / adaptation | Eleven activities, correct/wrong feedback, same-patient/game models, bounded levels | Preserve and rerun game regressions |
| Reminders / memories / reports | Native scheduling, factual completion records, local photos, scoped PDF delivery | Preserve; no unsupported missed-dose or delivery claims |
| AI on both sides | Bounded factual context, explicit intent, medical refusal, server authorization | Keep GPS completely outside AI context |
| SQLite / sync | Transactional migrations and general outbox; dormant migration 014 still stores locations indefinitely | Keep migration history; use a bounded location queue with separate consent epoch, not general backup |
| Supabase / RLS | Owner-only backup plus membership RPCs; no active location sharing grant | Add location tables/RPCs with ownership, explicit scope, epoch invalidation and RLS |
| GPS / maps / native | GPS removed, no GPS/map dependency or native permission; old tests mandate removal | Restore real device GPS, Google map, freshness, controls, safe zone and regression coverage |
| Accessibility / localization | Shared accessible buttons/fields/loading and seven typed catalogs | Reuse components and supply all new keys in all seven catalogs; human translation and native TalkBack review remain necessary |
| Product direction | Historical SIH matrix is stale; cultural voice recognition and clinical outcomes are not implemented | Do not claim those capabilities; no speculative AI summary or clinical alert feature |

## Release rules

1.0.1 uses Android versionCode 2. Subsequent releases increment both (1.0.2 / 3, 1.0.3 / 4). Never reuse published values. This task must not start EAS or publish anything.

Validation results and deployment/device prerequisites are recorded below after execution.
