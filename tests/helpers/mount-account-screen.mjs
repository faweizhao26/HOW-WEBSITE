import { readFileSync } from "node:fs"
import vm from "node:vm"
import ts from "typescript"
import * as translations from "../../src/lib/i18n/translations.ts"
import { watchAuthUser } from "../../src/lib/auth/watch-auth-user.ts"
import { prepareAccountRequest, AccountRequestError } from "../../src/lib/auth/prepare-account-request.ts"
import * as registration from "../../src/lib/registration/service.ts"
import { registrationMessages } from "../../src/lib/registration/messages.ts"

export function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  return tree && typeof tree === "object" ? [tree, ...nodes(tree.props?.children)] : []
}
export function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join("")
  return tree && typeof tree === "object" ? text(tree.props?.children) : typeof tree === "string" ? tree : ""
}
export const user = id => ({ id, email: `${id}@example.test`, email_confirmed_at: "2026-01-01" })
export const profile = id => ({ id, full_name: `${id}-private-name`, phone: "+8613812345678", company: `${id}-private-company`, bio: "", bio_zh: "", wechat: "", avatar_url: null })

export function mountAccountScreen(kind, options = {}) {
  const slots = [], pendingEffects = [], transitions = [], timers = new Set(), notifications = [], calls = []
  let index = 0, dirty = false, tree, listener, currentUser = options.initialUser ?? user("A")
  const router = { replace: path => calls.push(["replace", path]), push: path => calls.push(["push", path]), refresh() {} }
  const same = (a,b) => a && b && a.length === b.length && a.every((x,i) => Object.is(x,b[i]))
  const react = {
    useState(initial) {
      const at = index++
      if (!(at in slots)) slots[at] = { value: typeof initial === "function" ? initial() : initial }
      return [slots[at].value, next => { slots[at].value = typeof next === "function" ? next(slots[at].value) : next; dirty = true }]
    },
    useRef(initial) { const at = index++; return slots[at] ??= { current: initial } },
    useCallback(fn,deps) { const at = index++; if (!same(slots[at]?.deps,deps)) slots[at] = { deps, value: fn }; return slots[at].value },
    useEffect(fn,deps) {
      const at = index++
      if (same(slots[at]?.deps,deps)) return
      const previous = slots[at]
      slots[at] = { deps }
      pendingEffects.push(() => { previous?.cleanup?.(); slots[at].cleanup = fn() })
    },
    startTransition(fn) { const promise = fn(); transitions.push(promise); return promise },
  }
  const auth = {
    getUser: async () => ({ data: { user: currentUser }, error: null }),
    getSession: async () => ({ data: { session: currentUser ? { user: currentUser } : null }, error: null }),
    onAuthStateChange(fn) { listener = fn; return { data: { subscription: { unsubscribe() { listener = null } } } } },
    signOut: async () => ({ error: null }),
  }
  const modules = {
    react,
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    "next/navigation": { useRouter: () => router, useSearchParams: () => new URLSearchParams() },
    "@/lib/i18n/provider": { useLocale: () => "en" },
    "@/lib/i18n/translations": translations,
    "@/lib/supabase/client": { createClient: () => ({ auth }) },
    "@/lib/auth/watch-auth-user": { watchAuthUser },
    "@/lib/auth/prepare-account-request": { prepareAccountRequest, AccountRequestError },
    "@/lib/profile/data": {
      loadProfileData: options.loadProfile ?? (async (_db,id) => ({ profile: profile(id), sessions: [], registrations: [] })),
      saveProfile: options.saveProfile ?? (async (_db,id,fields) => ({ ...profile(id), ...fields })),
      uploadProfileAvatar: async () => { throw Error("Unexpected upload") }, updateOwnRegistration: async () => { throw Error("Unexpected registration mutation") },
    },
    "@/lib/registration/service": { ...registration, loadRegistrationData: options.loadRegistration ?? (async () => ({ user: currentUser, profile: currentUser ? profile(currentUser.id) : null, tickets: [{ id: "33333333-3333-4333-8333-333333333333", name: "Community", is_active: true, is_free: true, requires_code: false }], registration: null })) },
    "@/lib/registration/messages": { registrationMessages },
    "./actions": { submitRegistration: options.submitRegistration ?? (async () => ({ success: true, data: { ticketName: "Community", ticketNameZh: "" } })), checkRegistrationChannel: async () => ({ success: false, code: "invalid_channel" }) },
    sonner: { toast: { success: message => notifications.push(message), error: message => notifications.push(message) } },
  }
  const path = kind === "profile" ? "../../src/app/profile/page.tsx" : "../../src/app/register/registration-form.tsx"
  const js = ts.transpileModule(readFileSync(new URL(path,import.meta.url),"utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const context = {
    exports: {}, URLSearchParams,
    setTimeout(fn, delay) { const timer = setTimeout(() => { timers.delete(timer); fn() },delay); timers.add(timer); return timer },
    clearTimeout(timer) { timers.delete(timer); clearTimeout(timer) },
    require: name => modules[name] ?? new Proxy({}, { get: (_target,key) => key }),
  }
  vm.runInNewContext(js,context)
  function render() { index = 0; dirty = false; tree = context.exports.default({ locale: "en" }); while(pendingEffects.length) pendingEffects.shift()(); return tree }
  render()
  return {
    render, nodes: () => nodes(tree), text: () => text(tree), notifications, transitions,
    hasSubscription: () => typeof listener === "function",
    event(id) { currentUser = id === null ? null : user(id); listener?.(id === null ? "SIGNED_OUT" : "SIGNED_IN",currentUser ? { user: currentUser } : null); if(dirty) render() },
    async flush() { for(let i=0;i<8;i++){ await new Promise(resolve=>setTimeout(resolve,1)); if(dirty)render() } },
    unmount() { for(const slot of slots) slot?.cleanup?.(); for(const timer of timers) clearTimeout(timer) },
  }
}
