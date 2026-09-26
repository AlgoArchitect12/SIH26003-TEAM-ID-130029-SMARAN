# Security and privacy

SMARAN handles personal memories, caregiver relationships, routine records and optional location data. Do not put real patient records, credentials, coordinates or identifiable screenshots in public issues, pull requests or test fixtures.

## Reporting a vulnerability

Use GitHub's private **Report a vulnerability** option if it is available on this repository. If it is unavailable, open an issue asking the maintainer for a private reporting channel without describing the exploit or including sensitive evidence. No private contact address or response-time commitment is currently published.

In a private report, include the affected commit, platform, minimal reproduction using synthetic data and the access boundary involved. Never include active secrets. If a credential is exposed, revoke or rotate it with its provider; removing it from a later commit does not remove it from history.

## Configuration boundaries

| Configuration | Boundary |
|---|---|
| Supabase URL and publishable client key | Optional public app configuration; never substitute a service-role key |
| Google Maps SDK keys | Native build configuration, restricted by SDK and Android package/signing certificate or iOS bundle identifier |
| Google OAuth client secret | Supabase provider configuration only |
| AI provider and WhatsApp credentials | Server-side Edge Function secrets only |
| Supabase service-role key | Privileged backend configuration only; never ship it in an app bundle |

Real `.env` files, signing material and local release artifacts must remain untracked. Review both the current tree and Git history before publication. Use synthetic data for all regression checks.

## Limits to preserve when deploying

- General backup requires explicit consent; location has separate consent and access scopes. Do not bypass RLS or grant clients service-role access to make a demo work.
- SecureStore protects selected values; the SQLite database is not configured for SQLCipher encryption. Local person switching is not authentication between users sharing a device.
- Personal photos are local files. Report sharing intentionally exports information outside the app; invoking a share sheet does not prove delivery.
- Review Edge Function authorization, webhook access and provider configuration before deployment, especially the privileged report-delivery integration. A secret scan is not a complete security assessment.
- Authenticated hosted flows and physical-device privacy behavior require acceptance testing. See [the current validation report](docs/validation/SIH_VALIDATION.md).
