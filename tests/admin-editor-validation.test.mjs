import assert from "node:assert/strict"
import { test } from "node:test"
import { defaultSiteSettings } from "../src/lib/content/settings.ts"
import { parseSiteContent } from "../src/lib/content/site-content.ts"
const api = await import("../src/lib/content/settings-validation.ts").catch(() => ({}))

test("publication issues identify exact required, email and CFP fields", () => {
  assert.equal(typeof api.getSettingsIssues, "function")
  const rows = api.getSettingsIssues({ ...defaultSiteSettings, conference_name: "", contact_email: "bad", cfp_types: "[]", cfp_deadline: "2027-02-30" })
  for (const path of ["conference_name", "contact_email", "cfp_types", "cfp_deadline"]) assert.ok(rows.some(row => row.path === path), path)
  assert.ok(rows.every(row => row.label.zh && row.label.en && row.message.zh && row.message.en))
})

test("managed errors contain the page, section title and field path", () => {
  const content = parseSiteContent({})
  content.pages.attend.sections[1].imageUrl = "javascript:alert(1)"
  content.contacts.sponsor = "bad"
  const rows = api.getSettingsIssues({ ...defaultSiteSettings, site_content: JSON.stringify(content) })
  const issue = rows.find(row => row.path === "pages.attend.sections.1.imageUrl")
  assert.match(issue.label.zh, /参会指南.*交通与住宿.*图片/)
  assert.ok(rows.some(row => row.path === "contacts.sponsor"))
})

test("valid legacy drafts pass and malformed JSON stays a located error", () => {
  assert.deepEqual(api.getSettingsIssues(defaultSiteSettings), [])
  assert.ok(api.getSettingsIssues({ ...defaultSiteSettings, site_content: "{bad" }).some(row => row.path === "site_content"))
  assert.ok(api.getSettingsIssues({ ...defaultSiteSettings, cfp_durations: "{bad" }).some(row => row.path === "cfp_durations"))
})
