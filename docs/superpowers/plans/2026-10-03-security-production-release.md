# Security-Only Production Release

The user confirmed a production release of dependency security fixes only.
Base: main at `c6b37ca8f88648b78676e7f12c12a21bfd65933b`.

## Scope

- Upgrade Next.js and eslint-config-next from 16.2.6 to 16.3.8.
- Remove the shadcn CLI dependency; preserve its exact MIT stylesheet locally.
- Refresh compatible transitive dependencies and replace the lint plugin's
  vulnerable fast-glob chain with the private tinyglobby-backed scanner.
- Add seven scanner compatibility tests without disabling Next lint rules.
- Exclude registration/profile/service changes, registration-only dependencies,
  migration SQL, and production Auth configuration changes.

The registration repair remains on `codex/fix-registration-verification` and
is not part of this release. Production database and SMS setup are unchanged.

## Pre-Push Verification

- Dependency install audit: zero findings, including development dependencies.
- `npm ls fast-glob --all`: valid dependency tree using the local adapter.
- 51 Node tests passed on this security-only branch.
- Whole-project ESLint: 93 files, zero errors, 48 existing warnings.
- Standard Turbopack build, TypeScript and all 30 routes passed against the
  isolated local Supabase stack. No local build output is uploaded to Vercel;
  the Git production deployment builds with its existing production settings.
- The diff against production contains no registration/profile changes and no
  database schema or migration changes.
- Git author and live SSH identity verified as `faweizhao26`.
