import assert from "node:assert/strict"
import { test } from "node:test"
import { createClient } from "@supabase/supabase-js"
import { buildBadgeHTML } from "../src/lib/admin/badge.ts"
import { validateSettingsDraft, defaultSiteSettings } from "../src/lib/content/settings.ts"
import { getSettingsIssues } from "../src/lib/content/settings-validation.ts"

const config = { widthMm: 70, heightMm: 40, paddingMm: 3, style: "mono", showConference: false, showCompany: true, showTicket: false }
const settings = { badge_print: JSON.stringify(config), conference_name: "Conference <2027>" }
const person = { name: "Example <Name>", company: "Example & Company", ticket_types: { name: "Guest", name_zh: "嘉宾" } }

test("badge paper, monochrome styling and selected fields follow settings", () => {
  const html = buildBadgeHTML(person, "zh", settings)
  assert.match(html, /size:70mm 40mm/)
  assert.match(html, /padding:3mm/)
  assert.match(html, /background:#fff;color:#000/)
  assert.ok(html.includes("Example &lt;Name&gt;"))
  assert.ok(html.includes("Example &amp; Company"))
  assert.ok(!html.includes("嘉宾"))
  assert.ok(!html.slice(html.indexOf("<body>")).includes("Conference &lt;2027&gt;"))
  assert.ok(!html.includes("linear-gradient"))
})

test("badge optional fields, translated ticket and escaped conference name", () => {
  const html = buildBadgeHTML(person, "en", { ...settings, badge_print: JSON.stringify({ ...config, showCompany: false, showTicket: true, showConference: true }) })
  assert.ok(html.includes("Conference &lt;2027&gt;"))
  assert.ok(html.includes("Guest"))
  assert.ok(!html.includes("Example &amp; Company"))
  assert.ok(!html.includes("嘉宾"))
})

test("legacy settings keep 90 x 55 mm color badges", () => {
  assert.match(buildBadgeHTML(person, "zh"), /size:90mm 55mm/)
})

test("invalid dimensions and malformed print config block settings publication", () => {
  for (const value of ["{", "null", "{}", JSON.stringify({ ...config, widthMm: 0 }), JSON.stringify({ ...config, heightMm: 1000 }), JSON.stringify({ ...config, paddingMm: 20 }), JSON.stringify({ ...config, style: "injected" }), JSON.stringify({ ...config, showCompany: "false" })]) {
    const invalid = { ...defaultSiteSettings, badge_print: value }
    assert.equal(validateSettingsDraft(invalid), "badge")
    assert.ok(getSettingsIssues(invalid).some(issue => issue.path === "badge_print"))
    assert.throws(() => buildBadgeHTML(person, "zh", invalid))
  }
  assert.equal(validateSettingsDraft({ ...defaultSiteSettings, badge_print: JSON.stringify(config) }), null)
})

test("printing reads the current release, never a settings draft; failed reads reject", async () => {
  const { loadBadgePrintSettings } = await import("../src/lib/admin/badge-settings.ts")
  const client = (fetch) => createClient("https://isolated.example.test", "test-key", { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch } })
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } })
  const loaded = await loadBadgePrintSettings(client(url => {
    assert.ok(new URL(url).pathname.endsWith("site_settings_releases"))
    assert.equal(new URL(url).searchParams.get("is_current"), "eq.true")
    return json({ payload: settings })
  }))
  assert.deepEqual(loaded, settings)
  await assert.rejects(loadBadgePrintSettings(client(() => json({ message: "denied" }, 403))))
  await assert.rejects(loadBadgePrintSettings(client(() => json({ payload: { badge_print: "{}" } }))))
  assert.deepEqual(await loadBadgePrintSettings(client(() => json(null))), {})
})
