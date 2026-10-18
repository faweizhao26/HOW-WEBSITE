import assert from "node:assert/strict"
import { test } from "node:test"
import { existsSync, readFileSync } from "node:fs"
import vm from "node:vm"
import ts from "typescript"

function moduleAt(path, modules, extra = {}) {
  const js = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const context = { exports: {}, URL, Response, require: name => {
    assert.ok(name in modules, `Unexpected dependency ${name}`)
    return modules[name]
  }, ...extra }
  vm.runInNewContext(js, context)
  return context.exports
}

test("ordinary server clients never write a refreshed old account into browser cookies", async () => {
  let writes = 0
  const server = moduleAt("../src/lib/supabase/server.ts", {
    "next/headers": { cookies: async () => ({ getAll: () => [], set: () => { writes++ } }) },
    "@supabase/ssr": { createServerClient: (_url, _key, options) => {
      options.cookies.setAll([{ name: "synthetic", value: "old-account", options: {} }])
      return {}
    } },
  }, { process: { env: { NEXT_PUBLIC_SUPABASE_URL: "https://synthetic.example.test", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test" } } })
  await server.createServerSupabase()
  assert.equal(writes, 0)
  await server.createServerSupabase({ writeCookies: true })
  assert.equal(writes, 1, "Explicit authentication routes retain cookie persistence")
})

for (const method of ["GET", "POST"]) {
  test(`CFP ${method} proxy ${method === "POST" ? "does not overwrite" : "retains navigation refresh of"} cookies`, async () => {
    const responses = []
    const next = () => { const response = { writes: [], cookies: { set(...args) { response.writes.push(args) } } }; responses.push(response); return response }
    const { proxy } = moduleAt("../src/proxy.ts", {
      "next/server": { NextResponse: { next } },
      "@supabase/ssr": { createServerClient: (_url, _key, options) => ({ auth: { getUser: async () => {
        options.cookies.setAll([{ name: "synthetic", value: "old-account", options: {} }])
        return { data: { user: { id: "synthetic" } } }
      } } }) },
    }, { process: { env: { NEXT_PUBLIC_SUPABASE_URL: "https://synthetic.example.test", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test" } } })
    const response = await proxy({ method, nextUrl: { pathname: "/cfp" }, cookies: { getAll: () => [], set() {} } })
    assert.equal(response.writes.length, method === "GET" ? 1 : 0)
  })
}

for (const route of ["callback", "signout"]) {
  test(`${route} explicitly opts into writing authentication cookies`, async () => {
    let options
    const mod = moduleAt(`../src/app/auth/${route}/route.ts`, {
      "next/server": { NextResponse: { redirect: url => new Response(null, { status: 303, headers: { location: String(url) } }) } },
      "@/lib/supabase/server": { createServerSupabase: async value => {
        options = value
        return { auth: { exchangeCodeForSession: async () => ({ data: { session: {} }, error: null }), signOut: async () => ({ error: null }) } }
      } },
      "@/lib/auth/redirect": { safeAuthRedirect: () => "/" },
    })
    await mod[route === "callback" ? "GET" : "POST"](new Request(`http://local.test/auth/${route}?code=synthetic`))
    assert.equal(options?.writeCookies, true)
  })
}

test("browser requests refresh first and reject a changed account before submitting", async () => {
  const path = new URL("../src/lib/auth/prepare-account-request.ts", import.meta.url)
  assert.ok(existsSync(path), "A shared browser account preparation boundary is required")
  const { prepareAccountRequest } = await import(path.href)
  let refreshed = 0
  const auth = { getSession: async () => { refreshed++; return { data: { session: { user: { id: "A" } } }, error: null } } }
  await prepareAccountRequest(auth, "A")
  assert.equal(refreshed, 1)
  await assert.rejects(prepareAccountRequest(auth, "B"), error => error.code === "account_changed")
  await assert.rejects(prepareAccountRequest({ getSession: async () => ({ data: { session: null }, error: null }) }, "A"), error => error.code === "login_required")
})

test("registration refuses an expected account mismatch before ticket or database operations", async () => {
  const { createRegistration } = await import("../src/lib/registration/service.ts")
  let reads = 0
  const client = { auth: { getUser: async () => ({ data: { user: { id: "11111111-1111-4111-8111-111111111111", email: "same@example.test", email_confirmed_at: "2026-01-01" } }, error: null }) }, from() { reads++; throw Error("Unexpected database call") } }
  await assert.rejects(createRegistration(client, { expectedUserId: "22222222-2222-4222-8222-222222222222", email: "same@example.test", name: "Test", phone: "13812345678", ticketTypeId: "33333333-3333-4333-8333-333333333333" }), error => error.code === "account_changed")
  assert.equal(reads, 0)
})
