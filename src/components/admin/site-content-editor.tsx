"use client"

import { useId } from "react"
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { SiteMediaField } from "@/components/admin/site-media-field"
import { newContentBlock } from "@/lib/content/site-content"
import type { Bilingual, ContentBlock, SiteContent } from "@/lib/content/site-content"

type Props = { value: SiteContent; onChange: (value: SiteContent) => void; locale: "en" | "zh"; disabled: boolean }
const names = { home: { zh: "首页栏目", en: "Home sections" }, about: { zh: "关于大会", en: "About" }, attend: { zh: "参会指南", en: "Attendee guide" }, privacy: { zh: "隐私条款", en: "Privacy policy" }, conduct: { zh: "行为准则", en: "Code of conduct" } }

function CopyField({ label, path, value, onChange, multiline = false }: { label: string; path: string; value: Bilingual; onChange: (value: Bilingual) => void; multiline?: boolean }) {
  const id = useId()
  const Control = multiline ? Textarea : Input
  return <div data-setting-path={path} className="grid gap-4 sm:grid-cols-2">{(["en", "zh"] as const).map(language => <div key={language} className="space-y-2"><Label htmlFor={`${id}-${language}`}>{label} ({language === "zh" ? "中文" : "English"})</Label><Control id={`${id}-${language}`} data-setting-path={`${path}.${language}`} value={value[language]} maxLength={10000} onChange={event => onChange({ ...value, [language]: event.target.value })} /></div>)}</div>
}

function UrlField({ label, path, value, onChange }: { label: string; path: string; value: string; onChange: (value: string) => void }) {
  const id = useId()
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} data-setting-path={path} value={value} maxLength={2048} onChange={event => onChange(event.target.value)} /></div>
}

function Enabled({ label, path, checked, onChange }: { label: string; path: string; checked: boolean; onChange: (checked: boolean) => void }) {
  const id = useId()
  return <div data-setting-path={path} className="flex items-center justify-between gap-4"><Label htmlFor={id}>{label}</Label><Switch id={id} checked={checked} onCheckedChange={onChange} /></div>
}

function BlockFields({ value, path, onChange, locale }: { value: ContentBlock; path: string; onChange: (value: ContentBlock) => void; locale: "en" | "zh" }) {
  const label = (zh: string, en: string) => locale === "zh" ? zh : en
  const set = <K extends keyof ContentBlock>(key: K, next: ContentBlock[K]) => onChange({ ...value, [key]: next })
  return <div data-setting-path={path} className="space-y-4">
    <Enabled path={`${path}.enabled`} label={label("显示此栏目", "Show section")} checked={value.enabled} onChange={next => set("enabled", next)} />
    <CopyField path={`${path}.title`} label={label("标题", "Title")} value={value.title} onChange={next => set("title", next)} />
    <CopyField path={`${path}.body`} label={label("正文", "Body")} value={value.body} multiline onChange={next => set("body", next)} />
    <CopyField path={`${path}.items`} label={label("列表项目（每行一项）", "List items (one per line)")} multiline value={{ en: value.items.map(item => item.en).join("\n"), zh: value.items.map(item => item.zh).join("\n") }} onChange={next => { const en = next.en.split("\n"), zh = next.zh.split("\n"); set("items", Array.from({ length: Math.max(en.length, zh.length) }, (_, index) => ({ en: en[index] || "", zh: zh[index] || "" }))) }} />
    <SiteMediaField path={`${path}.imageUrl`} locale={locale} kind="image" label={label("图片链接", "Image URL")} value={value.imageUrl} onChange={next => set("imageUrl", next)} />
    <CopyField path={`${path}.imageAlt`} label={label("图片说明", "Image description")} value={value.imageAlt} onChange={next => set("imageAlt", next)} />
    <SiteMediaField path={`${path}.linkUrl`} locale={locale} kind="document" label={label("页面或资料链接", "Page or document URL")} value={value.linkUrl} onChange={next => set("linkUrl", next)} />
    <CopyField path={`${path}.linkLabel`} label={label("链接文字", "Link label")} value={value.linkLabel} onChange={next => set("linkLabel", next)} />
  </div>
}

function MoveButtons({ index, count, move, remove, locale }: { index: number; count: number; move: (offset: number) => void; remove: () => void; locale: "en" | "zh" }) {
  return <div className="flex gap-2">
    <Button type="button" variant="outline" size="icon" title={locale === "zh" ? "上移" : "Move up"} aria-label={locale === "zh" ? "上移" : "Move up"} disabled={index === 0} onClick={() => move(-1)}><ArrowUp /></Button>
    <Button type="button" variant="outline" size="icon" title={locale === "zh" ? "下移" : "Move down"} aria-label={locale === "zh" ? "下移" : "Move down"} disabled={index === count - 1} onClick={() => move(1)}><ArrowDown /></Button>
    <Button type="button" variant="outline" size="icon" title={locale === "zh" ? "删除" : "Delete"} aria-label={locale === "zh" ? "删除" : "Delete"} onClick={remove}><Trash2 /></Button>
  </div>
}

function moved<T>(rows: T[], index: number, offset: number): T[] {
  const next = [...rows]
  ;[next[index], next[index + offset]] = [next[index + offset], next[index]]
  return next
}

function BlocksEditor({ rows, path, onChange, locale }: { rows: ContentBlock[]; path: string; onChange: (rows: ContentBlock[]) => void; locale: "en" | "zh" }) {
  return <div data-setting-path={path} className="space-y-4">{rows.map((row, index) => <details key={row.id} className="border-b pb-4"><summary className="cursor-pointer break-words py-2 font-medium">{index + 1}. {row.title[locale] || row.title.en || (locale === "zh" ? "新栏目" : "New section")}</summary><div className="space-y-4 pt-3"><MoveButtons index={index} count={rows.length} locale={locale} move={offset => onChange(moved(rows, index, offset))} remove={() => onChange(rows.filter(item => item.id !== row.id))} /><BlockFields path={`${path}.${index}`} value={row} locale={locale} onChange={next => onChange(rows.map(item => item.id === row.id ? next : item))} /></div></details>)}<Button type="button" variant="outline" disabled={rows.length >= 50} onClick={() => onChange([...rows, newContentBlock(crypto.randomUUID())])}><Plus />{locale === "zh" ? "添加栏目" : "Add section"}</Button></div>
}

export function SiteContentEditor({ value, onChange, locale, disabled }: Props) {
  const label = (zh: string, en: string) => locale === "zh" ? zh : en
  const setVenue = <K extends keyof SiteContent["venue"]>(key: K, next: SiteContent["venue"][K]) => onChange({ ...value, venue: { ...value.venue, [key]: next } })
  return <fieldset data-setting-path="site_content" disabled={disabled} className="min-w-0 space-y-5 border-t pt-6">
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
