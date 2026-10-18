import assert from "node:assert/strict"
import { test } from "node:test"
import { createClient } from "@supabase/supabase-js"

const api = await import("../src/lib/admin/settings-draft.ts").catch(() => ({}))
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
const client = (fetch) => createClient("https://isolated.example.test", "test-key", {
  auth: { persistSession: false, autoRefreshToken: false }, global: { fetch },
})

test("settings save sends the entire untrimmed baseline and returns the confirmed snapshot", async () => {
  assert.equal(typeof api.saveSettingsDraft, "function")
  const baseline = { hero_title: " Old ", site_content: '{"nested":"old"}', extra_key: "keep" }
  const local = { ...baseline, hero_title: " New " }
  const saved = { ...local, hero_title: "New" }
  const db = client((url, options) => {
    assert.ok(url.endsWith("/rpc/save_site_settings_draft"))
    assert.deepEqual(JSON.parse(options.body), { p_expected: baseline, p_draft: saved })
    return json(saved)
  })
  assert.deepEqual(await api.saveSettingsDraft(db, baseline, local), saved)
  assert.equal(local.hero_title, " New ")
  assert.equal(baseline.hero_title, " Old ")
})

test("stale settings save is distinguishable and never mutates the local draft or baseline", async () => {
  assert.equal(typeof api.saveSettingsDraft, "function")
  const baseline = { title: "old" }, local = { title: "local" }
  await assert.rejects(api.saveSettingsDraft(client(() => json({ code: "PT409", message: "settings_draft_conflict" }, 409)), baseline, local), error => error instanceof api.SettingsDraftConflictError)
  assert.deepEqual(baseline, { title: "old" })
  assert.deepEqual(local, { title: "local" })
})

test("empty initial settings are a real baseline; missing or malformed confirmations fail", async () => {
  assert.equal(typeof api.saveSettingsDraft, "function")
  assert.deepEqual(await api.saveSettingsDraft(client(() => json({ title: "First" })), {}, { title: "First" }), { title: "First" })
  for (const response of [json(null), json([]), json({ title: 1 }), json({ message: "denied", code: "42501" }, 403)]) {
    await assert.rejects(api.saveSettingsDraft(client(() => response), {}, { title: "First" }))
  }
})
