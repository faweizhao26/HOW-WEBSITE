# Production Rollout

Date: September 30, 2026. The user explicitly authorized merging main,
migrating the production database, and deploying Production.

## Application

- Repository: `faweizhao26/HOW-WEBSITE`, branch `main`.
- Commit and SSH identity: `faweizhao26 <faweizhao26@gmail.com>`.
- Publication workflow: `9c5951d038b13feab87c861b56ece2094d455daf`.
- Application release: `f39579ed12de71fcddf9fe63eb740b48ec921f07`.
- Production deployment: `dpl_GeRPZwXitRRmbPptREcCDzAttYy8`, `READY`.
- Public URL: https://how-website.vercel.app.

The first production browser matrix found only the authenticated desktop
logout button's dark-mode contrast failure (4.12:1). The scoped color fix
passed targeted ESLint and a real-page check before deployment. The final
ego-lite matrix passed all 40 combinations: five routes, English/Chinese,
light/dark, desktop 1440px and mobile 390px. Checked text contrast, horizontal
overflow, visible broken images, and browser runtime errors all passed.
Homepage and sponsor screenshots were visually inspected. No error/fatal
runtime logs were returned for the application deployment during this check.

Evidence: `/private/tmp/how-publication-production-final-qa/report.json`
and its screenshots. The initial failed matrix is retained separately in
`/private/tmp/how-publication-production-qa`. No production test accounts or
test content were created; authenticated publication lifecycle tests remain
the isolated-stack evidence in the preceding verification report.

## Database

The public production bundle verified the Supabase project as
`uhhgcecvxzqvwpwiardu` before migration. Applied the exact repository file
`supabase/migrations/20260929000100_content_publication_workflow.sql`:
36,579 bytes, SHA-256
`67e52e0d2ba99a351065b85a7981c359d29af8ef851ca9fd940858689abce026`.

The MCP initially recorded version `20260930090548`. A guarded metadata-only
update aligned it with repository version `20260929000100`, after checking
its name and SQL MD5 (`50265122017767805eae396e8f74b454`). The SQL was not
reapplied. The two pre-existing July migration records were left unchanged;
their files are not in this repository and must be baselined before a future
CLI migration-history reconciliation. Do not rerun the publication migration.

Post-migration counts match the original business rows: one profile, one
session, three sponsors, and one registration. Three public sponsor snapshots
were backfilled. There are no published speakers, sessions, or news yet;
the corresponding public routes show the expected empty state, not mock data.
Homepage and sponsors return `ready`. Original settings remain in the current
release, including `conference_date=2027.4.16-4.18` and
`contact_email=faweizhao26@gmail.com`. No public table has RLS disabled.

Security advisors returned no database policy/function findings. One
pre-existing Auth warning remains: leaked-password protection is disabled.
Auth configuration was not changed as part of this rollout. See
[Supabase password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Subsequent documentation-only commits may advance main without changing this
verified application release's runtime behavior.
