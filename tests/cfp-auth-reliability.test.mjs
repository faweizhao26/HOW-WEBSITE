import assert from "node:assert/strict"
import { test } from "node:test"
import { existsSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

async function moduleAt(path) {
  const url = new URL(path, import.meta.url)
  assert.ok(existsSync(url), `Missing reliability boundary: ${path}`)
  return import(url.href)
}
const cfp = () => moduleAt("../src/lib/cfp/service.ts")
const auth = () => moduleAt("../src/lib/auth/login.ts")
const redirects = () => moduleAt("../src/lib/auth/redirect.ts")
const user = { id: "11111111-1111-4111-8111-111111111111", email: "speaker@example.test", email_confirmed_at: "2026-01-01" }
const input = { requestId: "22222222-2222-4222-8222-222222222222", expectedUserId: user.id, title: "  PostgreSQL  ", titleZh: "", abstract: "  Abstract  ", abstractZh: "", duration: 30, type: "talk" }
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } })
function client(fetch, currentUser = user, error = null) {
  const db = createClient("https://isolated.example.test", "test-key", { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch } })
  db.auth.getUser = async () => ({ data: { user: currentUser }, error })
  return db
}
const row = { id: input.requestId, user_id: user.id, title: "PostgreSQL", title_zh: null, abstract: "Abstract", abstract_zh: null, duration: 30, type: "talk", status: "pending", admin_feedback: null, created_at: "2026-10-10" }

test("CFP reads distinguish signed-out, empty, Auth failure and proposal query failure", async () => {
  const { loadCFPData } = await cfp()
  assert.deepEqual(await loadCFPData(client(() => { throw Error("should not read") }, null, { name: "AuthSessionMissingError" })), { user: null, sessions: [] })
  assert.equal((await loadCFPData(client(() => json([])))).sessions.length, 0)
  await assert.rejects(loadCFPData(client(() => json([]), null, { name: "AuthRetryableFetchError" })), e => e.code === "load_failed")
  await assert.rejects(loadCFPData(client(() => json({ message: "private query failure" }, 503))), e => e.code === "load_failed")
})

test("CFP validates blank Unicode text, length, duration and untrusted ownership fields", async () => {
  const { parseProposalInput } = await cfp()
  assert.equal(parseProposalInput(input).title, "PostgreSQL")
  assert.equal(parseProposalInput(input).abstract, "Abstract")
  for (const changed of [{ title: "\u3000\t\u00a0" }, { abstract: "\n\ufeff " }, { title: "a".repeat(201) }, { abstract: "a".repeat(10001) }, { duration: -1 }, { duration: 31 }, { type: "other" }, { requestId: "bad" }, { userId: user.id }, { status: "approved" }]) {
    assert.throws(() => parseProposalInput({ ...input, ...changed }), e => e.code === "invalid_input")
  }
})

test("CFP derives confirmed owner from Auth and requires the inserted row", async () => {
  const { submitProposal } = await cfp()
  let writes = 0
  const db = client((url, options) => {
    if (options.method === "POST") {
      writes++
      const saved = JSON.parse(options.body)
      assert.equal(saved.user_id, user.id)
      assert.equal(saved.title, "PostgreSQL")
      assert.equal(saved.status, "pending")
      assert.equal(saved.publication_status, "draft")
      return json(row)
    }
    return json(null)
  })
  assert.equal((await submitProposal(db, input)).id, input.requestId)
  assert.equal(writes, 1)
  await assert.rejects(submitProposal(client(() => json(null), null), input), e => e.code === "login_required")
  await assert.rejects(submitProposal(client(() => json(null), { ...user, email_confirmed_at: null }), input), e => e.code === "email_not_verified")
  await assert.rejects(submitProposal(client(() => json(null)), input), e => e.code === "operation_failed")
})

test("same CFP request retries recover one proposal but changed content or another owner cannot", async () => {
  const { submitProposal } = await cfp()
  const db = client(() => json(row))
  assert.equal((await submitProposal(db, input)).id, row.id)
  await assert.rejects(submitProposal(db, { ...input, title: "Changed" }), e => e.code === "request_conflict")
  await assert.rejects(submitProposal(client(() => json({ ...row, user_id: "other" })), input), e => e.code === "request_conflict")
})

test("concurrent duplicate CFP insert re-reads the matching row after unique violation", async () => {
  const { submitProposal } = await cfp()
  let reads = 0
  const db = client((url, options) => options.method === "POST" ? json({ code: "23505", message: "private" }, 409) : json(++reads === 1 ? null : row))
  assert.equal((await submitProposal(db, input)).id, row.id)
  assert.equal(reads, 2)
  await assert.rejects(submitProposal(client((url, options) => options.method === "POST" ? json({ message: "private" }, 403) : json(null)), input), e => e.code === "operation_failed" && !e.message.includes("private"))
})

test("CFP recovers a committed insert whose HTTP response was lost without resubmitting", async () => {
  const { submitProposal } = await cfp()
  let saved = false
  let writes = 0
  const db = client((url, options) => {
    if (options.method === "POST") { saved = true; writes++; throw Error("response lost") }
    return json(saved ? row : null)
  })
  assert.equal((await submitProposal(db, input)).id, row.id)
  assert.equal((await submitProposal(db, input)).id, row.id)
  assert.equal(writes, 1)
})

test("Auth redirects preserve internal targets and reject schemes, hosts, control characters and loops", async () => {
  const { safeAuthRedirect } = await redirects()
  assert.equal(safeAuthRedirect("/cfp?tab=submissions#mine"), "/cfp?tab=submissions#mine")
  assert.equal(safeAuthRedirect("/cfp?query=hello%20world"), "/cfp?query=hello%20world")
  assert.equal(safeAuthRedirect("/x/..//evil.example/path"), "/")
  for (const path of [null, "", "https://evil.example", "javascript:alert(1)", "//evil.example", "/\\evil.example", "/%2f%2fevil.example", "/%5cevil.example", "/\nevil", "/auth/login", "/auth/callback?next=/cfp", "/auth/signout", "/x/../auth/login", "/%61uth/login", "/%zz"]) assert.equal(safeAuthRedirect(path), "/", String(path))
})

test("CFP refuses a draft from the previously signed-in account before reading or writing", async () => {
  const { submitProposal } = await cfp()
  let requests = 0
  await assert.rejects(submitProposal(client(() => { requests++; return json(null) }, { ...user, id: "33333333-3333-4333-8333-333333333333" }), input), e => e.code === "account_changed")
  assert.equal(requests, 0)
})

test("Auth error codes are mapped without backend message leakage", async () => {
  const { authErrorCode } = await auth()
  assert.equal(authErrorCode({ code: "invalid_credentials" }), "invalid_credentials")
  assert.equal(authErrorCode({ code: "email_not_confirmed" }), "email_not_confirmed")
  assert.equal(authErrorCode({ status: 429 }), "rate_limited")
  assert.equal(authErrorCode({ message: "private internal detail" }), "operation_failed")
})

test("password login normalizes email but not password and rejects empty success and exceptions", async () => {
  const { signInAccount } = await auth()
  const db = client(() => json(null))
  db.auth.signInWithPassword = async ({ email, password }) => {
    assert.equal(email, "speaker@example.test")
    assert.equal(password, " secret ")
    return { data: { user, session: { access_token: "fixture" } }, error: null }
  }
  assert.equal((await signInAccount(db, { email: " speaker@example.test ", password: " secret " })).user.id, user.id)
  db.auth.signInWithPassword = async () => ({ data: { user: null, session: null }, error: null })
  await assert.rejects(signInAccount(db, { email: user.email, password: "secret" }), e => e.code === "operation_failed")
  db.auth.signInWithPassword = async () => { throw Error("private network failure") }
  await assert.rejects(signInAccount(db, { email: user.email, password: "secret" }), e => e.code === "operation_failed")
})
