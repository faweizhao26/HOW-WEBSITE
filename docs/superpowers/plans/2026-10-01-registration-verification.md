# Registration Verification

Scope: replace demo OTP, protect registration writes, and prevent duplicate
registrations. Branch: `codex/fix-registration-verification`.

## Implementation

- Authenticated server actions derive the account id and email from `getUser`.
- Phone validation uses `libphonenumber-js/max` and E.164 normalization.
- Supabase Auth phone-change OTP owns the verification decision. No application
  demo codes are accepted, and changing the form phone invalidates its UI state.
- OTP confirmation checks the current account's pending phone change before
  verification, rejects a mismatched returned account, and requests local sign-out.
- Server actions reject disabled/unconfigured SMS and phone auto-confirmation.
- Unique user index protects concurrent requests and cancelled registrations.
- RLS plus an invoker trigger guards contact/ticket/check-in/ownership fields.
- Profile cancellation/restoration reflects actual database success, with a
  controlled confirmation dialog and a single accessible trigger button.
- Locale is server-derived on registration/profile pages. Long contact details
  wrap within the profile layout, without dimming cancelled records' text.
- Invitation lists are hidden; exact authenticated validation returns a ticket id.
- The full bootstrap schema contains the exact additive migration.

## Local Evidence

The isolated PostgreSQL 17 / GoTrue / PostgREST stack is
`how-publication-stack`, with API port 55421 and database port 55422.
No production changes were made.

- 60 Node tests passed, including 16 registration tests.
- 178 pgTAP tests passed: 148 content-publication and 30 registration checks.
- Seven real Auth/Data API lifecycle groups passed, including concurrent
  registration, protected fields, cancellation/restoration, and local OTP.
- Missing-provider/automatic-confirmation rejection was verified separately
  before enabling the local OTP mapping.
- Production build and TypeScript checks passed against the isolated stack.
- Targeted lint passes for registration code, tests and API verifier. Profile
  still has its previous lint warnings outside this change's scope.
- Ego-lite form checks passed in eight desktop/mobile, Chinese/English and
  light/dark combinations. Profile confirmed/cancelled records passed sixteen
  combinations, including contrast, overflow, images and runtime errors.
- A final eight-combination profile check passed after fixing contact labels
  being compressed into multiple lines. Desktop and mobile screenshots were
  visually inspected; long email values now wrap without squeezing the labels.
- Browser clicks verified wrong-OTP rejection, phone-change invalidation,
  invitation validation, registration, cancellation and restoration.
- Generated UI/API accounts, registrations, invitation codes and tickets were
  removed from the isolated database. Temporary UI credentials and obsolete
  screenshots were deleted, and the browser was signed out.

Browser verification uses ego-lite TaskSpace 5 and
`http://127.0.0.1:3020/register`. Screenshots/reports are generated under
`/private/tmp/how-registration-qa`. The local OTP mapping is only a GoTrue test
fixture, not a real SMS delivery result.
Final contact-layout screenshots/report are under
`/private/tmp/how-registration-profile-final`. The preview remains running;
after fixture cleanup the isolated database has no active registration tickets.

## Production Work Still Required

Configure a real SMS provider and turn off phone auto-confirmation before
applying/enabling the registration workflow. Migration SQL by itself cannot
correct an Auth service that automatically confirms phones. Verify actual
device delivery, expiry, resend limits, and countries supported by the provider.
Do not copy the isolated stack's OTP mapping or dummy provider credentials.

Check for existing duplicate user registrations before the additive migration;
it deliberately stops instead of deleting records. Apply the migration and
deploy the matching frontend together after review and explicit confirmation.
Existing registrations are not retroactively rewritten or reverified.

An independent dependency audit also reports existing Next.js 16.2.6 security
advisories (17 total production dependency findings). `libphonenumber-js` has
no reported advisory in that audit. Framework upgrades were not folded into
this registration patch.
