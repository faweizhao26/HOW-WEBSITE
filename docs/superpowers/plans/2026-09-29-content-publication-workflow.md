# Content Publication Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Supabase the authoritative content source for HOW 2027 while keeping drafts private and publishing agenda, sessions, speakers, sponsors, news, and site settings deliberately.

**Architecture:** Editable records stay in protected draft tables. Individual content is copied into public projection tables on publish, while agenda and site settings are released as atomic JSONB snapshots. Public pages use a typed server-only repository; authenticated server actions perform publish, unpublish, rollback, and path revalidation.

**Tech Stack:** Next.js 16.2.6 App Router, React 19.2.4, TypeScript, Supabase Postgres/Auth/Storage with RLS, PostgreSQL JSONB and pgTAP, Node test runner, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-29-content-publication-workflow-design.md`

## Global Constraints

- Conference dates remain exactly 2027-04-16 through 2027-04-18.
- CFP review state and website publication state remain separate.
- Editing a published item must not alter its public projection until republished.
- Agenda and site settings publish atomically and keep rollback history.
- Anonymous users must not read drafts, administrative feedback, phone numbers, WeChat IDs, or account profiles.
- Production Supabase failures must never fall back to mock content.
- Public UI remains bilingual and works in light/dark themes on desktop and mobile.
- Do not expose a Supabase service-role or secret key to the browser.
- Read the relevant Next.js 16 docs in `node_modules/next/dist/docs/` before modifying server actions, caching, or route behavior.
- Before schema implementation, inspect the current Supabase changelog and documentation; generate every migration with `supabase migration new`, then run database advisors when available.

## Review Focus

- Distinguish “no release exists” from “the data source failed”; the former gets an honest empty state and the latter an unavailable state.
- Verify that editing an already published record leaves its public projection byte-for-byte unchanged until republish.
- Reject an agenda release containing an out-of-range date, invalid time, or unpublished session/speaker without changing the current release.
- Verify `anon` cannot read `profiles` or any draft table but can read each published projection.
- With production content mode and a failing Supabase query, verify no mock speaker, session, sponsor, or news content appears.

---

## File Structure

### Database and types

- `supabase/migrations/<CLI timestamp>_content_publication_workflow.sql`: schema, grants, RLS, triggers, transactional publication functions, and compatibility backfill; the exact timestamped path is the output of the required `supabase migration new` command.
- `supabase/tests/database/content_publication_rls_test.sql`: pgTAP structure, grant, RLS, atomicity, and rollback tests.
- `supabase-schema.sql`: reproducible full schema snapshot for fresh projects.
- `src/lib/db/schema.ts`: TypeScript database rows and public payload types.

### Shared application services

- `src/lib/content/mode.ts`: explicit local mock versus Supabase mode selection.
- `src/lib/content/types.ts`: public result union and published payload contracts.
- `src/lib/content/public.ts`: server-only reads of public projections and current releases.
- `src/lib/auth/require-admin.ts`: server-side authenticated admin guard.
- `src/app/admin/actions/publication.ts`: publish, unpublish, and rollback server actions.
- `src/components/admin/publication-badge.tsx`: shared draft/published/pending-changes badge.
- `src/components/admin/publication-actions.tsx`: shared action buttons and error toasts.

### Feature surfaces

- `src/app/admin/speakers/page.tsx`, `src/app/speakers/page.tsx`: speaker draft management and public directory.
- Existing session, agenda, sponsor, news, settings, homepage, footer, header, and public pages: consume the shared contracts rather than direct ad hoc queries.

### Tests

- `tests/content-publication-schema.test.mjs`: static migration/schema contract checks.
- `tests/content-publication-app.test.mjs`: source-level integration boundaries and no-fallback checks.
- `tests/e2e/site.spec.ts`: public route, theme, responsive, empty/error-state checks.
- `tests/e2e/publication.spec.ts`: authenticated admin-to-public workflow when test Supabase credentials are configured.

---

### Task 1: Database Publication and RLS Foundation

**Files:**
- Create via `supabase migration new content_publication_workflow`: `supabase/migrations/<CLI timestamp>_content_publication_workflow.sql`
- Create: `supabase/tests/database/content_publication_rls_test.sql`
- Create: `tests/content-publication-schema.test.mjs`
- Modify: `supabase-schema.sql`
- Modify: `src/lib/db/schema.ts`

**Interfaces:**
- Produces draft table publication fields: `publication_status`, `published_at`, `published_by`, `updated_at`.
- Produces tables: `speakers`, `published_speakers`, `published_sessions`, `published_sponsors`, `published_news_posts`, `agenda_releases`, `site_settings_releases`.
- Produces RPCs: `publish_speaker(uuid)`, `unpublish_speaker(uuid)`, `publish_session(uuid)`, `unpublish_session(uuid)`, `publish_sponsor(uuid)`, `unpublish_sponsor(uuid)`, `publish_news_post(uuid, timestamptz)`, `unpublish_news_post(uuid)`, `publish_agenda()`, `rollback_agenda_release(uuid)`, `publish_site_settings()`, and `rollback_site_settings_release(uuid)`.
- Item publish and release RPCs return the affected item or release UUID; unpublish RPCs return the item UUID.

- [ ] **Step 1: Write failing schema contract tests**

Add Node assertions that require all draft/public tables, publication columns, RLS enablement, explicit grants, RPC names, `WITH CHECK` admin policies, and removal of anonymous profile reads. Add pgTAP assertions for the five Review Focus security/atomicity cases owned by this task.

- [ ] **Step 2: Run the tests and verify the new contracts fail**

Run: `npm test`

Expected: FAIL because the publication schema and generated migration do not exist.

- [ ] **Step 3: Generate and implement the migration**

Run `supabase --help`, `supabase migration new content_publication_workflow`, and the generated command help before using further CLI subcommands. Implement the exact tables and RPC interfaces above. RPCs must be transactional, use caller privileges, validate admin access through a non-exposed helper, and never use user-editable metadata for authorization.

- [ ] **Step 4: Update the full schema and TypeScript contracts**

Add `PublicationStatus`, draft/public row types, `AgendaReleasePayload`, and `PublishedSiteSettings` to `src/lib/db/schema.ts`. Keep `sessions.status` as the CFP review status and add `speaker_id` separately.

- [ ] **Step 5: Run database and static tests**

Run: `supabase db reset`

Run: `supabase test db`

Run: `npm test`

Expected: database reset succeeds, pgTAP reports `Result: PASS`, and Node tests pass. If local Supabase cannot run, record that limitation and run the migration in an isolated development project before any production action.

- [ ] **Step 6: Run advisors and commit**

Run the available database advisor command or Supabase MCP advisor. Fix security findings affecting the migration.

```bash
git add supabase supabase-schema.sql src/lib/db/schema.ts tests/content-publication-schema.test.mjs
git commit -m "Add content publication database model"
```

### Task 2: Public Content Repository and Failure Semantics

**Files:**
- Create: `src/lib/content/mode.ts`
- Create: `src/lib/content/types.ts`
- Create: `src/lib/content/public.ts`
- Create: `tests/content-publication-app.test.mjs`
- Modify: `src/lib/utils.ts`
- Modify: `src/lib/supabase/server.ts`

**Interfaces:**
- Produces `type PublicContentResult<T> = { status: "ready"; data: T } | { status: "empty" } | { status: "error"; message: string }`.
- Produces `getContentMode(): "mock" | "supabase"`.
- Produces `getPublishedSettings()`, `getPublishedSpeakers()`, `getPublishedSessions()`, `getPublishedSponsors()`, `getPublishedNews()`, and `getPublishedAgenda()`, each returning `Promise<PublicContentResult<T>>`.
- Public repository functions return bilingual raw data; pages select locale after reading cookies.

- [ ] **Step 1: Write failing mode and repository boundary tests**

Assert that local explicit mock mode is allowed, production mode never falls back after a query error, all six readers return the discriminated result union, and `src/lib/content/public.ts` is marked server-only.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `node --test tests/content-publication-app.test.mjs`

Expected: FAIL because the content module does not exist.

- [ ] **Step 3: Implement mode selection**

`getContentMode()` returns mock only for `NEXT_PUBLIC_CONTENT_MODE=mock`, or for missing/placeholder Supabase configuration outside production. Production with missing or failing configuration returns repository errors, never mock data.

- [ ] **Step 4: Implement typed public readers**

Read only projection/current-release tables. Convert zero rows to `empty`, Supabase errors to `error`, and successful queries to `ready`. Do not catch errors and return an empty collection.

- [ ] **Step 5: Verify and commit**

Run: `npm test`

Run: `npm run build`

Expected: PASS.

```bash
git add src/lib/content src/lib/utils.ts src/lib/supabase/server.ts tests/content-publication-app.test.mjs
git commit -m "Add typed public content repository"
```

### Task 3: Shared Publication Actions and Speaker Lifecycle

**Files:**
- Create: `src/lib/auth/require-admin.ts`
- Create: `src/app/admin/actions/publication.ts`
- Create: `src/components/admin/publication-badge.tsx`
- Create: `src/components/admin/publication-actions.tsx`
- Create: `src/app/admin/speakers/page.tsx`
- Create: `src/app/speakers/page.tsx`
- Modify: `src/app/admin/layout.tsx`
- Modify: `src/app/admin/page.tsx`
- Modify: `src/components/layout/header.tsx`
- Modify: `src/components/layout/footer.tsx`
- Modify: `src/lib/i18n/translations.ts`
- Modify: `tests/content-publication-app.test.mjs`
- Modify: `tests/e2e/site.spec.ts`

**Interfaces:**
- Produces `type PublicationActionResult = { ok: true; id: string } | { ok: false; message: string }`.
- Produces server actions `publishSpeaker(id)`, `unpublishSpeaker(id)`, `publishSession(id)`, `unpublishSession(id)`, `publishSponsor(id)`, `unpublishSponsor(id)`, `publishNewsPost(id, publishedAt?)`, `unpublishNewsPost(id)`, `publishAgenda()`, `rollbackAgenda(releaseId)`, `publishSiteSettings()`, and `rollbackSiteSettings(releaseId)`.
- `requireAdmin()` returns the authenticated admin ID or throws an authorization error without revealing private profile data.

- [ ] **Step 1: Add failing shared-action and speaker-route tests**

Require authenticated admin guards, structured action results, path revalidation mappings, `/speakers` in desktop/mobile navigation, `/admin/speakers` in admin navigation, and speaker empty/error/public states.

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test`

Expected: FAIL on the missing actions, routes, and navigation entries.

- [ ] **Step 3: Implement admin guard and server actions**

Each action calls its exact RPC, returns the structured result, and revalidates only affected paths. Map speaker publication to `/speakers` and `/schedule`; map errors to safe localized messages rather than raw SQL.

- [ ] **Step 4: Implement shared publication controls**

Render `Draft`, `Published`, and `Published, changes pending` from publication metadata. Disable actions while pending, show success/failure toasts, and require confirmation for unpublish and rollback.

- [ ] **Step 5: Implement speaker admin and public pages**

Admin supports create, edit, sort order, avatar URL/upload result, optional account link, publish, republish, and unpublish. Public `/speakers` reads only `getPublishedSpeakers()` and renders bilingual accessible cards without nested cards.

- [ ] **Step 6: Verify and commit**

Run: `npm test`

Run: `npm run build`

Run: `npm run lint`

Expected: tests and build pass; lint has no new errors.

```bash
git add src/lib/auth src/app/admin/actions src/components/admin src/app/admin/speakers src/app/speakers src/app/admin/layout.tsx src/app/admin/page.tsx src/components/layout src/lib/i18n/translations.ts tests
git commit -m "Add speaker publication workflow"
```

### Task 4: Session Review-to-Publication Workflow

**Files:**
- Modify: `src/app/admin/sessions/page.tsx`
- Modify: `src/app/cfp/page.tsx`
- Modify: `src/app/profile/page.tsx`
- Modify: `src/app/admin/page.tsx`
- Modify: `src/lib/i18n/translations.ts`
- Modify: `tests/content-publication-app.test.mjs`
- Modify: `supabase/tests/database/content_publication_rls_test.sql`

**Interfaces:**
- Consumes `publishSession(id)`, `unpublishSession(id)`, `PublicationActions`, and the speaker draft table from Task 3.
- Produces admin speaker assignment for approved sessions and a stable `published_sessions` projection for agenda publication.

- [ ] **Step 1: Add failing session publication tests**

Assert that pending/rejected sessions cannot publish, approved sessions without a published speaker cannot publish, and editing a published session leaves `published_sessions` unchanged until republish.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npm test`

Run: `supabase test db`

Expected: FAIL on missing session assignment and publication controls.

- [ ] **Step 3: Add speaker assignment and publication state to the admin session UI**

Keep the existing CFP review controls. Show a published-speaker selector only for approved proposals, then show shared publish controls when a valid speaker is assigned.

- [ ] **Step 4: Preserve submitter-facing behavior**

CFP and profile pages continue to display review status only; they must not expose admin publication metadata or other speakers' drafts.

- [ ] **Step 5: Verify and commit**

Run: `npm test`

Run: `supabase test db`

Run: `npm run build`

Expected: PASS.

```bash
git add src/app/admin/sessions/page.tsx src/app/cfp/page.tsx src/app/profile/page.tsx src/app/admin/page.tsx src/lib/i18n/translations.ts tests/content-publication-app.test.mjs supabase/tests/database/content_publication_rls_test.sql
git commit -m "Separate session review from publication"
```

### Task 5: Sponsor and News Publication Workflows

**Files:**
- Modify: `src/app/admin/sponsors/page.tsx`
- Modify: `src/app/admin/updates/page.tsx`
- Modify: `src/app/sponsors/page.tsx`
- Modify: `src/app/updates/page.tsx`
- Modify: `src/lib/mock-data.ts`
- Modify: `src/lib/i18n/translations.ts`
- Modify: `tests/content-publication-app.test.mjs`

**Interfaces:**
- Consumes public repository readers and sponsor/news publication actions.
- Produces server-rendered sponsor/news pages with `ready`, `empty`, and `error` states.

- [ ] **Step 1: Add failing no-fallback and pending-change tests**

Assert that sponsor/news public pages no longer import browser Supabase clients, `localStorage`, or `getSponsors/getNews`; assert that edits to published drafts do not alter public projections before republish.

- [ ] **Step 2: Run tests and confirm failure**

Run: `npm test`

Expected: FAIL because the current sponsor page falls back to local storage and news has no publication state.

- [ ] **Step 3: Update admin sponsor and news editors**

Save all edits to draft tables, display publication badges, and use shared publish/unpublish actions. Preserve theme-neutral logo surfaces and assign news publication time only through explicit publication.

- [ ] **Step 4: Convert public pages to server readers**

Render public projections only. Keep recruitment contact copy, bilingual empty states, theme support, and a restrained unavailable state for repository errors.

- [ ] **Step 5: Verify and commit**

Run: `npm test`

Run: `npm run build`

Expected: PASS.

```bash
git add src/app/admin/sponsors/page.tsx src/app/admin/updates/page.tsx src/app/sponsors/page.tsx src/app/updates/page.tsx src/lib/mock-data.ts src/lib/i18n/translations.ts tests/content-publication-app.test.mjs
git commit -m "Add sponsor and news publishing"
```

### Task 6: Atomic Agenda Releases

**Files:**
- Modify: `src/app/admin/agenda/page.tsx`
- Modify: `src/app/schedule/page.tsx`
- Modify: `src/lib/conference.ts`
- Modify: `src/components/chatbot.tsx`
- Modify: `src/lib/i18n/translations.ts`
- Modify: `tests/content-publication-app.test.mjs`
- Modify: `tests/e2e/site.spec.ts`
- Modify: `supabase/tests/database/content_publication_rls_test.sql`

**Interfaces:**
- Consumes `publishAgenda()`, `rollbackAgenda(releaseId)`, and `getPublishedAgenda()`.
- Agenda payload ordering is date, start time, then sort order and includes denormalized public session/speaker data.

- [ ] **Step 1: Add failing agenda validation and rollback tests**

Cover all Review Focus agenda cases: dates outside 2027-04-16 through 2027-04-18, `start_time >= end_time`, missing labels, unpublished session/speaker references, unchanged current release after failure, and successful rollback.

- [ ] **Step 2: Run tests and confirm failure**

Run: `supabase test db`

Run: `npm test`

Expected: FAIL until release validation and public schedule wiring exist.

- [ ] **Step 3: Add agenda publish and history controls**

Keep slots as the editable workspace. Add one `Publish complete agenda` command, current version/time display, historical release list, and confirmed rollback. Surface validation failures next to the publish control.

- [ ] **Step 4: Convert schedule to current release data**

Remove `mockSlots` and `mockProducers` from production rendering. Preserve the current responsive timeline/grid layout, but render a bilingual provisional empty state when no release exists and an unavailable state on source failure.

- [ ] **Step 5: Update conference-facing copy and tests**

Chatbot and schedule copy must no longer describe published data as fictional placeholders. Add `/speakers` and release-backed `/schedule` to light/dark, desktop/mobile coverage.

- [ ] **Step 6: Verify and commit**

Run: `supabase test db`

Run: `npm test`

Run: `npm run build`

Expected: PASS.

```bash
git add src/app/admin/agenda/page.tsx src/app/schedule/page.tsx src/lib/conference.ts src/components/chatbot.tsx src/lib/i18n/translations.ts tests supabase/tests/database/content_publication_rls_test.sql
git commit -m "Publish agenda as atomic releases"
```

### Task 7: Atomic Site Settings Releases

**Files:**
- Modify: `src/app/admin/settings/page.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/components/layout/footer.tsx`
- Modify: `src/components/countdown.tsx`
- Modify: `src/lib/conference.ts`
- Modify: `src/lib/i18n/translations.ts`
- Modify: `tests/content-publication-app.test.mjs`
- Modify: `supabase/tests/database/content_publication_rls_test.sql`

**Interfaces:**
- Consumes `publishSiteSettings()`, `rollbackSiteSettings(releaseId)`, and `getPublishedSettings()`.
- Required settings keys are `conference_name`, `conference_date`, `conference_location`, `conference_location_zh`, `contact_email`, `hero_title`, `hero_title_zh`, `hero_subtitle`, and `hero_subtitle_zh`.

- [ ] **Step 1: Add failing complete-settings release tests**

Assert required keys, valid date parsing, one current release, unchanged current release after validation failure, rollback, and distinction between no release and query failure.

- [ ] **Step 2: Run tests and confirm failure**

Run: `supabase test db`

Run: `npm test`

Expected: FAIL until settings releases are wired.

- [ ] **Step 3: Add settings publish/history UI**

Keep field editing as draft save. Add complete publish, current release metadata, pending-change status, release history, and confirmed rollback.

- [ ] **Step 4: Convert homepage and footer to current settings release**

Use code defaults only when no settings release has ever existed. Render a safe unavailable state or retain non-content shell elements when the repository reports an error; never label an error as an empty release.

- [ ] **Step 5: Verify and commit**

Run: `supabase test db`

Run: `npm test`

Run: `npm run build`

Expected: PASS.

```bash
git add src/app/admin/settings/page.tsx src/app/page.tsx src/components/layout/footer.tsx src/components/countdown.tsx src/lib/conference.ts src/lib/i18n/translations.ts tests/content-publication-app.test.mjs supabase/tests/database/content_publication_rls_test.sql
git commit -m "Publish site settings as releases"
```

### Task 8: End-to-End Verification and Production Readiness

**Files:**
- Create: `tests/e2e/publication.spec.ts`
- Modify: `tests/e2e/site.spec.ts`
- Modify: `tests/regression.test.mjs`
- Modify: `README.md`
- Create: `.env.example`

**Interfaces:**
- Consumes every public reader, publication action, and admin workflow from Tasks 1-7.
- Produces a verified branch ready for explicit production migration/deployment approval.

- [x] **Step 1: Write the authenticated publication journey**

With test Supabase credentials, cover: create draft speaker, verify hidden, publish, verify visible, edit draft, verify old public copy, republish, publish session, publish agenda, publish settings, then roll back agenda/settings. Use unique test identifiers and clean up only records created by the test.

- [x] **Step 2: Extend public visual and runtime coverage**

Include `/speakers`, empty/error states, published schedule, sponsors, updates, and homepage in both themes and desktop/mobile projects. Assert no horizontal overflow, low-contrast text, hydration errors, or browser console errors.

- [x] **Step 3: Run the complete verification suite**

Run: `supabase db reset`

Run: `supabase test db`

Run: `npm test`

Run: `npm run lint`

Run: `npm run build`

Run: `npm run test:e2e`

Local verification uses the authenticated ego-lite click journey and
`npm run test:e2e:ego` in place of launching Playwright, following the user's
explicit browser preference. The optional Playwright CI runner was not run
locally. See `2026-09-30-content-publication-verification.md` for results.

Expected: all tests and build pass; lint has zero errors and no new warnings in touched files.

- [x] **Step 4: Inspect the rendered site**

Start the production build locally on an unused port. Capture desktop and mobile screenshots in Chinese and English, light and dark themes. Check speaker images, sponsor logos, schedule grids, publication badges, dialogs, and empty/error states for overlap or unreadable text.

- [x] **Step 5: Review migration and deployment boundary**

Confirm `git diff`, migration list, database advisors, no secrets, and production mock mode disabled. Do not apply the production migration, push, or deploy without the user's fresh explicit confirmation after visual review.

- [x] **Step 6: Commit final verification changes**

```bash
git add tests README.md .env.example
git commit -m "Verify content publication workflow"
```

---

## Execution Notes

- Implement tasks in order because later UI tasks consume the database and TypeScript interfaces from Tasks 1-3.
- Keep each task's commit focused. Do not combine production migration/deployment with implementation commits.
- If Supabase local services are unavailable, stop before claiming RLS or RPC verification; static tests alone are insufficient for the database security claims.
- After implementation and verification, request a whole-branch code review before asking for production approval.
