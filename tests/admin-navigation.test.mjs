import assert from "node:assert/strict"
import { test } from "node:test"
import { existsSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import vm from "node:vm"
import ts from "typescript"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"

const moduleURL = new URL("../src/lib/auth/watch-navigation-user.ts", import.meta.url)
const load = async () => {
  assert.ok(existsSync(moduleURL), "Navigation must resolve the signed-in user's trusted profile role")
  return (await import(moduleURL.href)).watchNavigationUser
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0))
function fixture() {
  let listener, resolveInitial, inCallback = false, unsubscribed = false
  const initial = new Promise(resolve => { resolveInitial = resolve })
  const values = [], requests = []
  return {
    client: {
      auth: {
        getUser: () => initial,
        onAuthStateChange(callback) { listener = callback; return { data: { subscription: { unsubscribe() { unsubscribed = true } } } } },
      },
      from(table) {
        assert.equal(inCallback, false, "Do not query Supabase inside its locked Auth callback")
        assert.equal(table, "profiles")
        return { select(columns) {
          assert.equal(columns, "role")
          return { eq(key, id) {
            assert.equal(key, "id")
            return { single() { return new Promise((resolve, reject) => requests.push({ id, resolve, reject })) } }
          } }
        } }
      },
    },
    initial(user) { resolveInitial({ data: { user } }) },
    emit(user) { inCallback = true; listener(user ? "SIGNED_IN" : "SIGNED_OUT", user ? { user } : null); inCallback = false },
    values, requests, receive: value => values.push(value), unsubscribed: () => unsubscribed,
  }
}

test("only a confirmed admin profile enables navigation, never user metadata", async () => {
  const watch = await load()
  for (const role of ["admin", "user", "program", null]) {
    const f = fixture(), user = { id: "a", user_metadata: { role: "admin" }, app_metadata: { role: "admin" } }
    const stop = watch(f.client, f.receive)
    f.initial(user)
    await Promise.resolve()
    assert.deepEqual(f.values.at(-1), { user, isAdmin: false })
    await tick()
    assert.equal(f.requests[0].id, user.id)
    f.requests[0].resolve({ data: role ? { role } : null, error: null })
    await tick()
    assert.equal(f.values.at(-1).isAdmin, role === "admin")
    stop()
  }
})

test("sign-out immediately hides admin navigation and ignores a late profile response", async () => {
  const watch = await load(), f = fixture()
  const stop = watch(f.client, f.receive)
  f.emit({ id: "a" })
  await tick()
  f.emit(null)
  assert.deepEqual(f.values.at(-1), { user: null, isAdmin: false })
  f.requests[0].resolve({ data: { role: "admin" }, error: null })
  await tick()
  assert.deepEqual(f.values.at(-1), { user: null, isAdmin: false })
  stop()
})

test("revalidating the same account keeps the confirmed entry stable, but a failed refresh hides it", async () => {
  const watch = await load(), f = fixture(), user = { id: "a" }
  const stop = watch(f.client, f.receive)
  f.emit(user); await tick()
  f.requests[0].resolve({ data: { role: "admin" }, error: null }); await tick()
  assert.equal(f.values.at(-1).isAdmin, true)
  f.emit({ ...user })
  assert.equal(f.values.at(-1).isAdmin, true, "Auth refocus must not move the link while it is being clicked")
  await tick()
  f.requests[1].reject(new Error("offline")); await tick()
  assert.equal(f.values.at(-1).isAdmin, false)
  stop()
})

test("A-B-A account changes reject old role responses even when the account id matches again", async () => {
  const watch = await load(), f = fixture()
  const stop = watch(f.client, f.receive)
  for (const id of ["a", "b", "a"]) { f.emit({ id }); await tick() }
  f.requests[2].resolve({ data: { role: "user" }, error: null })
  f.requests[1].resolve({ data: { role: "admin" }, error: null })
  f.requests[0].resolve({ data: { role: "admin" }, error: null })
  await tick()
  assert.deepEqual(f.values.at(-1), { user: { id: "a" }, isAdmin: false })
  assert.equal(f.values.some(value => value.isAdmin), false)
  stop()
})

test("failed role reads and unmounted watchers cannot expose the admin entry", async () => {
  const watch = await load(), f = fixture()
  const stop = watch(f.client, f.receive)
  f.emit({ id: "a" }); await tick()
  f.requests[0].resolve({ data: { role: "admin" }, error: { message: "denied" } })
  await tick()
  assert.equal(f.values.at(-1).isAdmin, false)
  f.emit({ id: "a" }); await tick()
  f.requests[1].reject(new Error("offline"))
  await tick()
  assert.equal(f.values.at(-1).isAdmin, false)
  f.emit({ id: "a" }); await tick()
  stop()
  const count = f.values.length
  f.requests[2].resolve({ data: { role: "admin" }, error: null })
  f.emit(null)
  f.initial({ id: "late" })
  await tick()
  assert.equal(f.values.length, count)
  assert.equal(f.unsubscribed(), true)
})

test("desktop and mobile headers show an admin link only for a confirmed admin", () => {
  const require = createRequire(import.meta.url)
  const source = readFileSync(new URL("../src/components/layout/header.tsx", import.meta.url), "utf8")
  const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  for (const locale of ["en", "zh"]) for (const navigation of [
    { user: null, isAdmin: false }, { user: { id: "user", user_metadata: { role: "admin" } }, isAdmin: false },
    { user: { id: "admin" }, isAdmin: true },
  ]) {
    const compiled = { exports: {} }
    const overrides = {
      react: { ...React, useEffect() {}, useState: initial => [typeof initial === "boolean" ? true : navigation, () => {}] },
      "next/link": { __esModule: true, default: props => React.createElement("a", props) },
      "next/navigation": { usePathname: () => "/", useRouter: () => ({ replace() {}, refresh() {} }) },
      "@/lib/supabase/client": {}, "@/lib/auth/watch-auth-user": {}, "@/lib/auth/watch-navigation-user": {},
      "@/lib/i18n/translations": { navigation: new Proxy({}, { get: () => ({ en: "Menu", zh: "菜单" }) }) },
      "./language-switcher": { LanguageSwitcher: () => null }, "./theme-toggle": { ThemeToggle: () => null },
      "@/components/ui/button": { Button: props => React.createElement("button", props) }, "@/lib/utils": {},
    }
    vm.runInNewContext(javascript, { module: compiled, exports: compiled.exports, require: name => name in overrides ? overrides[name] : require(name) })
    const html = renderToStaticMarkup(React.createElement(compiled.exports.Header, { locale, initialTheme: "light" }))
    assert.equal([...html.matchAll(/href="\/admin"/g)].length, navigation.isAdmin ? 2 : 0)
    if (navigation.isAdmin) assert.match(html, new RegExp(locale === "zh" ? "管理后台" : "Admin"))
  }
})
