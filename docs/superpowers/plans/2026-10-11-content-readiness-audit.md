# Content Readiness Audit Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Compare production content with the public website, fix verified inconsistencies and give organizers a concrete missing-information list.

**Architecture:** Keep the existing published-content readers and bilingual pages. Derive homepage session numbers from published sessions; retain clear pending states for unconfirmed operational details. Do not change production content or registrations during the audit.

**Tech Stack:** Next.js 16.3.8, React, Supabase read-only SQL, existing Node tests, ego-lite browser.

**Spec:** User-approved content check and `docs/STATUS.md`.

## Constraints and Review Focus

- Date remains April 16-18, 2027, matching current draft and published settings.
- Publication snapshots are authoritative for public content; drafts are not automatically published.
- Do not invent speakers, times, services, attendee numbers or venue booking confirmation.
- Distinguish an empty publication from a failed read.
- Do not change the existing user's login, profile, password or registration.
- Local implementation and verification do not imply production deployment.

## Task 1: Production Evidence

- [x] Read current settings, active tickets, publication counts and published sponsors.
- [x] Compare eight public routes in Chinese and English.
- [x] Wait for sponsor images to load; all three have nonzero natural dimensions.
- [x] Reproduce the assistant's unconditional lunch/coffee promise.
- [x] Verify that Shandong Hotel and Shungeng Convention Center are distinct places using the hotel official contact page.
- [x] Write `docs/CONTENT_READINESS.md`, separating verified facts, missing materials and local fixes.

## Task 2: Minimal Consistency Fixes

- [x] Add a behavioral homepage test for published count, empty state and failed-read state; observe failure first.
- [x] Use `getPublishedSessions()` in `src/app/page.tsx`, removing unsupported fixed session/attendance numbers.
- [x] User confirmed the venue is not determined. Set canonical venue/address to pending in `src/lib/conference.ts`; remove hotel and street claims from all visible references, including mock announcement text.
- [x] Remove the incorrect Shungeng-area note from `src/app/venue/page.tsx` and make operational details pending.
- [x] Update the assistant's unconfirmed catering, transport and streaming responses; accurately label its rule-based FAQ.
- [x] Make community activity copy clearly provisional in `src/app/attend/page.tsx`.
- [x] Update existing canonical-venue assertions rather than preserving an incorrect name.

## Task 3: Verification and Handoff

- [x] Run focused tests, full Node tests, lint and production build after implementation. Full Node tests: 109/109 after venue and page-contrast fixes; focused tests: 16/16 after venue-pending changes. Final changed-file lint and production build passed after the FAQ label contrast adjustment.
- [x] Start a local server on port 3031. The direct local Supabase connection reset; use a fresh read-only public-content snapshot through a temporary fetch adapter outside the repository. Homepage: 8 variants passed. Venue/attend: 8 of 24 initial checks found low dark-mode contrast, fixed it and passed all 16 affected variants. This is display verification, not a live API/write test.
- [x] Verify actual English and Chinese meal/venue questions return pending information. Inspect English desktop light and Chinese mobile dark FAQ after improving the label contrast. Theme-transition sampling briefly flagged navigation text; a settled English dark page had no contrast problems and required no navigation changes.
- [x] Record content gaps and verification in `docs/STATUS.md` without changing production.
- [x] Remove audit-only screenshots and the temporary existing-server probe. Finish TaskSpace 21, retaining only the result preview. Keep the detached 3031 server, its log and read-only snapshot/adapter needed for review; none of these temporary files enter product code.

## Evidence Sources

- Production Supabase project: `uhhgcecvxzqvwpwiardu`, read-only audit on 2026-10-11.
- Public site: https://how-website.vercel.app/.
- Hotel official contact page: https://sdhotel.com.cn/contact.html (Ma'anshan Road 2-1; lists Shungeng Exhibition Center separately, 1.6 km away). This verifies place identity, not the conference booking.

## Release

- 2026-10-11: User explicitly requested the push after reviewing the local outcome. Target: Production; identity: `faweizhao26`.
- SSH identity confirmed; remote `main` is still `aeb79255022789d429b3972eb3eced0d72994557` before this release. Focused tests 16/16 and diff whitespace check passed again; no runtime code changed since the full tests, lint, build and display verification above.
- Exclude the unrelated Next.js-generated `AGENTS.md` change and the temporary snapshot adapter. Deployment result and live-page verification will be recorded in `docs/STATUS.md`.
- Runtime commit `dbafb17038bb6ae4c5c053b682054ea2f5bfedaf` pushed to `main` and `codex/content-readiness-audit` with `faweizhao26` as author, committer and SSH identity.
- Deployment `dpl_9iUsLPtMXMfz7LsjicLf93MTeUeW`: `target=production`, `readyState=READY`, matching SHA, `aliasError=null`, alias includes `how-website.vercel.app`.
- Production homepage, venue and attend pages passed six read-only Chinese/English checks; actual homepage published content is ready, pending numbers and venue are correct, no horizontal overflow, text contrast problems or runtime exceptions found in this scope.
- Chinese and English FAQ meal/venue questions passed on the production origin. No registration or account mutations performed; no logout. TaskSpace 22 finished, no agent pages kept.
- Release receipt updates only documentation; no additional runtime changes or database migration.
