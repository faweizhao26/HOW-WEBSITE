import assert from "node:assert/strict"
import { test } from "node:test"
import { existsSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

const user = { id: "11111111-1111-4111-8111-111111111111", email_confirmed_at: "2026-10-10" }
const callback = "https://conference.example/auth/callback?next=%2Fcfp&flow=recovery"
async function service() {
  const path = new URL("../src/lib/auth/email.ts", import.meta.url)
  assert.ok(existsSync(path), "Account email service is missing")
  return import(path.href)
}
function client(fetch, owner = user) {
  const token = Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url") + "." + Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url") + ".fixture"
  const session = JSON.stringify({ access_token: token, refresh_token: "fixture", expires_at: Math.floor(Date.now() / 1000) + 3600, user })
  const db = createClient("https://auth.example.test", "test-key", { auth: { autoRefreshToken: false, persistSession: true, storage: { getItem: () => session, setItem() {}, removeItem() {} } }, global: { fetch } })
  db.auth.getUser = async () => ({ data: { user: owner }, error: null })
  return db
}
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } })

test("email requests normalize email and keep recovery separate from signup resend", async () => {
  const { requestAccountEmail } = await service()
  const calls = []
  const db = client((url, options) => { calls.push({ url: String(url), body: JSON.parse(options.body) }); return json({}) })
  await requestAccountEmail(db, { kind: "recovery", email: " speaker@example.test ", callbackURL: callback })
  assert.match(calls[0].url, /\/recover\?redirect_to=/)
  assert.equal(calls[0].body.email, "speaker@example.test")
  await requestAccountEmail(db, { kind: "confirmation", email: "speaker@example.test", callbackURL: callback.replace("recovery", "confirmation") })
  assert.match(calls[1].url, /\/resend\?redirect_to=/)
  assert.equal(calls[1].body.type, "signup")
})
test("invalid email requests do not send and invalid backend results do not report success", async () => {
  const { requestAccountEmail } = await service()
  let requests = 0
  const db = client(() => { requests++; return json({}) })
  for (const changed of [{ email: " " }, { email: "bad" }, { kind: "sms" }, { callbackURL: "javascript:alert(1)" }]) {
    await assert.rejects(requestAccountEmail(db, { kind: "recovery", email: "speaker@example.test", callbackURL: callback, ...changed }), e => e.code === "invalid_email")
  }
  assert.equal(requests, 0)
  await assert.rejects(requestAccountEmail(client(() => json({ code: "over_email_send_rate_limit", msg: "private" }, 429)), { kind: "recovery", email: "speaker@example.test", callbackURL: callback }), e => e.code === "rate_limited")
  await assert.rejects(requestAccountEmail(client(() => { throw Error("private") }), { kind: "recovery", email: "speaker@example.test", callbackURL: callback }), e => e.code === "operation_failed" && !e.message.includes("private"))
})
test("password reset rejects mismatches and weak input before a mutation", async () => {
  const { resetAccountPassword } = await service()
  let requests = 0
  const db = client(() => { requests++; return json(user) })
  const input = { expectedUserId: user.id, password: "New Strong Password 9!", confirmation: "New Strong Password 9!" }
  for (const changed of [{ password: "short", confirmation: "short" }, { password: " ".repeat(8), confirmation: " ".repeat(8) }, { confirmation: "different" }]) {
    await assert.rejects(resetAccountPassword(db, { ...input, ...changed }), e => ["invalid_password", "password_mismatch"].includes(e.code))
  }
  assert.equal(requests, 0)
})
test("password reset validates current account and requires a returned matching user", async () => {
  const { resetAccountPassword } = await service()
  const input = { expectedUserId: user.id, password: " New Strong Password 9! ", confirmation: " New Strong Password 9! " }
  const db = client((url, options) => { assert.equal(JSON.parse(options.body).password, input.password); return json(user) })
  assert.equal((await resetAccountPassword(db, input)).id, user.id)
  await assert.rejects(resetAccountPassword(client(() => { throw Error("must not write") }, null), input), e => e.code === "session_expired")
  await assert.rejects(resetAccountPassword(client(() => { throw Error("must not write") }, { ...user, id: "other" }), input), e => e.code === "account_changed")
  await assert.rejects(resetAccountPassword(client(() => json({})), input), e => e.code === "operation_failed")
  await assert.rejects(resetAccountPassword(client(() => json({ error_code: "same_password", msg: "private" }, 422)), input), e => e.code === "same_password")
})
test("email callback URLs preserve safe destinations without permitting auth loops or external targets", async () => {
  const { accountEmailCallbackURL } = await import("../src/lib/auth/redirect.ts")
  assert.equal(accountEmailCallbackURL("https://conference.example", "recovery", "/cfp?tab=mine"), "https://conference.example/auth/callback?next=%2Fcfp%3Ftab%3Dmine&flow=recovery")
  assert.equal(accountEmailCallbackURL("https://conference.example", "confirmation", "/cfp"), "https://conference.example/auth/confirm?redirect=%2Fcfp")
  for (const next of ["https://evil.example", "/auth/reset-password", "/x/..//evil.example"]) {
    assert.equal(new URL(accountEmailCallbackURL("https://conference.example", "confirmation", next)).searchParams.get("redirect"), "/")
  }
})
