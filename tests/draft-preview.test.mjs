import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, resolve, extname } from "node:path"
import { fileURLToPath } from "node:url"
import { test } from "node:test"
import vm from "node:vm"
import ts from "typescript"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { defaultSiteSettings } from "../src/lib/content/settings.ts"
import { parseSiteContent } from "../src/lib/content/site-content.ts"

const root = fileURLToPath(new URL("../", import.meta.url))
const require = createRequire(import.meta.url)
function loader(overrides = {}, globals = {}) {
  const cache = new Map()
  function load(name, from = root) {
    if (name in overrides) return overrides[name]
    if (!name.startsWith("@/") && !name.startsWith(".")) {
      assert.notEqual(name, "server-only", "Views must remain client-safe")
      assert.notEqual(name, "next/headers", "Views must not read request cookies")
      return require(name)
    }
    let path = name.startsWith("@/") ? resolve(root, "src", name.slice(2)) : resolve(from, name)
    if (!extname(path)) path = [".tsx", ".ts"].map(extension => path + extension).find(existsSync) || path
    if (cache.has(path)) return cache.get(path)
    const output = ts.transpileModule(readFileSync(path, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText
    const compiled = { exports: {} }
    cache.set(path, compiled.exports)
    vm.runInNewContext(output, { module: compiled, exports: compiled.exports, require: child => load(child, dirname(path)), console, URL, structuredClone, setTimeout, clearTimeout, ...globals })
    return compiled.exports
  }
  return load
}

function hookHarness() {
  const states = [], refs = [], previousEffects = [], pending = []
  let stateIndex = 0, refIndex = 0, effectIndex = 0
  return {
    react: {
      useState(initial) {
        const index = stateIndex++
        if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial
        return [states[index], next => { states[index] = typeof next === "function" ? next(states[index]) : next }]
      },
      useRef(initial) { return refs[refIndex++] ??= { current: initial } },
      useCallback(callback) { return callback },
      useEffect(effect, dependencies) {
        const index = effectIndex++
        const previous = previousEffects[index]
        if (!previous || dependencies.some((value, i) => value !== previous.dependencies[i])) {
          pending.push(() => { previous?.cleanup?.(); previousEffects[index] = { dependencies, cleanup: effect() } })
        }
      },
    },
    render(Component, props) { stateIndex = refIndex = effectIndex = 0; return Component(props) },
    renderChild(Component, props) { stateIndex = 1; return Component(props) },
    flush() { pending.splice(0).forEach(effect => effect()) },
    unmount() { previousEffects.forEach(effect => effect.cleanup?.()) },
  }
}

function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  return tree && typeof tree === "object" ? [tree, ...nodes(tree.props?.children)] : []
}

function previewWindow() {
  const listeners = new Map(), messages = []
  const parent = { postMessage: (message, origin) => messages.push({ message, origin }) }
  const classes = new Set(["dark"])
  const document = { documentElement: { lang: "en", classList: { contains: value => classes.has(value), remove: (...values) => values.forEach(value => classes.delete(value)), add: value => classes.add(value) } } }
  const window = {
    parent, location: { origin: "https://how.example" },
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: (name, callback) => { if (listeners.get(name) === callback) listeners.delete(name) },
  }
  return { window, document, messages, classes, listeners }
}

test("shared views render real draft content and draft-specific contacts", () => {
  const { HomeView, SitePageView, VenueView, SponsorsView } = loader()("@/components/content/site-views")
  const content = structuredClone(parseSiteContent(defaultSiteSettings))
  content.pages.about.title = { en: "Draft about", zh: "草稿介绍" }
  content.contacts.sponsor = "draft-sponsor@example.com"
  content.contacts.report = "draft-report@example.com"
  content.venue.confirmed = true
  content.venue.name = { en: "Draft venue", zh: "草稿会场" }
  content.venue.address = { en: "Draft address", zh: "草稿地址" }
  const settings = { ...defaultSiteSettings, hero_title: "Draft hero", contact_email: "draft-contact@example.com" }
  const render = (view, props) => renderToStaticMarkup(createElement(view, { settings, content, locale: "en", ...props }))
  const home = render(HomeView, { sessions: { status: "ready", data: [{ id: "published-one" }] } })
  assert.match(home, /Draft hero/)
  assert.match(home, /<canvas/)
  assert.match(home, />1<\/div><div[^>]*>Published Sessions<\/div>/)
  assert.match(render(SitePageView, { page: "about" }), /Draft about/)
  assert.match(render(SitePageView, { page: "about", locale: "zh" }), /草稿介绍/)
  assert.match(render(SitePageView, { page: "privacy" }), /mailto:draft-contact@example.com/)
  assert.match(render(SitePageView, { page: "conduct" }), /mailto:draft-report@example.com/)
  assert.match(render(VenueView), /Draft venue/)
  const sponsors = render(SponsorsView, { sponsors: { status: "empty" } })
  assert.match(sponsors, /draft-sponsor@example.com/)
  assert.doesNotMatch(sponsors, /faweizhao26@gmail.com/)
})

test("preview message guard requires parent, same origin, exact type and valid settings", () => {
  const { readSettingsPreviewMessage } = loader()("@/components/admin/settings-preview-frame")
  const parent = {}, origin = "https://how.example"
  const data = { type: "how-settings-preview", settings: defaultSiteSettings, locale: "en", page: "home", theme: "light" }
  const event = { source: parent, origin, data }
  assert.equal(readSettingsPreviewMessage(event, parent, origin)?.page, "home")
  for (const change of [
    { source: {} }, { origin: "https://other.example" }, { data: null },
    { data: { ...data, type: "other" } }, { data: { ...data, page: "register" } },
    { data: { ...data, locale: "fr" } }, { data: { ...data, theme: "system" } },
    { data: { ...data, settings: { ...defaultSiteSettings, hero_title: 12 } } },
    { data: { ...data, settings: { ...defaultSiteSettings, contact_email: "invalid-email" } } },
    { data: { ...data, settings: { ...defaultSiteSettings, site_content: "broken" } } },
    { data: { ...data, settings: [] } }, { data: { ...data, settings: {} } },
  ]) assert.equal(readSettingsPreviewMessage({ ...event, ...change }, parent, origin), null)
})

test("preview route authorizes before private reads and never reads a published settings release", async () => {
  const calls = []
  const load = loader({
    "next/headers": { cookies: async () => { calls.push("cookies"); throw Error("unexpected") } },
    "@/lib/auth/require-admin": { requireAdmin: async () => { calls.push("auth"); throw Error("denied") } },
    "next/navigation": { notFound: () => { throw Error("not-found") } },
    "@/lib/supabase/server": { createServerSupabase: async () => { calls.push("private-read"); throw Error("unexpected") } },
    "@/lib/content/public": { getPublishedSessions: () => { calls.push("sessions") }, getPublishedSponsors: () => { calls.push("sponsors") } },
    "@/components/admin/settings-preview-frame": { SettingsPreviewFrame: () => null },
  })
  const { default: PreviewPage } = load("@/app/admin/preview/page")
  await assert.rejects(PreviewPage(), /not-found/)
  assert.deepEqual(calls, ["auth"])
  const source = readFileSync(resolve(root, "src/app/admin/preview/page.tsx"), "utf8")
  assert.match(source, /\.from\("site_settings"\)/)
  assert.doesNotMatch(source, /getPublishedSettings|site_settings_releases|\.insert\(|\.update\(|\.upsert\(/)
})

test("authorized preview route passes saved settings and real published data without writes", async () => {
  const calls = [], settings = { ...defaultSiteSettings, hero_title: "Saved admin draft" }
  const sessions = { status: "ready", data: [{ id: "published-session" }] }, sponsors = { status: "empty" }
  const load = loader({
    "next/headers": { cookies: async () => ({ get: key => ({ value: key === "lang" ? "zh" : "light" }) }) },
    "@/lib/auth/require-admin": { requireAdmin: async () => { calls.push("auth") } },
    "next/navigation": { notFound: () => { throw Error("unexpected") } },
    "@/lib/supabase/server": {
      createServerSupabase: async () => ({
        from(table) {
          calls.push(table)
          return {
            select(fields) {
              assert.equal(fields, "key,value")
              return Promise.resolve({ data: Object.entries(settings).map(([key, value]) => ({ key, value })), error: null })
            },
          }
        },
      }),
    },
    "@/lib/content/public": { getPublishedSessions: async () => sessions, getPublishedSponsors: async () => sponsors },
    "@/components/admin/settings-preview-frame": { SettingsPreviewFrame: () => null },
  })
  const tree = await load("@/app/admin/preview/page").default()
  assert.deepEqual(calls, ["auth", "site_settings"])
  assert.deepEqual({ ...tree.props.settings }, settings)
  assert.equal(tree.props.sessions, sessions)
  assert.equal(tree.props.sponsors, sponsors)
  assert.equal(tree.props.locale, "zh")
  assert.equal(tree.props.theme, "light")
})

test("controlled dialog sends only to its iframe and uses actual desktop/mobile widths", () => {
  const h = hookHarness(), env = previewWindow(), sent = []
  const primitive = ({ children }) => createElement("div", null, children)
  const { SettingsPreview } = loader({
    react: h.react,
    "@/components/ui/dialog": { Dialog: primitive, DialogContent: primitive, DialogHeader: primitive, DialogTitle: primitive },
    "@/components/ui/button": { Button: ({ children, ...props }) => createElement("button", props, children) },
  }, env)("@/components/admin/settings-preview")
  const props = { open: true, onOpenChange() {}, settings: defaultSiteSettings, locale: "en" }
  let tree = h.render(SettingsPreview, props)
  const iframe = nodes(tree).find(node => node.type === "iframe")
  const child = { postMessage: (message, origin) => sent.push({ message, origin }) }
  iframe.props.ref.current = { contentWindow: child }
  h.flush()
  assert.equal(iframe.props.src, "/admin/preview")
  assert.equal(iframe.props.style.width, 1120)
  assert.match(iframe.props.className, /max-w-full/)
  iframe.props.onLoad()
  assert.equal(sent.length, 2)
  assert.equal(sent[0].origin, env.window.location.origin)
  assert.equal(sent[0].message.settings, defaultSiteSettings)
  assert.equal(sent[0].message.type, "how-settings-preview")
  const ready = env.listeners.get("message")
  ready({ source: {}, origin: env.window.location.origin, data: { type: "how-settings-preview-ready" } })
  ready({ source: child, origin: "https://other.example", data: { type: "how-settings-preview-ready" } })
  assert.equal(sent.length, 2)
  ready({ source: child, origin: env.window.location.origin, data: { type: "how-settings-preview-ready" } })
  assert.equal(sent.length, 3)
  const selects = nodes(tree).filter(node => node.type === "select")
  assert.equal(nodes(selects[0]).filter(node => node.type === "option").length, 9)
  selects[0].props.onChange({ target: { value: "privacy" } })
  selects[1].props.onChange({ target: { value: "zh" } })
  selects[2].props.onChange({ target: { value: "dark" } })
  nodes(tree).find(node => node.props?.["aria-label"] === "Mobile view").props.onClick()
  tree = h.render(SettingsPreview, props)
  h.flush()
  assert.equal(sent.at(-1).message.page, "privacy")
  assert.equal(sent.at(-1).message.locale, "zh")
  assert.equal(sent.at(-1).message.theme, "dark")
  const html = renderToStaticMarkup(tree)
  assert.match(html, /width:390px/)
  assert.doesNotMatch(html, /scale\(|Draft preview<\/button>/)
  assert.equal(nodes(tree).find(node => node.type === "iframe").props.style.width, 390)
  h.unmount()
  assert.equal(env.listeners.size, 0)
})

test("iframe handshake renders all nine real draft views, blocks links, and keeps page headers", () => {
  const h = hookHarness(), env = previewWindow()
  const real = loader()
  class Element { closest() { return {} } }
  const { SettingsPreviewFrame } = loader({
    react: h.react,
    "@/components/content/site-views": real("@/components/content/site-views"),
    "@/components/content/content-blocks": real("@/components/content/content-blocks"),
    "@/lib/i18n/provider": real("@/lib/i18n/provider"),
  }, { ...env, Element })("@/components/admin/settings-preview-frame")
  const content = parseSiteContent(defaultSiteSettings)
  content.pages.about.title = { en: "Draft about", zh: "草稿介绍" }
  const settings = { ...defaultSiteSettings, hero_title: "Unsaved hero", contact_email: "unsaved@example.com", site_content: JSON.stringify(content), cfp_intro: "Draft CFP policy" }
  const props = { settings: null, locale: "en", theme: "dark", sessions: { status: "empty" }, sponsors: { status: "empty" } }
  const render = () => h.render(SettingsPreviewFrame, props)
  let tree = render()
  assert.match(renderToStaticMarkup(tree), /Draft preview unavailable/)
  h.flush()
  assert.equal(env.messages[0].message.type, "how-settings-preview-ready")
  assert.equal(env.messages[0].origin, env.window.location.origin)
  const receive = env.listeners.get("message")
  const setPage = page => receive({ source: env.window.parent, origin: env.window.location.origin, data: { type: "how-settings-preview", settings, locale: "en", theme: "light", page } })
  for (const [page, expected] of [["home", /Unsaved hero/], ["about", /Draft about/], ["attend", /Attend HOW 2027/], ["venue", /Venue/], ["sponsors", /Sponsors/], ["privacy", /Privacy Policy/], ["conduct", /Code of Conduct/], ["cfp", /Draft CFP policy/], ["faq", /FAQ/]]) {
    setPage(page)
    tree = render()
    h.flush()
    const html = renderToStaticMarkup(tree)
    assert.match(html, expected)
    assert.match(html, /data-settings-preview/)
    assert.doesNotMatch(html, /faweizhao26@gmail.com/)
    if (page === "about") {
      assert.match(html, /<header[^>]*>.*Draft about/s)
      assert.match(html, /body:has\(\[data-settings-preview\]\) > header/)
    }
    if (page === "cfp") assert.doesNotMatch(html, /<form|type="submit"/)
  }
  // The FAQ owns local question state; resolve that child without fetching public data.
  const faqElement = nodes(tree).find(node => typeof node.type === "function" && node.type.name === "FAQPreview")
  assert.ok(faqElement)
  const faqTree = h.renderChild(faqElement.type, faqElement.props)
  nodes(faqTree).find(node => node.type === "button" && node.props.children === "Contact email").props.onClick()
  tree = render()
  assert.match(renderToStaticMarkup(tree), /For conference questions, contact unsaved@example.com/)
  receive({ source: env.window.parent, origin: env.window.location.origin, data: { type: "how-settings-preview", settings: { ...settings, site_content: "broken" }, locale: "en", theme: "dark", page: "home" } })
  assert.match(renderToStaticMarkup(render()), /FAQ/)
  let blocked = 0
  tree.props.onClickCapture({ target: new Element(), preventDefault: () => blocked++, stopPropagation: () => blocked++ })
  assert.equal(blocked, 2)
  assert.equal(env.classes.has("light"), true)
  h.unmount()
  assert.equal(env.listeners.size, 0)
  assert.equal(env.classes.has("dark"), true)
})

test("CFP preview matches public English-only fallback for partial translations", () => {
  const h = hookHarness(), env = previewWindow(), real = loader()
  const { SettingsPreviewFrame } = loader({ react: h.react,
    "@/components/content/site-views": real("@/components/content/site-views"),
    "@/components/content/content-blocks": real("@/components/content/content-blocks"),
    "@/lib/i18n/provider": real("@/lib/i18n/provider"),
    "@/components/ui/badge": { Badge: props => createElement("span", props) },
  }, env)("@/components/admin/settings-preview-frame")
  const props = { settings: defaultSiteSettings, locale: "en", theme: "light", sessions: { status: "empty" }, sponsors: { status: "empty" } }
  h.render(SettingsPreviewFrame, props); h.flush()
  const settings = { ...defaultSiteSettings, cfp_intro: "", cfp_intro_zh: "中文说明专用", cfp_requirements: "", cfp_requirements_zh: "中文要求专用", cfp_review_notes: "", cfp_review_notes_zh: "中文审核专用" }
  const receive = locale => env.listeners.get("message")({ source: env.window.parent, origin: env.window.location.origin, data: { type: "how-settings-preview", settings, locale, theme: "light", page: "cfp" } })
  receive("en")
  assert.doesNotMatch(renderToStaticMarkup(h.render(SettingsPreviewFrame, props)), /中文说明专用|中文要求专用|中文审核专用/)
  receive("zh")
  assert.match(renderToStaticMarkup(h.render(SettingsPreviewFrame, props)), /中文说明专用/)
  settings.cfp_intro = "English fallback"
  settings.cfp_intro_zh = ""
  receive("zh")
  assert.match(renderToStaticMarkup(h.render(SettingsPreviewFrame, props)), /English fallback/)
  h.unmount()
})

test("leave approval is single-use even when query navigation preserves the settings component", () => {
  const h = hookHarness(), listeners = new Map(), pushes = []
  class Element {
    closest() { return { href: "https://how.example/admin/settings", target: "", hasAttribute: () => false } }
  }
  const ui = Object.fromEntries(["AlertDialog", "AlertDialogAction", "AlertDialogCancel", "AlertDialogContent", "AlertDialogDescription", "AlertDialogFooter", "AlertDialogHeader", "AlertDialogTitle"].map(name => [name, name]))
  const { UnsavedSettingsGuard } = loader({ react: h.react,
    "next/navigation": { useRouter: () => ({ push: href => pushes.push(href) }) },
    "@/components/ui/alert-dialog": ui,
  }, { Element, location: { origin: "https://how.example", pathname: "/admin/settings", search: "?x=1" },
    window: { addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: name => listeners.delete(name) },
    document: { addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: name => listeners.delete(name) },
  })("@/components/admin/unsaved-settings-guard")
  const props = { active: true, locale: "en" }
  h.render(UnsavedSettingsGuard, props); h.flush()
  let blocked = 0
  const click = () => listeners.get("click")({ target: new Element(), button: 0, preventDefault: () => blocked++, stopPropagation() {} })
  click()
  let tree = h.render(UnsavedSettingsGuard, props)
  nodes(tree).find(node => node.type === "AlertDialogAction").props.onClick()
  assert.deepEqual(pushes, ["/admin/settings"])
  tree = h.render(UnsavedSettingsGuard, props); h.flush()
  assert.equal(tree.props.open, false)
  click()
  assert.equal(blocked, 2, "The next link must still be guarded")
  let prevented = false
  listeners.get("beforeunload")({ preventDefault: () => { prevented = true } })
  assert.equal(prevented, true, "Refresh remains guarded after query-only navigation")
  h.render(UnsavedSettingsGuard, { ...props, active: false }); h.flush()
  assert.equal(listeners.size, 0)
})

test("public wrappers delegate their published content to shared views", () => {
  for (const [page, view] of [["", "HomeView"], ["about", "SitePageView"], ["attend", "SitePageView"], ["venue", "VenueView"], ["sponsors", "SponsorsView"], ["privacy", "SitePageView"], ["code-of-conduct", "SitePageView"]]) {
    const source = readFileSync(resolve(root, "src/app", page, "page.tsx"), "utf8")
    assert.match(source, /getPublished(?:Settings|SiteContent)/)
    assert.match(source, new RegExp(`<${view} `))
    assert.doesNotMatch(source, /site_settings"|how-settings-preview/)
  }
  const layout = readFileSync(resolve(root, "src/app/admin/layout.tsx"), "utf8")
  assert.ok(layout.indexOf('if (!authorized) return null') < layout.indexOf('if (pathname === "/admin/preview")'))
})
