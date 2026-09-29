# HOW 2027 Content Publication Workflow Design

Date: 2026-09-29  
Status: Approved in conversation; awaiting written-spec review

## 1. Purpose

Connect the public site and admin interface to Supabase as the authoritative content source for agenda, sessions, speakers, sponsors, news, and site settings. Editors must be able to prepare content without exposing unfinished changes, then publish it deliberately.

The implementation succeeds when:

- Public pages display only explicitly published content.
- CFP review and website publication are separate decisions.
- Editing published content does not change the live site until it is published again.
- Agenda and site settings are published atomically as complete sets.
- Public users cannot read drafts, administrative notes, phone numbers, WeChat IDs, or other private profile fields.
- Production never silently substitutes mock content after a Supabase error.

Registration, ticketing, check-in, CFP submission, and general visual redesign are outside this phase except where permissions must be preserved.

## 2. Current State

The repository already has Supabase tables for profiles, sessions, agenda slots, sponsors, news posts, and site settings. Admin pages write directly to those tables. However:

- The public schedule always reads `mockSlots` and `mockProducers`.
- Sponsors may fall back to browser `localStorage` when a production query fails.
- News and settings have no draft/publish boundary.
- Session `status` represents CFP review, not website publication.
- Speaker content is stored in `profiles`, whose current public read policy also exposes private profile columns through the Data API.
- Many Supabase errors are swallowed, so the admin UI can report no useful failure reason.

These gaps make the admin interface an incomplete source of truth and make it possible for the public site to disagree with the backend.

## 3. Considered Approaches

### 3.1 Status columns only

Add `draft` and `published` flags to existing rows and let public pages read rows marked published. This is fast, but an edit either changes the live row immediately or requires temporarily removing it from the site. It also provides no stable rollback point.

### 3.2 Draft records plus published projections

Keep editable records in the existing administrative tables and copy public fields into separate published projection tables when an editor publishes. Agenda and settings use immutable release snapshots. This keeps live data stable, makes permissions easier to audit, and supports rollback without introducing a full CMS.

This is the selected approach.

### 3.3 External headless CMS

A CMS would provide mature editorial workflows but would add another service, authentication model, and synchronization path. It is unnecessary for the current team and content volume.

## 4. Architecture

The system has three layers:

1. **Draft layer:** Existing administrative tables plus a new `speakers` table. Editors and CFP submitters work here under RLS.
2. **Publication layer:** Public-only projection tables for individual items and append-only release tables for complete sections.
3. **Application layer:** Server-side public content readers and authenticated server actions for publish, unpublish, and rollback operations.

Public pages never query draft tables. Admin pages can inspect both the draft record and its publication metadata.

Individual content types use copy-on-publish:

- speakers
- sessions
- sponsors
- news posts

Whole-section content uses release snapshots:

- agenda
- site settings

Every publish action is transactional. A failed action leaves the previous public version unchanged.

## 5. Data Model

### 5.1 Common publication metadata

The draft tables for sessions, speakers, sponsors, and news posts contain:

- `publication_status`: `draft` or `published`
- `published_at`: nullable timestamp
- `published_by`: nullable profile ID
- `updated_at`: timestamp maintained by a trigger

The admin UI derives an additional display state, `published_with_changes`, when `updated_at > published_at`. This is a UI state, not a database enum.

Publishing upserts a sanitized public copy, then updates the metadata in the same transaction. Unpublishing removes the public copy and returns the draft record to `draft`.

### 5.2 Speakers

Add a dedicated `speakers` draft table with:

- `id`
- optional unique `profile_id`
- English and Chinese display names where available
- company and title in both languages where available
- biography in both languages
- avatar URL
- sort order
- common publication metadata

Add `published_speakers` with the same public presentation fields and no account or private contact fields. This supports manually managed guests as well as CFP users promoted to speakers.

The existing `profiles` table remains the account profile. Anonymous access to it is removed. Users retain access to their own profile, and administrators retain access to all profiles.

### 5.3 Sessions

Keep `sessions.status` as the CFP review state (`pending`, `approved`, or `rejected`) to minimize migration risk. Add `speaker_id` and common publication metadata.

Add `published_sessions`, containing only the public session fields and a reference to `published_speakers`. Administrative feedback, submitter identity, and private profile data are excluded.

A session can be published only when:

- its review status is `approved`;
- it has a speaker;
- that speaker is currently published.

Rejecting or unpublishing a session does not rewrite an already published agenda release. The schedule changes only when the agenda is published again.

### 5.4 Sponsors and news

Keep the existing `sponsors` and `news_posts` tables as editable drafts and add common publication metadata.

Add `published_sponsors` and `published_news_posts` containing only public fields. News publication time is assigned on first publication and updated only when the editor explicitly republishes with a new publication time. Editing a draft never changes the public copy.

### 5.5 Agenda releases

Keep `agenda_slots` as the editable schedule workspace. Add `agenda_releases` with:

- `id`
- monotonically increasing `version`
- `payload` as JSONB
- `is_current`
- `published_at`
- `published_by`

The payload contains the complete ordered agenda, including the public session and speaker data needed to render it. It is deliberately denormalized so later edits to sessions or speakers cannot mutate a released agenda.

Publishing validates every slot before creating the release:

- dates must fall between 2027-04-16 and 2027-04-18;
- start time must be earlier than end time;
- session slots must reference a published session and speaker;
- non-session slots must have a display label;
- ordering must be deterministic by date, start time, and sort order.

The transaction inserts the new release and switches `is_current` from the previous release to the new one. Rollback marks a selected historical release current; it does not delete history.

### 5.6 Site settings releases

Keep `site_settings` as the editable key/value workspace. Add `site_settings_releases` with the same release metadata as agenda releases and a JSONB payload containing the complete validated settings map.

Required settings include conference name, date range, English and Chinese locations, contact email, and bilingual hero copy. A release is rejected if required keys are absent or the conference date cannot be parsed.

The homepage and other consumers read only the current settings release, with code defaults used only when no release has ever existed. A Supabase query error is not treated as an absent release.

## 6. Permissions and Security

- Draft tables are not selectable by `anon`.
- CFP submitters retain access to their own session submissions.
- Only administrators can manage speakers, agenda slots, sponsors, news, and site settings.
- Published projection tables are selectable by `anon` and `authenticated` and contain no private columns.
- Release tables expose only the current release to public roles; administrators can inspect history.
- Admin write policies include both `USING` and `WITH CHECK` clauses.
- Reusable admin authorization lives in a non-exposed database helper, not in user-editable metadata and not in a public `SECURITY DEFINER` function.
- Storage keeps public delivery for conference media, while upload, replace, and delete permissions remain restricted to administrators or the owning user as appropriate.

Publishing functions run with the caller's privileges and rely on RLS. They are callable only by authenticated users and complete all copy and metadata changes in one transaction.

## 7. Application Flow

### 7.1 Public reads

Create a typed server-only content module that provides readers for current settings, speakers, sessions, sponsors, news, and agenda. Public pages use this module instead of importing mock data or creating browser Supabase clients.

The module returns one of three explicit outcomes:

- published data;
- no publication exists;
- data source failure.

Pages show honest empty states for the second outcome and a restrained unavailable state for the third. They never replace either outcome with fictional production content.

### 7.2 Admin writes and publication

Draft editing remains responsive in the client interface. Publish, unpublish, agenda release, settings release, and rollback operations go through authenticated server actions. The actions validate input, invoke transactional database functions, return structured errors, and revalidate affected paths after success.

Admin lists display these states:

- Draft
- Published
- Published, changes pending

Available commands are:

- Save draft
- Publish or republish
- Unpublish
- Publish complete agenda
- Publish complete settings
- Roll back a release

Session publication controls remain disabled until CFP review and speaker requirements are satisfied.

### 7.3 Public routes

- Add `/speakers` and expose it in desktop and mobile navigation.
- Convert `/sponsors` to a server-rendered published-content page.
- Convert `/schedule` from mock data to the current agenda release.
- Keep `/updates` server-rendered but read only published news.
- Update the homepage to read only the current settings release.

The existing bilingual, light-mode, dark-mode, and responsive behavior remains intact.

## 8. Mock and Failure Policy

Mock content is allowed only when an explicit local/test content mode is enabled. Missing or placeholder Supabase configuration may activate that mode during local development, but a configured production deployment never falls back to mock data after a query failure.

All admin mutations inspect Supabase errors. Failures produce localized error toasts and leave local UI state consistent with the database. Server-side publication failures log enough context to identify the content type and operation without logging secrets or private profile fields.

## 9. Migration and Compatibility

The migration is additive before it becomes restrictive:

1. Create publication metadata, speaker tables, projection tables, release tables, triggers, functions, grants, and initial RLS policies.
2. Backfill `updated_at` and publication metadata.
3. Copy existing sponsors and news into their public projections so currently visible real content remains visible.
4. Create the first site settings release from existing settings merged with code defaults.
5. Do not create an agenda release from `mockSlots`; the public schedule shows a provisional empty state until an administrator publishes a real agenda.
6. Update the application to use the new paths.
7. Remove anonymous profile access and obsolete broad public policies only after public readers no longer depend on them.

Existing sessions and CFP submissions remain unchanged and unpublished. Approved sessions still require an explicit speaker association and publish action.

Schema changes will be captured as a Supabase migration and reflected in `supabase-schema.sql` and the TypeScript database types.

## 10. Testing and Verification

Database verification covers:

- anonymous users cannot read drafts or profiles;
- anonymous users can read published projections;
- normal users can manage only their own CFP submissions;
- admins can manage drafts and publications;
- invalid session, agenda, and settings publications fail atomically;
- rollback changes the current release without deleting history.

Application verification covers:

- draft edits do not change public pages;
- republishing updates the intended page;
- agenda and settings releases switch as complete units;
- production-mode query failures never show mock content;
- bilingual empty and unavailable states;
- desktop and mobile navigation for the new speakers page;
- light and dark themes for speaker, sponsor, schedule, news, and admin publication states.

Required checks are focused unit tests, Supabase integration checks when credentials are available, Playwright coverage of the admin-to-public workflow, `npm test`, `npm run build`, and lint with no new errors.

## 11. Delivery Boundary

Implementation is complete when the migration, application changes, tests, and browser QA pass locally. Production deployment and public database migration are separate release actions. They require an explicit final review of the rendered site and confirmation immediately before production publication.
