import assert from "node:assert/strict"
import { test } from "node:test"
import { readFileSync } from "node:fs"
import vm from "node:vm"
import ts from "typescript"
import { createServerClient, createBrowserClient } from "@supabase/ssr"
import { resetAccountPassword } from "../src/lib/auth/email.ts"

const compiled = ts.transpileModule(readFileSync(new URL("../src/lib/supabase/server.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const a = { id: "11111111-1111-4111-8111-111111111111", email_confirmed_at: "2026-10-10" }
const b = { ...a, id: "22222222-2222-4222-8222-222222222222" }
const name = "sb-auth-auth-token"
const part = value => Buffer.from(JSON.stringify(value)).toString("base64url")
const fresh = Math.floor(Date.now() / 1000) + 3600
const session = (user, expiry = fresh) => ({ access_token: `${part({ alg: "HS256" })}.${part({ sub: user.id, exp: expiry })}.fixture`, refresh_token: "fixture", expires_at: expiry, user })
const encode = value => "base64-" + part(value)
const decode = value => JSON.parse(Buffer.from(value.slice(7), "base64url"))
function server(cookieStore, fetch, writeCookies) {
  const context = {
    exports: {},
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: "https://auth.example.test", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-key" } },
    require: id => {
      if (id === "next/headers") return { cookies: async () => cookieStore }
      if (id === "@supabase/ssr") return { createServerClient: (url, key, options) => createServerClient(url, key, { ...options, global: { fetch } }) }
      throw Error(id)
    },
  }
  vm.runInNewContext(compiled, context)
  return context.exports.createServerSupabase({ writeCookies })
}

test("a delayed password response cannot replace a newer browser account cookie", async () => {
  for (const writeCookies of [true, false]) {
    const snapshot = [{ name, value: encode(session(a)) }], writes = []
    let browser = snapshot, release, started
    const blocked = new Promise(resolve => { release = resolve })
    const entered = new Promise(resolve => { started = resolve })
    const fetch = async (_url, options) => {
      if (options.method === "PUT") { started(); await blocked }
      return new Response(JSON.stringify(a), { headers: { "content-type": "application/json" } })
    }
    const db = await server({ getAll: () => snapshot, set: (name, value, options) => writes.push({ name, value, options }) }, fetch, writeCookies)
    const task = resetAccountPassword(db, { expectedUserId: a.id, password: "Synthetic Password9!", confirmation: "Synthetic Password9!" })
    await entered
    browser = [{ name, value: encode(session(b)) }]
    release(); await task
    for (const cookie of writes) {
      browser = browser.filter(c => c.name !== cookie.name)
      if (cookie.options.maxAge !== 0) browser.push(cookie)
    }
    assert.equal(decode(browser.find(c => c.name === name).value).user.id, writeCookies ? a.id : b.id)
    assert.equal(writes.length, writeCookies ? 1 : 0)
  }
})

test("browser getSession refreshes a near-expiry session and persists the fresh cookie before an action", async () => {
  let cookies = [{ name, value: encode(session(a, Math.floor(Date.now() / 1000) + 10)) }]
  let requests = 0, writes = 0
  const client = createBrowserClient("https://auth.example.test", "test-key", {
    isSingleton: false,
    auth: { autoRefreshToken: false, detectSessionInUrl: false },
    cookies: {
      getAll: () => cookies,
      setAll: updates => {
        writes++
        for (const update of updates) {
          cookies = cookies.filter(c => c.name !== update.name)
          if (update.options.maxAge !== 0) cookies.push(update)
        }
      },
    },
    global: { fetch: async url => {
      assert.match(String(url), /token\?grant_type=refresh_token/)
      requests++
      return new Response(JSON.stringify({ ...session(a), expires_in: 3600, token_type: "bearer" }), { headers: { "content-type": "application/json" } })
    } },
  })
  const { data, error } = await client.auth.getSession()
  assert.equal(error, null)
  assert.equal(data.session.expires_at, fresh)
  assert.equal(requests, 1)
  assert.equal(writes, 1)
  assert.equal(decode(cookies.find(c => c.name === name).value).expires_at, fresh)
})
