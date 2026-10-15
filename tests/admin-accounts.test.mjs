import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import vm from "node:vm"
import { test } from "node:test"
import ts from "typescript"
import { createClient } from "@supabase/supabase-js"

const url = new URL("../src/lib/admin/accounts.ts", import.meta.url)
const load = async () => {
  assert.ok(existsSync(url), "Account administration must validate requests and database results")
  return import(url.href)
}
const id = "11111111-1111-4111-8111-111111111111"
const account = { id, fullName: "Example", email: "person@example.test", role: "user", createdAt: "2026-10-15T00:00:00Z" }
const workspace = { accounts: [account], total: 1, page: 1, pageSize: 20, adminCount: 1, currentUserId: id, history: [] }
const client = respond => createClient("https://isolated.example.test", "key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: async (url, options) => respond(new URL(url), JSON.parse(options.body)) },
})
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

test("account search trims input and uses server pagination without exposing auth records", async () => {
  const { loadManagedAccounts } = await load()
  const db = client((url, body) => {
    assert.equal(url.pathname, "/rest/v1/rpc/list_managed_accounts")
    assert.deepEqual(body, { p_query: "person@", p_role: "all", p_page: 1 })
    return json({ ...workspace, secret: "must not escape", accounts: [{ ...account, encrypted_password: "hidden" }] })
  })
  assert.deepEqual(await loadManagedAccounts(db, { query: "  person@ ", role: "all", page: 1 }), workspace)
})

test("invalid account filters and role edits never reach the database", async () => {
  const { loadManagedAccounts, changeManagedAccountRole } = await load()
  const db = client(() => assert.fail("Invalid input reached the database"))
  for (const input of [{ page: 0 }, { page: 1.5 }, { role: "owner" }, { query: "x".repeat(201) }]) {
    await assert.rejects(loadManagedAccounts(db, input), { code: "invalid" })
  }
  for (const input of [{ id: "bad", role: "admin", expectedRole: "user" }, { id, role: "owner", expectedRole: "user" }, { id, role: "admin" }]) {
    await assert.rejects(changeManagedAccountRole(db, input), { code: "invalid" })
  }
})

test("role changes carry the expected role and return only confirmed changes", async () => {
  const { changeManagedAccountRole } = await load()
  const db = client((url, body) => {
    assert.equal(url.pathname, "/rest/v1/rpc/change_managed_account_role")
    assert.deepEqual(body, { p_account_id: id, p_role: "admin", p_expected_role: "user" })
    return json({ id, role: "admin", changed: true })
  })
  assert.deepEqual(await changeManagedAccountRole(db, { id, role: "admin", expectedRole: "user" }), { id, role: "admin", changed: true })
})

test("role errors are safe and distinguish conflicts, authorization and self removal", async () => {
  const { changeManagedAccountRole, loadManagedAccounts } = await load()
  for (const [message, code] of [["ACCOUNT_ROLE_CONFLICT", "conflict"], ["ACCOUNT_LAST_ADMIN", "last_admin"], ["ACCOUNT_SELF_REVOKE", "self_revoke"], ["ACCOUNT_FORBIDDEN", "forbidden"], ["ACCOUNT_NOT_FOUND", "not_found"], ["database credentials: secret", "failed"]]) {
    await assert.rejects(changeManagedAccountRole(client(() => json({ message, code: "P0001" }, 400)), { id, role: "user", expectedRole: "admin" }), error => error.code === code && !error.message.includes("secret"))
  }
  for (const body of [null, {}, { ...workspace, accounts: [{ ...account, role: "owner" }] }]) {
    await assert.rejects(loadManagedAccounts(client(() => json(body)), {}), { code: "failed" })
  }
  await assert.rejects(changeManagedAccountRole(client(() => json(null)), { id, role: "admin", expectedRole: "user" }), { code: "failed" })
})

test("server actions deny untrusted callers before reading or changing accounts", async () => {
  const adapter = await load()
  const file = new URL("../src/app/admin/actions/accounts.ts", import.meta.url)
  assert.ok(existsSync(file))
  const js = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const require = createRequire(import.meta.url)
  let allowed = false, requests = 0
  const db = client(() => { requests++; return json(workspace) })
  const overrides = {
    "@/lib/auth/require-admin": { requireAdmin: async () => { if (!allowed) throw new Error("private auth error"); return id } },
    "@/lib/supabase/server": { createServerSupabase: async () => db },
    "@/lib/admin/accounts": adapter,
  }
  const compiled = { exports: {} }
  vm.runInNewContext(js, { module: compiled, exports: compiled.exports, require: name => overrides[name] ?? require(name) })
  const { listAccounts, updateAccountRole } = compiled.exports
  for (const call of [() => listAccounts({}), () => updateAccountRole({ id, role: "admin", expectedRole: "user" })]) {
    const result = await call()
    assert.equal(result.ok, false)
    assert.equal(result.code, "forbidden")
    assert.equal(JSON.stringify(result).includes("private"), false)
  }
  assert.equal(requests, 0)
  allowed = true
  const result = await listAccounts({})
  assert.equal(result.ok, true)
  assert.deepEqual(result.data, workspace)
})
