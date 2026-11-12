"use client"

import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SiteMediaField } from "./site-media-field"
import { BlockFields, BlocksEditor, CopyField, Enabled, MoveButtons } from "./site-content-fields"
import { newOutreachTier } from "@/lib/content/site-content"
import type { SiteContent } from "@/lib/content/site-content"

type Outreach = SiteContent["outreach"]
export function OutreachEditor({ value, onChange, locale }: { value: Outreach; onChange: (value: Outreach) => void; locale: "en" | "zh" }) {
  const label = (zh: string, en: string) => locale === "zh" ? zh : en
  const sponsor = value.sponsorship
  const setSponsor = (next: Outreach["sponsorship"]) => onChange({ ...value, sponsorship: next })
  return <div className="min-w-0 space-y-5" data-setting-path="outreach">
    <h2 className="text-lg font-semibold">{label("筹备资料与赞助方案", "Conference resources and sponsorship")}</h2>
    <p className="text-sm text-muted-foreground">{label("新模块默认隐藏。启用并填写实际内容后才展示；保存草稿不会改变正式网站，需预览确认后发布。", "New modules are hidden by default. Enable and fill them before they appear. Draft saves do not change the live site; preview and publish when ready.")}</p>
    <details className="border-b pb-4"><summary className="cursor-pointer py-2 font-medium">{label("赞助方案与招商 PDF", "Sponsorship packages and prospectus")}</summary><div className="space-y-5 pt-4">
      <Enabled path="outreach.sponsorship.enabled" label={label("公开赞助方案", "Show sponsorship packages")} checked={sponsor.enabled} onChange={enabled => setSponsor({ ...sponsor, enabled })} />
      <SiteMediaField kind="document" path="outreach.sponsorship.prospectusUrl" label={label("招商 PDF", "Sponsorship PDF")} value={sponsor.prospectusUrl} locale={locale} onChange={prospectusUrl => setSponsor({ ...sponsor, prospectusUrl })} />
      {sponsor.tiers.map((tier, index) => {
        const path = `outreach.sponsorship.tiers.${index}`
        const save = (next: typeof tier) => setSponsor({ ...sponsor, tiers: sponsor.tiers.map(row => row.id === tier.id ? next : row) })
        return <details key={tier.id} className="border-b pb-4"><summary className="cursor-pointer break-words py-2">{index + 1}. {tier.title[locale] || tier.title.en || label("新赞助等级", "New sponsorship tier")}</summary><div className="space-y-4 pt-3">
          <MoveButtons index={index} count={sponsor.tiers.length} locale={locale} remove={() => setSponsor({ ...sponsor, tiers: sponsor.tiers.filter(row => row.id !== tier.id) })} move={offset => { const rows = [...sponsor.tiers]; [rows[index], rows[index + offset]] = [rows[index + offset], rows[index]]; setSponsor({ ...sponsor, tiers: rows }) }} />
          <CopyField path={`${path}.price`} label={label("价格说明（未确定可留空）", "Price description (optional)")} value={tier.price} onChange={price => save({ ...tier, price })} />
          <CopyField path={`${path}.availability`} label={label("名额或招募状态（未确定可留空）", "Availability or recruitment status (optional)")} value={tier.availability} onChange={availability => save({ ...tier, availability })} />
          <BlockFields path={path} value={tier} locale={locale} onChange={next => save({ ...tier, ...next })} />
        </div></details>
      })}
      <Button type="button" variant="outline" disabled={sponsor.tiers.length >= 20} onClick={() => setSponsor({ ...sponsor, tiers: [...sponsor.tiers, newOutreachTier(crypto.randomUUID())] })}><Plus />{label("添加赞助等级", "Add sponsorship tier")}</Button>
    </div></details>
    {(["media", "speakerGuide", "progress"] as const).map(key => {
      const page = value[key], path = `outreach.${key}`
      const save = (next: typeof page) => onChange({ ...value, [key]: next })
      const title = { media: label("宣传资料中心", "Media resources"), speakerGuide: label("讲者指南", "Speaker guide"), progress: label("首页筹备进展", "Homepage updates") }[key]
      return <details key={key} className="border-b pb-4"><summary className="cursor-pointer py-2 font-medium">{title}</summary><div className="space-y-4 pt-4">
        <Enabled path={`${path}.enabled`} label={label("公开此模块及入口", "Show module and links")} checked={page.enabled} onChange={enabled => save({ ...page, enabled })} />
        <CopyField path={`${path}.title`} label={label("标题", "Title")} value={page.title} onChange={title => save({ ...page, title })} />
        <CopyField path={`${path}.intro`} label={label("导语", "Introduction")} multiline value={page.intro} onChange={intro => save({ ...page, intro })} />
        <CopyField path={`${path}.subtitle`} label={label("补充说明或更新时间", "Note or update date")} value={page.subtitle} onChange={subtitle => save({ ...page, subtitle })} />
        <BlocksEditor path={`${path}.sections`} rows={page.sections} locale={locale} onChange={sections => save({ ...page, sections })} />
      </div></details>
    })}
  </div>
}
