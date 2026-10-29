import assert from "node:assert/strict"
import { test } from "node:test"
import { createClient } from "@supabase/supabase-js"

const uid = "11111111-1111-4111-8111-111111111111"
const id = "22222222-2222-4222-8222-222222222222"
const base = { expectedUserId: uid, ticketTypeId: id, name: "Group", nameZh: "团票", description: "", descriptionZh: "", active: true, sortOrder: 3, kind: "group", group: { enabled: false, minSize: 5, maxSize: 20, unitPriceCents: 20000, claimDeadline: null } }
const load = () => import("../src/lib/group-tickets/service.ts")
function client(reply, user = { id: uid, email_confirmed_at: "2026-01-01" }) {
  const db = createClient("https://isolated.example.test", "test-key", { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (url, init) => reply(new URL(url), JSON.parse(init.body)) } })
  db.auth.getUser = async () => ({ data: { user }, error: null })
  return db
}
const json = value => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } })

test("unified ticket save uses one atomic RPC and retains ticket ID on retries", async () => {
  const { saveAdminTicket } = await load()
  const requests = []
  const db = client((url, body) => { requests.push({ url, body }); return json(id) })
  for (let i = 0; i < 2; i++) assert.equal(await saveAdminTicket(db, base), id)
  assert.equal(requests.length, 2)
  assert.equal(requests[0].url.pathname, "/rest/v1/rpc/admin_ticket_save")
  assert.deepEqual(requests[0].body, requests[1].body)
  assert.equal(requests[0].body.p_ticket_id, id)
  assert.equal(requests[0].body.p_group.unitPriceCents, 20000)
})

test("unified ticket rejects conflicting modes, invalid groups and stale accounts before writes", async () => {
  const { saveAdminTicket } = await load()
  let writes = 0
  const db = client(() => { writes++; return json(id) })
  for (const patch of [{ name: " " }, { sortOrder: -1 }, { group: null }, { isFree: true }, { group: { ...base.group, minSize: 21 } }, { group: { ...base.group, unitPriceCents: 0.1 } }, { group: { ...base.group, claimDeadline: "yesterday" } }, { kind: "individual", group: base.group }]) {
    await assert.rejects(saveAdminTicket(db, { ...base, ...patch }), e => e.code === "invalid_input")
  }
  await assert.rejects(saveAdminTicket(db, { ...base, expectedUserId: id }), e => e.code === "account_changed")
  assert.equal(writes, 0)
})

test("individual ticket save keeps free and channel settings without group rules", async () => {
  const { saveAdminTicket } = await load()
  const { group, ...individual } = base
  assert.ok(group)
  await saveAdminTicket(client((_url, body) => {
    assert.equal(body.p_group, null)
    assert.equal(body.p_is_free, true)
    assert.equal(body.p_requires_code, true)
    return json(id)
  }), { ...individual, kind: "individual", isFree: true, requiresCode: true })
})

test("ticket workspace fails if group rules cannot be loaded", async () => {
  const { loadTicketWorkspace } = await import("../src/lib/admin/data.ts")
  const db = createClient("https://isolated.example.test", "test-key", { global: { fetch: async url => String(url).includes("group_ticket_configs") ? new Response(JSON.stringify({ message: "offline" }), { status: 503 }) : json([]) } })
  await assert.rejects(loadTicketWorkspace(db))
})
