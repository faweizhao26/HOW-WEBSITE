# CFP and Login Reliability

## Scope

Repair the three approved items on top of production commit 992df2f. Reuse the
attached clean worktree and branch codex/cfp-auth-reliability. Leave the original
dirty checkout, real SMS, password recovery and migration-history alignment alone.
No production writes or deployment are authorized in this implementation stage.

## Tasks

- [x] CFP data: reject Auth/query failures, distinguish empty from failed reads,
  offer retry and ignore reads from a superseded load or unmounted page.
- [x] CFP submission: server-side confirmed identity and input validation, trimmed
  titles/abstracts, explicit limits, returned-row confirmation and reusable request
  UUID for response-loss/concurrent retries. Keep drafts on failure, lock immediately,
  render the returned proposal without a second read, and use stable EN/ZH errors.
- [x] Login: normalize internal redirects on both password login and Auth callback,
  preserve valid destinations through the account links, surface callback errors,
  map Auth failures to readable EN/ZH messages and release pending state on failure.
- [x] Verify: focused RED/GREEN tests, full unit suite, lint/build, isolated real
  Auth/Data API checks and ego-lite interaction plus desktop/mobile theme/locale QA.

## Boundaries

Follow existing registration service/Server Action patterns. CFP titles are capped
at 200 characters and abstracts at 10000; supported durations stay 15/30/45/60.
Session workflow authorization remains in the existing RLS/trigger. This batch's
server validation is not a new database-wide content constraint. An idempotent
retry must match the stored proposal's owner and content; another user or changed
payload may never recover/overwrite it. No service-role key in browser or actions.

## Review Focus

Missing Auth session versus network failure; blank Unicode input; invalid duration;
zero-row writes; a committed write with a missing response; overlapping page reads;
double submit before disabled controls render; encoded/absolute redirect values;
callback errors retaining the destination; unknown backend errors remaining private.

## Evidence

- `npm test`: 95/95 passed, including 10 service/redirect cases and seven actual
  component mount-effect cases. Existing Node module-type warnings remain.
- `npm run lint -- --max-warnings=0`: passed. Production-mode build and TypeScript
  passed, generating 30 routes with isolated localhost Supabase configuration.
- Real local Auth/Data API: wrong password, unconfirmed email, signed-out/empty
  reads, ownership/input checks, eight concurrent requests yielding exactly one
  row, and a committed write with a lost response all passed.
- ego-lite TaskSpace 17: 12 interaction checks passed, including immediate double
  submit, network failures retaining inputs/drafts, saved-row persistence,
  cross-tab account changes and a paused old-account initial-read response.
- 24 browser combinations across login/signup/CFP, 1440/390 widths, EN/ZH and
  light/dark: no detected horizontal overflow, contrast problems, broken main
  images or runtime errors. Desktop light and mobile dark screenshots inspected.
- Independent read-only review identified canonicalized protocol-relative
  redirects, encoded-space destination loss and identity event ordering races.
  Regression coverage and final follow-up review found no remaining issue in
  those reviewed paths. The hook harness does not simulate full React scheduling.
- Password login uses a full navigation: browser QA reproduced an old prefetched
  protected-route redirect surviving client navigation after successful login.
- Failure callbacks were checked over HTTP for internal/absolute/encoded targets.
  Real confirmation-email delivery and successful PKCE callback were not exercised:
  the isolated Auth stack auto-confirms signup and has no running mail inbox.

## Review Preview

`http://localhost:3025/cfp` is a local production-mode preview, not a deployment.
The generated synthetic accounts and private fixture are retained only for review.
Screenshots and the structured browser report are under
`/private/tmp/how-cfp-auth-qa/`; credentials are not printed or tracked.
The temporary `/private/tmp/how-cfp-auth-run.mjs` wrapper obtains only the isolated
Docker stack's credentials. After review, remove generated accounts/proposals with:

```bash
CFP_QA_CLEANUP=true node /private/tmp/how-cfp-auth-run.mjs node scripts/verify-cfp-auth-api.mjs
```

No production data, SQL migrations, dependency versions, commits, push or deployment
were changed in this implementation stage. Original checkout changes were preserved.
