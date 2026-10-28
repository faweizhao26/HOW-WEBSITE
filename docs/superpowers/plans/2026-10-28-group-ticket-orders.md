# Group Ticket Orders Implementation Plan

**Goal:** Deliver group orders and individually redeemed registrations without enabling online payments.
**Architecture:** Dedicated group-only ticket types; authenticated RPCs perform transactional order/seat transitions. Existing Auth, registrations, check-in and badge printing remain authoritative. Administrator records an externally verified payment reference and exact received amount before seats become available. No payment credentials, checkout, refunds, or automatic account creation.
**Scope approved:** User approved developing the previously proposed order/group-seat foundation with real charging deferred. Execute inline; no further approval gate or automatic publishing.

## Decisions
- CNY prices stored as integer cents and snapshotted per order; configuration disabled by default.
- Group size 2-100; orders expire after 24 hours if not activated. Optional claim deadline copied to the order.
- Creator is not automatically an attendee. Every attendee logs in with their own verified email and claims one seat.
- One registration per account remains enforced. An existing registration is not silently replaced; cancelled registrations must be handled separately.
- One random code per seat, copyable by owner/admin only; rotating an unclaimed code invalidates its predecessor.
- Only pending orders can be cancelled. Administrators can close active orders to stop future claims; existing registrations remain valid. Closing is NOT a refund.
- Private reads are live and owner-scoped; administrators can page all orders. No group data enters public content caches.
- New migration must be applied before deploying; no production writes or push this round.

## Tasks
- [x] Domain contract and failing validation/behavior tests.
- [x] Migration: group configs, orders, seats, audit events; RLS and explicitly granted RPC wrappers; atomic activation/claim/rotation/closure, idempotent order creation.
- [x] Service: input validation, account-change check, real auth and safe errors.
- [x] UI: `/group-tickets`, `/group-tickets/redeem`, `/admin/group-orders`; links from profile/registration/admin tickets and navigation. Bilingual, theme-compatible, loading/error/empty states and pagination.
- [x] Isolated Postgres/API verification: owner isolation, direct-write rejection, paid-ticket bypass rejection, amount/reference checks, duplicate operations and concurrent last-seat claim. Fresh review found 3 boundaries, reproduced RED and fixed GREEN. Final migration also passes clean-schema application.
- [x] Regression suite 224/224, lint/build, desktop/mobile browser verification and cleanup; status and migration instructions updated. UI review retry finding reproduced in browser and fixed; source reviewed and bounded mobile layout corrected. No push/deploy.

## Contract
UI imports types from `src/lib/group-tickets/types.ts` and functions from `service.ts`.
All functions take a Supabase client first. Mutations include `expectedUserId`; UI retains `requestId` on create retry.
`loadGroupWorkspace(client, admin=false, page=0, search="")` returns configs, tickets, paged orders, total, userId.
`loadGroupOrder(client, orderId)` returns order and seats.
`saveGroupConfig(client, {expectedUserId,ticketTypeId,enabled,minSize,maxSize,unitPriceCents,claimDeadline})`.
`createGroupOrder(client, {expectedUserId,requestId,ticketTypeId,quantity,teamName})` returns order ID.
`activateGroupOrder(client, {expectedUserId,orderId,paymentReference,receivedCents})`.
`cancelGroupOrder(client, {expectedUserId,orderId})`; `closeGroupOrder(client, {expectedUserId,orderId,reason})`.
`rotateGroupSeat(client, {expectedUserId,seatId})`.
`redeemGroupSeat(client, {expectedUserId,code,name,phone,company,position})` returns `{registrationId}`.
`GroupTicketError` has `code`; `groupErrorMessage(error,locale)` returns safe localized text.
