import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"
import ts from "typescript"

export function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  return tree && typeof tree === "object" ? [tree, ...nodes(tree.props?.children)] : []
}

export function eventTarget() {
  const listeners = new Map()
  return {
    addEventListener(type, callback) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(callback) },
    removeEventListener(type, callback) { listeners.get(type)?.delete(callback) },
    emit(type, event = {}) { for (const callback of listeners.get(type) ?? []) callback(event) },
    listenerCount() { return [...listeners.values()].reduce((total, set) => total + set.size, 0) },
  }
}

export function environment({ theme = "dark", reduced = false } = {}) {
  const observers = new Set(), mutations = new Set(), frames = new Map(), classes = new Set([theme])
  const document = { ...eventTarget(), cookie: "", activeElement: null }
  const root = { classList: {
    contains: name => classes.has(name),
    toggle(name, force) {
      const present = classes.has(name)
      const next = force ?? !present
      if (next) classes.add(name); else classes.delete(name)
      if (present !== next) for (const observer of observers) mutations.add(observer)
      return next
    },
  } }
  document.documentElement = root
  const preference = { ...eventTarget(), matches: reduced }
  const window = { ...eventTarget(), devicePixelRatio: 1, matchMedia: () => preference }
  const storage = new Map()
  let frameId = 0
  class MutationObserver {
    constructor(callback) { this.callback = callback }
    observe(target, options) { assert.equal(target, root); assert.ok(options.attributes); observers.add(this) }
    disconnect() { observers.delete(this); mutations.delete(this) }
  }
  class ResizeObserver {
    constructor(callback) { this.callback = callback; resizeObservers.add(this) }
    observe() {}
    disconnect() { resizeObservers.delete(this) }
  }
  const resizeObservers = new Set()
  return {
    document, window, preference, storage, frames, observers, resizeObservers,
    globals: {
      document, window, MutationObserver, ResizeObserver,
      localStorage: { setItem: (key, value) => storage.set(key, value), getItem: key => storage.get(key) ?? null },
      requestAnimationFrame(callback) { const id = ++frameId; frames.set(id, callback); return id },
      cancelAnimationFrame(id) { frames.delete(id) },
    },
    flushMutations() { const pending = [...mutations]; mutations.clear(); pending.forEach(observer => observer.callback([])) },
    nextFrame() { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(0)) },
    resize() { window.emit("resize"); for (const observer of resizeObservers) observer.callback([]) },
    setReduced(value) { preference.matches = value; preference.emit("change", { matches: value }) },
    createNode(node) { return { props: node.props, focus() { document.activeElement = this } } },
  }
}

// Execute actual TSX with persistent hooks; replace only browser/framework boundaries.
export function component(file, name, props, env, modules = {}, createNode = env.createNode) {
  const slots = [], pendingEffects = [], targets = new WeakMap()
  let cursor = 0, dirty = false, tree, mounted = true
  const changed = (before, after) => !before || !after || before.length !== after.length || after.some((value, index) => !Object.is(value, before[index]))
  const react = {
    useState(initial) {
      const index = cursor++
      slots[index] ??= { value: typeof initial === "function" ? initial() : initial }
      return [slots[index].value, next => {
        if (!mounted) return
        const value = typeof next === "function" ? next(slots[index].value) : next
        if (!Object.is(value, slots[index].value)) { slots[index].value = value; dirty = true }
      }]
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial } },
    useId() { const index = cursor++; return `ui-${index}` },
    useEffect(effect, deps) {
      const index = cursor++
      if (!slots[index] || changed(slots[index].deps, deps)) pendingEffects.push(() => {
        slots[index]?.cleanup?.()
        slots[index] = { deps, cleanup: effect() }
      })
    },
    useSyncExternalStore(subscribe, getSnapshot) {
      const index = cursor++
      if (!slots[index]) {
        const slot = slots[index] = { value: getSnapshot() }
        pendingEffects.push(() => { slot.cleanup = subscribe(() => {
          const value = getSnapshot()
          if (!Object.is(value, slot.value)) { slot.value = value; dirty = true }
        }) })
      }
      return slots[index].value = getSnapshot()
    },
  }
  const element = (type, props) => ({ type, props })
  const dependencies = {
    react, "react/jsx-runtime": { jsx: element, jsxs: element, Fragment: "Fragment" },
    "lucide-react": new Proxy({}, { get: (_target, key) => key }), ...modules,
  }
  const source = readFileSync(new URL(file, import.meta.url), "utf8")
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const context = { exports: {}, ...env.globals, require: key => {
    assert.ok(key in dependencies, `Unexpected dependency: ${key}`)
    return dependencies[key]
  } }
  vm.runInNewContext(js, context)
  function render() {
    cursor = 0; dirty = false
    tree = context.exports[name](props)
    for (const node of nodes(tree)) if (node.props?.ref) {
      const ref = node.props.ref
      if (!targets.has(ref)) targets.set(ref, createNode(node))
      ref.current = targets.get(ref)
    }
    while (pendingEffects.length) pendingEffects.shift()()
  }
  function flush() { for (let i = 0; dirty; i++) { assert.ok(i < 20, "Render did not settle"); render() } }
  render(); flush()
  return {
    tree: () => tree, flush,
    update(next) { props = { ...props, ...next }; render(); flush() },
    unmount() { mounted = false; slots.forEach(slot => slot?.cleanup?.()) },
  }
}
