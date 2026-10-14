import assert from "node:assert/strict"
import { test } from "node:test"

const content = await import("../src/lib/content/site-content.ts").catch(() => ({}))

test("legacy releases retain editable content without inventing a confirmed venue", () => {
  assert.equal(typeof content.parseSiteContent, "function")
  const value = content.parseSiteContent({})
  assert.equal(value.venue.confirmed, false)
  assert.ok(value.pages.attend.sections.length >= 4)
  assert.ok(value.pages.privacy.sections.length >= 6)
  assert.equal(value.contacts.sponsor, "")
})

test("custom content preserves bilingual blocks, hidden state and explicit empty lists", () => {
  const value = content.parseSiteContent({})
  value.pages.attend.sections = []
  value.home.sections[0].enabled = false
  value.venue.name = { en: "QA venue", zh: "测试场地" }
  const saved = content.parseSiteContent({ site_content: JSON.stringify(value) })
  assert.equal(saved.pages.attend.sections.length, 0)
  assert.equal(saved.home.sections[0].enabled, false)
  assert.equal(saved.venue.name.zh, "测试场地")
})

test("malformed content and executable asset/link URLs are rejected", () => {
  assert.throws(() => content.parseSiteContent({ site_content: "{bad" }))
  for (const url of ["javascript:alert(1)", "data:text/html,test", "//outside.test/path", "https://%", "http://host:65536"]) {
    const value = content.parseSiteContent({})
    value.venue.mapUrl = url
    assert.throws(() => content.parseSiteContent({ site_content: JSON.stringify(value) }))
  }
  const value = content.parseSiteContent({})
  value.home.sections[0].imageUrl = "javascript:alert(1)"
  assert.throws(() => content.parseSiteContent({ site_content: JSON.stringify(value) }))
})

test("default homepage CTA leaves venue status to the canonical released venue", () => {
  const value = content.parseSiteContent({})
  assert.equal(value.home.sections.find(block => block.id === "cta").body.en, "")
  assert.equal(value.home.sections.find(block => block.id === "cta").body.zh, "")
})

test("default blocks are independent per parse and duplicate identifiers are invalid", () => {
  const a = content.parseSiteContent({}), b = content.parseSiteContent({})
  a.pages.about.sections[0].title.en = "Changed"
  assert.notEqual(a.pages.about.sections[0].title.en, b.pages.about.sections[0].title.en)
  b.pages.about.sections.push(b.pages.about.sections[0])
  assert.throws(() => content.parseSiteContent({ site_content: JSON.stringify(b) }))
})

test("incomplete links and FAQ keywords stay editable without becoming publishable", () => {
  const value = content.parseSiteContent({})
  value.venue.mapUrl = "https:"
  value.faq.items.push({ id: "new", keywords: [], answer: { en: "", zh: "" }, enabled: true })
  const draft = { site_content: JSON.stringify(value) }
  assert.equal(content.parseSiteContentDraft(draft).venue.mapUrl, "https:")
  assert.throws(() => content.parseSiteContent(draft))
})
