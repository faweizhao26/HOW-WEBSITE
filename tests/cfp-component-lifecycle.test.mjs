import assert from "node:assert/strict"
import { test } from "node:test"
import { readFileSync } from "node:fs"
import vm from "node:vm"
import ts from "typescript"

const source = readFileSync(new URL("../src/app/cfp/page.tsx", import.meta.url), "utf8")
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText
const flush = () => new Promise(resolve => setImmediate(resolve))

// Execute the page's actual mount effects with a deferred read, without a DOM.
function mount() {
  const states = [], effects = []
  let listener, resolveLoad
  const load = new Promise(resolve => { resolveLoad = resolve })
  const react = {
    useState(value) {
      const slot = { value }; states.push(slot)
      return [value, next => { slot.value = typeof next === "function" ? next(slot.value) : next }]
    },
    useRef: current => ({ current }),
    useEffect: effect => effects.push(effect),
    startTransition: callback => callback(),
  }
  const modules = {
    react,
    "react/jsx-runtime": { jsx: () => null, jsxs: () => null },
    "@/lib/i18n/provider": { useLocale: () => "en" },
    "@/lib/i18n/translations": { common: { loading: { en: "Loading" } } },
    "@/lib/cfp/service": { loadCFPData: () => load },
    "@/lib/supabase/client": { createClient: () => ({ auth: {
      onAuthStateChange(callback) {
        listener = callback
        return { data: { subscription: { unsubscribe() { listener = null } } } }
      },
    } }) },
  }
  const context = { exports: {}, require: name => modules[name] ?? {} }
  vm.runInNewContext(js, context)
  context.exports.default()
  const cleanups = effects.map(effect => effect())
  return {
    // Slots follow data, loading, loadError, accountChanged in the page.
    state: () => ({ data: states[0].value, loading: states[1].value, changed: states[3].value }),
    event: (type, id) => listener(type, id === null ? null : { user: { id } }),
    resolve: id => resolveLoad({ user: id === null ? null : { id }, sessions: [] }),
    unmount: () => cleanups.forEach(cleanup => cleanup()),
  }
}

for (const first of ["INITIAL_SESSION", "SIGNED_IN", "TOKEN_REFRESHED"]) {
  test(`first ${first} establishes the CFP identity baseline`, async t => {
    const h = mount(); t.after(h.unmount)
    h.event(first, "A"); h.event("INITIAL_SESSION", "A")
    h.resolve("A"); await flush()
    assert.equal(h.state().data?.user?.id, "A")
    assert.equal(h.state().changed, false)
  })
}
for (const owners of [["A", "B"], ["A", "B", "A"]]) {
  test(`delayed CFP load is rejected after ${owners.join("-")}`, async t => {
    const h = mount(); t.after(h.unmount)
    h.event("INITIAL_SESSION", owners[0])
    for (const id of owners.slice(1)) h.event("SIGNED_IN", id)
    h.resolve("A"); await flush()
    assert.equal(h.state().data, null)
    assert.equal(h.state().changed, true)
    assert.equal(h.state().loading, false)
  })
}
test("late initial Auth event is checked against the loaded CFP owner", async t => {
  const h = mount(); t.after(h.unmount)
  h.resolve("A"); await flush(); h.event("INITIAL_SESSION", "B")
  assert.equal(h.state().data, null)
  assert.equal(h.state().changed, true)
})
test("unmounted CFP load cannot commit state", async () => {
  const h = mount(); h.unmount(); h.resolve("A"); await flush()
  assert.equal(h.state().data, null)
})
