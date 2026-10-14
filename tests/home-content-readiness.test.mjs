import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import vm from "node:vm"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import * as jsxRuntime from "react/jsx-runtime"
import ts from "typescript"
import * as conference from "../src/lib/conference.ts"
import * as translations from "../src/lib/i18n/translations.ts"
import { defaultSiteSettings } from "../src/lib/content/settings.ts"
import { contentText, parseSiteContent } from "../src/lib/content/site-content.ts"

const js = ts.transpileModule(readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText

async function render(sessions, locale = "en") {
  const block = ({ children, className }) => createElement("div", { className }, children)
  const modules = {
    "react/jsx-runtime": jsxRuntime,
    "next/link": { default: ({ children, href }) => createElement("a", { href }, children) },
    "next/headers": { cookies: async () => ({ get: () => ({ value: locale }) }) },
    "@/lib/i18n/utils": { getLocale: () => locale },
    "@/lib/i18n/translations": translations,
    "@/lib/conference": conference,
    "@/lib/content/settings": { defaultSiteSettings },
    "@/lib/content/site-content": { contentText, parseSiteContent },
    "@/components/content/content-blocks": { ContentBlocks: () => null },
    "@/lib/content/public": {
      getPublishedSettings: async () => ({ status: "ready", data: defaultSiteSettings }),
      getPublishedSessions: async () => sessions,
    },
    "@/components/ui/button": { Button: block },
    "@/components/ui/badge": { Badge: block },
    "@/components/ui/card": { Card: block, CardContent: block },
    "@/components/countdown": { Countdown: () => null },
    "@/components/home/hero-motion": { HeroMotion: () => null },
    "lucide-react": Object.fromEntries(["CheckCircle", "ArrowRight", "Calendar", "MapPin", "Users", "Mic"].map(name => [name, () => null])),
  }
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
