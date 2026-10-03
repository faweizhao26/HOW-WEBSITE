# Registration Locale Release

Scope: fix registration's initial locale and language switching only.
Base: production main at `ff26f1b802c18c4ac325b8ef5295371ee17bf9b7`.

## Change

The old client page initializes locale from document.cookie, while its server
render always uses English. Chinese requests therefore fail hydration with
React error 418. Move the unchanged interactive form into registration-form.tsx
and read the request cookie in an async server page, using the existing shared
getLocale helper. Pass locale as a prop rather than storing it in client state,
so a language-switch router refresh also updates the form without resetting it.

No profile, SMS, registration-write, invitation-validation, schema, migration,
package or lockfile behavior changes are included. Existing demo phone code is
not replaced by this locale-only release. Full registration security work
remains on the separate registration branch.

## Pre-Push Evidence

- The existing ego-lite verifier reproduced failures before the edit on the
  production registration route. Report: /private/tmp/how-registration-locale-before.
- 51 existing Node tests passed; targeted ESLint has zero errors and 13
  pre-existing warnings in the unchanged form code.
- Standard Next 16.3.8 Turbopack build, TypeScript and all 30 routes passed.
- HTTP requests with zh, en and invalid language cookies returned the expected
  server-rendered loading text; invalid cookies fall back to English.
- After clearing events from the old production page, the local ego-lite
  registration matrix passed all eight language/theme/viewport combinations,
  including runtime errors, contrast, overflow, headings and visible images.
  Report: /private/tmp/how-registration-locale-local-clean/report.json.
  One preceding run captured a prior-page error in its first case; that run
  is retained separately and is not recorded as a clean pass.
- Desktop and mobile language-switch clicks updated the registration heading.
  Typed name and company survived language refreshes. No registration was
  submitted and no SMS was requested.
- TypeScript AST comparison confirmed every existing form-body statement is
  unchanged except removal of the old locale initialization statement.
- Representative desktop/mobile screenshots were visually inspected.
- Commit identity and live GitHub SSH identity are faweizhao26.
