# Admin Reliability Verification

## Scope and Release State

- Worktree: `/Users/felixzhao/.codex/worktrees/admin-reliability/how-2027`.
- Branch: `codex/admin-reliability`.
- Base: `c4a49da7194e12b6c531674575e4b95a50009f56`, the locale-only release.
- Pre-push snapshot: this batch was not committed, pushed, or deployed when the local checks below completed.
- No production database, migrations, Auth settings, or SMS configuration were changed.
- The unshipped registration-security branch and the original checkout's dirty files were left untouched.

## Changes

1. Dashboard, ticket/channel management, and registration-list reads now reject failed requests instead of treating failures as valid data. The dashboard uses exact counts, not a row-limited list. Demo counts are restricted to explicit mock mode. Failed reads offer retry.
2. Ticket/channel mutations and admin cancellation/restoration require a successful response containing a row id. Forms retain input on failure, duplicate channel codes receive a specific message, and repeated submissions are disabled. Clipboard failures are handled. The selected ticket/channel tab survives data reloads.
3. A shared server-derived locale provider replaces frozen client cookie snapshots across the admin pages, authentication forms, CFP, profile, and chatbot. Locale changes preserve client form/filter state. Registration filter labels use the Select component's item mapping rather than displaying internal values.
4. Registration reads page through all rows. CSV export offers all records or the current filtered subset, preserves Unicode, quotes and embedded newlines, uses CRLF and a UTF-8 BOM, protects spreadsheet formula prefixes, and formats timestamps in Asia/Shanghai.
5. Scoped text-color fixes improve affected admin, CFP, profile, and registration ticket-description contrast. The public registration and profile workflows were otherwise unchanged.

## Automated Checks

- `npm test`: 61 passed, 0 failed. New cases cover failed reads, denied/duplicate/zero-row mutations, exact counts beyond the API row cap, pagination beyond 1,000 registrations, CSV escaping, locale labels and filtered exports.
- `npm run build`: passed for the final source, including TypeScript and all 30 routes.
- `npm run lint`: exit 0; 0 errors and 32 existing warnings. These warnings are not claimed to be resolved by this batch.
- `git diff --check`: passed.

## Real Local API Checks

`scripts/verify-admin-api.mjs` is gated to an explicitly isolated localhost project. It verified actual ticket create/update/readback, channel creation, duplicate rejection, denied anonymous writes, missing-row rejection, invalid ticket-reference rejection, dashboard/list reads, and ticket/channel deletion.

The existing local schema uses ON DELETE SET NULL for ticket references. This batch does not change that behavior or claim that deleting a referenced ticket is blocked.

Only synthetic accounts and rows were created in the local stack at `http://127.0.0.1:55421`. No email or SMS was sent. Browser-created disposable ticket/channel rows were removed through the UI after testing.

## Ego Lite Browser Checks

One TaskSpace (9), page p1, was used throughout. No other browser was launched.

- `/private/tmp/how-admin-final-qa/report.json`: 128 route/viewport/locale/theme combinations. All 80 admin combinations passed. Twelve contrast failures on profile and registration were identified and fixed. Other routes passed.
- `/private/tmp/how-admin-recheck/report.json`: 40 targeted combinations after the final application build. All overflow, contrast, broken-image and runtime-error checks passed. One profile capture occurred before its heading loaded, so this report has one failure and is not a clean 40/40 result.
- The script now waits for the profile/CFP heading. `/private/tmp/how-admin-profile-recheck/report.json`: all 8 profile combinations passed, including the previously premature capture.
- Representative desktop/mobile screenshots were visually inspected, including light-mode registration management, dark-mode ticket management, light-mode profile, and dark-mode registration.

Interactive checks passed:

- A blocked ticket save leaves the dialog open and input intact, then succeeds after restoring connectivity. The disposable ticket was deleted.
- A duplicate channel insert displays the error without closing/resetting the form.
- A blocked dashboard read shows an error without example statistics; retry restores real counts.
- Login, signup, CFP, settings and registration search inputs survive actual header language-switch clicks. A selected registration status remains selected with its translated label.
- The Channels tab survives both a locale change and a successful create/reload/delete cycle.
- Actual browser downloads of Chinese all-records and filtered CSVs, plus an English filtered CSV, were checked. The filtered files exclude the cancelled synthetic attendee; the all-records file includes both attendees. Quoted names, embedded newlines, company commas/quotes and localized labels were verified.

## Local Review

The final production-mode local preview is running at `http://127.0.0.1:3022`, connected only to the isolated local stack. Its log and parent pid file are `/private/tmp/how-admin-preview-3022.log` and `/private/tmp/how-admin-preview-3022.pid`.

Synthetic review fixtures and the browser's local test-admin session are retained so the result remains reviewable. Fixture credentials are in the mode-0600 local file `/private/tmp/how-admin-qa-fixture.json`; no secrets are committed or printed in this document. After review, run the gated API script with `ADMIN_QA_CLEANUP=true` and the isolated local project environment to remove those accounts/rows and the fixture file.

SMS provider selection, paid SMS integration, real-device OTP verification, and the full registration-security rollout remain deferred.

## Production Push Authorization

The user authorized pushing this verified batch. Before committing, live SSH authentication and effective Git author name/email were confirmed as `faweizhao26`. Remote `main` still matched the base above. The intended target is `faweizhao26/HOW-WEBSITE:main` and the existing Git-triggered Vercel production project `how-website` (`prj_2h1D6HkgwlIX8LcEE3xJtmAlnVh1`) in `faweizhao26s-projects`. No local prebuilt output, fixture data, database migrations, or environment changes are part of this release. Deployment readiness and public-domain assignment must be checked after the push; authorization alone is not evidence of deployment success.
