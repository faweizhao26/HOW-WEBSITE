import assert from "node:assert/strict"
import { test } from "node:test"
import { readFileSync, existsSync } from "node:fs"

const location = new URL("../src/lib/seo/metadata.ts", import.meta.url)
const api = async () => {
  assert.ok(existsSync(location), "Public pages need a localized metadata source")
  return import(location.href)
}

test("public page metadata has distinct bilingual titles and canonical share URLs without query credentials", async () => {
  const { publicPagePaths, buildPageMetadata } = await api()
  for (const locale of ["zh", "en"]) {
    const titles = new Set()
    for (const path of publicPagePaths) {
      const meta = buildPageMetadata(path, locale)
      assert.ok(meta.title && meta.description)
      titles.add(meta.title)
      assert.equal(meta.alternates.canonical, `https://how-website.vercel.app${path}`)
      assert.equal(meta.openGraph.url, meta.alternates.canonical)
      assert.equal(meta.openGraph.title, meta.title)
      assert.equal(meta.openGraph.description, meta.description)
      assert.equal(meta.openGraph.locale, locale === "zh" ? "zh_CN" : "en_US")
      assert.equal(meta.twitter.card, "summary_large_image")
      assert.equal(meta.twitter.images[0], "https://how-website.vercel.app/opengraph-image")
      assert.deepEqual(meta.robots, { index: true, follow: true })
    }
    assert.equal(titles.size, publicPagePaths.length)
  }
  assert.notEqual(buildPageMetadata("/about", "zh").title, buildPageMetadata("/about", "en").title)
  assert.equal(buildPageMetadata("/about", "zh", { indexable: false }).robots.index, false)
})

test("canonical origin is explicit, valid and never derived from a preview or request host", async () => {
  const { siteOrigin } = await api()
  assert.equal(siteOrigin("https://conference.example.test/"), "https://conference.example.test")
  for (const value of ["http://example.test", "https://user:pass@example.test", "https://example.test/private", "https://example.test/?access_token=secret", "invalid"]) assert.throws(() => siteOrigin(value))
})

test("metadata exports cover public server pages; private pages inherit noindex", async () => {
  const { publicPagePaths } = await api()
  for (const path of publicPagePaths) {
    const source = readFileSync(new URL(`../src/app${path === "/" ? "" : path}/page.tsx`, import.meta.url), "utf8")
    assert.match(source, /export function generateMetadata/)
    assert.ok(source.includes(`pageMetadata("${path}")`))
  }
  const root = readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8")
  assert.match(root, /robots: \{ index: false, follow: false \}/)
})

test("sitemap and robots contain only public canonical routes and no fabricated language URLs", async () => {
  const { publicPagePaths } = await api()
  const sitemap = (await import("../src/app/sitemap.ts")).default()
  const robots = (await import("../src/app/robots.ts")).default()
  assert.deepEqual(sitemap.map(x => x.url), publicPagePaths.map(path => `https://how-website.vercel.app${path}`))
  for (const item of sitemap) {
    assert.equal(item.alternates, undefined, "Cookie-only locales do not have separate crawlable URLs")
    assert.equal(item.lastModified, undefined, "Do not claim every build changed published content")
  }
  assert.equal(robots.sitemap, "https://how-website.vercel.app/sitemap.xml")
  assert.ok(robots.rules.disallow.includes("/api/"))
  for (const path of ["/admin", "/auth", "/profile", "/cfp"]) assert.ok(!robots.rules.disallow.includes(path), "HTML routes must be crawlable so their noindex or login redirect can be read")
  assert.ok(!publicPagePaths.some(x => /^\/(admin|auth|profile|cfp)/.test(x)))
})

test("preview deployments and mock previews disable indexing and omit the public sitemap", async () => {
  const { indexingEnabled } = await api()
  const { default: sitemap } = await import("../src/app/sitemap.ts")
  const { default: robots } = await import("../src/app/robots.ts")
  const keys = ["VERCEL_ENV", "NEXT_PUBLIC_CONTENT_MODE"]
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]))
  try {
    for (const [environment, mode] of [["preview", "supabase"], ["production", "mock"]]) {
      process.env.VERCEL_ENV = environment
      process.env.NEXT_PUBLIC_CONTENT_MODE = mode
      assert.equal(indexingEnabled(), false)
      assert.deepEqual(sitemap(), [])
      assert.deepEqual(robots(), { rules: { userAgent: "*", disallow: "/" } })
    }
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
  }
})
