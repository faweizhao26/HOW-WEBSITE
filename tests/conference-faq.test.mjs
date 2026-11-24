import assert from "node:assert/strict"
import { test } from "node:test"
const api = await import("../src/lib/content/conference-faq.ts").catch(() => ({}))
const contentApi = await import("../src/lib/content/site-content.ts").catch(() => ({}))
test("FAQ canonical facts follow released venue, contact and CFP closure", () => {
  assert.equal(typeof api.getConferenceAnswer, "function")
  const content = contentApi.parseSiteContent({})
  content.venue.confirmed = true
  content.venue.name = { en: "QA venue", zh: "测试场地" }
  const settings = { conference_date: "2027.4.16-4.18", conference_location: "Jinan", conference_location_zh: "济南", contact_email: "qa@example.test", cfp_enabled: "false" }
  const published = { content, settings }
  assert.match(api.getConferenceAnswer("会场", "zh", published), /测试场地/)
  assert.match(api.getConferenceAnswer("联系", "zh", published), /qa@example.test/)
  assert.match(api.getConferenceAnswer("投稿", "zh", published), /关闭/)
  content.venue.confirmed = false
  assert.doesNotMatch(api.getConferenceAnswer("会场", "zh", published), /测试场地/)
})
test("custom literal keywords and disabled answers use the released content only", () => {
  const content = contentApi.parseSiteContent({})
  content.faq.items = [{ id: "qa", keywords: ["a+b"], answer: { en: "Custom answer", zh: "自定义答案" }, enabled: true }]
  const published = { content, settings: { contact_email: "qa@example.test" } }
  assert.equal(api.getConferenceAnswer("a+b", "zh", published), "自定义答案")
  assert.notEqual(api.getConferenceAnswer("ab", "zh", published), "自定义答案")
  content.faq.items[0].enabled = false
  assert.notEqual(api.getConferenceAnswer("a+b", "zh", published), "自定义答案")
  assert.match(api.getConferenceAnswer("日期", "zh", null), /暂时/)
})

test("FAQ refreshing requests a no-store published snapshot and rejects unavailable responses", async () => {
  assert.equal(typeof api.loadConferenceFAQ, "function")
  const value = contentApi.parseSiteContent({})
  let options
  const result = await api.loadConferenceFAQ(async (url, init) => { assert.equal(url, "/api/conference-content"); options = init; return Response.json({ status: "ready", content: value, settings: { contact_email: "qa@example.test" } }) })
  assert.equal(options.cache, "no-store")
  assert.equal(result.settings.contact_email, "qa@example.test")
  await assert.rejects(api.loadConferenceFAQ(async () => Response.json({ status: "error" }, { status: 503 })))
})

test("browsable FAQ uses canonical facts and enabled published custom answers with locale titles", () => {
  assert.equal(typeof api.getBrowsableFAQ, "function")
  const content = contentApi.parseSiteContent({})
  content.faq.items = [
    { id: "custom", enabled: true, keywords: ["Lunch arrangements", "午餐安排"], answer: { en: "Bring your own lunch", zh: "午餐请自行安排" } },
    { id: "hidden", enabled: false, keywords: ["Hidden"], answer: { en: "Do not publish", zh: "不展示" } },
    { id: "empty", enabled: true, keywords: ["Empty"], answer: { en: "", zh: "" } },
  ]
  const published = { content, settings: { conference_date: "2027.4.16-4.18", conference_location: "Jinan", conference_location_zh: "济南", contact_email: "qa@example.test", cfp_enabled: "false" } }
  for (const locale of ["en", "zh"]) {
    const rows = api.getBrowsableFAQ(locale, published)
    assert.equal(rows.length, 7)
    assert.equal(rows.find(row => row.id === "custom:custom").question, locale === "zh" ? "午餐安排" : "Lunch arrangements")
    assert.equal(rows.find(row => row.id === "custom:custom").answer, content.faq.items[0].answer[locale])
    assert.match(rows.find(row => row.id === "builtin:venue").answer, locale === "zh" ? /待公布/ : /announced/)
    assert.match(rows.find(row => row.id === "builtin:cfp").answer, locale === "zh" ? /关闭/ : /closed/)
    assert.equal(rows.some(row => /hidden|empty/.test(row.id)), false)
  }
})
