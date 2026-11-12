import { ContentBlocks, ContentLink, ContentPage } from "./content-blocks"
import { contentText, outreachPageVisible, visibleOutreachBlocks } from "@/lib/content/site-content"
import type { SiteContent } from "@/lib/content/site-content"

type Props = { content: SiteContent; locale: "en" | "zh" }
export function OutreachLinks({ content, locale }: Props) {
  if (![content.outreach.media, content.outreach.speakerGuide].some(outreachPageVisible)) return null
  return <nav aria-label={locale === "zh" ? "大会资料" : "Conference resources"} className="flex flex-wrap gap-4 py-3">{(["media", "speakerGuide"] as const).filter(key => outreachPageVisible(content.outreach[key])).map(key => <ContentLink key={key} href={key === "media" ? "/media" : "/speaker-guide"}>{contentText(content.outreach[key].title, locale) || (key === "media" ? (locale === "zh" ? "宣传资料" : "Media resources") : (locale === "zh" ? "讲者指南" : "Speaker guide"))}</ContentLink>)}</nav>
}
export function OutreachPageView({ content, locale, page, preview = false }: Props & { page: "media" | "speakerGuide"; preview?: boolean }) {
  const entry = content.outreach[page]
  if (!outreachPageVisible(entry)) return preview ? <p className="p-8 text-muted-foreground">{locale === "zh" ? "此模块尚未公开或没有可展示内容；前台页面与入口均隐藏。" : "This module is hidden or empty; public links and page are unavailable."}</p> : null
  const sections = visibleOutreachBlocks(entry.sections).map(block => page === "media" && !block.linkUrl && block.imageUrl ? { ...block, linkUrl: block.imageUrl, linkLabel: { en: "Open original image", zh: "查看原图" } } : block)
  return <ContentPage page={{ ...entry, sections }} locale={locale} />
}
export function ProgressView({ content, locale }: Props) {
  const page = content.outreach.progress
  if (!outreachPageVisible(page)) return null
  return <section data-outreach="progress" className="space-y-5 border-y border-border py-8">
    <h2 className="text-2xl font-semibold">{contentText(page.title, locale)}</h2>
    {contentText(page.intro, locale) && <p className="whitespace-pre-line text-muted-foreground">{contentText(page.intro, locale)}</p>}
    {contentText(page.subtitle, locale) && <p className="text-sm text-muted-foreground">{contentText(page.subtitle, locale)}</p>}
    <ContentBlocks blocks={visibleOutreachBlocks(page.sections)} locale={locale} />
  </section>
}
export function SponsorshipView({ content, locale }: Props) {
  const value = content.outreach.sponsorship
  if (!value.enabled) return null
  const tiers = value.tiers.filter(tier => tier.enabled && contentText(tier.title, locale).trim() && (tier.price.en.trim() || tier.price.zh.trim() || tier.availability.en.trim() || tier.availability.zh.trim() || visibleOutreachBlocks([tier]).length))
  if (!tiers.length && !value.prospectusUrl) return null
  return <section data-outreach="sponsorship" className="mb-12 space-y-6 border-y border-border py-8">
    <h2 className="text-2xl font-semibold">{locale === "zh" ? "赞助方案" : "Sponsorship packages"}</h2>
    {value.prospectusUrl && <ContentLink href={value.prospectusUrl}>{locale === "zh" ? "查看招商 PDF" : "View sponsorship PDF"}</ContentLink>}
    <div className="grid gap-5 sm:grid-cols-2">{tiers.map(tier => <article key={tier.id} className="min-w-0 space-y-4 rounded-lg border border-border bg-card p-5 [overflow-wrap:anywhere]">
      <h3 className="text-lg font-semibold">{contentText(tier.title, locale)}</h3>
      {contentText(tier.price, locale) && <p className="font-medium">{contentText(tier.price, locale)}</p>}
      {contentText(tier.availability, locale) && <p className="text-sm text-muted-foreground">{contentText(tier.availability, locale)}</p>}
      <ContentBlocks blocks={[{ ...tier, title: { en: "", zh: "" } }]} locale={locale} />
    </article>)}</div>
  </section>
}
