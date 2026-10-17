import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import vm from "node:vm"
import ts from "typescript"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"

const require = createRequire(import.meta.url)
function compile(file, overrides = {}) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8")
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  const compiled = { exports: {} }
  vm.runInNewContext(js, { module: compiled, exports: compiled.exports, require: name => overrides[name] ?? require(name) })
  return compiled.exports
}

export function renderAdminNavigation(pathname, locale = "zh") {
  const file = "../../src/components/admin/navigation.tsx"
  assert.ok(existsSync(new URL(file, import.meta.url)), "Mobile admin navigation needs a collapsible page selector")
  const translations = compile("../../src/lib/i18n/translations.ts")
  const { AdminNavigation } = compile(file, {
    "@/lib/i18n/translations": translations,
    "next/link": { __esModule: true, default: props => React.createElement("a", props) },
    "@/components/ui/button": { Button: ({ children, onClick, className, ...props }) => React.createElement("button", { onClick, className, "aria-label": props["aria-label"], title: props.title }, children) },
  })
  return renderToStaticMarkup(React.createElement(AdminNavigation, { pathname, locale, onLogout() {} }))
}
