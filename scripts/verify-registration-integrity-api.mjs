import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { readFile, writeFile, unlink } from "node:fs/promises"
import { createClient } from "@supabase/supabase-js"
import { createRegistration, lookupRegistrationChannel, loadRegistrationData } from "../src/lib/registration/service.ts"
import { updateOwnRegistration } from "../src/lib/profile/data.ts"
import { updateCheckin } from "../src/lib/admin/checkin.ts"

const env = process.env
assert.equal(env.PUBLICATION_TEST_ISOLATED_PROJECT, "true")
const url = env.PUBLICATION_TEST_SUPABASE_URL
assert.ok(url && ["localhost", "127.0.0.1"].includes(new URL(url).hostname), "Local isolated database only")
const options = { auth: { persistSession: false, autoRefreshToken: false } }
const trusted = createClient(url, env.PUBLICATION_TEST_SUPABASE_SERVICE_ROLE_KEY, options)
const client = () => createClient(url, env.PUBLICATION_TEST_SUPABASE_ANON_KEY, options)
const unwrap = async promise => { const result = await promise; if (result.error) throw result.error; return result.data }
const path = env.REGISTRATION_QA_FIXTURE_PATH || "/private/tmp/how-registration-qa-fixture.json"
let fixture
async function cleanup() {
  if (!fixture) return
  for (const id of fixture.users) await unwrap(trusted.from("registrations").delete().eq("user_id", id))
  for (const id of fixture.channels) await unwrap(trusted.from("channel_codes").delete().eq("id", id))
  for (const id of fixture.tickets) await unwrap(trusted.from("ticket_types").delete().eq("id", id))
  for (const id of fixture.users) await unwrap(trusted.auth.admin.deleteUser(id))
  const saved = await readFile(path, "utf8").catch(error => { if (error.code !== "ENOENT") throw error; return null })
  if (saved && JSON.parse(saved).users[0] === fixture.users[0]) await unlink(path)
}

if (env.REGISTRATION_QA_CLEANUP === "true") {
  fixture = JSON.parse(await readFile(path, "utf8"))
  assert.equal(fixture.url, url)
  await cleanup()
  console.log("Removed generated registration QA accounts and rows")
} else {
  if (env.REGISTRATION_QA_KEEP_FIXTURES === "true") {
    const existing = await readFile(path, "utf8").catch(error => { if (error.code !== "ENOENT") throw error; return null })
    assert.equal(existing, null, "Clean the existing retained QA fixture before preparing another one")
  }
  const suffix = randomUUID().slice(0, 8)
  fixture = { url, password: randomUUID()+"!Qa9", users: [], emails: [], channels: [], tickets: [], codes: [] }
  try {
    for (const role of ["admin", "attendee", "browser"]) {
      const email = role + "-" + suffix + "@example.test"
      const { user } = await unwrap(trusted.auth.admin.createUser({ email, password: fixture.password, email_confirm: true }))
      fixture.users.push(user.id)
      fixture.emails.push(email)
    }
    await unwrap(trusted.from("profiles").update({ role: "admin" }).eq("id", fixture.users[0]))
    for (const [name, requires_code, is_active] of [["Community", false, true], ["Partner", true, true], ["Inactive", false, false]]) {
      const row = await unwrap(trusted.from("ticket_types").insert({ name: "QA "+name+" "+suffix, name_zh: "QA "+name, description: "QA registration fixture", requires_code, is_active, is_free: !requires_code }).select("id").single())
      fixture.tickets.push(row.id)
    }
    for (const [ticket_type_id, is_active] of [[fixture.tickets[1], true], [null, true], [fixture.tickets[1], false]]) {
      const code = "REG-QA-" + randomUUID().slice(0,8)
      const row = await unwrap(trusted.from("channel_codes").insert({ code, name: "QA Invitation", ticket_type_id, is_active }).select("id").single())
      fixture.channels.push(row.id)
      fixture.codes.push(code)
    }
    const admin = client(), attendee = client(), browser = client(), anonymous = client()
    for (const [index, current] of [admin, attendee, browser].entries()) await unwrap(current.auth.signInWithPassword({ email: fixture.emails[index], password: fixture.password }))
    const fields = { name: "QA Attendee", email: fixture.emails[1], phone: "+1 202-555-0123", ticketTypeId: fixture.tickets[0] }
    await assert.rejects(createRegistration(anonymous, fields), error => error.code === "login_required")
    await assert.rejects(createRegistration(attendee, { ...fields, ticketTypeId: fixture.tickets[2] }), error => error.code === "invalid_ticket")
    await assert.rejects(createRegistration(attendee, { ...fields, ticketTypeId: fixture.tickets[1] }), error => error.code === "invalid_channel")
    await assert.rejects(createRegistration(attendee, { ...fields, channelCode: fixture.codes[0] }), error => error.code === "invalid_channel")
    await assert.rejects(lookupRegistrationChannel(anonymous, fixture.codes[0]))
    assert.equal((await lookupRegistrationChannel(attendee, fixture.codes[0])).ticketTypeId, fixture.tickets[1])
    await assert.rejects(lookupRegistrationChannel(attendee, fixture.codes[2]), error => error.code === "invalid_channel")
    assert.deepEqual(await unwrap(attendee.from("channel_codes").select("id,code")), [])
    console.log("PASS real authentication, inactive ticket, required/mismatched/inactive code and hidden code list")

    const raw = { user_id: fixture.users[1], ticket_type_id: fixture.tickets[0], name: fields.name, email: fields.email, phone: "+12025550123", status: "confirmed" }
    for (const changed of [{ name: " " }, { email: fixture.emails[2] }, { ticket_type_id: null }, { checked_in: true }, { checked_in_at: new Date().toISOString() }, { user_id: fixture.users[2] }, { phone: "888888" }]) {
      const result = await attendee.from("registrations").insert({ ...raw, ...changed })
      assert.ok(result.error, "Direct API bypass must reject " + JSON.stringify(Object.keys(changed)))
    }
    console.log("PASS direct Data API bypass rejects forged identity, empty name/ticket, checked-in fields and demo phone")
    const edgeFailures = []
    for (const name of ["\t\n", "\u3000", "\u00a0\ufeff"]) {
      const result = await attendee.from("registrations").insert({ ...raw, name })
      if (!result.error) {
        edgeFailures.push("Whitespace-only name accepted: " + JSON.stringify(name))
        await unwrap(trusted.from("registrations").delete().eq("user_id", fixture.users[1]))
      }
    }
    try {
      await createRegistration(browser, { ...fields, email: fixture.emails[2], phone: "+6907290" })
    } catch (error) { edgeFailures.push("Valid short international phone rejected: " + error.code) }
    await unwrap(trusted.from("registrations").delete().eq("user_id", fixture.users[2]))
    assert.deepEqual(edgeFailures, [])
    console.log("PASS Unicode/control whitespace names rejected and valid short international number accepted")
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => createRegistration(attendee, fields)))
    assert.equal(results.filter(result => result.status === "fulfilled").length, 1)
    assert.ok(results.filter(result => result.status === "rejected").every(result => result.reason.code === "already_registered"))
    const records = await unwrap(trusted.from("registrations").select("id").eq("user_id", fixture.users[1]))
    assert.equal(records.length, 1)
    const id = records[0].id
    console.log("PASS eight simultaneous submissions create exactly one registration")

    assert.equal((await loadRegistrationData(attendee)).registration.id, id)
    await updateOwnRegistration(attendee, fixture.users[1], id, "cancelled")
    await assert.rejects(createRegistration(attendee, fields), error => error.code === "already_registered")
    await updateOwnRegistration(attendee, fixture.users[1], id, "confirmed")
    assert.ok((await attendee.from("registrations").update({ name: "Forged" }).eq("id", id)).error)
    assert.ok((await attendee.from("registrations").update({ user_id: fixture.users[2] }).eq("id", id)).error)
    await updateCheckin(admin, { id, checked_in: false })
    await assert.rejects(updateOwnRegistration(attendee, fixture.users[1], id, "cancelled"))
    await updateCheckin(admin, { id, checked_in: true })
    console.log("PASS cancellation/restore, duplicate after cancellation, immutable owned fields and admin check-in/undo")

    await unwrap(trusted.from("channel_codes").update({ is_active: false }).eq("id", fixture.channels[0]))
    const stale = await browser.from("registrations").insert({ ...raw, user_id: fixture.users[2], email: fixture.emails[2], ticket_type_id: fixture.tickets[1], channel_code: fixture.codes[0] })
    assert.ok(stale.error)
    await unwrap(trusted.from("channel_codes").update({ is_active: true }).eq("id", fixture.channels[0]))
    console.log("PASS database rejects an invitation disabled after its frontend check")
    if (env.REGISTRATION_QA_KEEP_FIXTURES === "true") {
      await writeFile(path, JSON.stringify(fixture), { mode: 0o600 })
      console.log("Isolated browser fixture prepared; credentials not printed")
    } else await cleanup()
    for (const current of [admin, attendee, browser]) await current.auth.signOut({ scope: "local" })
  } catch (error) { await cleanup(); throw error }
}
