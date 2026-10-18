# 2026-10-18 Audit Reliability Fixes

Baseline: e23c9b084f005f3774beb34cee6b1868ca5f3e05.
Branch: codex/audit-reliability-fixes.
Approved scope: the ten findings in the 2026-10-17 overall audit, not optional SEO or a new mail/SMS integration.

## Contracts

1. Account-bound requests must not overwrite a newer browser account's cookies. Refresh in the browser before mutations, bind the expected user, and prevent business actions/CFP POST proxy from writing refreshed cookies.
2. Profile and registration screens must clear private data immediately on identity changes and ignore all prior-account async results, including mutations.
3. Ordinary session INSERT cannot set administrator workflow/feedback/media fields; admin workflows remain available. Validate in the isolated database, never production.
4. Settings drafts use an atomic compare-and-save RPC with a baseline snapshot; conflicts retain the local draft and ask the user to reload. Unconditional direct upsert must not bypass the guard. Existing publish/rollback flows remain compatible.
5. Session media uploads confirm the written row and report failures; cleanup must preserve files referenced after an ambiguous response.
6. Registration export uses stable pagination boundaries without offset-induced duplicate rows. Preserve filters and CSV output.
7. Mobile header exposes Profile, closes accessibly and preserves modified-click behavior.
8. Theme controls share the current theme rather than stale initial props, including menu remounts and layout changes.
9. Reduced-motion Canvas redraws on theme/size changes without re-enabling continuous animation.
10. Initial ticket foreign keys match production NO ACTION; no production migration or destructive data changes.

## Work And Verification

- Main: contracts 1-3 and 10; integration, full regression, isolated database/API checks and browser QA.
- Independent UI work: contracts 7-9, with component tests.
- Independent admin data work: contracts 4-6, with concurrency/failure tests and a separate draft migration.
- Use disjoint files/migrations for delegated work. One final whole-change review after integration.
- For risky behavior, add a reproducing test, observe failure, implement and run targeted checks.
- Final gates: complete Node suite, zero-warning lint, production build, real isolated database/RLS and relevant ego-lite flows. No production writes, commit, push or deployment in this request.

## Ledger

- Setup: existing linked worktree reused; unrelated AGENTS.md preserved. Baseline tests were 163/163 in the audit at the same SHA; no source changes since that evidence.
- Execution choice: independent UI and admin workflows can be implemented in parallel while main owns account/SQL boundaries. Do not duplicate work or dispatch per-task reviewers.
- Completed: all ten contracts implemented. Added browser-side session preparation, expected registration owner checks, account-generation guards and cookie-only identity reconciliation on focus/visibility.
- Final independent review completed once. Its two important findings were reproduced and fixed: navigation logout now uses the browser SDK to broadcast; an unsettled media write never deletes an upload that can still be committed later.
- Verification: 198/198 Node tests; zero-warning lint; Next production build (37 routes); real local SQL/RLS and concurrent settings transactions; capped PostgREST export of 1006 equal-microsecond rows during insertion/deletion; real authenticated-admin Storage upload/readback.
- ego-lite TaskSpace 12: cross-tab logout and account changes, server-cookie logout reconciliation, settings-window conflict with retained edits, mobile Profile, Escape/focus, language refresh/theme remounts, reduced-motion Canvas pixel changes and 24 display combinations passed. Desktop/mobile screenshots inspected; space finished with no kept tabs.
- Environment: dedicated how_audit_reliability_20261018 database, synthetic accounts only. QA gateway CORS headers and synthetic Auth roles were repaired before acceptance. No existing local data copied and no production write/access performed for this batch.
- Release: the user then authorized push/deploy. Both migrations applied through the connected Supabase tool; server-assigned versions 20261018124149/20261018124202 were mirrored in local filenames without changing SQL. Commit 2cca665 was atomically pushed to the work branch/main as faweizhao26. Production deployment dpl_AzTQhk2N6UCayTZqtMx25cHsN8um READY, SHA and aliases verified; real read-only acceptance completed in ego-lite space 13. Business row counts/settings checksums unchanged and no short-window error/fatal logs. Detailed receipt and rollback notes are in ../AUDIT_RELIABILITY.md. Unrelated AGENTS.md remains untouched.
