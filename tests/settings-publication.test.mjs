import assert from "node:assert/strict"
import { test } from "node:test"
import { defaultSiteSettings, requiredSettingsKeys, validateSettingsDraft, hasSettingsChanges } from "../src/lib/content/settings.ts"

test("settings release requires all bilingual content and the actual conference period", () => {
  assert.equal(validateSettingsDraft(defaultSiteSettings), null)
  for (const key of requiredSettingsKeys) {
    assert.equal(validateSettingsDraft({ ...defaultSiteSettings, [key]: "  " }), "required")
  }
  for (const date of ["2027.4.14-4.15", "2027.4.31-4.32", "2028.4.16-4.18", "2027.4.16", ""]) {
    assert.notEqual(validateSettingsDraft({ ...defaultSiteSettings, conference_date: date }), null)
  }
})

test("settings pending state compares snapshots and ignores empty optional defaults", () => {
  assert.equal(hasSettingsChanges({ ...defaultSiteSettings, register_url: "" }, defaultSiteSettings), false)
  assert.equal(hasSettingsChanges({ ...defaultSiteSettings, hero_title: "New title" }, defaultSiteSettings), true)
  assert.equal(hasSettingsChanges(defaultSiteSettings, null), true)
  assert.equal(hasSettingsChanges(defaultSiteSettings, { ...defaultSiteSettings, register_url: "https://example.com" }), true)
})
