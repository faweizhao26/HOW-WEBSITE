import assert from "node:assert/strict"
import { test } from "node:test"
import { existsSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

async function service() {
  const url = new URL("../src/lib/registration/service.ts", import.meta.url)
  assert.ok(existsSync(url), "Registration must validate inputs and writes on the server")
  return import(url.href)
}
const user = { id: "11111111-1111-4111-8111-111111111111", email: "attendee@example.test", email_confirmed_at: "2026-01-01" }
const ticketId = "22222222-2222-4222-8222-222222222222"
const values = { name: "  Attendee  ", email: user.email, phone: "13812345678", ticketTypeId: ticketId }
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } })
function client(fetch, currentUser = user) {
  const db = createClient("https://isolated.example.test", "test-key", { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch } })
  db.auth.getUser = async () => ({ data: { user: currentUser }, error: null })
  return db
}

test("registration validates and normalizes contact fields without pretending phone ownership", async () => {
  const { parseRegistrationInput } = await service()
  const result = parseRegistrationInput(values)
  assert.equal(result.name, "Attendee")
  assert.equal(result.phone, "+8613812345678")
  for (const input of [{ ...values, name: "   " }, { ...values, name: "\t\n" }, { ...values, name: "\u3000" }, { ...values, name: "\u00a0\ufeff" }, { ...values, email: "bad" }, { ...values, ticketTypeId: "" }, { ...values, userId: user.id }]) {
    assert.throws(() => parseRegistrationInput(input), e => e.code === "invalid_input")
  }
})

test("phone parser accepts international numbers and rejects short codes and extracted text", async () => {
  const { normalizeRegistrationPhone } = await service()
  for (const phone of ["+1 202-555-0123", "+44 7400 123456", "+81 90 1234 5678", "+6907290"]) assert.match(normalizeRegistrationPhone(phone), /^\+[1-9]\d+$/)
  for (const phone of ["888888", "123456", "Call +1 202-555-0123", "+8613812345678 ext.12"]) assert.throws(() => normalizeRegistrationPhone(phone), e => e.code === "invalid_phone")
})

test("server submission rejects absent sessions and forged contact identities before any write", async () => {
  const { createRegistration } = await service()
  let requests = 0
  const fetch = () => { requests++; return json(null) }
  await assert.rejects(createRegistration(client(fetch, null), values), e => e.code === "login_required")
  await assert.rejects(createRegistration(client(fetch), { ...values, email: "other@example.test" }), e => e.code === "invalid_input")
  assert.equal(requests, 0)
})

test("registration requires an active ticket and a code matching that ticket", async () => {
  const { createRegistration } = await service()
  for (const ticket of [null, { id: ticketId, is_active: false }, { id: ticketId, is_active: true, requires_code: true }]) {
    await assert.rejects(createRegistration(client(url => {
      const path = new URL(url).pathname
      if (path.endsWith("registrations")) return json(null)
      return json(ticket)
    }), values), e => ["invalid_ticket", "invalid_channel"].includes(e.code))
  }
  await assert.rejects(createRegistration(client(url => {
    if (new URL(url).pathname.endsWith("registrations")) return json(null)
    if (String(url).includes("/rpc/")) return json(false)
    return json({ id: ticketId, is_active: true, requires_code: true })
  }), { ...values, channelCode: "wrong-ticket" }), e => e.code === "invalid_channel")
})

test("successful registration uses authenticated identity and requires returned row", async () => {
  const { createRegistration } = await service()
  const db = client((url, options) => {
    if (options.method === "POST") {
      const record = JSON.parse(options.body)
      assert.equal(record.user_id, user.id)
      assert.equal(record.email, user.email)
      assert.equal(record.phone, "+8613812345678")
      assert.equal(record.status, "confirmed")
      assert.equal(record.checked_in, false)
      return json({ id: "saved" })
    }
    if (String(url).endsWith("unused")) throw new Error("unexpected")
    return json(new URL(url).pathname.endsWith("ticket_types") ? { id: ticketId, name: "Community", name_zh: "社区票", is_active: true, requires_code: false } : null)
  })
  assert.deepEqual(await createRegistration(db, values), { id: "saved", ticketName: "Community", ticketNameZh: "社区票" })
  await assert.rejects(createRegistration(client(() => json(null)), values), e => e.code === "invalid_ticket")
})

test("duplicate writes and failed reads map to stable errors instead of raw database messages", async () => {
  const { createRegistration } = await service()
  for (const [body, status, code] of [[{ code: "23505", message: "private db text" }, 409, "already_registered"], [{ message: "private db text" }, 403, "operation_failed"], [null, 200, "operation_failed"]]) {
    await assert.rejects(createRegistration(client((url, options) => options.method === "POST" ? json(body, status) : json(new URL(url).pathname.endsWith("ticket_types") ? { id: ticketId, name: "Community", is_active: true, requires_code: false } : null)), values), e => e.code === code && !e.message.includes("private db text"))
  }
  await assert.rejects(createRegistration(client(() => json({ message: "read denied" }, 403)), values), e => e.code === "load_failed")
})

test("initial registration reads wait for profile and reject partial failures", async () => {
  const { loadRegistrationData } = await service()
  let release
  const profile = new Promise(resolve => { release = resolve })
  let resolved = false
  const reading = loadRegistrationData(client(url => new URL(url).pathname.endsWith("profiles") ? profile : json([]))).then(result => { resolved = true; return result })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(resolved, false)
  release(json({ full_name: "Saved name" }))
  assert.equal((await reading).profile.full_name, "Saved name")
  await assert.rejects(loadRegistrationData(client(url => new URL(url).pathname.endsWith("ticket_types") ? json({ message: "denied" }, 403) : json(null))), e => e.code === "load_failed")
})

test("channel checks distinguish unavailable lookup from invalid code", async () => {
  const { lookupRegistrationChannel } = await service()
  await assert.rejects(lookupRegistrationChannel(client(() => json({ message: "offline" }, 503)), "QA"), e => e.code === "operation_failed")
  await assert.rejects(lookupRegistrationChannel(client(() => json(null)), "QA"), e => e.code === "invalid_channel")
})
