import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { test } from "node:test"

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

test("Supabase schema supports registration and profile fields used by the app", () => {
  const sql = read("supabase-schema.sql")

  for (const table of ["ticket_types", "channel_codes", "registrations"]) {
    assert.match(sql, new RegExp(`CREATE TABLE public\\.${table}\\b`))
    assert.match(sql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`))
  }

  for (const column of ["phone TEXT", "wechat TEXT", "avatar_url TEXT"]) {
    assert.match(sql, new RegExp(column))
  }

  assert.match(sql, /checked_in BOOLEAN NOT NULL DEFAULT false/)
  assert.match(sql, /Admins can manage registrations/)
  assert.match(sql, /GRANT SELECT ON public\.ticket_types TO anon, authenticated/)
  assert.match(sql, /GRANT SELECT, INSERT, UPDATE ON public\.registrations TO authenticated/)
  assert.doesNotMatch(sql, /GRANT .*DELETE.*ON public\.registrations TO authenticated/)
  assert.doesNotMatch(sql, /GRANT .*INSERT.*ON public\.ticket_types TO anon/)
  assert.doesNotMatch(sql, /GRANT .*UPDATE.*ON public\.channel_codes TO anon/)
  assert.match(sql, /SECURITY DEFINER\s+SET search_path = public, auth/)
  assert.match(sql, /REVOKE EXECUTE ON FUNCTION public\.handle_new_user\(\) FROM PUBLIC, anon, authenticated/)
  assert.match(sql, /REVOKE EXECUTE ON FUNCTION public\.rls_auto_enable\(\) FROM PUBLIC, anon, authenticated/)
})

test("Next 16 uses proxy instead of deprecated middleware for route protection", () => {
  assert.equal(existsSync(new URL("../src/proxy.ts", import.meta.url)), true)
  assert.equal(existsSync(new URL("../src/middleware.ts", import.meta.url)), false)

  const proxy = read("src/proxy.ts")
  assert.match(proxy, /export async function proxy/)
  assert.match(proxy, /matcher: \["\/admin\/:path\*", "\/cfp\/:path\*"\]/)
})

test("Header has working sign-out routes for desktop and mobile", () => {
  assert.equal(existsSync(new URL("../src/app/auth/signout/route.ts", import.meta.url)), true)

  const header = read("src/components/layout/header.tsx")
  assert.match(header, /action="\/auth\/signout"/)
  assert.doesNotMatch(header, /href="#"\s+onClick=\{\(\) => \{\}\}/)
})

test("Locale-sensitive labels use explicit fallback grouping", () => {
  const home = read("src/app/page.tsx")
  const adminLayout = read("src/app/admin/layout.tsx")

  assert.match(home, /settings\.conference_location_zh \|\| \(locale === "zh"/)
  assert.match(adminLayout, /\(adminLabels\.how2027Admin\?\.\[locale\]\) \|\| \(locale === "zh"/)
})

test("Attend placeholder content is wired into the public site", () => {
  assert.equal(existsSync(new URL("../src/app/attend/page.tsx", import.meta.url)), true)

  const translations = read("src/lib/i18n/translations.ts")
  const header = read("src/components/layout/header.tsx")
  const footer = read("src/components/layout/footer.tsx")
  const home = read("src/app/page.tsx")

  assert.match(translations, /attend: \{ en: "Attend", zh: "参会指南" \}/)
  assert.match(header, /href: "\/attend", key: "attend"/)
  assert.match(footer, /href="\/attend"/)
  assert.match(home, /href="\/attend"/)
})

test("Public site has a persistent day and night theme toggle", () => {
  assert.equal(existsSync(new URL("../src/components/layout/theme-toggle.tsx", import.meta.url)), true)

  const layout = read("src/app/layout.tsx")
  const header = read("src/components/layout/header.tsx")
  const styles = read("src/app/globals.css")
  const toggle = read("src/components/layout/theme-toggle.tsx")

  assert.match(layout, /theme = cookieStore\.get\("theme"\)\?\.value === "light" \? "light" : "dark"/)
  assert.match(layout, /className=\{theme\}/)
  assert.match(layout, /<Header locale=\{locale\} initialTheme=\{theme\} \/>/)
  assert.match(header, /import \{ ThemeToggle \} from "\.\/theme-toggle"/)
  assert.match(header, /<ThemeToggle initialTheme=\{initialTheme\} \/>/)
  assert.match(styles, /\.light \.bg-zinc-950/)
  assert.match(styles, /\.light \.bg-emerald-600\.text-white/)
  assert.match(styles, /\.light \.bg-gradient-to-br \.text-white/)
  assert.match(toggle, /localStorage\.setItem\("theme", nextTheme\)/)
  assert.match(toggle, /document\.cookie = `theme=\$\{nextTheme\}/)
})

test("Home page has explicit sharp light-mode styling", () => {
  const home = read("src/app/page.tsx")
  const countdown = read("src/components/countdown.tsx")

  assert.match(home, /bg-white dark:bg-zinc-900\/80/)
  assert.match(home, /text-zinc-950 dark:text-white/)
  assert.match(home, /border-zinc-200 dark:border-zinc-800/)
  assert.match(home, /from-white via-emerald-50 to-cyan-50/)
  assert.doesNotMatch(home, /blur-\[128px\]/)
  assert.match(countdown, /from-zinc-950 to-zinc-700 dark:from-white dark:to-zinc-300/)
})

test("Sponsor recruitment contact is visible on public sponsor surfaces", () => {
  const sponsors = read("src/app/sponsors/page.tsx")
  const attend = read("src/app/attend/page.tsx")
  const chatbot = read("src/components/chatbot.tsx")
  const footer = read("src/components/layout/footer.tsx")
  const conduct = read("src/app/code-of-conduct/page.tsx")
  const privacy = read("src/app/privacy/page.tsx")
  const settings = read("src/app/admin/settings/page.tsx")

  assert.match(sponsors, /faweizhao26@gmail\.com/)
  assert.match(sponsors, /mailto:faweizhao26@gmail\.com/)
  assert.match(attend, /faweizhao26@gmail\.com/)
  for (const source of [chatbot, footer, conduct, privacy, settings]) {
    assert.match(source, /faweizhao26@gmail\.com/)
    assert.doesNotMatch(source, /conference@how2027\.org/)
  }
})

test("Sponsor logos render on a theme-neutral safe surface", () => {
  const sponsors = read("src/app/sponsors/page.tsx")
  const adminSponsors = read("src/app/admin/sponsors/page.tsx")
  const styles = read("src/app/globals.css")

  for (const source of [sponsors, adminSponsors]) {
    assert.match(source, /sponsor-logo-surface/)
    assert.match(source, /sponsor-logo-image/)
  }
  assert.match(styles, /\.sponsor-logo-surface/)
  assert.match(styles, /\.sponsor-logo-image/)
  assert.match(styles, /drop-shadow\(0 1px 1px rgb\(0 0 0 \/ 0\.45\)\)/)
})

test("Placeholder conference content is clearly labeled", () => {
  const schedule = read("src/app/schedule/page.tsx")
  const chatbot = read("src/components/chatbot.tsx")
  const updates = read("src/app/updates/page.tsx")

  assert.match(schedule, /Program details are provisional/)
  assert.match(schedule, /议程内容为占位示例/)
  assert.match(chatbot, /speaker lineup is still being confirmed/)
  assert.doesNotMatch(chatbot, /IvorySQL, Supabase, Alibaba Cloud, AWS, GitLab, ByteDance/)
  assert.match(updates, /planning updates will appear here/i)
})
