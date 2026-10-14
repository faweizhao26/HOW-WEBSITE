import assert from "node:assert/strict"
import { test } from "node:test"
import { createClient } from "@supabase/supabase-js"
import { defaultSiteSettings, validateSettingsDraft } from "../src/lib/content/settings.ts"
import { loadCFPData, submitProposal } from "../src/lib/cfp/service.ts"
import { getCFPState, parseCFPSettings } from "../src/lib/cfp/settings.ts"

const user = { id: "11111111-1111-4111-8111-111111111111", email_confirmed_at: "2026-01-01" }
const input = { requestId: "22222222-2222-4222-8222-222222222222", expectedUserId: user.id, title: "Title", abstract: "Abstract", duration: 30, type: "talk" }
const row = { id: input.requestId, user_id: user.id, title: "Title", title_zh: null, abstract: "Abstract", abstract_zh: null, duration: 30, type: "talk", status: "pending" }
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } })

function client(settings, { existing = null, failedSettings = false } = {}) {
  let writes = 0
  const db = createClient("https://isolated.example.test", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (url, options) => {
      if (new URL(url).pathname.endsWith("site_settings_releases")) return failedSettings ? json({ message: "private" }, 503) : json(settings === null ? null : { payload: settings })
      if (options.method === "POST") { writes++; return json(row) }
      return json(existing)
    } },
  })
  db.auth.getUser = async () => ({ data: { user }, error: null })
  return { db, writes: () => writes }
}

test("settings publication rejects malformed CFP dates, switches and option lists", () => {
  for (const fields of [
    { cfp_deadline: "2027-02-30" }, { cfp_deadline: "tomorrow" }, { cfp_enabled: "maybe" },
    { cfp_types: "[]" }, { cfp_types: '["talk","other"]' }, { cfp_types: '["talk","talk"]' },
    { cfp_durations: "[31]" }, { cfp_durations: "[]" }, { cfp_durations: "invalid" },
    { cfp_contact_email: "not an email" }, { cfp_requirements: "x".repeat(10001) },
  ]) assert.notEqual(validateSettingsDraft({ ...defaultSiteSettings, ...fields }), null, JSON.stringify(fields).slice(0, 100))
  assert.equal(validateSettingsDraft({ ...defaultSiteSettings, cfp_enabled: "false", cfp_deadline: "", cfp_types: '["talk"]', cfp_durations: "[15,30]" }), null)
})

for (const [name, settings, code] of [
  ["closed", { cfp_enabled: "false" }, "cfp_closed"],
  ["expired", { cfp_deadline: "2020-01-01" }, "cfp_closed"],
  ["removed type", { cfp_types: '["workshop"]' }, "cfp_options_changed"],
  ["removed duration", { cfp_durations: "[15]" }, "cfp_options_changed"],
]) test(`fresh proposals respect the published CFP policy: ${name}`, async () => {
  const h = client(settings)
  await assert.rejects(submitProposal(h.db, input), error => error.code === code)
  assert.equal(h.writes(), 0)
})

test("unavailable or missing published CFP settings cannot silently open submissions", async () => {
  for (const h of [client(null), client({}, { failedSettings: true })]) {
    await assert.rejects(submitProposal(h.db, input), error => error.code === "operation_failed")
    assert.equal(h.writes(), 0)
  }
})

test("CFP page receives only the released policy and keeps existing proposals while closed", async () => {
  const h = client({ cfp_enabled: "false", cfp_requirements_zh: "已发布要求" }, { existing: [] })
  const data = await loadCFPData(h.db)
  assert.equal(data.policy.enabled, false)
  assert.equal(data.policy.requirements.zh, "已发布要求")
  assert.deepEqual(data.sessions, [])
})

test("a matching saved request is recoverable after CFP closes without another write", async () => {
  const h = client({ cfp_enabled: "false" }, { existing: row })
  assert.equal((await submitProposal(h.db, input)).id, row.id)
  assert.equal(h.writes(), 0)
})

test("CFP deadline includes the entire Beijing calendar day, independently of host timezone", () => {
  const policy = parseCFPSettings({ cfp_deadline: "2027-04-01" })
  assert.equal(getCFPState(policy, Date.parse("2027-04-01T15:59:59.999Z")), "open")
  assert.equal(getCFPState(policy, Date.parse("2027-04-01T16:00:00.000Z")), "expired")
  assert.equal(getCFPState(parseCFPSettings({}), Date.parse("2040-01-01")), "open")
})
