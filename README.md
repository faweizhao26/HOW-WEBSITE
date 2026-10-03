# HOW 2027

Bilingual conference site built with Next.js 16, React 19, Tailwind CSS and Supabase.
The conference runs April 16-18, 2027 in Jinan.

## Local Development

```bash
npm install
npm run dev -- --port 3017
```

Configure `.env.local` using the variable names in `.env.example`.
`NEXT_PUBLIC_CONTENT_MODE=supabase` reads actual published content.
For an isolated visual preview, explicitly set `NEXT_PUBLIC_CONTENT_MODE=mock`
at **both build and start time**:

```bash
NEXT_PUBLIC_CONTENT_MODE=mock npm run build
NEXT_PUBLIC_CONTENT_MODE=mock npm run start -- --port 3018
```

Mock changes stay local and do not simulate real publication. Production must
use `NEXT_PUBLIC_CONTENT_MODE=supabase` and valid Supabase public credentials.
Never add a service-role key to `NEXT_PUBLIC_*` variables.

## Database Setup

For a new Supabase project, apply `supabase-schema.sql` once. For an existing
project with the original schema, use
`supabase/migrations/20260929000100_content_publication_workflow.sql` instead.
Do not apply both paths to the same database. This migration is additive to
the original schema; it is not a standalone bootstrap migration.

Admin access comes from the trusted `profiles.role` column. Promote the intended
account from a trusted database console, not through signup metadata. Ordinary
accounts cannot change their own role.

## Content Publishing

- Speakers, approved sessions, sponsors and news are saved as drafts. Explicit
  publish copies them into public projections. Editing a published draft does
  not change its public snapshot until republish.
- Sessions require a published speaker. CFP approval and website publication
  are separate states. Unpublish removes the public projection, not the draft.
- Agenda slots are a workspace. `Publish complete agenda` validates every slot
  and creates one immutable, complete release with embedded session/speaker data.
- Settings use the same draft/release model. Save the draft before publishing.
  Current release, pending changes and release history are visible in the admin.
- Rollback switches the current agenda/settings release without rewriting its
  payload or changing the workspace drafts. Republish creates a new version.

Public readers return `ready`, `empty` or `error`. Settings defaults are used
only for an empty release history. Query failures show an unavailable state;
they never reveal drafts or switch to mock content.

Published projections and release history are not directly writable through
the authenticated Data API. Public invoker RPCs delegate to private,
administrator-guarded writers. The private schema must not be exposed by the
Data API. Release writers lock their source tables while validating/copying.

## Verification

```bash
npm test
npm run lint
npm run build
```

The development lint dependency `fast-glob` is a private local adapter backed
by tinyglobby, avoiding the vulnerable micromatch/braces dependency chain.
See `tools/next-lint-glob/README.md` for its limited API and removal criteria.
Keep that directory and the lockfile together; `npm ci` validates installation.

Database behavior tests are in
`supabase/tests/database/content_publication_rls_test.sql`. Run them with
`supabase test db` against an isolated migrated project. A PostgreSQL-only
substitute needs the Supabase `anon`/`authenticated` roles, `auth.users`,
`auth.uid()` and pgTAP; this validates SQL/RLS, not the full Auth/Data API stack.
`npm run test:db:concurrency` checks that publication blocks competing draft
edits and serialises publishers in the local PostgreSQL container. Override
`PUBLICATION_DB_CONTAINER` and `PUBLICATION_DB_NAME` for another isolated local
test database. Its generated account is removed and publication changes roll back.

Local visual checks use **ego-lite**, reusing the current TaskSpace:

```bash
EGO_TASK_SPACE_ID=4 EGO_BASE_URL=http://127.0.0.1:3019 EGO_ROUTES=/ EGO_EXPECT_CONTENT_STATE=ready npm run test:e2e:ego
```

Replace the space id and preview URL with the current authorized TaskSpace
and local server. Omit `EGO_ROUTES` to check all five publication routes.
The verifier checks routes in English/Chinese, light/dark,
desktop/mobile, including text contrast, page overflow, images and runtime
errors. Screenshots default to `/private/tmp/how-publication-qa`.
Set `EGO_EXPECT_CONTENT_STATE=error` for a missing/unavailable data source,
or `empty` for an isolated database with no public content. `EGO_ROUTES` can
select a comma-separated subset. The verifier leaves the TaskSpace active;
finish it once the full review is complete, retaining only the result tab.

`tests/e2e/publication.spec.ts` is an optional CI journey against a disposable
Supabase project. Configure all `PUBLICATION_TEST_*` variables, explicitly set
`PUBLICATION_TEST_ISOLATED_PROJECT=true`, and build the app against that same
project. Use a trusted existing test administrator. The service-role key is
used only by the Node test for cleanup; it is never sent to browser code.
Without this configuration the journey is skipped, not considered verified.

The same isolated test credentials can run the Auth/Data API lifecycle without
launching a browser:

```bash
node --env-file=.env.local scripts/verify-publication-api.mjs
```

This requires empty speaker/session/agenda draft tables. It checks draft
isolation, item publication and withdrawal, complete releases, rollback, and
direct-write denial. Only its generated rows are deleted, and the original
settings draft and release are restored. Browser clicks still need a separate
ego-lite verification; an API pass does not stand in for that check.
Test-client logout uses local scope to preserve other sessions of the same
test administrator, including the browser review session.

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3018 npm run test:e2e
```

Playwright CI uses its installed Chromium, with no hardcoded Google Chrome
application path. Local review in this workflow uses ego-lite instead.

## Production Boundary

Review the local screenshots and verification results before production work.
Production migration, pushing the branch and deploying require a fresh explicit
confirmation. Push with `faweizhao26`, not the local machine's other account.
Keep database verification, browser QA and deployment status distinct.
