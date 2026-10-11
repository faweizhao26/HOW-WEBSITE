# Avatar Storage and Migration Alignment Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restore ordinary-user avatar uploads without permitting writes to another user's avatars or conference media, and align repository migration records with production evidence.

**Architecture:** Add narrow Storage RLS policies; keep unique upload paths and existing profile save/cleanup logic. Preserve production migration history, restore missing historical files and correct the registration migration filename only after checksum comparison. Do not replay historical SQL.

**Tech Stack:** PostgreSQL RLS, Supabase Storage, Supabase CLI 2.120.0, existing Node.js verification scripts.

**Spec:** `docs/STATUS.md`, remaining production Storage and migration acceptance.

## Global Constraints

- Do not modify existing users, registrations, conference content, or passwords during preparation.
- Production migration and release require fresh explicit confirmation after local verification.
- Use `faweizhao26` for any authorized push.
- Real RLS tests use only the isolated local database and roll back their synthetic data.
- Do not claim PostgreSQL policy tests are real Storage API upload tests.

## Review Focus

- A user's upload must match both their UUID directory and `owner_id`.
- Anonymous users and ordinary users must not access another user's object metadata or manage conference media.
- Cleanup DELETE requires SELECT, while random-path uploads need no UPDATE/upsert permission.
- Existing administrator media upload/delete behavior must remain usable.
- Matching historical migration contents must not be executed again merely to correct version names.

## Task 1: Avatar Storage Policies

- [x] Read production bucket/policies: public bucket exists, only admin INSERT/DELETE; no ordinary-user permission.
- [x] Generate the avatar migration with the CLI; after application, align its filename to production version `20261010094629` without changing SQL bytes.
- [x] Run `scripts/verify-avatar-storage-rls.mjs` against the empty migration and observe denied own upload.
- [x] Add authenticated own-directory/owner INSERT, SELECT, DELETE; administrator SELECT scoped to conference media.
- [x] Verify real RLS locally: own upload/read/delete, cross-user/forged-owner/other-folder/anonymous denial, no overwrite, admin media access.
- [x] Following explicit production confirmation, apply only the new migration and verify real Storage API upload/display/cleanup using two temporary ordinary accounts, then remove them.

## Task 2: Historical Migration Records

- [x] Read all four production migration versions and checksums.
- [x] Publication migration checksum matches repository exactly; registration SQL checksum matches despite different timestamp.
- [x] All six current registration function definitions match the isolated tested database; production unique index, guard trigger and restrictive RLS are present.
- [x] Restore two missing July migration files from production statements, preserving their exact versions.
- [x] Rename registration migration to production version `20261009151924`; update README and preflight script.
- [x] Verify archived SQL checksums and migration references; do not modify production migration rows or replay SQL.

## Current Evidence

Production project `uhhgcecvxzqvwpwiardu`, read-only queries on 2026-10-10:

| Version | Name | Production SQL MD5 |
| --- | --- | --- |
| 20260703043638 | tighten_public_api_permissions_and_function_security | 3355c59ede5e0c3b2f6c36b4875bc2b8 |
| 20260703043806 | align_registration_rls_policies | fb5c0ee32b6dffdcafc700348c5b3d09 |
| 20260929000100 | content_publication_workflow | 50265122017767805eae396e8f74b454 |
| 20261009151924 | registration_integrity | 626cba02f584d8da70a07f4943bff9cc |
| 20261010094629 | avatar_storage_ownership | 2492ea746a989943f4920e44e5780110 |

The two archived July files add a final newline; removing that single final newline
for checksum comparison matches the exact recorded production statements. The publication
and renamed registration files match production bytes without normalization.

Production policy prerequisites were checked read-only: `owner_id` is text, and
authenticated schema usage, helper EXECUTE and object SELECT/INSERT/DELETE grants exist.

## Verification and Boundary

- RED: after correcting fixture setup to use local schema owner `supabase_admin`,
  the empty migration produced `new row violates row-level security policy for table objects`
  on the ordinary user's own upload.
- GREEN: the new policies passed all real PostgreSQL role/RLS checks in
  `scripts/verify-avatar-storage-rls.mjs`; all temporary tables and users rolled back.
- The isolated RLS fixture uses a minimal transactional Storage table and actual local
  Auth/profile helpers, not a running Storage API. The separate real production acceptance
  below closes the binary upload/display/cleanup gap.
- `npm test`: 106/106 pass. `npm run lint -- --max-warnings=0`: pass.
- All four historical migration checksum comparisons passed; the new production migration
  also matches its archived SQL checksum, and no stale filename reference remains.
- No application TSX or runtime code changed; build/visual matrix not repeated for SQL and records only.
- Working branch `codex/avatar-storage-verification`; user authorized the new production
  migration, temporary ordinary accounts/files with cleanup, then publishing as `faweizhao26`.
  Existing profiles/passwords, registration records and conference content remain unchanged.

## Real Production Acceptance

- Applied only `avatar_storage_ownership`; production recorded version `20261010094629`.
  The local filename follows that exact version, rather than changing the production history.
- Created two auto-confirmed ordinary users through the logged-in Supabase Auth dashboard.
  No email was sent and no existing user's profile or password was changed.
- Used ego-lite on an isolated production alias with a temporary scoped share link, avoiding
  the existing user's session on the public domain. The link was revoked afterward.
- Two actual page uploads succeeded, using distinct 128x128 PNGs. Replacement and refresh
  rendered the saved image with natural dimensions 128x128. Public GET returned HTTP 200,
  image/png and exact uploaded bytes. Desktop dark and mobile light screenshots were inspected;
  the mobile viewport had no horizontal overflow.
- Real Storage API checks denied cross-user upload, metadata listing and deletion, ordinary
  conference-media writes outside the avatar directory, and overwrite/upsert. Each ordinary
  user could upload to their own directory. Public avatar URLs intentionally remain public.
- Called the actual upload helper with real Storage upload/list/delete and profile readback.
  Only the profile PATCH failure response was injected: a blocked write cleaned the new
  object and retained the old profile URL. A committed real write followed by an injected
  lost response retained the newly referenced object. These are controlled failure tests,
  not claims of a naturally occurring production outage.
- Cleanup removed four retained files through the Storage API, cleared only temporary
  profile references, revoked their sessions and deleted both users through Auth. A read-only
  production query confirmed zero test users, profiles, Storage objects and registrations.
  CLI cleanup hit connection resets before mutation; the same cleanup completed through
  authenticated ordinary-user browser requests instead.
- The security advisor reported no Storage/RLS issue; the existing leaked-password-protection
  warning is separate and no unrelated Auth setting was changed.
