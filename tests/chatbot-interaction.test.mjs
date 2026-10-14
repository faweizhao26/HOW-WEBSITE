import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import vm from "node:vm"
import ts from "typescript"
import { conference } from "../src/lib/conference.ts"
import { getConferenceAnswer } from "../src/lib/content/conference-faq.ts"
import { contentText, parseSiteContent } from "../src/lib/content/site-content.ts"
import { defaultSiteSettings } from "../src/lib/content/settings.ts"

const js = ts.transpileModule(readFileSync(new URL("../src/components/chatbot.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText

// Keep hook values across renders and control the actual component's delayed replies.
function widget(locale = "zh", path = "/") {
  const slots = [], timers = []
  const published = { settings: defaultSiteSettings, content: parseSiteContent({}) }
  let cursor = 0, tree
  const Button = Symbol("Button"), Input = Symbol("Input")
  const element = (type, props) => ({ type, props })
  const modules = {
    "react/jsx-runtime": { jsx: element, jsxs: element, Fragment: Symbol("Fragment") },
    react: {
      useState(initial) {
        const index = cursor++
        slots[index] ??= { value: initial }
        return [slots[index].value, next => {
          slots[index].value = typeof next === "function" ? next(slots[index].value) : next
        }]
      },
      useRef(initial) { const index = cursor++; slots[index] ??= { value: { current: initial } }; return slots[index].value },
      useEffect(effect) { effect() },
    },
    "@/lib/i18n/provider": { useLocale: () => locale },
    "next/navigation": { usePathname: () => path },
    "@/lib/conference": { conference },
    "@/lib/content/conference-faq": { getConferenceAnswer, loadConferenceFAQ: () => ({ then: done => { done(published); return { catch() {} } } }) },
    "@/lib/content/site-content": { contentText },
    "@/components/ui/button": { Button },
    "@/components/ui/input": { Input },
    "lucide-react": {},
  }
  const context = {
    exports: {}, AbortController, fetch() {}, require: name => { assert.ok(name in modules, `Unexpected dependency: ${name}`); return modules[name] },
    setTimeout(callback) { timers.push(callback); return timers.length },
  }
  vm.runInNewContext(js, context)
  function render() { cursor = 0; tree = context.exports.ChatbotWidget({ published }) }
  function nodes(node) {
    if (Array.isArray(node)) return node.flatMap(nodes)
    if (!node || typeof node !== "object") return []
    return [node, ...nodes(node.props?.children)]
  }
  function control(type) { return nodes(tree).find(node => node.type === type).props }
  render()
  if (tree === null) return { isHidden: () => true }
  control("button").onClick()
  render()
  return {
    type(text) { control(Input).onChange({ target: { value: text } }); render() },
    send() { control(Button).onClick(); render() },
    enter(isComposing = false) {
      control(Input).onKeyDown({ key: "Enter", nativeEvent: { isComposing }, preventDefault() {} })
      render()
    },
    flush() { while (timers.length) { timers.shift()(); render() } },
    input() { return control(Input).value },
    messages() { return Array.from(slots[1].value, message => ({ ...message })) },
  }
}

test("public FAQ widget does not cover administrator editing controls", () => {
  assert.equal(widget("zh", "/admin/settings").isHidden?.(), true)
})

test("rapid questions retain both questions and their corresponding replies", () => {
  const h = widget()
  h.type("午餐"); h.send()
  h.type("会场在哪里"); h.send()
  h.flush()
  const messages = h.messages()
  assert.deepEqual(messages.map(message => message.role), ["user", "bot", "user", "bot"])
  assert.deepEqual(messages.filter(message => message.role === "user").map(message => message.text), ["午餐", "会场在哪里"])
  const replies = messages.filter(message => message.role === "bot")
  assert.equal(replies.length, 2)
  assert.match(replies[0].text, /餐饮和茶歇安排待公布/)
  assert.match(replies[1].text, /会场待公布/)
})

test("IME confirmation Enter keeps the draft and does not send a question", () => {
  const h = widget()
  h.type("会场")
  h.enter(true); h.flush()
  assert.equal(h.messages().length, 0)
  assert.equal(h.input(), "会场")
  h.enter(); h.flush()
  assert.equal(h.messages().length, 2)
  assert.equal(h.input(), "")
})

test("ordinary Enter sends one English question and whitespace sends nothing", () => {
  const h = widget("en")
  h.type("  Lunch  "); h.enter(); h.flush()
  assert.deepEqual(h.messages().map(message => message.role), ["user", "bot"])
  assert.equal(h.messages()[0].text, "Lunch")
  assert.match(h.messages()[1].text, /arrangements are to be announced/)
  h.type("   "); h.send(); h.flush()
  assert.equal(h.messages().length, 2)
})
