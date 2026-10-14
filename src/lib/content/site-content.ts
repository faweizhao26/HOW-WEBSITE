import { z } from "zod"
import { defaultSiteContent } from "./site-defaults.ts"

export const bilingualSchema = z.object({ en: z.string().max(10000), zh: z.string().max(10000) })
export type Bilingual = z.infer<typeof bilingualSchema>
// The same URL pattern is retained in the generated PostgreSQL JSON Schema.
const link = z.string().max(2048).regex(/^(?:$|\/|\/[^/\\\u0000-\u0020][^\\\u0000-\u0020]*|https?:\/\/[A-Za-z0-9.-]+(?::(?:[0-9]{1,4}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5]))?(?:[/?#][^\\\u0000-\u0020]*)?)$/, "Use an http(s) URL or a site-relative path")
const blockSchema = z.object({
  id: z.string().min(1).max(80), title: bilingualSchema, body: bilingualSchema,
  items: z.array(bilingualSchema).max(50), imageUrl: link, imageAlt: bilingualSchema,
  linkUrl: link, linkLabel: bilingualSchema, enabled: z.boolean(),
})
export type ContentBlock = z.infer<typeof blockSchema>
const blocks = z.array(blockSchema).max(50).refine(rows => new Set(rows.map(row => row.id)).size === rows.length, "Duplicate block identifiers")
const pageSchema = z.object({ title: bilingualSchema, intro: bilingualSchema, subtitle: bilingualSchema, sections: blocks })
const email = z.email().max(320).or(z.literal(""))
export const siteContentSchema = z.object({
  contacts: z.object({ sponsor: email, report: email }),
  venue: z.object({ confirmed: z.boolean(), name: bilingualSchema, address: bilingualSchema, directions: bilingualSchema, mapUrl: link, imageUrl: link, imageAlt: bilingualSchema }),
  home: z.object({ sections: blocks }),
  pages: z.object({ about: pageSchema, attend: pageSchema, privacy: pageSchema, conduct: pageSchema }),
  sponsorRecruitment: blockSchema,
  faq: z.object({ greeting: bilingualSchema, items: z.array(z.object({ id: z.string().min(1).max(80), keywords: z.array(z.string().trim().min(1).max(100)).min(1).max(30), answer: bilingualSchema, enabled: z.boolean() })).max(50).refine(rows => new Set(rows.map(row => row.id)).size === rows.length) }),
})
export type SiteContent = z.infer<typeof siteContentSchema>

export function parseSiteContent(settings: Record<string, string>): SiteContent {
  if (settings.site_content && settings.site_content.length > 400000) throw new Error("site_content_too_large")
  return siteContentSchema.parse(settings.site_content ? JSON.parse(settings.site_content) : structuredClone(defaultSiteContent))
}

export function parseSiteContentDraft(settings: Record<string, string>): SiteContent {
  const raw = settings.site_content ? JSON.parse(settings.site_content) : structuredClone(defaultSiteContent)
  const result = siteContentSchema.safeParse(raw)
  if (!result.success && result.error.issues.some(issue => issue.code === "invalid_type" || (issue.code === "custom" && !String(issue.path.at(-1)).endsWith("Url")))) throw new Error("invalid_content_structure")
  return raw as SiteContent
}

export function contentText(value: Bilingual, locale: "en" | "zh"): string {
  return value[locale] || value.en || value.zh
}

export function newContentBlock(id: string): ContentBlock {
  const empty = () => ({ en: "", zh: "" })
  return { id, title: empty(), body: empty(), items: [], imageUrl: "", imageAlt: empty(), linkUrl: "", linkLabel: empty(), enabled: true }
}
