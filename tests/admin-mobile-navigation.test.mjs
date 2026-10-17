import assert from "node:assert/strict"
import { test } from "node:test"
import { renderAdminNavigation as navigation } from "./helpers/render-admin-navigation.mjs"

test("mobile navigation starts closed and identifies the active page in both languages", () => {
  for (const [locale, label] of [["zh", "账号管理"], ["en", "Accounts"]]) {
    const html = navigation("/admin/accounts", locale)
    const details = html.match(/<details\b[^>]*>([\s\S]*?)<\/details>/)?.[0]
    assert.ok(details, "A page selector must replace the horizontal mobile navigation rail")
    assert.doesNotMatch(details.slice(0, details.indexOf(">")), /\bopen(?:=|\s|$)/)
    assert.match(details.match(/<summary[^>]*>([\s\S]*?)<\/summary>/)?.[1] ?? "", new RegExp(label))
    assert.match(details, /href="\/admin\/accounts"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/admin\/accounts"/)
  }
})

test("collapsed mobile navigation retains access to every admin section and logout", () => {
  const html = navigation("/admin/settings")
  const details = html.match(/<details\b[^>]*>([\s\S]*?)<\/details>/)?.[1] ?? ""
  for (const href of ["/admin", "/admin/sessions", "/admin/speakers", "/admin/agenda", "/admin/registrations", "/admin/checkin", "/admin/accounts", "/admin/tickets", "/admin/sponsors", "/admin/updates", "/admin/settings"]) {
    assert.ok(details.includes(`href="${href}"`), `Missing mobile destination: ${href}`)
  }
  assert.match(details, /<button[^>]*>[\s\S]*退出登录/)
})

test("nested routes select their section without marking the dashboard active", () => {
  for (const [pathname, label] of [["/admin/accounts/example", "账号管理"], ["/admin/accounts-old", "仪表盘"], ["/admin", "仪表盘"]]) {
    const html = navigation(pathname)
    const summary = html.match(/<summary[^>]*>([\s\S]*?)<\/summary>/)?.[1] ?? ""
    assert.match(summary, new RegExp(label))
    assert.equal([...html.matchAll(/aria-current="page"/g)].length, 2, "Exactly one active destination per responsive navigation")
  }
})
