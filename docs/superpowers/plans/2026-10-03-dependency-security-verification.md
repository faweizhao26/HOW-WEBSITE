# Dependency Security Verification

Date: October 3, 2026. Branch: `codex/fix-registration-verification`.

## Changes

- Pin Next.js and its ESLint configuration to 16.3.8.
- Remove the shadcn CLI dependency. The application imported only its CSS;
  preserve that stylesheet in `src/styles/ui-variants.css`, including its MIT
  license, and keep the existing application-owned UI components.
- Refresh compatible dependency versions, including ws 8.22.0, Babel,
  browser mapping, brace-expansion and js-yaml. No forced major-version
  changes or dependency overrides were applied.
- Registration logic, database migration and production configuration are
  unchanged by this follow-up.

The upgrade path and compatibility requirements were checked against the
[official Next.js guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
and published package metadata.

## Evidence

- Runtime dependency audit: zero findings (`npm audit --omit=dev`).
- Full dependency audit: five high-severity findings, all in the development
  ESLint dependency chain: eslint-config-next, @next/eslint-plugin-next,
  fast-glob, micromatch and braces. npm suggests downgrading the Next.js ESLint
  configuration to 14.2.35; that incompatible downgrade was not applied.
- 60 application tests passed after the compatible dependency refresh.
- Targeted ESLint checks passed for registration, its service, the profile
  server wrapper and Next.js configuration.
- Seven isolated Auth/Data API registration lifecycle groups passed.
- `npm run build -- --webpack` passed, including TypeScript and all 30 routes.
- The default Turbopack build hit a local process/port permission error, also
  after requesting elevated execution. This is not recorded as a passing
  Turbopack verification.
- Before the compatible transitive refresh, the upgraded Turbopack build
  passed and emitted CSS with the same SHA-256 as the original build:
  `6aa2f627fff1a8c55b0e27fc0671ea62476186309cb1e92ddb89eefdc23cbff7`.
  The preserved source stylesheet was also checked against the original.
- Browser re-verification was interrupted and remains incomplete. No fresh
  visual approval or production deployment is claimed for this follow-up.

## Remaining Work

Track the development-only lint dependency advisories without forcing an
incompatible downgrade. Complete browser verification and the default
production build in the deployment environment before production rollout.
The real SMS provider, delivery checks, production registration migration and
deployment remain separate outstanding work. No production data was changed.
