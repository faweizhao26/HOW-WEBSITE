import assert from "node:assert/strict"
import { test } from "node:test"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import vm from "node:vm"
import ts from "typescript"
import * as redirects from "../src/lib/auth/redirect.ts"

const require = createRequire(import.meta.url)
const js = ts.transpileModule(readFileSync(new URL("../src/app/auth/callback/route.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
function route(auth) {
  const modules = { "next/server": require("next/server"), "@/lib/auth/redirect": redirects, "@/lib/supabase/server": { createServerSupabase: async () => ({ auth }) } }
  const context = { exports: {}, URL, require: name => modules[name] }
  vm.runInNewContext(js, context)
  return path => context.exports.GET(new Request("https://conference.example" + path))
}
test("recovery PKCE callback reaches reset page without losing its original internal destination", async () => {
  const get = route({ exchangeCodeForSession: async code => { assert.equal(code, "one-use-code"); return { data: { session: { access_token: "fixture" }, redirectType: "recovery" }, error: null } } })
  const response = await get("/auth/callback?code=one-use-code&next=%2Fcfp")
  assert.equal(response.headers.get("location"), "https://conference.example/auth/reset-password?redirect=%2Fcfp")
  assert.equal(response.headers.get("cache-control"), "no-store")
  assert.equal(response.headers.get("referrer-policy"), "no-referrer")
})
test("signup token-hash callback verifies only supported type and rejects external next", async () => {
  const get = route({ verifyOtp: async input => { assert.equal(input.type, "signup"); assert.equal(input.token_hash, "one-use-token"); return { data: { session: { access_token: "fixture" } }, error: null } } })
  const response = await get("/auth/callback?token_hash=one-use-token&type=signup&next=https%3A%2F%2Fevil.example")
  assert.equal(response.headers.get("location"), "https://conference.example/")
})
test("expired and missing recovery links cannot fall through to the reset form as success", async () => {
  const get = route({ exchangeCodeForSession: async () => ({ data: { session: null }, error: { code: "otp_expired" } }) })
  for (const query of ["code=expired&flow=recovery", "flow=recovery"]) {
    const response = await get("/auth/callback?" + query + "&next=%2Fcfp")
    assert.equal(response.headers.get("location"), "https://conference.example/auth/reset-password?error=auth_failed&redirect=%2Fcfp")
  }
})
test("unsupported email token types are never verified and failed signup callbacks retain safe destination", async () => {
  const get = route({ verifyOtp: async () => { throw Error("must not verify an unsupported type") } })
  const response = await get("/auth/callback?token_hash=token&type=email_change&next=%2Fcfp")
  assert.equal(response.headers.get("location"), "https://conference.example/auth/login?error=auth_failed&redirect=%2Fcfp")
})
