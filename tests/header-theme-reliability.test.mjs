import assert from "node:assert/strict"
import { test } from "node:test"
import { component, environment, nodes } from "./helpers/ui-reliability-harness.mjs"

function header(env, user = { id: "member" }, locale = "en", auth = {}) {
  return component("../../src/components/layout/header.tsx", "Header", { locale, initialTheme: "dark" }, env, {
    "next/link": { default: "Link" }, "next/navigation": { usePathname: () => "/", useRouter: () => ({ replace: path => env.window.location.assign(path), refresh() {} }) },
    "@/lib/supabase/client": { createClient: () => ({ auth }) },
    sonner: { toast: { error() {} } },
    "@/lib/auth/watch-navigation-user": { watchNavigationUser(_client, receive) { receive({ user, isAdmin: false }); return () => {} } },
    "@/lib/i18n/translations": { navigation: new Proxy({}, { get: () => ({ zh: "Menu", en: "Menu" }) }) },
    "./language-switcher": { LanguageSwitcher: "LanguageSwitcher" }, "./theme-toggle": { ThemeToggle: "ThemeToggle" },
    "@/components/ui/button": { Button: "Button" }, "@/lib/utils": { isMockMode: () => false },
  })
}

test("navigation logout invokes the browser SDK so other tabs receive signed-out events", async () => {
  let requests = 0, prevented = 0
  const destinations = [], env = environment()
  env.window.location = { assign: path => destinations.push(path) }
  const h = header(env, { id: "member" }, "en", { signOut: async () => { requests++; return { error: null } } })
  const form = nodes(h.tree()).find(node => node.type === "form" && node.props.action === "/auth/signout")
  assert.equal(typeof form.props.onSubmit, "function", "Cookie-only form logout cannot notify other tabs")
  await form.props.onSubmit({ preventDefault() { prevented++ } })
  assert.equal(requests, 1); assert.equal(prevented, 1); assert.deepEqual(destinations, ["/"])
  h.unmount()
})
const trigger = h => nodes(h.tree()).find(node => /^(Open|Close|打开|关闭)/.test(node.props?.["aria-label"] ?? ""))
const open = h => { trigger(h).props.onClick(); h.flush() }
const panel = h => nodes(h.tree()).find(node => node.props?.className?.includes("max-h-[calc(100dvh"))
const click = (h, node, overrides = {}) => {
  const event = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false, currentTarget: { target: "" }, preventDefault() { this.defaultPrevented = true }, ...overrides }
  node.props.onClick?.(event)
  if (!event.defaultPrevented && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) node.props.onNavigate?.({ preventDefault() { throw new Error("Navigation must remain native") } })
  h.flush()
  return event
}

test("mobile menu exposes Profile only to signed-in users in both languages", () => {
  for (const locale of ["zh", "en"]) for (const user of [null, { id: "member" }]) {
    const env = environment(), h = header(env, user, locale)
    open(h)
    const profile = nodes(panel(h)).find(node => node.props?.href === "/profile")
    assert.equal(Boolean(profile), Boolean(user))
    if (user) assert.equal(profile.props.children, locale === "zh" ? "个人中心" : "Profile")
    h.unmount()
  }
})

test("menu reports expansion, Escape closes it and restores trigger focus", () => {
  const env = environment(), h = header(env)
  assert.equal(trigger(h).props["aria-expanded"], false)
  open(h)
  assert.equal(trigger(h).props["aria-expanded"], true)
  assert.equal(trigger(h).props["aria-controls"], panel(h).props.id)
  env.document.activeElement = { name: "menu link" }
  let prevented = false
  h.tree().props.onKeyDown?.({ key: "Escape", preventDefault() { prevented = true } })
  h.flush()
  assert.equal(panel(h), undefined)
  assert.equal(trigger(h).props["aria-expanded"], false)
  assert.equal(env.document.activeElement?.props["aria-controls"], trigger(h).props["aria-controls"])
  assert.equal(prevented, true)
  h.unmount()
})

test("mobile links close for normal navigation, not modified or prevented clicks", () => {
  const env = environment(), h = header(env)
  for (const overrides of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }, { defaultPrevented: true }]) {
    open(h)
    const about = nodes(panel(h)).find(node => node.props?.href === "/about")
    click(h, about, overrides)
    assert.ok(panel(h), `Menu closed on ${JSON.stringify(overrides)}`)
    trigger(h).props.onClick(); h.flush()
  }
  for (const href of ["/about", "/profile", "/cfp"]) {
    open(h)
    click(h, nodes(panel(h)).find(node => node.props?.href === href))
    assert.equal(panel(h), undefined, `${href} must close the menu`)
  }
  h.unmount()
})

const toggle = (env, initialTheme = "dark") => component("../../src/components/layout/theme-toggle.tsx", "ThemeToggle", { initialTheme }, env)
const label = h => h.tree().props["aria-label"]
function settle(env, ...controls) { env.flushMutations(); controls.forEach(control => control.flush()) }

test("desktop and remounted mobile theme controls share current theme across refresh", () => {
  const env = environment(), desktop = toggle(env)
  desktop.tree().props.onClick(); settle(env, desktop)
  assert.equal(label(desktop), "Switch to night mode")
  const mobile = toggle(env, "dark")
  assert.equal(label(mobile), "Switch to night mode", "Remount must not reuse the stale server theme")
  mobile.tree().props.onClick(); settle(env, desktop, mobile)
  assert.equal(env.document.documentElement.classList.contains("dark"), true)
  assert.equal(label(desktop), "Switch to day mode")
  desktop.tree().props.onClick(); settle(env, desktop, mobile)
  assert.equal(label(mobile), "Switch to night mode", "Mounted hidden controls must update too")
  desktop.update({ initialTheme: "dark" }); mobile.update({ initialTheme: "dark" })
  assert.equal(label(mobile), "Switch to night mode", "Language refresh must not reset current theme")
  mobile.unmount()
  const reopened = toggle(env, "dark")
  assert.equal(label(reopened), "Switch to night mode")
  reopened.tree().props.onClick(); settle(env, desktop, reopened)
  assert.equal(env.storage.get("theme"), "dark")
  assert.match(env.document.cookie, /^theme=dark;/)
  assert.equal(label(desktop), "Switch to day mode")
  desktop.unmount(); reopened.unmount()
  assert.equal(env.observers.size, 0)
})

test("theme click reads the current root even before observer notification", () => {
  const env = environment(), h = toggle(env)
  env.document.documentElement.classList.toggle("dark", false)
  env.document.documentElement.classList.toggle("light", true)
  h.tree().props.onClick()
  assert.equal(env.document.documentElement.classList.contains("dark"), true)
  h.unmount()
})
