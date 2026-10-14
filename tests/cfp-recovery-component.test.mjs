import assert from "node:assert/strict"
import { test } from "node:test"
import { readFileSync } from "node:fs"
import { randomUUID } from "node:crypto"
import vm from "node:vm"
import ts from "typescript"
import { cfp, common } from "../src/lib/i18n/translations.ts"
import { cfpErrors } from "../src/lib/cfp/messages.ts"
import { CFPError, parseProposalInput } from "../src/lib/cfp/service.ts"
import { getCFPState, parseCFPSettings } from "../src/lib/cfp/settings.ts"

const source = readFileSync(new URL("../src/app/cfp/page.tsx", import.meta.url), "utf8")
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
const beforeDeadline = Date.parse("2027-04-01T15:59:59.000Z")
const afterDeadline = Date.parse("2027-04-01T16:00:00.000Z")
const user = { id: "11111111-1111-4111-8111-111111111111" }
const flush = () => new Promise(resolve => setImmediate(resolve))
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  return tree && typeof tree === "object" ? [tree, ...nodes(tree.props?.children)] : []
}
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join("")
  return tree && typeof tree === "object" ? text(tree.props?.children) : typeof tree === "string" ? tree : ""
}

function mount() {
  const states = [], refs = [], effects = [], transitions = [], calls = []
  let stateIndex = 0, refIndex = 0, now = beforeDeadline, initial = true
  const policy = parseCFPSettings({ cfp_deadline: "2027-04-01" })
  const react = {
    useState(value) {
      const index = stateIndex++
      if (!(index in states)) states[index] = value
      return [states[index], next => { states[index] = typeof next === "function" ? next(states[index]) : next }]
    },
    useRef(value) { const index = refIndex++; return refs[index] ??= { current: value } },
    useEffect(effect) { if (initial) effects.push(effect) },
    startTransition(callback) { transitions.push(callback()) },
  }
  const modules = {
    react,
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    "@/lib/i18n/provider": { useLocale: () => "en" },
    "@/lib/i18n/translations": { cfp, common },
    "@/lib/cfp/messages": { cfpErrors },
    "@/lib/cfp/settings": { getCFPState: policy => getCFPState(policy, now) },
    "@/lib/cfp/service": { CFPError, parseProposalInput, loadCFPData: async () => ({ user, sessions: [], policy }) },
    "@/lib/supabase/client": { createClient: () => ({ auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } }) },
    "./actions": { submitCFP: async values => {
      calls.push(values)
      if (calls.length === 1) { now = afterDeadline; throw new Error("committed response lost") }
      return { success: true, data: { id: calls[0].requestId, title: "Original proposal", title_zh: null, abstract: "Original abstract", abstract_zh: null, duration: 30, type: "talk", status: "pending" } }
    } },
    sonner: { toast: { success() {} } },
  }
  const context = { exports: {}, crypto: { randomUUID }, require: name => modules[name] ?? new Proxy({}, { get: (_target, key) => key }) }
  vm.runInNewContext(js, context)
  const render = () => { stateIndex = refIndex = 0; const tree = context.exports.default(); initial = false; return tree }
  render(); effects.forEach(effect => effect())
  return { render, calls, settle: async () => { await Promise.all(transitions); await flush() } }
}

test("a committed response lost across the CFP deadline remains recoverable from the page", async () => {
  const h = mount()
  await h.settle()
  let tree = h.render()
  nodes(tree).find(node => node.type === "Input" && node.props.id === "title").props.onChange({ target: { value: "Original proposal" } })
  nodes(tree).find(node => node.type === "Textarea" && node.props.id === "abstract").props.onChange({ target: { value: "Original abstract" } })
  tree = h.render()
  nodes(tree).find(node => node.type === "form").props.onSubmit({ preventDefault() {} })
  await h.settle()
  tree = h.render()
  assert.equal(nodes(tree).some(node => node.type === "form"), false)
  const recovery = nodes(tree).find(node => node.type === "Button" && text(node).includes("Check last submission"))
  assert.ok(recovery, "Closing the form must retain a result-recovery command")
  recovery.props.onClick({ preventDefault() {} })
  await h.settle()
  tree = h.render()
  assert.equal(h.calls.length, 2)
  assert.equal(h.calls[1].requestId, h.calls[0].requestId)
  assert.equal(h.calls[1].title, "Original proposal")
  assert.equal(h.calls[1].expectedUserId, user.id)
  assert.equal(nodes(tree).filter(node => node.type === "h3" && text(node) === "Original proposal").length, 1)
})
