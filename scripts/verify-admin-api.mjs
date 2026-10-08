import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { writeFile, readFile, unlink } from "node:fs/promises"
import { createClient } from "@supabase/supabase-js"
import { loadDashboardStats, loadTicketWorkspace, loadRegistrationRecords, saveTicket, saveChannel, deleteTicketRecord, deleteChannelRecord } from "../src/lib/admin/data.ts"

const env = process.env
assert.equal(env.PUBLICATION_TEST_ISOLATED_PROJECT, "true", "Use an isolated test project only")
const url = env.PUBLICATION_TEST_SUPABASE_URL
assert.ok(url && ["localhost", "127.0.0.1"].includes(new URL(url).hostname), "Use the local isolated stack only")
const options = { auth: { autoRefreshToken: false, persistSession: false } }
const trusted = createClient(url, env.PUBLICATION_TEST_SUPABASE_SERVICE_ROLE_KEY, options)
const admin = createClient(url, env.PUBLICATION_TEST_SUPABASE_ANON_KEY, options)
const anonymous = createClient(url, env.PUBLICATION_TEST_SUPABASE_ANON_KEY, options)
const file = env.ADMIN_QA_FIXTURE_PATH || "/private/tmp/how-admin-qa-fixture.json"
const unwrap = async promise => { const result = await promise; if (result.error) throw result.error; return result.data }
let fixture

async function cleanup() {
  if (!fixture) return
  for (const id of fixture.registrations) await unwrap(trusted.from("registrations").delete().eq("id", id))
  for (const id of fixture.channels) await unwrap(trusted.from("channel_codes").delete().eq("id", id))
  for (const id of fixture.tickets) await unwrap(trusted.from("ticket_types").delete().eq("id", id))
  for (const id of fixture.users) await unwrap(trusted.auth.admin.deleteUser(id))
  await unlink(file).catch(error => { if (error.code !== "ENOENT") throw error })
}

if (env.ADMIN_QA_CLEANUP === "true") {
  fixture = JSON.parse(await readFile(file, "utf8"))
  assert.equal(fixture.url, url)
  await cleanup()
  console.log("Generated admin QA accounts and rows removed")
} else {
  const suffix = randomUUID().slice(0, 8)
  fixture = { url, email: `admin-${suffix}@example.test`, password: randomUUID() + "!Qa9", users: [], registrations: [], channels: [], tickets: [] }
  try {
    for (const email of [fixture.email, `attendee-${suffix}@example.test`]) {
      const { user } = await unwrap(trusted.auth.admin.createUser({ email, password: fixture.password, email_confirm: true }))
      fixture.users.push(user.id)
    }
    await unwrap(trusted.from("profiles").update({ role: "admin" }).eq("id", fixture.users[0]))
    await unwrap(admin.auth.signInWithPassword({ email: fixture.email, password: fixture.password }))
    const fields = { name: `QA Community ${suffix}`, name_zh: "QA 社区票", description: "QA", description_zh: "QA", is_free: true, requires_code: false }
    const ticket = await saveTicket(admin, fields)
    fixture.tickets.push(ticket)
    await saveTicket(admin, { ...fields, description: "Updated" }, ticket)
    assert.equal((await unwrap(trusted.from("ticket_types").select("description").eq("id", ticket).single())).description, "Updated")
    const code = `QA-${suffix}`
    const channel = await saveChannel(admin, { code, name: "QA Partner", ticket_type_id: ticket })
    fixture.channels.push(channel)
    await assert.rejects(saveChannel(admin, { code, name: "Duplicate", ticket_type_id: ticket }), error => error.code === "23505")
    await assert.rejects(saveTicket(anonymous, fields))
    await assert.rejects(saveTicket(admin, fields, randomUUID()))
    await assert.rejects(deleteChannelRecord(admin, randomUUID()))
    console.log("PASS real ticket/channel save, duplicate rejection, denied write and zero-row rejection")

    for (const [index, userId] of fixture.users.entries()) {
      const record = await unwrap(trusted.from("registrations").insert({
        user_id: userId, ticket_type_id: ticket, channel_code: code,
        name: index === 0 ? 'QA Alice "A", Zhang\nTeam' : "QA Bob",
        email: index === 0 ? fixture.email : `attendee-${suffix}@example.test`,
        phone: index === 0 ? "+8613812345678" : "+12025550123",
        company: index === 0 ? 'QA Company, "Ltd"' : "QA Example", status: index === 0 ? "confirmed" : "cancelled",
      }).select("id").single())
      fixture.registrations.push(record.id)
    }
    await assert.rejects(saveChannel(admin, { code: code + "-invalid", name: "Invalid reference", ticket_type_id: randomUUID() }), error => error.code === "23503")
    assert.ok((await loadTicketWorkspace(admin)).tickets.some(row => row.id === ticket))
    assert.equal((await loadRegistrationRecords(admin)).filter(row => fixture.registrations.includes(row.id)).length, 2)
    const stats = await loadDashboardStats(admin)
    assert.ok(Object.values(stats).every(Number.isInteger))
    console.log("PASS invalid ticket-reference rejection and real dashboard/list reads")

    const disposable = await saveTicket(admin, { ...fields, name: "QA Disposable" })
    fixture.tickets.push(disposable)
    assert.equal(await deleteTicketRecord(admin, disposable), disposable)
    const disposableChannel = await saveChannel(admin, { code: code + "-delete", name: "QA Disposable", ticket_type_id: null })
    fixture.channels.push(disposableChannel)
    assert.equal(await deleteChannelRecord(admin, disposableChannel), disposableChannel)
    console.log("PASS real ticket/channel deletion")
    if (env.ADMIN_QA_KEEP_FIXTURES === "true") {
      await writeFile(file, JSON.stringify(fixture), { mode: 0o600 })
      console.log("Isolated browser fixture prepared; credentials not printed")
    } else { await cleanup() }
  } catch (error) { await cleanup(); throw error }
  finally { await admin.auth.signOut({ scope: "local" }) }
}
