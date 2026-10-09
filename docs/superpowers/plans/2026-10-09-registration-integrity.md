# Registration Integrity Repair

Scope approved in chat: server validation, channel-code matching and stale-query protection,
duplicate prevention, loading/retry, input/error messages, removal of demo SMS, and 18 lint warnings.
Real SMS, production writes, and publishing are excluded.

## Implementation

- [x] Add a shared typed registration parser/service and authenticated Server Actions.
- [x] Add database identity/ticket/field guards and one-registration-per-user constraint;
  fail migration on existing duplicates without deleting or rewriting records.
- [x] Replace demo verification with contact collection, await initial reads, add retry,
  retain form drafts, reject stale channel queries, and guard repeated submissions.
- [x] Resolve admin-layout and CFP warning causes without changing unrelated behavior.
- [x] Verify unit tests, isolated real Auth/Data API lifecycle and concurrency,
  whole-project lint/build, and ego-lite desktop/mobile/light/dark/EN/ZH flows.

## Contract

Phone numbers are collected and format-validated, not ownership-verified. User identity
comes from the authenticated session; email is the confirmed account email. Normal users
may only change the status of their own registration. Administrators retain management
permissions. One registration per user is preserved through cancellation/restoration.

## Evidence

## Verification Complete

- Unit regression tests were red before adding the registration service, then passed.
- Final full application suite: 78/78 passing, including the added input boundaries.
- Full-project ESLint: 0 errors and 0 warnings, down from 18 existing warnings.
- Standard Turbopack build: passed, including TypeScript and all 30 routes.
- Full dependency audit: 0 findings after a compatible source-map-js 1.2.2 patch.
- Real isolated Auth/Data API: identity, ticket/code enforcement, hidden code lists,
  direct write bypass attempts, eight simultaneous submissions creating exactly one
  row, cancellation/restoration and admin check-in/undo all passed.
- Independent review found SQL rejection of the valid short number +6907290 and
  acceptance of control/Unicode whitespace-only names. All four failures reproduced
  through the real Data API before repairing the migration. The added boundary group
  now passes; account phone ownership remains intentionally unverified.
- The full migration was tested with duplicate rows inside a rollback-only transaction.
  It stops before changing schema; rows, the unique index and identity-function definition
  are unchanged after rollback.
- Independent follow-up review confirms both P2 findings are resolved. No application
  code changes were needed after browser QA; the final edits were SQL, tests and docs.
- Ego-lite TaskSpace 14: 16 populated form/CFP checks, 8 existing-registration checks
  and 8 admin-layout checks passed (desktop/mobile, EN/ZH, light/dark). No overflow,
  contrast failures, broken visible images or runtime errors in those matrices.
- Browser interaction tests passed for whitespace/invalid phone rejection, read-only
  account email, removal of demo SMS, mismatched code rejection, delayed response after
  clearing a code, initial-read retry, and failed-action draft/pending-lock recovery.
- The original dblclick harness lost its target when the first real click completed
  successfully; the database contained one row, not two. The corrected timing test sends
  two synchronous native form submissions before React renders disabled state: one
  Server Action, one database row, successful confirmation and existing-registration
  state on reload. It passed without changing application code.
- Screenshots and machine-readable reports: /private/tmp/how-registration-integrity-qa.
- Admin sidebar collapse, restore and navigation passed. The administrator can still
  read/manage ticket and invitation lists after public code-list access is removed.
- Final API cleanup removes only its generated data and only its own matching fixture
  file; a separately retained browser fixture remains available for local review.

## Local Review

Preview: http://localhost:3024/register, retained in ego-lite as an anonymous page with
Chinese/light settings. Test tickets and private QA fixture remain in the isolated local
stack for review and reproduction, not in production. The preview process, launcher,
PID and log in /private/tmp/how-registration-* are needed while this preview is running.
The fixture is mode 0600 and its credentials were not printed. Use the documented
REGISTRATION_QA_CLEANUP command when the local review no longer needs those generated
accounts, invitations, tickets and registrations.

## Release Boundary

The branch is codex/registration-integrity. Apply the registration-integrity migration
before deploying this code; it requires explicit resolution if production already has
duplicate registrations. Do not cherry-pick the older SMS-dependent registration branch
into this deferred-SMS release. A future real-SMS rollout needs a later migration that
requires verified phone ownership, as well as the provider and device-delivery checks.

The implementation and local-review stage made no production database, Auth, SMS,
deployment, or GitHub changes.

## Production Release Preflight

The user authorized production publication on October 9, 2026. SSH authentication
is faweizhao26; the remote main branch still points to a09a9ec. The official site's
browser requests confirm Supabase project uhhgcecvxzqvwpwiardu. Its preflight finds
zero duplicate users, one existing registration, the private admin helper present
and no one-registration-per-user index yet. The migration changes constraints,
policies and functions without rewriting existing registration rows. Auth settings
and real SMS remain unchanged. Final deployment evidence is recorded separately
after the published commit is ready.
