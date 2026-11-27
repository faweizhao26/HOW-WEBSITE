import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import vm from "node:vm"
import { cloneElement, createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import * as jsxRuntime from "react/jsx-runtime"
import ts from "typescript"
import * as conference from "../src/lib/conference.ts"
import * as cfpSettings from "../src/lib/cfp/settings.ts"
import * as registrationSettings from "../src/lib/registration/settings.ts"
import * as translations from "../src/lib/i18n/translations.ts"
import { defaultSiteSettings } from "../src/lib/content/settings.ts"
import { contentText, parseSiteContent } from "../src/lib/content/site-content.ts"

const js = ts.transpileModule(readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText
const viewsJs = ts.transpileModule(readFileSync(new URL("../src/components/content/site-views.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText

async function render(sessions, locale = "en", overrides = {}, settingsStatus = "ready") {
  const block = ({ children, className, render }) => render ? cloneElement(render, { className }, children) : createElement("div", { className }, children)
  const modules = {
    "react/jsx-runtime": jsxRuntime,
    "next/link": { default: ({ children, href }) => createElement("a", { href }, children) },
    "next/image": { default: () => null },
    "next/headers": { cookies: async () => ({ get: () => ({ value: locale }) }) },
    "@/lib/i18n/utils": { getLocale: () => locale },
    "@/lib/seo/page-metadata": { pageMetadata: () => ({}) },
    "@/lib/i18n/translations": translations,
    "@/lib/conference": conference,
    "@/lib/cfp/settings": cfpSettings,
    "@/lib/registration/settings": registrationSettings,
    "@/lib/content/settings": { defaultSiteSettings },
    "@/lib/content/site-content": { contentText, parseSiteContent },
    "@/components/content/content-blocks": { ContentBlocks: () => null },
    "./outreach-views": { OutreachLinks: () => null, ProgressView: () => null, SponsorshipView: () => null },
    "./conference-faq": { ConferenceFAQ: () => null },
    "./past-conference-cards": { PastConferenceCards: () => null },
    "@/components/layout/how-2027-logo": { How2027Logo: () => "HOW 2027" },
    "@/lib/content/public": {
      getPublishedSettings: async () => settingsStatus === "ready"
        ? { status: "ready", data: { ...defaultSiteSettings, ...overrides } }
        : { status: settingsStatus },
      getPublishedSessions: async () => sessions,
    },
    "@/components/ui/button": { Button: block },
    "@/components/ui/badge": { Badge: block },
    "@/components/ui/card": { Card: block, CardContent: block },
    "@/components/countdown": { Countdown: () => null },
    "@/components/home/hero-motion": { HeroMotion: () => null },
    "lucide-react": Object.fromEntries(["CheckCircle", "ArrowRight", "Calendar", "MapPin", "Users", "Mic", "ExternalLink", "Megaphone"].map(name => [name, () => null])),
  }
  const viewContext = { exports: {}, require: name => { assert.ok(name in modules, `Unexpected view dependency: ${name}`); return modules[name] } }
  vm.runInNewContext(viewsJs, viewContext)
  modules["@/components/content/site-views"] = viewContext.exports
  const context = { exports: {}, require: name => { assert.ok(name in modules, `Unexpected dependency: ${name}`); return modules[name] } }
  vm.runInNewContext(js, context)
  return renderToStaticMarkup(await context.exports.default())
}

test("home reports actual published session count, not prototype numbers", async () => {
  const html = await render({ status: "ready", data: Array.from({ length: 7 }, (_, index) => ({ id: String(index) })) })
  assert.match(html, />7<\/div><div[^>]*>Published Sessions<\/div>/)
  assert.doesNotMatch(html, />18<\/div>|500\+/)
})

test("home marks unpublished program and attendance as pending in both languages", async () => {
  for (const [locale, pending] of [["en", "TBA"], ["zh", "待公布"]]) {
    const html = await render({ status: "empty" }, locale)
    const labels = locale === "zh" ? ["已公布演讲", "参会规模"] : ["Published Sessions", "Attendance"]
    for (const label of labels) assert.match(html, new RegExp(`>${pending}</div><div[^>]*>${label}</div>`))
    assert.doesNotMatch(html, />18<\/div>|500\+/)
  }
})

test("home distinguishes unavailable sessions from an unpublished program", async () => {
  const html = await render({ status: "error", message: "read failed" })
  assert.match(html, /Unavailable/)
  assert.doesNotMatch(html, />0<\/div>|>18<\/div>/)
})

test("home announces open CFP before the conference hero and links to guest submissions", async () => {
  const en = await render({ status: "empty" }, "en", { cfp_deadline: "2099-04-01" })
  assert.match(en, /Call for Proposals is open[\s\S]*?<time date[Tt]ime="2099-04-01T23:59:59\+08:00">April 1, 2099 23:59 \(UTC\+8\)<\/time>[\s\S]*?<a href="\/cfp">Submit a proposal/)
  assert.ok(en.indexOf("Call for Proposals is open") < en.indexOf("<h1"))
  const zh = await render({ status: "empty" }, "zh")
  assert.match(zh, /演讲征稿已开启[\s\S]*?无需注册或登录[\s\S]*?<a href="\/cfp">提交议题/)
  assert.doesNotMatch(zh, /<time datetime=/i)
})

test("home omits the submission announcement when CFP is closed, expired, invalid, or unpublished", async () => {
  for (const overrides of [{ cfp_enabled: "false" }, { cfp_deadline: "2000-04-01" }, { cfp_deadline: "invalid" }]) {
    assert.doesNotMatch(await render({ status: "empty" }, "en", overrides), /Call for Proposals is open/)
  }
  assert.doesNotMatch(await render({ status: "empty" }, "en", {}, "empty"), /Call for Proposals is open/)
})

test("homepage registration follows published methods without hiding the schedule or CFP", async () => {
  const sessions = { status: "empty" }
  const options = { registration_onsite_enabled: "false", registration_external_enabled: "true", register_url: "https://example.com/event" }
  const external = await render(sessions, "zh", options)
  assert.match(external, /href="https:\/\/example\.com\/event"[^>]*>立即报名/)
  assert.doesNotMatch(external, /href="\/register"/)
  const closed = await render(sessions, "zh", { ...options, registration_external_enabled: "false" })
  assert.doesNotMatch(closed, /立即报名|href="\/register"/)
  assert.match(closed, /href="\/schedule"/)
  assert.match(closed, /href="\/cfp"/)
})
