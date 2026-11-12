"use client"

import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SiteMediaField } from "./site-media-field"
import { OutreachEditor } from "./outreach-editor"
import { BlocksEditor, BlockFields, CopyField, Enabled, MoveButtons, UrlField, moved } from "./site-content-fields"
import type { SiteContent } from "@/lib/content/site-content"

type Props = { value: SiteContent; onChange: (value: SiteContent) => void; locale: "en" | "zh"; disabled: boolean }
const names = { home: { zh: "首页栏目", en: "Home sections" }, about: { zh: "关于大会", en: "About" }, attend: { zh: "参会指南", en: "Attendee guide" }, privacy: { zh: "隐私条款", en: "Privacy policy" }, conduct: { zh: "行为准则", en: "Code of conduct" } }

export function SiteContentEditor({ value, onChange, locale, disabled }: Props) {
  const label = (zh: string, en: string) => locale === "zh" ? zh : en
  const setVenue = <K extends keyof SiteContent["venue"]>(key: K, next: SiteContent["venue"][K]) => onChange({ ...value, venue: { ...value.venue, [key]: next } })
  return <fieldset data-setting-path="site_content" disabled={disabled} className="min-w-0 space-y-5 border-t pt-6">
    <OutreachEditor value={value.outreach} locale={locale} onChange={outreach => onChange({ ...value, outreach })} />
    <h2 className="text-lg font-semibold">{label("页面内容", "Page content")}</h2>
    <details className="border-b pb-4"><summary className="cursor-pointer py-2 font-medium">{label("会场与联系方式", "Venue and contacts")}</summary><div className="space-y-4 pt-4">
      <Enabled path="venue.confirmed" label={label("会场已确认", "Venue confirmed")} checked={value.venue.confirmed} onChange={next => setVenue("confirmed", next)} />
      {(["name", "address", "directions", "imageAlt"] as const).map(key => <CopyField key={key} path={`venue.${key}`} label={{ name: label("会场名称", "Venue name"), address: label("地址", "Address"), directions: label("现场指引", "On-site directions"), imageAlt: label("会场图片说明", "Venue image description") }[key]} value={value.venue[key]} multiline={key === "directions"} onChange={next => setVenue(key, next)} />)}
      <UrlField path="venue.mapUrl" label={label("地图链接", "Map URL")} value={value.venue.mapUrl} onChange={next => setVenue("mapUrl", next)} />
      <SiteMediaField path="venue.imageUrl" locale={locale} kind="image" label={label("会场图片链接", "Venue image URL")} value={value.venue.imageUrl} onChange={next => setVenue("imageUrl", next)} />
      {(["sponsor", "report"] as const).map(key => <UrlField key={key} path={`contacts.${key}`} label={key === "sponsor" ? label("赞助咨询邮箱", "Sponsor contact email") : label("行为准则举报邮箱", "Conduct reporting email")} value={value.contacts[key]} onChange={next => onChange({ ...value, contacts: { ...value.contacts, [key]: next } })} />)}
    </div></details>
    <details className="border-b pb-4"><summary className="cursor-pointer py-2 font-medium">{names.home[locale]}</summary><div className="pt-4"><BlocksEditor path="home.sections" rows={value.home.sections} locale={locale} onChange={sections => onChange({ ...value, home: { sections } })} /></div></details>
    {(["about", "attend", "privacy", "conduct"] as const).map(key => <details key={key} className="border-b pb-4"><summary className="cursor-pointer py-2 font-medium">{names[key][locale]}</summary><div className="space-y-4 pt-4">
      <CopyField path={`pages.${key}.title`} label={label("页面标题", "Page title")} value={value.pages[key].title} onChange={title => onChange({ ...value, pages: { ...value.pages, [key]: { ...value.pages[key], title } } })} />
      <CopyField path={`pages.${key}.intro`} label={label("导语", "Introduction")} multiline value={value.pages[key].intro} onChange={intro => onChange({ ...value, pages: { ...value.pages, [key]: { ...value.pages[key], intro } } })} />
      <CopyField path={`pages.${key}.subtitle`} label={label("副标题或生效日期", "Subtitle or effective date")} value={value.pages[key].subtitle} onChange={subtitle => onChange({ ...value, pages: { ...value.pages, [key]: { ...value.pages[key], subtitle } } })} />
      <BlocksEditor path={`pages.${key}.sections`} rows={value.pages[key].sections} locale={locale} onChange={sections => onChange({ ...value, pages: { ...value.pages, [key]: { ...value.pages[key], sections } } })} />
    </div></details>)}
    <details className="border-b pb-4"><summary className="cursor-pointer py-2 font-medium">{label("赞助招募", "Sponsor recruitment")}</summary><div className="pt-4"><BlockFields path="sponsorRecruitment" value={value.sponsorRecruitment} locale={locale} onChange={sponsorRecruitment => onChange({ ...value, sponsorRecruitment })} /></div></details>
    <details className="border-b pb-4"><summary className="cursor-pointer py-2 font-medium">{label("大会问答", "Conference FAQ")}</summary><div className="space-y-5 pt-4">
      <CopyField path="faq.greeting" label={label("欢迎语", "Greeting")} value={value.faq.greeting} onChange={greeting => onChange({ ...value, faq: { ...value.faq, greeting } })} />
      {value.faq.items.map((item, index) => <details key={item.id} className="border-b pb-4"><summary className="cursor-pointer break-words py-2">{index + 1}. {item.keywords.join(", ")}</summary><div className="space-y-4 pt-3">
        <MoveButtons index={index} count={value.faq.items.length} locale={locale} move={offset => onChange({ ...value, faq: { ...value.faq, items: moved(value.faq.items, index, offset) } })} remove={() => onChange({ ...value, faq: { ...value.faq, items: value.faq.items.filter(row => row.id !== item.id) } })} />
        <Enabled path={`faq.items.${index}.enabled`} label={label("启用此问答", "Enable answer")} checked={item.enabled} onChange={enabled => onChange({ ...value, faq: { ...value.faq, items: value.faq.items.map(row => row.id === item.id ? { ...row, enabled } : row) } })} />
        <UrlField path={`faq.items.${index}.keywords`} label={label("关键词（逗号分隔）", "Keywords (comma separated)")} value={item.keywords.join(", ")} onChange={next => onChange({ ...value, faq: { ...value.faq, items: value.faq.items.map(row => row.id === item.id ? { ...row, keywords: next.split(/[,，]/).map(word => word.trim()) } : row) } })} />
        <CopyField path={`faq.items.${index}.answer`} label={label("答案", "Answer")} multiline value={item.answer} onChange={answer => onChange({ ...value, faq: { ...value.faq, items: value.faq.items.map(row => row.id === item.id ? { ...row, answer } : row) } })} />
      </div></details>)}
      <Button type="button" variant="outline" disabled={value.faq.items.length >= 50} onClick={() => onChange({ ...value, faq: { ...value.faq, items: [...value.faq.items, { id: crypto.randomUUID(), keywords: [], answer: { en: "", zh: "" }, enabled: true }] } })}><Plus />{label("添加问答", "Add FAQ")}</Button>
    </div></details>
  </fieldset>
}
