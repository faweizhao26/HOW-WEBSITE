import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
import { changeOwnRegistrationStatus, confirmRegistrationCode, createRegistration, requestRegistrationCode } from "../src/lib/registration/service.ts"
import { assertSmsVerificationConfiguration } from "../src/lib/registration/sms-config.ts"

const env = process.env
assert.equal(env.PUBLICATION_TEST_ISOLATED_PROJECT, "true", "Use an isolated test project only")
const url = env.PUBLICATION_TEST_SUPABASE_URL
const options = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(url, env.PUBLICATION_TEST_SUPABASE_SERVICE_ROLE_KEY, options)
const anon = createClient(url, env.PUBLICATION_TEST_SUPABASE_ANON_KEY, options)
const attendee = createClient(url, env.PUBLICATION_TEST_SUPABASE_ANON_KEY, options)
const unverified = createClient(url, env.PUBLICATION_TEST_SUPABASE_ANON_KEY, options)
const unwrap = async (query) => {
  const result = await query
  assert.equal(result.error, null, result.error?.message)
  return result.data
}
const users = []
const ticket = randomUUID(), invitation = randomUUID(), code = `REG-${randomUUID()}`
const phone = env.REGISTRATION_TEST_PHONE || "+8613812345666"
const password = randomUUID() + "!Qa9"
let groups = 0
function passed(label) { console.log(`PASS ${++groups}: ${label}`) }
async function account(client, verified) {
  const email = `registration-${randomUUID()}@example.test`
  const data = await unwrap(admin.auth.admin.createUser({ email, password, email_confirm: true,
    ...(verified ? { phone, phone_confirm: true } : {}), user_metadata: { full_name: "Registration QA" } }))
  users.push(data.user.id)
  await unwrap(client.auth.signInWithPassword({ email, password }))
  return data.user
}

try {
  await unwrap(admin.from("ticket_types").insert({ id: ticket, name: "Registration QA", name_zh: "报名验证", is_free: true, requires_code: false, is_active: true }))
  await unwrap(admin.from("channel_codes").insert({ id: invitation, code, name: "Registration QA", ticket_type_id: ticket }))
  const pendingUser = await account(unverified, false)
  const values = { name: "Registration QA", phone, ticketTypeId: ticket }
  await assert.rejects(createRegistration(unverified, values), error => error.code === "phone_not_verified")
  const bypass = await unverified.from("registrations").insert({ user_id: pendingUser.id, ticket_type_id: ticket, name: values.name, phone, email: pendingUser.email })
  assert.equal(bypass.error?.code, "42501")
  passed("unverified phone denied by both service and direct Data API")

  if (env.REGISTRATION_TEST_OTP) {
    await assertSmsVerificationConfiguration(url, env.PUBLICATION_TEST_SUPABASE_ANON_KEY)
    assert.equal((await requestRegistrationCode(unverified, phone)).verified, false)
    await assert.rejects(confirmRegistrationCode(unverified, phone, "888888"), error => error.code === "invalid_code")
    assert.equal((await confirmRegistrationCode(unverified, phone, env.REGISTRATION_TEST_OTP)).verified, true)
    const current = await unwrap(unverified.auth.getUser())
    assert.ok(current.user.phone_confirmed_at)
    assert.equal(current.user.id, pendingUser.id)
    passed("real local Auth phone_change OTP rejects the demo and confirms ownership")
    await unwrap(admin.auth.admin.deleteUser(pendingUser.id))
    users.splice(users.indexOf(pendingUser.id), 1)
  } else {
    await assert.rejects(assertSmsVerificationConfiguration(url, env.PUBLICATION_TEST_SUPABASE_ANON_KEY), /sms_unavailable/)
    assert.equal((await unwrap(unverified.auth.getUser())).user.phone_confirmed_at, undefined)
    passed("unconfigured SMS is rejected before modifying the account")
  }

  const user = await account(attendee, true)
  assert.deepEqual((await anon.from("channel_codes").select("id").eq("id", invitation)).data, [])
  assert.deepEqual((await attendee.from("channel_codes").select("id").eq("id", invitation)).data, [])
  assert.ok((await anon.rpc("registration_channel_ticket", { p_code: code })).error)
  assert.equal(await unwrap(attendee.rpc("registration_channel_ticket", { p_code: code })), ticket)
  passed("invitation enumeration denied; authenticated exact lookup works")

  const race = await Promise.allSettled([createRegistration(attendee, values), createRegistration(attendee, values)])
  assert.equal(race.filter(result => result.status === "fulfilled").length, 1)
  assert.equal(race.find(result => result.status === "rejected").reason.code, "already_registered")
  const registration = race.find(result => result.status === "fulfilled").value
  assert.equal((await unwrap(attendee.from("registrations").select("id").eq("user_id", user.id))).length, 1)
  passed("concurrent registration creates one record only")

  for (const payload of [{ checked_in: true }, { ticket_type_id: null }, { phone: "+8613912345678" }, { checked_in_at: new Date().toISOString() }]) {
    assert.equal((await attendee.from("registrations").update(payload).eq("id", registration.id)).error?.code, "42501")
  }
  passed("direct API ticket, contact and check-in tampering denied")
  assert.equal((await changeOwnRegistrationStatus(attendee, registration.id, "cancelled")).status, "cancelled")
  await assert.rejects(createRegistration(attendee, values), error => error.code === "already_registered")
  assert.equal((await changeOwnRegistrationStatus(attendee, registration.id, "confirmed")).status, "confirmed")
  passed("cancel/restore retains the same unique registration")
  await unwrap(admin.from("registrations").update({ checked_in: true, checked_in_at: new Date().toISOString() }).eq("id", registration.id))
  await assert.rejects(changeOwnRegistrationStatus(attendee, registration.id, "cancelled"), error => error.code === "operation_failed")
  passed("checked-in registrations cannot be cancelled by attendees")
  console.log(`PASS: ${groups} real Auth/Data API lifecycle groups`)
} finally {
  const failures = []
  for (const id of users) {
    const result = await admin.auth.admin.deleteUser(id)
    if (result.error) failures.push(result.error.message)
  }
  for (const [table, id] of [["channel_codes", invitation], ["ticket_types", ticket]]) {
    const result = await admin.from(table).delete().eq("id", id)
    if (result.error) failures.push(result.error.message)
  }
  assert.deepEqual(failures, [], "Registration fixture cleanup failed")
}
