# Profile and Check-In Verification

Date: 2026-10-09
Branch: `codex/profile-checkin-reliability`
Baseline: `4857d4249f0c5e468201ff14d6ff06b723723953`
Status: locally verified; not committed, pushed, or deployed in this batch.

## Scope

- Profile reads reject partial failures and offer retry instead of empty activity.
- Profile saves, avatar changes, and personal cancellation/restoration require a returned database row. Failed saves retain input or the confirmation dialog.
- Avatar uploads use unique paths. Failed profile updates remove the new upload only when readback confirms it is unreferenced; a committed write with a lost response must not lose its file.
- Pending mutations block duplicate clicks. Clipboard success is reported only after the write resolves.
- Check-in reads distinguish failure from empty results/zero counts. Search is debounced, abortable, safely quoted, and protected against stale responses, including clearing the query.
- Check-in writes compare the previous state and require a confirmed registration for a new check-in. Returned rows determine the displayed result; undo remains possible for a checked-in record that was subsequently cancelled.
- Badge printing escapes all attendee/ticket text, uses the selected language, handles blocked popups, and waits for document readiness instead of a fixed delay. Badge size remains 90 x 55 mm.
- Profile registration badges, metadata, and avatars have readable light/dark styling and correct image cropping/fallback.

No production database, schema, permission, Auth, SMS, registration-form, or dependency changes are included.

## Verification

- Full existing/expanded suite: `npm test`, 69/69 passed before the additional lost-response regression case.
- Focused final suite: `node --test tests/profile-checkin.test.mjs`, 9/9 passed, including that additional case.
- Final `npm run build`: successful compilation, TypeScript checks, and 30 routes.
- Final ESLint: 0 errors, 18 existing warnings in admin layout, CFP, and registration form. All files changed in this batch have 0 warnings.
- `git diff --check`: passed. The unrelated dirty original checkout was not changed.
- `scripts/verify-profile-checkin-api.mjs`: real local profile save/readback, other-user write rejection, cancellation/restoration, ownership filtering, punctuation/quotes/literal wildcard search, exact counts, check-in/undo, stale-state rejection, and cancelled-registration rejection all passed.

Ego Lite TaskSpace 11 used the local isolated Supabase stack and synthetic accounts:

- Failed profile save retained the draft; retry saved successfully.
- Failed cancellation retained the dialog and old state; retry and restoration succeeded.
- Simulated storage upload followed by denied profile update left the old avatar unchanged and issued cleanup DELETE. The file input reset for retry.
- Failed profile load offered retry rather than reporting no registrations; retry succeeded.
- Failed check-in stats displayed `--/--` and retry instead of `0/0`; failed search offered retry instead of a no-match message.
- A deliberately delayed old query could not replace a newer query or repopulate a cleared search.
- Two synchronous check-in clicks issued one PATCH; the returned state was displayed. Undo succeeded.
- Printed `<img src=x>` and `</span><script>x</script>` appeared as literal text; no injected image/script elements existed. The Chinese ticket label was correct and print was invoked once, with native printing stubbed for QA.
- Final populated-page matrix: 16/16 desktop/mobile, English/Chinese, light/dark checks passed with no overflow, contrast failures, broken visible images, or runtime errors. This included the cancelled profile registration state.
- Additional confirmed-profile matrix: 8/8 checks passed across the same viewports/locales/themes.

Evidence: `/private/tmp/how-profile-checkin-qa/report.json`, `confirmed-report.json`, and screenshots in that directory. The earlier cancelled-state report recorded the original contrast failures; the final 16-case report verifies the corrected cancelled state.

## Preview and Remaining Work

Preview: `http://127.0.0.1:3023/profile`. Ego Lite retains the authenticated result page only; the print popup is closed at completion.

The local fixture file `/private/tmp/how-admin-qa-fixture.json` is mode 0600 and retained only to support this preview. It contains synthetic credentials and must not be committed. After review/release, run the existing `scripts/verify-admin-api.mjs` with `ADMIN_QA_CLEANUP=true` and the isolated stack environment to remove its generated accounts/rows and fixture file. Stop only the preview processes identified by `/private/tmp/how-profile-checkin-3023.pid` and port 3023 when no longer needed.

Real SMS and the separately staged registration-security rollout remain deferred. The local stack has no Storage service: avatar failure/cleanup was verified with real Supabase-JS HTTP tests and browser response simulation, not a real Storage upload or production end-to-end test. No online-update claim is made.
