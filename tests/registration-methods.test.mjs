import assert from "node:assert/strict"
import { test } from "node:test"
import { readFileSync } from "node:fs"
import vm from "node:vm"
import { cloneElement, createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import * as jsxRuntime from "react/jsx-runtime"
import ts from "typescript"
import { defaultSiteSettings, validateSettingsDraft } from "../src/lib/content/settings.ts"
import { getSettingsIssues } from "../src/lib/content/settings-validation.ts"
import { getRegistrationOptions, resolveRegistrationLink } from "../src/lib/registration/settings.ts"

const url = "https://events.example.com/how-2027?source=how"
const external = { registration_onsite_enabled: "false", registration_external_enabled: "true", register_url: url }
const both = { ...external, registration_onsite_enabled: "true" }
const closed = { ...external, registration_external_enabled: "false" }

test("registration exposes only enabled destinations and preserves existing channel links on-site", () => {
  assert.deepEqual(getRegistrationOptions({ register_url: url }), { onsite: true, externalUrl: null, href: "/register" })
  assert.deepEqual(getRegistrationOptions(external), { onsite: false, externalUrl: url, href: url })
  assert.deepEqual(getRegistrationOptions(both), { onsite: true, externalUrl: url, href: "/register" })
  assert.deepEqual(getRegistrationOptions(closed), { onsite: false, externalUrl: null, href: null })
  assert.equal(getRegistrationOptions(null).href, null)
  assert.equal(resolveRegistrationLink("/register?code=invite", url), url)
  assert.equal(resolveRegistrationLink("/register?code=invite", "/register"), "/register?code=invite")
  assert.equal(resolveRegistrationLink("/register", null), null)
  assert.equal(resolveRegistrationLink("/auth/register", null), "/auth/register")
})

test("external registration cannot be published without a valid absolute web URL", () => {
  for (const register_url of ["", "/register", "//events.example.com", "javascript:alert(1)", "https://user:pass@events.example.com", "https://"]) {
    const settings = { ...defaultSiteSettings, ...external, register_url }
    assert.equal(getSettingsIssues(settings).find(issue => issue.path === "register_url")?.path, "register_url")
    assert.equal(validateSettingsDraft(settings), "registration")
    assert.equal(getRegistrationOptions(settings).href, null)
  }
  for (const config of [external, both, closed]) {
    assert.equal(validateSettingsDraft({ ...defaultSiteSettings, ...config }), null)
  }
})

test("old registration URLs follow the published mode without forwarding channel codes externally", async () => {
  const source = readFileSync(new URL("../src/app/register/page.tsx", import.meta.url), "utf8")
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } })
  const render = async (settings, query = {}) => {
    const modules = {
      "react/jsx-runtime": jsxRuntime,
      "next/headers": { cookies: async () => ({ get: () => null }) },
      "next/link": { default: ({ href, children }) => createElement("a", { href }, children) },
      "next/navigation": { redirect: href => { throw new Error(href) } },
      "lucide-react": { ArrowRight: () => null, ExternalLink: () => null },
      "@/lib/seo/page-metadata": { pageMetadata: () => ({}) },
      "@/lib/i18n/utils": { getLocale: () => "en" },
      "@/components/ui/button": { Button: ({ render, children }) => cloneElement(render, {}, children) },
      "@/lib/content/public": { getPublishedSettings: async () => ({ status: "ready", data: settings }) },
      "@/lib/registration/settings": { getRegistrationOptions },
      "./registration-form": { default: () => createElement("form") },
    }
    const context = { exports: {}, require: name => modules[name] }
    vm.runInNewContext(outputText, context)
    return renderToStaticMarkup(await context.exports.default({ searchParams: Promise.resolve(query) }))
  }
  assert.match(await render({}), /<form/)
  assert.match(await render(closed, { method: "onsite", code: "private" }), /registration is not currently open/)
  await assert.rejects(render(external, { method: "onsite", code: "private" }), { message: url })
  const choices = await render(both)
  assert.match(choices, /href="\/register\?method=onsite"/)
  assert.ok(choices.includes(`href="${url}"`))
  assert.match(await render(both, { code: "private" }), /<form/)
  assert.match(await render(both, { method: "onsite" }), /<form/)
})
