import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { test } from "node:test"

const moduleUrl = new URL("../src/lib/registration/service.ts", import.meta.url)
const load = async () => {
  assert.ok(existsSync(moduleUrl), "Registration must use real server-verified phone ownership")
  return import(moduleUrl.href)
}
test("full schema embeds the exact registration security migration", () => {
  const schema = readFileSync(new URL("../supabase-schema.sql", import.meta.url), "utf8")
  const migration = readFileSync(new URL("../supabase/migrations/20261001051337_registration_security.sql", import.meta.url), "utf8")
  assert.equal(schema.split("-- --- Registration security ---\n")[1], migration)
})
const user = { id: "user-1", email: "attendee@example.test", email_confirmed_at: "2026-10-01", phone: "8613812345678", phone_confirmed_at: "2026-10-01" }

function client(currentUser = user) {
  const calls = []
  return {
    calls,
    auth: {
      getUser: async () => ({ data: { user: currentUser }, error: null }),
      updateUser: async (input) => { calls.push(["updateUser", input]); return { data: { user: currentUser }, error: null } },
      verifyOtp: async (input) => { calls.push(["verifyOtp", input]); return { data: { user: currentUser }, error: null } },
      signOut: async (input) => { calls.push(["signOut", input]); return { error: null } },
    },
  }
}
function pendingClient() {
  const c = client()
  c.auth.getUser = async () => ({ data: { user: { ...user, phone: null, phone_confirmed_at: null, new_phone: user.phone } }, error: null })
  return c
}

test("phone validation normalizes Chinese and international numbers", async () => {
  const { normalizeRegistrationPhone } = await load()
  assert.equal(normalizeRegistrationPhone("138 1234 5678"), "+8613812345678")
  assert.equal(normalizeRegistrationPhone("+1 (202) 555-0123"), "+12025550123")
  for (const input of ["", "123456", "not a phone", "+999123456789"])
    assert.throws(() => normalizeRegistrationPhone(input), (error) => error.code === "invalid_phone")
})

test("SMS configuration rejects phone auto-confirmation, missing providers and unreadable settings", async () => {
  const { assertSmsVerificationConfiguration } = await import("../src/lib/registration/sms-config.ts")
  const valid = { phone_autoconfirm: false, external: { phone: true }, sms_provider: "twilio" }
  const fetcher = (settings) => async () => ({ ok: true, json: async () => settings })
  await assertSmsVerificationConfiguration("https://example.test", "public-key", fetcher(valid))
  for (const settings of [{ ...valid, phone_autoconfirm: true }, { ...valid, sms_provider: "" }, { ...valid, external: { phone: false } }, {}]) {
    await assert.rejects(assertSmsVerificationConfiguration("https://example.test", "public-key", fetcher(settings)), /sms_unavailable/)
  }
  await assert.rejects(assertSmsVerificationConfiguration("https://example.test", "public-key", async () => ({ ok: false })), /sms_unavailable/)
  await assert.rejects(assertSmsVerificationConfiguration(undefined, undefined), /sms_unavailable/)
})

test("phone ownership needs a confirmed phone, not user-editable metadata", async () => {
  const { hasVerifiedRegistrationPhone } = await load()
  assert.equal(hasVerifiedRegistrationPhone(user, "+8613812345678"), true)
  assert.equal(hasVerifiedRegistrationPhone(user, "+8613912345678"), false)
  assert.equal(hasVerifiedRegistrationPhone({ ...user, phone_confirmed_at: null }, "+8613812345678"), false)
  assert.equal(hasVerifiedRegistrationPhone({ id: "u", user_metadata: { phone: user.phone, phone_verified: true } }, "+8613812345678"), false)
})

test("SMS requests require login and call the existing account's phone-change flow", async () => {
  const { requestRegistrationCode } = await load()
  const c = client({ ...user, phone: null, phone_confirmed_at: null })
  assert.deepEqual(await requestRegistrationCode(c, "13812345678"), { phone: "+8613812345678", verified: false })
  assert.deepEqual(c.calls, [["updateUser", { phone: "+8613812345678" }]])
  await assert.rejects(requestRegistrationCode(client(null), "13812345678"), (error) => error.code === "login_required")
})

test("an already verified phone does not send another SMS", async () => {
  const { requestRegistrationCode } = await load(), c = client()
  assert.equal((await requestRegistrationCode(c, "13812345678")).verified, true)
  assert.deepEqual(c.calls, [])
})

test("SMS failures never claim that a code was sent", async () => {
  const { requestRegistrationCode } = await load(), c = client({ ...user, phone: null })
  c.auth.updateUser = async () => ({ data: { user: null }, error: { code: "sms_send_failed" } })
  await assert.rejects(requestRegistrationCode(c, "13812345678"), (error) => error.code === "sms_unavailable")
  c.auth.updateUser = async () => ({ data: { user: null }, error: { code: "over_sms_send_rate_limit", status: 429 } })
  await assert.rejects(requestRegistrationCode(c, "13812345678"), (error) => error.code === "rate_limited")
})

test("OTP confirmation uses Supabase phone_change, not a local magic value", async () => {
  const { confirmRegistrationCode } = await load(), c = pendingClient()
  assert.deepEqual(await confirmRegistrationCode(c, "13812345678", "593721"), { phone: "+8613812345678", verified: true })
  assert.deepEqual(c.calls, [["verifyOtp", { phone: "+8613812345678", token: "593721", type: "phone_change" }]])
})

test("demo values and expired tokens only succeed if the Auth service actually verifies them", async () => {
  const { confirmRegistrationCode } = await load(), c = pendingClient()
  c.auth.verifyOtp = async () => ({ data: { user: null }, error: { code: "otp_expired" } })
  for (const token of ["888888", "123456", "593721"])
    await assert.rejects(confirmRegistrationCode(c, "13812345678", token), (error) => error.code === "invalid_code")
})

test("OTP success cannot switch accounts or verify a different phone", async () => {
  const { confirmRegistrationCode } = await load(), c = pendingClient()
  c.auth.verifyOtp = async () => ({ data: { user: { ...user, id: "other" } }, error: null })
  await assert.rejects(confirmRegistrationCode(c, "13812345678", "593721"), (error) => error.code === "invalid_code")
  assert.deepEqual(c.calls.at(-1), ["signOut", { scope: "local" }])
  c.auth.verifyOtp = async () => ({ data: { user: { ...user, phone: "8613912345678" } }, error: null })
  await assert.rejects(confirmRegistrationCode(c, "13812345678", "593721"), (error) => error.code === "invalid_code")
})

test("OTP cannot verify a phone change started by another account", async () => {
  const { confirmRegistrationCode } = await load(), c = pendingClient()
  await assert.rejects(confirmRegistrationCode(c, "13912345678", "593721"), error => error.code === "invalid_code")
  assert.deepEqual(c.calls, [])
  c.auth.getUser = async () => ({ data: { user: { ...user, new_phone: undefined } }, error: null })
  await assert.rejects(confirmRegistrationCode(c, "13812345678", "593721"), error => error.code === "invalid_code")
  assert.deepEqual(c.calls, [])
})

test("registration input requires a ticket and rejects privileged fields", async () => {
  const { parseRegistrationInput } = await load()
  const input = { name: " Attendee ", phone: "13812345678", ticketTypeId: "70000000-0000-4000-8000-000000000001", channelCode: " INVITE ", company: "", position: "Engineer" }
  assert.equal(parseRegistrationInput(input).phone, "+8613812345678")
  assert.equal(parseRegistrationInput(input).channelCode, "INVITE")
  assert.equal(parseRegistrationInput(input).name, "Attendee")
  assert.throws(() => parseRegistrationInput({ ...input, ticketTypeId: "" }))
  assert.throws(() => parseRegistrationInput({ ...input, checked_in: true }))
  assert.throws(() => parseRegistrationInput({ ...input, user_id: "other" }))
})

test("registration cannot skip phone verification", async () => {
  const { createRegistration } = await load()
  const input = { name: "Attendee", phone: "13812345678", ticketTypeId: "70000000-0000-4000-8000-000000000001" }
  await assert.rejects(createRegistration(client({ ...user, phone_confirmed_at: null }), input), (error) => error.code === "phone_not_verified")
})

test("database uniqueness races return an existing-registration result", async () => {
  const { createRegistration } = await load(), c = client()
  let payload
  c.from = () => ({ insert: (input) => { payload = input; return { select: () => ({ single: async () => ({ data: null, error: { code: "23505" } }) }) } } })
  await assert.rejects(createRegistration(c, { name: "Attendee", phone: "13812345678", ticketTypeId: "70000000-0000-4000-8000-000000000001" }), (error) => error.code === "already_registered")
  assert.equal(payload.user_id, user.id)
  assert.equal(payload.email, user.email)
  assert.equal(payload.checked_in, false)
  assert.equal(payload.checked_in_at, null)
})

test("status changes distinguish database failure, missing row and actual success", async () => {
  const { changeOwnRegistrationStatus } = await load(), c = client()
  let response = { data: null, error: { code: "42501" } }
  const filters = []
  const query = { eq: (key, value) => { filters.push([key, value]); return query }, select: () => query, maybeSingle: async () => response }
  c.from = () => ({ update: (input) => { assert.deepEqual(input, { status: "cancelled" }); return query } })
  const id = "92000000-0000-4000-8000-000000000001"
  await assert.rejects(changeOwnRegistrationStatus(c, id, "cancelled"), error => error.code === "operation_failed")
  response = { data: null, error: null }
  await assert.rejects(changeOwnRegistrationStatus(c, id, "cancelled"), error => error.code === "not_found")
  response = { data: { id, status: "cancelled" }, error: null }
  assert.deepEqual(await changeOwnRegistrationStatus(c, id, "cancelled"), { id, status: "cancelled" })
  assert.ok(filters.some(([key, value]) => key === "user_id" && value === user.id))
  await assert.rejects(changeOwnRegistrationStatus(c, id, "pending"), error => error.code === "invalid_input")
})

test("the registration page has no demo bypass or direct client-side insert", () => {
  const path = new URL("../src/app/register/registration-form.tsx", import.meta.url)
  assert.ok(existsSync(path), "Registration UI must use the authenticated server actions")
  const ui = readFileSync(path, "utf8")
  assert.doesNotMatch(ui, /888888|123456|\.insert\(/)
  assert.match(ui, /sendRegistrationCode/)
  assert.match(ui, /confirmRegistrationPhone/)
  assert.match(ui, /submitRegistration/)
})
