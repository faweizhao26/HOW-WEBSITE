# CFP and Site Notifications Implementation Plan

**Goal:** Update proposal intake and let administrators notify and export selected conference audiences without sending email from the site.

**Scope:** Keep existing Auth, publications and proposals; use separate additive database migrations and verify on disposable local data. No deploy, mailing integration or production writes.

- [x] CFP: save a single proposal language and speaker snapshot; enforce approved type/duration combinations on UI, server and database; retain legacy proposals and releases.
- [x] Notification storage: bound preview, admin-only audience selection/CSV data, atomic idempotent delivery, owner-only inbox and read state. Snapshot exact proposal status and title for review messages.
- [x] Admin and reader interfaces: audience and manual selection; preview then send; CSV respecting mode; notification center, unread badge and send history.
- [x] Run targeted, database and full project checks. Record staged deployment order and limitations.
