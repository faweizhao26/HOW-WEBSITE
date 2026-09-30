# Content Publication Verification

Branch: `codex/content-publication-workflow`

## Implemented

Tasks 1-7 provide explicit item publication, draft isolation, immutable agenda
and settings releases, release history, and rollback. Dates are April 16-18,
2027. This final pass also restricts profile role changes and direct publication
table writes, fixes anonymous registration policies and profile joins, and
serialises publication with draft edits. Sessions remain withdrawable when
their speaker binding is removed. Both homepage themes have readable primary
buttons, countdown labels, and footer text.
The final browser pass also fixes the stale login state in the header,
the desktop logout button's missing submit type, and wrapping in the
authenticated desktop navigation. Narrow screens use a scrollable menu.

## Verified Locally

| Check | Result |
| --- | --- |
| Node tests | 44 passed |
| Production build, Supabase mode | Passed, including TypeScript |
| Full ESLint | 0 errors, 48 existing warnings |
| Targeted ESLint on changed controls, scripts and tests | 0 errors or warnings |
| Fresh PostgreSQL 16 schema, pgTAP | 148 passed |
| Original-schema upgrade with legacy settings, pgTAP | 148 passed |
| Official CLI reset and pgTAP, isolated Supabase/PostgreSQL 17 stack | 148 passed |
| Official security advisors on the isolated local stack | No issues found |
| Auth/Data API publication lifecycle | 10 groups passed |
| Authenticated ego-lite click lifecycle | Passed; generated content cleaned |
| Final real-stack empty-state visual matrix | 32 passed |
| Final real-stack homepage visual matrix | 8 passed |
| Login state, desktop/mobile logout, authenticated header layout | Passed |
| Competing publisher and draft edit | Both blocked; transactions rolled back |
| Whole-branch and final-delta code reviews | Findings fixed; no new blockers |
| Whitespace / patch check | Passed |

The first database checks used the isolated `how-content-db` PostgreSQL 16
container. Follow-up checks used Supabase CLI 2.118.0 in
`/private/tmp/how-publication-stack`, with actual PostgreSQL 17, GoTrue, Kong and
PostgREST services. No production database was used. CLI migration history
matches the local bootstrap fixture; security advisors reported no issues.

`scripts/verify-publication-api.mjs` passed against the actual local Auth/Data
API stack. It covers speakers, sponsors, news, session approval/publication,
draft isolation, direct-write denial, complete agenda/settings releases,
invalid-agenda atomicity, rollback and withdrawal after speaker unbinding.
Its generated content was removed and the original settings restored. The
first API run exposed an incorrect test setup: sessions must be created as
pending, then approved, not inserted directly as approved. Both the API
script and optional Playwright journey now follow that contract.
Test clients now use local-scope logout so their cleanup does not revoke the
separate browser login. This was verified with the browser session active.

HTTP checks against the actual app and local stack confirmed all four
content routes return `empty`, while the homepage reads the seeded settings
release as `ready`. This is server-rendered state verification, not visual QA.
The subsequent real-stack ego-lite matrix confirmed those states visually:
32 empty-content combinations and all 8 homepage combinations passed after
the header fixes, without checked contrast, overflow, image or runtime errors.

Ego-lite inspected `/`, `/schedule`, `/speakers`, `/sponsors`, and `/updates` in
English/Chinese, light/dark, 1440px desktop and 390px mobile viewports. There
were no horizontal overflow, checked text contrast, visible image, or runtime
failures:

- Ready-mode fixture: 32 non-home checks passed; the final homepage retest
  passed all 8 combinations after contrast fixes.
- Unavailable data source: all 40 combinations passed, with actual `error`
  state and no mock-content fallback.
- Screenshots were visually inspected for homepage and mobile schedule;
  agenda and settings admin views were inspected during Tasks 6-7. The final
  session detail dialog opens correctly and has no nested button elements.

Local evidence lives in `/private/tmp/how-publication-ready-qa`,
`/private/tmp/how-publication-home-qa`, and
`/private/tmp/how-publication-error-qa`. The ready-mode folder's old homepage
captures are superseded by the home-only folder.

The final real-stack evidence is in
`/private/tmp/how-publication-empty-final-qa`,
`/private/tmp/how-publication-home-final-qa`, and
`/private/tmp/how-publication-ui-qa`. The authenticated click journey covers
speaker draft save, publish, edit isolation and republish; session approval,
speaker assignment and publication; complete agenda/settings publication and
history rollback; and withdrawal after speaker unbinding. The generated rows
were removed, and the original settings draft and release were restored.
Mobile rollback and desktop session detail dialogs were visually inspected.
Header login updates without a reload; both desktop and mobile logout work.
Authenticated desktop navigation remains single-line; tablet/mobile menus
remain usable. Four auth-watcher regression tests cover login/logout events,
late initial reads, and subscription cleanup.

## Still Pending

Local verification for Task 8 is complete. The user approved the visual result
and authorized committing and pushing on September 30, 2026. The authenticated browser journey and empty-state visual QA
used ego-lite TaskSpace 4 after explicit permission to create it. No alternate
browser was launched. `tests/e2e/publication.spec.ts` remains an optional CI
journey and has not been executed locally; ego-lite provides the local browser
evidence, not a claim that the Playwright CI runner passed.

The actual Supabase-mode production build passed. Its preview now runs at
`http://localhost:3019`, connected to the isolated local stack, not production.
The previous mock preview on port 3018 was stopped. Generated test credentials
are kept only in `/private/tmp/how-publication-stack/test.env` with restricted
file permissions; `.env.local` was not modified.

## Publication Status

No production migration or deployment was performed. The user authorized
committing and pushing the verified feature branch after visual review.
GitHub SSH authentication and the commit identity both verified as
`faweizhao26`; the remote is `faweizhao26/HOW-WEBSITE`. The push result is
reported separately after completion. Production migration and deployment
remain outside this authorization.
