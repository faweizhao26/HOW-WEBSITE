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
