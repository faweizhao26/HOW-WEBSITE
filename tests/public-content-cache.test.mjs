import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"
import vm from "node:vm"
import ts from "typescript"
import { test } from "node:test"
import { createClient } from "@supabase/supabase-js"
import { defaultSiteSettings, validateSettingsDraft } from "../src/lib/content/settings.ts"

function load(path, modules, globals = {}) {
  const file = new URL(path, import.meta.url)
  assert.ok(existsSync(file), "Public content must use its own cookie-free cached client")
  const js = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const context = { exports: {}, URL, Request, Headers, process: { env: { NEXT_PUBLIC_SUPABASE_URL: "https://public.example.test", NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key" } }, ...globals, require: name => {
    assert.ok(name in modules, `Unexpected dependency (cookies must stay outside public cache): ${name}`)
    return modules[name]
  } }
  vm.runInNewContext(js, context)
  return context.exports
}
const policy = { PUBLIC_CONTENT_CACHE_TAG: "how:published-content", PUBLIC_CONTENT_REVALIDATE_SECONDS: 60 }
const response = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } })
function publicClient(fetcher) {
  return load("../src/lib/supabase/public.ts", { "server-only": {}, "@supabase/supabase-js": { createClient }, "../content/cache-policy.ts": policy }, { fetch: fetcher }).createPublicContentClient()
}

test("public client caches only anonymous published GETs with one shared tag", async () => {
  const calls = []
  const client = publicClient((input, options) => { calls.push({ url: new URL(input), options }); return response([{ id: "public" }]) })
  assert.equal((await client.from("published_sponsors").select("*")).error, null)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].options.cache, "force-cache")
  assert.equal(calls[0].options.next.revalidate, 60)
  assert.equal(calls[0].options.next.tags[0], policy.PUBLIC_CONTENT_CACHE_TAG)
  assert.equal(calls[0].options.headers.get("authorization"), "Bearer anon-key")
  assert.equal(calls[0].options.headers.get("cookie"), null)
})

test("public cache refuses drafts, personal records, mutations and release history", async () => {
  let requests = 0
  const client = publicClient(() => { requests++; return response([]) })
  for (const table of ["site_settings", "speakers", "profiles", "registrations"]) {
    assert.ok((await client.from(table).select("*").retry(false)).error)
  }
  assert.ok((await client.from("published_sponsors").insert({ name: "no" }).retry(false)).error)
  assert.ok((await client.from("site_settings_releases").select("payload").retry(false)).error)
  assert.ok((await client.from("agenda_releases").select("payload").eq("is_current", false).retry(false)).error)
  assert.equal(requests, 0)
  assert.equal((await client.from("site_settings_releases").select("payload").eq("is_current", true).maybeSingle()).error, null)
  assert.equal(requests, 1)
})

test("public client retains database errors instead of treating failure as empty content", async () => {
  const client = publicClient(() => response({ message: "temporarily unavailable" }, 503))
  assert.ok((await client.from("published_sessions").select("*").retry(false)).error)
})

test("successful publish, unpublish and rollback immediately invalidate shared public data", async () => {
  let denied = false, failed = false
  const events = []
  const actions = load("../src/app/admin/actions/publication.ts", {
    "next/cache": { revalidatePath: path => events.push(["path", path]), updateTag: tag => events.push(["tag", tag]) },
    "@/lib/auth/require-admin": { requireAdmin: async () => { if (denied) throw Error("denied") } },
    "@/lib/supabase/server": { createServerSupabase: async () => ({
      from: () => ({ select: async () => ({ data: Object.entries(defaultSiteSettings).map(([key, value]) => ({ key, value })) }) }),
      rpc: async name => { events.push(["rpc", name]); return failed ? { error: new Error("failed") } : { data: "release" } },
    }) },
    "@/lib/content/settings": { validateSettingsDraft },
    "@/lib/content/cache-policy": policy,
  })
  for (const name of ["publishSpeaker", "unpublishSpeaker", "publishSession", "unpublishSession", "publishSponsor", "unpublishSponsor", "publishNewsPost", "unpublishNewsPost", "publishAgenda", "rollbackAgenda", "publishSiteSettings", "rollbackSiteSettings"]) {
    events.length = 0
    assert.equal((await actions[name]("id")).ok, true)
    assert.equal(events[0][0], "rpc")
    assert.deepEqual(events[1], ["tag", policy.PUBLIC_CONTENT_CACHE_TAG])
  }
  for (const reason of ["denied", "failed"]) {
    events.length = 0; denied = reason === "denied"; failed = reason === "failed"
    assert.equal((await actions.publishSiteSettings()).ok, false)
    assert.equal(events.some(event => event[0] === "tag"), false)
  }
})
