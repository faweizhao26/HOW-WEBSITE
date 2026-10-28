import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { test } from "node:test"
import { createClient } from "@supabase/supabase-js"

const uid = "11111111-1111-4111-8111-111111111111"
const id = "22222222-2222-4222-8222-222222222222"
const input = { expectedUserId: uid, requestId: id, ticketTypeId: id, quantity: 5, teamName: "Example team" }
async function service() {
  const url = new URL("../src/lib/group-tickets/service.ts", import.meta.url)
  assert.ok(existsSync(url), "Group orders require a validated service")
  return import(url.href)
}
function client(reply, user = { id: uid, email_confirmed_at: "2026-01-01" }) {
  const db = createClient("https://isolated.example.test", "test-key", { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (url, init) => reply(new URL(url), init) } })
  db.auth.getUser = async () => ({ data: { user }, error: null })
  return db
}
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } })

test("group order rejects forged prices, unbounded quantity and stale account before RPC", async () => {
  const { createGroupOrder } = await service()
  let requests = 0
  const db = client(() => { requests++; return json(id) })
  for (const value of [{ ...input, quantity: 101 }, { ...input, quantity: 1 }, { ...input, quantity: 2.5 }, { ...input, teamName: "  " }, { ...input, totalCents: 1 }]) await assert.rejects(createGroupOrder(db, value), e => e.code === "invalid_input")
  await assert.rejects(createGroupOrder(db, { ...input, expectedUserId: id }), e => e.code === "account_changed")
  assert.equal(requests, 0)
})
test("group create preserves idempotency key and never sends a client price", async () => {
  const { createGroupOrder } = await service()
  const db = client((url, init) => {
    assert.equal(url.pathname, "/rest/v1/rpc/group_order_create")
    assert.deepEqual(JSON.parse(init.body), { p_expected_user: uid, p_request_id: id, p_ticket_id: id, p_quantity: 5, p_team_name: "Example team" })
    return json(id)
  })
  assert.equal(await createGroupOrder(db, input), id)
})
test("group operations require verified real users and do not leak RPC errors", async () => {
  const { createGroupOrder, groupErrorMessage } = await service()
  await assert.rejects(createGroupOrder(client(() => json(id), null), input), e => e.code === "login_required")
  await assert.rejects(createGroupOrder(client(() => json(id), { id: uid }), input), e => e.code === "email_not_verified")
  for (const code of ["group_unavailable", "already_registered", "code_unavailable"]) await assert.rejects(createGroupOrder(client(() => json({ message: code, code: "P0001", details: "private db secret" }, 400)), input), e => e.code === code && !groupErrorMessage(e, "en").includes("private"))
})
test("group config validates integer money, size bounds and deadlines", async () => {
  const { saveGroupConfig } = await service()
  const config = { expectedUserId: uid, ticketTypeId: id, enabled: false, minSize: 2, maxSize: 10, unitPriceCents: 12345, claimDeadline: null }
  const db = client(() => json(true))
  for (const patch of [{ minSize: 11 }, { maxSize: 101 }, { unitPriceCents: 1.5 }, { unitPriceCents: -1 }, { claimDeadline: "not-a-date" }]) await assert.rejects(saveGroupConfig(db, { ...config, ...patch }), e => e.code === "invalid_input")
  await saveGroupConfig(db, config)
})
test("group seat redemption normalizes phone and rejects unknown attendee identity fields", async () => {
  const { redeemGroupSeat } = await service()
  const value = { expectedUserId: uid, code: "HOWG-" + "a".repeat(48), name: "  Person  ", phone: "13812345678", company: "Example", position: "Engineer" }
  const db = client((url, init) => {
    assert.equal(url.pathname, "/rest/v1/rpc/group_seat_redeem")
    const args = JSON.parse(init.body)
    assert.equal(args.p_phone, "+8613812345678")
    assert.equal(args.p_name, "Person")
    assert.equal(args.p_code, value.code.toUpperCase())
    assert.ok(!("email" in args))
    return json(id)
  })
  assert.deepEqual(await redeemGroupSeat(db, value), { registrationId: id })
  await assert.rejects(redeemGroupSeat(db, { ...value, email: "other@example.test" }), e => e.code === "invalid_input")
})
test("activation requires an exact integer amount and external reference", async () => {
  const { activateGroupOrder } = await service()
  for (const patch of [{ paymentReference: " " }, { receivedCents: -1 }, { receivedCents: 1.2 }]) await assert.rejects(activateGroupOrder(client(() => json(true)), { expectedUserId: uid, orderId: id, paymentReference: "External invoice 123", receivedCents: 10000, ...patch }), e => e.code === "invalid_input")
})
test("ordinary registration does not offer group-only tickets", async () => {
  const { loadRegistrationData } = await import("../src/lib/registration/service.ts")
  const db = client((url) => {
    if (url.pathname.endsWith("ticket_types")) assert.equal(url.searchParams.get("group_only"), "eq.false")
    return json(url.pathname.endsWith("ticket_types") ? [] : null)
  }, null)
  assert.deepEqual((await loadRegistrationData(db)).tickets, [])
})
