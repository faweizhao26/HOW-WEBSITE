import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import vm from "node:vm"
import ts from "typescript"
import { z } from "zod"
import { createClient } from "@supabase/supabase-js"
import * as redirects from "../src/lib/auth/redirect.ts"
import { createPrivacyFetch } from "../src/lib/auth/privacy-fetch.ts"
import { createRegistration, parseRegistrationInput } from "../src/lib/registration/service.ts"
import { redeemGroupSeat } from "../src/lib/group-tickets/service.ts"
import { mountAccountScreen, user } from "./helpers/mount-account-screen.mjs"

const source = readFileSync(new URL("../src/app/api/auth/signup/route.ts", import.meta.url), "utf8")
function handler(fetch) {
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const context = { exports: {}, Response, Request, URL, Headers, AbortSignal, fetch, process: { env: { NEXT_PUBLIC_SUPABASE_URL: "https://synthetic.example.test", NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-key" } }, require: name => name === "zod" ? { z } : redirects }
  vm.runInNewContext(js, context)
  return context.exports.POST
}
const redirect = "https://app.example.test/auth/callback?next=%2Fregister"
const body = { email: "qa@example.test", password: "SyntheticPassword9", data: { full_name: "Test", privacyAccepted: true }, code_challenge: "browser-pkce-challenge", code_challenge_method: "s256", gotrue_meta_security: {} }
const request = (patch = {}, target = redirect) => new Request("https://app.example.test/api/auth/signup?redirect_to=" + encodeURIComponent(target), { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://app.example.test" }, body: JSON.stringify({ ...body, ...patch }) })

test("signup proxy blocks missing or forged consent before any upstream request", async () => {
  let calls = 0
  const post = handler(async () => { calls++; throw Error("Unexpected Auth call") })
  for (const privacyAccepted of [undefined, false, "true", 1]) {
    const response = await post(request({ data: { full_name: "Test", privacyAccepted } }))
    assert.equal(response.status, 400)
    assert.equal((await response.json()).code, "privacy_required")
  }
  assert.equal(calls, 0)
  assert.equal((await post(request({}, "https://evil.example/auth/callback"))).status, 400)
  assert.equal((await post(new Request("https://app.example.test/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" }))).status, 400)
  assert.equal(calls, 0)
})

test("signup proxy preserves browser PKCE and Auth errors without writing cookies", async () => {
  const post = handler(async (url, init) => {
    assert.equal(url.origin, "https://synthetic.example.test")
    assert.equal(url.searchParams.get("redirect_to"), redirect)
    const sent = JSON.parse(init.body)
    assert.equal(sent.code_challenge, body.code_challenge)
    assert.equal(sent.code_challenge_method, "s256")
    assert.equal(sent.data.privacy_consent.accepted, true)
    assert.match(sent.data.privacy_consent.accepted_at, /^\d{4}-\d\d-/)
    assert.equal(sent.data.privacy_consent.policy_path, "/privacy")
    return Response.json({ code: "over_email_send_rate_limit", msg: "Too many requests" }, { status: 429, headers: { "Retry-After": "60" } })
  })
  const response = await post(request())
  assert.equal(response.status, 429)
  assert.equal(response.headers.get("retry-after"), "60")
  assert.equal(response.headers.get("set-cookie"), null)
  assert.equal(response.headers.get("cache-control"), "no-store")
})

test("signup origin uses the incoming Host when Next dev normalizes its internal URL", async () => {
  let calls = 0
  const post = handler(async url => { calls++; assert.equal(new URL(url.searchParams.get("redirect_to")).host, "127.0.0.1:3052"); return Response.json({}) })
  const target = "http://127.0.0.1:3052/auth/callback?next=%2Fregister"
  const response = await post(new Request("http://localhost:3052/api/auth/signup?redirect_to=" + encodeURIComponent(target), { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://127.0.0.1:3052", Host: "127.0.0.1:3052" }, body: JSON.stringify(body) }))
  assert.equal(response.status, 200)
  assert.equal(calls, 1)
})

test("signup uses the reverse proxy public host and drops the internal port", async () => {
  const post = handler(async url => {
    assert.equal(url.searchParams.get("redirect_to"), redirect)
    return Response.json({})
  })
  const req = (origin, host = "app.example.test") => new Request("https://0.0.0.0:3000/api/auth/signup?redirect_to=" + encodeURIComponent(redirect), { method: "POST", headers: { "Content-Type": "application/json", Origin: origin, Host: host }, body: JSON.stringify(body) })
  assert.equal((await post(req("https://app.example.test"))).status, 200)
  assert.equal((await post(req("https://different.example.test"))).status, 403)
  assert.equal((await post(req("https://app.example.test", "app.example.test/path"))).status, 400)
})

test("browser fetch redirects only signup and leaves login, refresh and database requests unchanged", async () => {
  const calls = []
  const fetch = createPrivacyFetch("https://auth.example.test", async (...args) => { calls.push(args); return Response.json({}) })
  const options = { method: "POST", body: JSON.stringify(body) }
  await fetch("https://auth.example.test/auth/v1/signup?redirect_to=callback", options)
  assert.equal(calls[0][0], "/api/auth/signup?redirect_to=callback")
  assert.equal(calls[0][1].body, options.body)
  for (const url of ["https://auth.example.test/auth/v1/token?grant_type=password", "https://auth.example.test/auth/v1/token?grant_type=refresh_token", "https://auth.example.test/rest/v1/registrations", "https://other.example.test/auth/v1/signup"]) {
    await fetch(url, options)
    assert.equal(calls.at(-1)[0], url)
    assert.equal(calls.at(-1)[1], options)
  }
})

test("real browser Auth SDK still generates PKCE and receives the normal signup response via proxy", async () => {
  let forwarded = false
  const storage = new Map()
  const post = handler(async (_url, init) => {
    const sent = JSON.parse(init.body)
    assert.ok(sent.code_challenge)
    assert.ok(["s256", "plain"].includes(sent.code_challenge_method))
    forwarded = true
    return Response.json({ id: "11111111-1111-4111-8111-111111111111", email: body.email, identities: [] })
  })
  const client = createClient("https://synthetic.example.test", "public-key", {
    auth: { flowType: "pkce", persistSession: true, autoRefreshToken: false, detectSessionInUrl: false, storage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) } },
    global: { fetch: createPrivacyFetch("https://synthetic.example.test", async (url, init) => post(new Request(new URL(url, "https://app.example.test"), init))) },
  })
  const result = await client.auth.signUp({ email: body.email, password: body.password, options: { data: body.data, emailRedirectTo: redirect } })
  assert.equal(result.error, null)
  assert.equal(result.data.session, null)
  assert.equal(result.data.user.email, body.email)
  assert.equal(forwarded, true)
  assert.ok([...storage.keys()].some(k => k.endsWith("code-verifier")))
})

test("browser Auth SDK retains privacy and upstream error codes through the proxy", async () => {
  let calls = 0
  const post = handler(async (_url, init) => {
    calls++
    assert.equal(init.headers["X-Supabase-Api-Version"], "2024-01-01")
    return Response.json({ code: "over_email_send_rate_limit", msg: "Too many requests" }, { status: 429, headers: { "X-Supabase-Api-Version": "2024-01-01" } })
  })
  const client = createClient("https://synthetic.example.test", "public-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: createPrivacyFetch("https://synthetic.example.test", async (url, init) => post(new Request(new URL(url, "https://app.example.test"), init))) },
  })
  const missing = await client.auth.signUp({ email: body.email, password: body.password, options: { data: { full_name: "Test" }, emailRedirectTo: redirect } })
  assert.equal(missing.error.code, "privacy_required")
  assert.equal(calls, 0)
  const limited = await client.auth.signUp({ email: body.email, password: body.password, options: { data: body.data, emailRedirectTo: redirect } })
  assert.equal(limited.error.code, "over_email_send_rate_limit")
  assert.equal(limited.error.status, 429)
  assert.equal(calls, 1)
})

test("personal and group registration reject unconfirmed consent before database writes", async () => {
  const values = { name: "Test", email: "qa@example.test", phone: "13812345678", ticketTypeId: "22222222-2222-4222-8222-222222222222" }
  const client = { auth: { getUser: async () => ({ data: { user: { id: "11111111-1111-4111-8111-111111111111", email: values.email, email_confirmed_at: "2026-01-01" } } }) }, from() { throw Error("Unexpected database write") }, rpc() { throw Error("Unexpected RPC") } }
  for (const privacyAccepted of [undefined, false, "true", 1]) {
    assert.throws(() => parseRegistrationInput({ ...values, privacyAccepted }), e => e.code === "privacy_required")
    await assert.rejects(createRegistration(client, { ...values, privacyAccepted }), e => e.code === "privacy_required")
    await assert.rejects(redeemGroupSeat(client, { privacyAccepted }), e => e.code === "privacy_required")
  }
})

test("registration checkbox starts unchecked and resets when the account changes", async t => {
  let calls = 0
  const h = mountAccountScreen("registration", { initialUser: user("11111111-1111-4111-8111-111111111111"), submitRegistration: async () => { calls++; return { success: false, code: "operation_failed" } } })
  t.after(h.unmount)
  await h.flush()
  const consent = () => h.nodes().find(n => n.type === "PrivacyConfirmation")
  assert.equal(consent().props.checked, false)
  h.nodes().find(n => n.type === "form").props.onSubmit({ preventDefault() {} })
  await h.flush()
  assert.equal(calls, 0)
  consent().props.onChange(true); h.render()
  assert.equal(consent().props.checked, true)
  h.event("22222222-2222-4222-8222-222222222222"); await h.flush()
  assert.equal(consent().props.checked, false)
})
