"use client"

import { useId } from "react"
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { SiteMediaField } from "./site-media-field"
import { contentText, newContentBlock } from "@/lib/content/site-content"
import type { Bilingual, ContentBlock } from "@/lib/content/site-content"
import { isPastConferenceEntry, newPastConferenceEntry, newPastConferencesSection, pastConferencesId } from "@/lib/content/past-conferences"

export function CopyField({ label, path, value, onChange, multiline = false }: { label: string; path: string; value: Bilingual; onChange: (value: Bilingual) => void; multiline?: boolean }) {
  const id = useId()
  const Control = multiline ? Textarea : Input
  return <div data-setting-path={path} className="grid gap-4 sm:grid-cols-2">{(["en", "zh"] as const).map(language => <div key={language} className="space-y-2"><Label htmlFor={`${id}-${language}`}>{label} ({language === "zh" ? "中文" : "English"})</Label><Control id={`${id}-${language}`} data-setting-path={`${path}.${language}`} value={value[language]} maxLength={10000} onChange={event => onChange({ ...value, [language]: event.target.value })} /></div>)}</div>
}

export function UrlField({ label, path, value, onChange }: { label: string; path: string; value: string; onChange: (value: string) => void }) {
  const id = useId()
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} data-setting-path={path} value={value} maxLength={2048} onChange={event => onChange(event.target.value)} /></div>
}

export function Enabled({ label, path, checked, onChange }: { label: string; path: string; checked: boolean; onChange: (checked: boolean) => void }) {
  const id = useId()
  return <div data-setting-path={path} className="flex items-center justify-between gap-4"><Label htmlFor={id}>{label}</Label><Switch id={id} checked={checked} onCheckedChange={onChange} /></div>
}

export function BlockFields({ value, path, onChange, locale, showEnabled = true }: { value: ContentBlock; path: string; onChange: (value: ContentBlock) => void; locale: "en" | "zh"; showEnabled?: boolean }) {
  const label = (zh: string, en: string) => locale === "zh" ? zh : en
  const set = <K extends keyof ContentBlock>(key: K, next: ContentBlock[K]) => onChange({ ...value, [key]: next })
  return <div data-setting-path={path} className="space-y-4">
    {showEnabled && <Enabled path={`${path}.enabled`} label={label("显示此栏目", "Show section")} checked={value.enabled} onChange={next => set("enabled", next)} />}
    <CopyField path={`${path}.title`} label={label("标题", "Title")} value={value.title} onChange={next => set("title", next)} />
    <CopyField path={`${path}.body`} label={label("正文", "Body")} value={value.body} multiline onChange={next => set("body", next)} />
    <CopyField path={`${path}.items`} label={label("列表项目（每行一项）", "List items (one per line)")} multiline value={{ en: value.items.map(item => item.en).join("\n"), zh: value.items.map(item => item.zh).join("\n") }} onChange={next => { const en = next.en.split("\n"), zh = next.zh.split("\n"); set("items", Array.from({ length: Math.max(en.length, zh.length) }, (_, index) => ({ en: en[index] || "", zh: zh[index] || "" }))) }} />
    <SiteMediaField path={`${path}.imageUrl`} locale={locale} kind="image" label={label("图片链接", "Image URL")} value={value.imageUrl} onChange={next => set("imageUrl", next)} />
    <CopyField path={`${path}.imageAlt`} label={label("图片说明", "Image description")} value={value.imageAlt} onChange={next => set("imageAlt", next)} />
    <SiteMediaField path={`${path}.linkUrl`} locale={locale} kind="document" label={label("页面或资料链接", "Page or document URL")} value={value.linkUrl} onChange={next => set("linkUrl", next)} />
    <CopyField path={`${path}.linkLabel`} label={label("链接文字", "Link label")} value={value.linkLabel} onChange={next => set("linkLabel", next)} />
  </div>
}

export function MoveButtons({ index, count, move, remove, locale }: { index: number; count: number; move: (offset: number) => void; remove: () => void; locale: "en" | "zh" }) {
  return <div className="flex gap-2">
    <Button type="button" variant="outline" size="icon" title={locale === "zh" ? "上移" : "Move up"} aria-label={locale === "zh" ? "上移" : "Move up"} disabled={index === 0} onClick={() => move(-1)}><ArrowUp /></Button>
    <Button type="button" variant="outline" size="icon" title={locale === "zh" ? "下移" : "Move down"} aria-label={locale === "zh" ? "下移" : "Move down"} disabled={index === count - 1} onClick={() => move(1)}><ArrowDown /></Button>
    <Button type="button" variant="outline" size="icon" title={locale === "zh" ? "删除" : "Delete"} aria-label={locale === "zh" ? "删除" : "Delete"} onClick={remove}><Trash2 /></Button>
  </div>
}

export function moved<T>(rows: T[], index: number, offset: number): T[] {
  const next = [...rows]
  ;[next[index], next[index + offset]] = [next[index + offset], next[index]]
  return next
}

type BlocksEditorProps = { rows: ContentBlock[]; path: string; onChange: (rows: ContentBlock[]) => void; locale: "en" | "zh" }

function PastConferenceEntryFields({ value, path, onChange, locale }: {
  value: ContentBlock; path: string; onChange: (value: ContentBlock) => void; locale: "en" | "zh"
}) {
  const id = useId()
  const zh = locale === "zh"
  return <div className="space-y-3">
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <div className="space-y-2">
        <Label htmlFor={`${id}-title`}>{zh ? "届次名称" : "Edition name"}</Label>
        <Input id={`${id}-title`} data-setting-path={`${path}.title`} maxLength={200} placeholder="HOW 2026" value={contentText(value.title, locale)} onChange={event => {
          const name = event.target.value
          onChange({ ...value, title: { zh: name, en: name } })
        }} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-url`}>{zh ? "往届网址" : "Edition URL"}</Label>
        <Input id={`${id}-url`} data-setting-path={`${path}.linkUrl`} inputMode="url" maxLength={2048} placeholder="https://..." value={value.linkUrl} onChange={event => onChange({ ...value, linkUrl: event.target.value.trim() })} />
      </div>
    </div>
    <Enabled path={`${path}.enabled`} label={zh ? "显示此链接" : "Show this link"} checked={value.enabled} onChange={enabled => onChange({ ...value, enabled })} />
  </div>
}

function PastConferencesFields({ rows, path, onChange, locale, sectionIndex }: BlocksEditorProps & { sectionIndex: number }) {
  const section = rows[sectionIndex]
  const zh = locale === "zh"
  const entries = rows.flatMap((row, index) => isPastConferenceEntry(row) ? [{ row, index }] : [])
  const replace = (index: number, value: ContentBlock) => onChange(rows.map((row, i) => i === index ? value : row))
  return <div className="min-w-0 space-y-4">
    <Enabled path={`${path}.${sectionIndex}.enabled`} label={zh ? "显示往届回顾" : "Show past conferences"} checked={section.enabled} onChange={enabled => replace(sectionIndex, { ...section, enabled })} />
    {entries.map(({ row, index }, order) => <fieldset key={row.id} className="min-w-0 space-y-3 rounded-md border p-3">
      <legend className="max-w-full break-words px-1 text-sm font-medium">{contentText(row.title, locale).trim() || (zh ? "新往届链接" : "New edition link")}</legend>
      <PastConferenceEntryFields path={`${path}.${index}`} value={row} locale={locale} onChange={next => replace(index, next)} />
      <MoveButtons index={order} count={entries.length} locale={locale} move={offset => onChange(moved(rows, index, entries[order + offset].index - index))} remove={() => onChange(rows.filter(item => item.id !== row.id))} />
    </fieldset>)}
    <Button type="button" variant="outline" disabled={rows.length >= 50} onClick={() => onChange([...rows, newPastConferenceEntry(crypto.randomUUID())])}>
      <Plus />{zh ? "添加往届链接" : "Add edition link"}
    </Button>
    <details className="border-t pt-2">
      <summary className="cursor-pointer py-2 text-sm font-medium">{zh ? "栏目标题与原有内容" : "Section title and existing content"}</summary>
      <BlockFields path={`${path}.${sectionIndex}`} value={section} locale={locale} showEnabled={false} onChange={next => replace(sectionIndex, next)} />
    </details>
  </div>
}

export function BlocksEditor({ rows, path, onChange, locale, pastConferences = false }: BlocksEditorProps & { pastConferences?: boolean }) {
  const zh = locale === "zh"
  const sections = rows.flatMap((row, index) => pastConferences && isPastConferenceEntry(row) ? [] : [{ row, index }])
  const isPastSection = (row: ContentBlock) => pastConferences && row.id === pastConferencesId
  return <div data-setting-path={path} className="space-y-4">
    {sections.map(({ row, index }, order) => <details key={row.id} className="border-b pb-4">
      <summary className="cursor-pointer break-words py-2 font-medium">{order + 1}. {row.title[locale] || row.title.en || (zh ? "新栏目" : "New section")}</summary>
      <div className="space-y-4 pt-3">
        <MoveButtons index={order} count={sections.length} locale={locale}
          move={offset => onChange(moved(rows, index, sections[order + offset].index - index))}
          remove={() => onChange(rows.filter(item => item.id !== row.id && !(isPastSection(row) && isPastConferenceEntry(item))))} />
        {isPastSection(row)
          ? <PastConferencesFields rows={rows} path={path} onChange={onChange} locale={locale} sectionIndex={index} />
          : <BlockFields path={`${path}.${index}`} value={row} locale={locale} onChange={next => onChange(rows.map(item => item.id === row.id ? next : item))} />}
      </div>
    </details>)}
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" disabled={rows.length >= 50} onClick={() => onChange([...rows, newContentBlock(crypto.randomUUID())])}><Plus />{zh ? "添加栏目" : "Add section"}</Button>
      {pastConferences && !sections.some(({ row }) => isPastSection(row)) && <Button type="button" variant="outline" disabled={rows.length >= 50} onClick={() => onChange([...rows, newPastConferencesSection()])}><Plus />{zh ? "添加往届回顾栏目" : "Add past conferences section"}</Button>}
    </div>
  </div>
}
