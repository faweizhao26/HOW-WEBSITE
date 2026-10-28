import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import { execFileSync } from "node:child_process"
import { createClient } from "@supabase/supabase-js"
import { loadGroupWorkspace, loadGroupOrder, saveGroupConfig, createGroupOrder, activateGroupOrder, redeemGroupSeat, cancelGroupOrder } from "../src/lib/group-tickets/service.ts"

assert.equal(process.env.PUBLICATION_TEST_ISOLATED_PROJECT, "true")
const fixture = JSON.parse(await readFile("/private/tmp/how-group-orders-20261028.json", "utf8"))
assert.equal(fixture.url, "http://127.0.0.1:55540")
assert.equal(fixture.database, "how_audit_reliability_20261018")
const clients = {}
for (const u of fixture.users) {
  const client = createClient(fixture.url, fixture.anon, { auth: { persistSession: false, autoRefreshToken: false } })
  assert.ifError((await client.auth.signInWithPassword(u)).error)
  clients[u.role] = client
}
const id = role => fixture.users.find(u => u.role === role).id
const sql = statement => execFileSync("docker", ["exec", "-i", "supabase_db_how-publication-stack", "psql", "-X", "-U", "postgres", "-d", fixture.database, "-Atq", "-v", "ON_ERROR_STOP=1"], { input: statement, encoding: "utf8" }).trim()
let order
try {
  const anon = createClient(fixture.url, fixture.anon, { auth: { persistSession: false, autoRefreshToken: false } })
  assert.ok((await anon.rpc("group_ticket_workspace", { p_admin: false, p_page: 0, p_search: "" })).error)
  await saveGroupConfig(clients.admin, { expectedUserId: id("admin"), ticketTypeId: fixture.ticketId, enabled: true, minSize: 2, maxSize: 10, unitPriceCents: 12345, claimDeadline: null })
  const ws = await loadGroupWorkspace(clients.leader)
  assert.equal(ws.configs.find(c => c.ticket_type_id === fixture.ticketId).unit_price_cents, 12345)
  order = await createGroupOrder(clients.leader, { expectedUserId: id("leader"), requestId: randomUUID(), ticketTypeId: fixture.ticketId, quantity: 2, teamName: "API QA" })
  assert.ok((await clients.other.from("group_orders").select("id").eq("id", order)).data.length === 0)
  assert.ok((await clients.leader.from("group_orders").update({ status: "active" }).eq("id", order)).error)
  assert.equal((await loadGroupOrder(clients.leader, order)).seats.length, 0)
  await activateGroupOrder(clients.admin, { expectedUserId: id("admin"), orderId: order, paymentReference: `QA-${order}`, receivedCents: 24690 })
  const detail = await loadGroupOrder(clients.leader, order)
  assert.equal(detail.seats.length, 2)
  const registration = await redeemGroupSeat(clients.member, { expectedUserId: id("member"), code: detail.seats[0].code, name: "API attendee", phone: "13812345678", company: "QA", position: "Engineer" })
  assert.ok(registration.registrationId)
  await assert.rejects(redeemGroupSeat(clients.member, { expectedUserId: id("member"), code: detail.seats[1].code, name: "Duplicate", phone: "13812345678" }), e => e.code === "already_registered")
  await assert.rejects(loadGroupOrder(clients.other, order), e => e.code === "forbidden")
  await assert.rejects(cancelGroupOrder(clients.leader, { expectedUserId: id("other"), orderId: order }), e => e.code === "account_changed")
  const rows = await clients.member.from("registrations").select("id,name,email,checked_in").eq("id", registration.registrationId).single()
  assert.ifError(rows.error)
  assert.equal(rows.data.email, fixture.users.find(u => u.role === "member").email)
  assert.equal(rows.data.checked_in, false)
  console.log("PASS real Auth password sessions -> Data API -> RPC/RLS -> individual registration, with owner isolation, anon/direct-write denial, account-change protection")
} finally {
  if (order) sql(`delete from public.group_order_events where order_id='${order}'; delete from public.group_orders where id='${order}'; delete from public.registrations where ticket_type_id='${fixture.ticketId}';`)
  sql(`delete from public.group_ticket_configs where ticket_type_id='${fixture.ticketId}'; update public.ticket_types set group_only=false where id='${fixture.ticketId}';`)
  for (const client of Object.values(clients)) await client.auth.signOut()
  console.log("PASS API scenario data removed; browser QA accounts retained temporarily")
}
