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

test("publication actions authenticate administrators and revalidate affected routes", () => {
  const guardPath = new URL("src/lib/auth/require-admin.ts", root)
  const actionsPath = new URL("src/app/admin/actions/publication.ts", root)
  assert.equal(existsSync(guardPath), true, "admin guard must exist")
  assert.equal(existsSync(actionsPath), true, "publication actions must exist")

  const guard = read("src/lib/auth/require-admin.ts")
  assert.match(guard, /^import "server-only"/)
  assert.match(guard, /auth\.getUser\(\)/)
  assert.match(guard, /from\("profiles"\)/)
  assert.match(guard, /profile\?\.role !== "admin"/)
  assert.doesNotMatch(guard, /raw_user_meta_data|user_metadata/)

  const actions = read("src/app/admin/actions/publication.ts")
  assert.match(actions, /^["']use server["']/)
  assert.match(actions, /export type PublicationActionResult/)
  assert.match(actions, /requireAdmin\(\)/)
  for (const action of [
    "publishSpeaker",
    "unpublishSpeaker",
    "publishSession",
    "unpublishSession",
    "publishSponsor",
    "unpublishSponsor",
    "publishNewsPost",
    "unpublishNewsPost",
    "publishAgenda",
    "rollbackAgenda",
    "publishSiteSettings",
    "rollbackSiteSettings",
  ]) {
    assert.match(actions, new RegExp(`export async function ${action}\\(`))
  }
  assert.match(actions, /["']\/speakers["']/)
  assert.match(actions, /["']\/schedule["']/)
  assert.match(actions, /["']\/sponsors["']/)
  assert.match(actions, /["']\/updates["']/)
  assert.match(actions, /paths\.forEach\(\(path\) => revalidatePath\(path\)\)/)
})

test("shared publication controls expose status, pending state, and confirmation", () => {
  for (const path of [
    "src/components/admin/publication-badge.tsx",
    "src/components/admin/publication-actions.tsx",
  ]) {
    assert.equal(existsSync(new URL(path, root)), true, `${path} must exist`)
  }

  const badge = read("src/components/admin/publication-badge.tsx")
  assert.match(badge, /Published, changes pending/)
  assert.match(badge, /已发布，有待发布更改/)
  assert.match(badge, /publishedAt.*updatedAt|updatedAt.*publishedAt/s)

  const actions = read("src/components/admin/publication-actions.tsx")
  assert.match(actions, /^["']use client["']/)
  assert.match(actions, /useTransition\(/)
  assert.match(actions, /AlertDialog/)
  assert.match(actions, /disabled=\{isPending\}/)
})

test("speaker lifecycle is available in admin and public navigation", () => {
  const adminPath = new URL("src/app/admin/speakers/page.tsx", root)
  const publicPath = new URL("src/app/speakers/page.tsx", root)
  assert.equal(existsSync(adminPath), true, "admin speaker page must exist")
  assert.equal(existsSync(publicPath), true, "public speaker page must exist")

  const adminPage = read("src/app/admin/speakers/page.tsx")
  assert.match(adminPage, /from\("speakers"\)/)
  assert.match(adminPage, /PublicationBadge/)
  assert.match(adminPage, /PublicationActions/)
  assert.match(adminPage, /profile_id/)
  assert.match(adminPage, /sort_order/)
  assert.match(adminPage, /avatar_url/)

  const publicPage = read("src/app/speakers/page.tsx")
  assert.match(publicPage, /getPublishedSpeakers\(\)/)
  assert.match(publicPage, /result\.status === "error"/)
  assert.match(publicPage, /result\.status === "empty"/)

  const header = read("src/components/layout/header.tsx")
  const footer = read("src/components/layout/footer.tsx")
  const adminLayout = read("src/app/admin/layout.tsx")
  assert.match(header, /href:\s*"\/speakers"/)
  assert.match(footer, /href="\/speakers"/)
  assert.match(adminLayout, /href:\s*"\/admin\/speakers"/)
})

test("session review remains separate from website publication", () => {
  const adminSessions = read("src/app/admin/sessions/page.tsx")
  const cfpPage = read("src/app/cfp/page.tsx")
  const profilePage = read("src/app/profile/page.tsx")
  const dashboard = read("src/app/admin/page.tsx")
  const adminLayout = read("src/app/admin/layout.tsx")

  assert.match(adminSessions, /from\("speakers"\)/)
  assert.match(adminSessions, /publication_status.*published|published.*publication_status/s)
  assert.match(adminSessions, /speaker_id/)
  assert.match(adminSessions, /PublicationBadge/)
  assert.match(adminSessions, /PublicationActions/)
  assert.match(adminSessions, /session\.status === "approved"/)

  for (const submitterPage of [cfpPage, profilePage]) {
    assert.doesNotMatch(submitterPage, /PublicationBadge|PublicationActions|published_sessions/)
    assert.match(submitterPage, /statusBadge\(/)
  }

  assert.match(dashboard, /from\("speakers"\)/)
  assert.doesNotMatch(dashboard, /new Set\(sessions\.map\(\(s\) => s\.user_id\)\)/)
  assert.match(adminLayout, /flex-col md:flex-row/)
  assert.match(adminLayout, /overflow-x-auto/)
})

test("sponsor and news drafts publish through public projections", () => {
  const adminSponsors = read("src/app/admin/sponsors/page.tsx")
  const adminUpdates = read("src/app/admin/updates/page.tsx")
  const publicSponsors = read("src/app/sponsors/page.tsx")
  const publicUpdates = read("src/app/updates/page.tsx")

  for (const publicPage of [publicSponsors, publicUpdates]) {
    assert.doesNotMatch(publicPage, /^['\"]use client['\"]/)
    assert.doesNotMatch(publicPage, /createClient|localStorage|from\(["'](?:sponsors|news_posts)["']\)|getSponsors\(|getNews\(/)
    assert.match(publicPage, /result\.status === "error"/)
    assert.match(publicPage, /result\.status === "empty"/)
  }

  assert.match(publicSponsors, /getPublishedSponsors\(\)/)
  assert.match(publicUpdates, /getPublishedNews\(\)/)

  for (const adminPage of [adminSponsors, adminUpdates]) {
    assert.match(adminPage, /PublicationBadge/)
    assert.match(adminPage, /PublicationActions/)
    assert.match(adminPage, /published_at/)
    assert.match(adminPage, /updated_at/)
  }

  assert.match(adminSponsors, /from\("sponsors"\)/)
  assert.match(adminUpdates, /from\("news_posts"\)/)
  assert.doesNotMatch(adminUpdates, /insert\([^)]*published_at/s)
})

test("agenda uses complete releases and never displays production mock content", () => {
  const adminAgenda = read("src/app/admin/agenda/page.tsx")
  const schedule = read("src/app/schedule/page.tsx")
  const chatbot = read("src/components/chatbot.tsx")
  assert.match(adminAgenda, /publishAgenda\(/)
  assert.match(adminAgenda, /agenda_releases/)
  assert.match(adminAgenda, /kind="agenda-release"/)
  assert.match(adminAgenda, /published_sessions/)
  assert.match(schedule, /getPublishedAgenda\(\)/)
  assert.match(schedule, /result\.status === "empty"/)
  assert.match(schedule, /result\.status === "error"/)
  assert.doesNotMatch(schedule, /mockSlots|mockProducers|from\("agenda_slots"\)/)
  assert.doesNotMatch(chatbot, /provisional agenda|占位信息|占位示例/)
})
