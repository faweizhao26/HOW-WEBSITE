import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { test } from "node:test"

const root = new URL("../", import.meta.url)
const read = (path) => readFileSync(new URL(path, root), "utf8")

test("content mode is explicit and production defaults to Supabase", () => {
  const path = new URL("src/lib/content/mode.ts", root)
  assert.equal(existsSync(path), true, "content mode module must exist")
  const source = read("src/lib/content/mode.ts")

  assert.match(source, /export function getContentMode\(\).*"mock".*"supabase"/s)
  assert.match(source, /NEXT_PUBLIC_CONTENT_MODE/)
  assert.match(source, /NODE_ENV\s*===\s*["']production["']/)
  assert.match(source, /return "supabase"/)
})

test("public content result distinguishes ready, empty, and error", () => {
  const path = new URL("src/lib/content/types.ts", root)
  assert.equal(existsSync(path), true, "public content types must exist")
  const source = read("src/lib/content/types.ts")

  assert.match(source, /export type PublicContentResult<T>/)
  assert.match(source, /status:\s*"ready";\s*data:\s*T/)
  assert.match(source, /status:\s*"empty"/)
  assert.match(source, /status:\s*"error";\s*message:\s*string/)
})

test("server-only repository reads every public projection and release", () => {
  const path = new URL("src/lib/content/public.ts", root)
  assert.equal(existsSync(path), true, "public content repository must exist")
  const source = read("src/lib/content/public.ts")

  assert.match(source, /^import "server-only"/)
  for (const reader of [
    "getPublishedSettings",
    "getPublishedSpeakers",
    "getPublishedSessions",
    "getPublishedSponsors",
    "getPublishedNews",
    "getPublishedAgenda",
  ]) {
    assert.match(source, new RegExp(`export async function ${reader}\\(`))
  }

  for (const table of [
    "site_settings_releases",
    "published_speakers",
    "published_sessions",
    "published_sponsors",
    "published_news_posts",
    "agenda_releases",
  ]) {
    assert.match(source, new RegExp(`from\\(["']${table}["']\\)`))
  }

  assert.match(source, /status:\s*"error"/)
  assert.match(source, /status:\s*"empty"/)
  assert.doesNotMatch(source, /from\(["'](?:speakers|sessions|sponsors|news_posts|site_settings|agenda_slots)["']\)/)
  assert.doesNotMatch(source, /error\.message/)
})

test("legacy mock helper delegates to the shared content mode", () => {
  const source = read("src/lib/utils.ts")
  assert.match(source, /import \{ getContentMode \} from ["']@\/lib\/content\/mode["']/)
  assert.match(source, /return getContentMode\(\) === "mock"/)
})
