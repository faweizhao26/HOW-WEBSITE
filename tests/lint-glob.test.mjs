import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { join, relative } from "node:path"
import { test } from "node:test"
import { ESLint } from "eslint"

const require = createRequire(import.meta.url)
const pluginRequire = createRequire(require.resolve("@next/eslint-plugin-next"))
const { getRootDirs } = pluginRequire("./utils/get-root-dirs")

function withWorkspace(run) {
  const cwd = mkdtempSync(join(tmpdir(), "how-lint-glob-"))
  const web = join(cwd, "apps", "web")
  const admin = join(cwd, "apps", "admin")
  mkdirSync(join(web, "pages"), { recursive: true })
  mkdirSync(admin, { recursive: true })
  writeFileSync(join(cwd, "apps", "notes.txt"), "not a directory")
  writeFileSync(join(web, "pages", "about.js"), "export default function Page() {}")
  return Promise.resolve().then(() => run({ cwd, web, admin }))
    .finally(() => rmSync(cwd, { recursive: true, force: true }))
}

test("lint scanner no longer depends on the vulnerable braces parser", () => {
  assert.throws(() => pluginRequire.resolve("braces"), { code: "MODULE_NOT_FOUND" })
})

test("Next lint uses the workspace by default", () => withWorkspace(({ cwd }) => {
  assert.deepEqual(getRootDirs({ cwd, settings: {} }), [cwd])
}))

test("Next lint scans directory globs without including files", () => withWorkspace(({ cwd, web, admin }) => {
  const result = getRootDirs({ cwd, settings: { next: { rootDir: join(cwd, "apps", "*") } } })
  assert.deepEqual(result.sort(), [web, admin].sort())
}))

test("Next lint supports braces and Windows-style separators", () => withWorkspace(({ cwd, web, admin }) => {
  const pattern = join(cwd, "apps", "{web,admin}").replaceAll("/", "\\")
  assert.deepEqual(getRootDirs({ cwd, settings: { next: { rootDir: pattern } } }).sort(), [web, admin].sort())
}))

test("Next lint supports multiple roots and unmatched patterns", () => withWorkspace(({ cwd, web, admin }) => {
  const result = getRootDirs({ cwd, settings: { next: { rootDir: [web, admin, join(cwd, "missing", "*"), null] } } })
  assert.deepEqual(result.sort(), [web, admin].sort())
}))

test("Next lint preserves relative roots without recursive expansion", () => withWorkspace(({ cwd, web }) => {
  const pattern = relative(process.cwd(), web)
  assert.deepEqual(getRootDirs({ cwd, settings: { next: { rootDir: pattern } } }), [pattern])
}))

test("Next lint rules still report image and internal-link violations", () => withWorkspace(async ({ cwd }) => {
  const eslint = new ESLint({
    cwd,
    overrideConfigFile: true,
    overrideConfig: [{
      languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
      plugins: { "@next/next": require("@next/eslint-plugin-next") },
      settings: { next: { rootDir: join(cwd, "apps", "*") } },
      rules: {
        "@next/next/no-img-element": "error",
        "@next/next/no-html-link-for-pages": "error",
      },
    }],
  })
  const [result] = await eslint.lintText("const view = <a href='/about'><img src='/logo.png' /></a>", { filePath: "view.js" })
  assert.deepEqual(result.messages.map(message => message.ruleId).sort(), [
    "@next/next/no-html-link-for-pages", "@next/next/no-img-element",
  ].sort())
}))
