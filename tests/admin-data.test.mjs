import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { test } from "node:test"
import { createClient } from "@supabase/supabase-js"

const load = async () => {
  const url = new URL("../src/lib/admin/data.ts", import.meta.url)
  assert.ok(existsSync(url), "Admin reads and writes must check their database results")
  return import(url.href)
}

function client(respond) {
  return createClient("https://isolated.example.test", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (url, options) => respond(new URL(url), options) },
  })
}
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json", ...headers },
})

test("dashboard counts are not limited by the API row cap", async () => {
  const { loadDashboardStats } = await load()
  const db = client((url, options) => {
    if (options.method !== "HEAD") return json([{ status: "pending" }, { status: "approved" }, { status: "rejected" }])
    const status = url.searchParams.get("status")
    const count = url.pathname.endsWith("sessions") ? (status ? 1001 : 3003) : 0
    return new Response(null, { headers: { "content-range": `*/${count}` } })
  })
  assert.deepEqual(await loadDashboardStats(db), { totalSessions: 3003, pending: 1001, approved: 1001, rejected: 1001, speakers: 0, agendaSlots: 0 })
})

test("dashboard rejects failed reads instead of showing example or zero counts", async () => {
  const { loadDashboardStats } = await load()
  for (const failed of ["sessions", "speakers", "agenda_slots"]) {
    const db = client((url, options) => url.pathname.endsWith(failed)
      ? json({ message: "unavailable" }, 503)
      : options.method === "HEAD" ? new Response(null, { headers: { "content-range": "0-0/0" } }) : json([]))
    await assert.rejects(loadDashboardStats(db))
  }
})

test("ticket workspace rejects partial reads", async () => {
  const { loadTicketWorkspace } = await load()
  await assert.rejects(loadTicketWorkspace(client(url => url.pathname.endsWith("channel_codes") ? json({ message: "denied" }, 403) : json([]))))
})

test("ticket and channel saves reject duplicate codes, denied writes and missing rows", async () => {
  const { saveTicket, saveChannel } = await load()
  for (const save of [saveTicket, saveChannel]) {
    for (const [body, status] of [[{ code: "23505", message: "duplicate" }, 409], [{ code: "42501", message: "denied" }, 403], [null, 200]]) {
      await assert.rejects(save(client(() => json(body, status)), { name: "Example" }, "existing-id"))
    }
  }
})

test("successful mutations require a returned row id", async () => {
  const { saveTicket, saveChannel, deleteTicketRecord, deleteChannelRecord } = await load()
  for (const save of [saveTicket, saveChannel]) {
    assert.equal(await save(client(() => json({ id: "saved-id" })), { name: "Example" }), "saved-id")
  }
  for (const remove of [deleteTicketRecord, deleteChannelRecord]) {
    await assert.rejects(remove(client(() => json(null)), "gone"))
    await assert.rejects(remove(client(() => json({ message: "in use", code: "23503" }, 409)), "in-use"))
    assert.equal(await remove(client(() => json({ id: "removed-id" })), "removed-id"), "removed-id")
  }
})

test("registration reads distinguish no records from a failed request", async () => {
  const { loadRegistrationRecords } = await load()
  assert.deepEqual(await loadRegistrationRecords(client(() => json([]))), [])
  await assert.rejects(loadRegistrationRecords(client(() => json({ message: "offline" }, 503))))
})

test("registration exports include records beyond the first API page", async () => {
  const { loadRegistrationRecords } = await load()
  const rows = Array.from({ length: 1001 }, (_, id) => ({ id: String(id) }))
  const db = client(url => {
    const offset = Number(url.searchParams.get("offset") || 0)
    const limit = Number(url.searchParams.get("limit") || 1000)
    return json(rows.slice(offset, offset + limit), 200, { "content-range": `${offset}-${Math.min(offset + limit, rows.length) - 1}/${rows.length}` })
  })
  assert.equal((await loadRegistrationRecords(db)).length, 1001)
})
