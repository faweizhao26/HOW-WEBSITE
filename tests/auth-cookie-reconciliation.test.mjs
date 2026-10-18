import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import vm from "node:vm"
import ts from "typescript"
import { eventTarget } from "./helpers/ui-reliability-harness.mjs"

test("returning to a tab observes cookie-only server logout without an injected Auth event", async () => {
  let cookieUser = { id: "A" }, subscriber
  const values = [], window = eventTarget(), document = { ...eventTarget(), visibilityState: "visible" }
  const js = ts.transpileModule(readFileSync(new URL("../src/lib/auth/watch-auth-user.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const context = { exports: {}, window, document }
  vm.runInNewContext(js, context)
  const stop = context.exports.watchAuthUser({ getUser: async () => ({ data: { user: cookieUser }, error: null }), onAuthStateChange(fn) { subscriber = fn; return { data: { subscription: { unsubscribe() {} } } } } }, user => values.push(user))
  await Promise.resolve(); assert.equal(values.at(-1).id, "A")
  cookieUser = null
  window.emit("focus")
  await Promise.resolve()
  assert.equal(values.at(-1), null)
  assert.equal(typeof subscriber, "function")
  stop();assert.equal(window.listenerCount(), 0);assert.equal(document.listenerCount(), 0)
})
