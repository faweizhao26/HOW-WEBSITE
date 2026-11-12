import assert from "node:assert/strict"
import { test } from "node:test"
import { parseSiteContent, parseSiteContentDraft, newContentBlock, outreachPageVisible, visibleOutreachBlocks } from "../src/lib/content/site-content.ts"

test("old releases gain independent hidden outreach defaults without changing old content", () => {
  const a = parseSiteContent({}), { outreach, ...legacy } = a
  assert.ok(outreach)
  const b = parseSiteContent({ site_content: JSON.stringify(legacy) })
  assert.deepEqual(b.home, legacy.home)
  for (const name of ["media", "speakerGuide"]) assert.equal(outreachPageVisible(b.outreach[name]), false)
  assert.equal(b.outreach.sponsorship.enabled, false)
  assert.equal(b.outreach.progress.enabled, false)
  b.outreach.media.sections.push(newContentBlock("test"))
  assert.equal(a.outreach.media.sections.length, 0)
})
test("titles and enabled switches alone never expose empty pages or blocks", () => {
  const c = parseSiteContent({})
  const b = newContentBlock("intro"); b.title.en = "Only a title"
  c.outreach.media.enabled = true; c.outreach.media.sections = [b]
  assert.equal(outreachPageVisible(c.outreach.media), false)
  b.linkUrl = "https://example.test/kit.pdf"
  assert.equal(outreachPageVisible(c.outreach.media), true)
  b.enabled = false
  assert.equal(visibleOutreachBlocks([b]).length, 0)
  assert.equal(outreachPageVisible(c.outreach.media), false)
})
test("outreach rejects unsafe links and duplicate IDs while retaining incomplete drafts", () => {
  const c = parseSiteContent({}); const b = newContentBlock("guide")
  c.outreach.speakerGuide.sections = [b]
  b.linkUrl = "javascript:alert(1)"
  assert.throws(() => parseSiteContent({ site_content: JSON.stringify(c) }))
  assert.equal(parseSiteContentDraft({ site_content: JSON.stringify(c) }).outreach.speakerGuide.sections[0].linkUrl, b.linkUrl)
  b.linkUrl = ""; c.outreach.speakerGuide.sections.push(b)
  assert.throws(() => parseSiteContent({ site_content: JSON.stringify(c) }))
})
