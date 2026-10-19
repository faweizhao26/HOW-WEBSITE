"use client"

import { useEffect, useRef, useState } from "react"
import { Printer, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { buildBadgeHTML, fitBadgeDocument } from "@/lib/admin/badge"
import { defaultBadgePrintConfig, parseBadgePrintSettings, type BadgePrintConfig } from "@/lib/admin/badge-settings"
import { openBadgePrintWindow, printBadgeWindow } from "@/lib/admin/badge-print"
import type { Locale } from "@/lib/i18n/utils"

function BadgePreview({ html, config, locale }: { html: string; config: BadgePrintConfig; locale: Locale }) {
  const container = useRef<HTMLDivElement>(null)
  const [available, setAvailable] = useState(0)
  const [fits, setFits] = useState(true)
  useEffect(() => {
    const target = container.current
    if (!target) return
    const observer = new ResizeObserver(entries => setAvailable(entries[0].contentRect.width))
    observer.observe(target)
    return () => observer.disconnect()
  }, [])
  const width = config.widthMm * 96 / 25.4
  const height = config.heightMm * 96 / 25.4
  const scale = Math.min(1, available ? available / width : 1)
  return <div ref={container} className="min-w-0 space-y-3">
    <div className="relative bg-white outline outline-neutral-300" style={{ width: width * scale, height: height * scale, maxWidth: "100%" }}>
      <iframe title={locale === "zh" ? "胸牌样张" : "Badge sample"} srcDoc={html} sandbox="allow-same-origin" scrolling="no"
        className="absolute left-0 top-0 border-0" style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left" }}
        onLoad={event => { const document = event.currentTarget.contentDocument; if (document) setFits(fitBadgeDocument(document)) }} />
    </div>
    {!fits && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{locale === "zh" ? "文字超出标签，请增大纸张或减少显示字段。" : "Text exceeds the label. Increase the paper size or hide optional fields."}</p>}
  </div>
}

export function BadgePrintSettings({ settings, locale, disabled, onChange }: {
  settings: Record<string, string>; locale: Locale; disabled: boolean; onChange: (value: string) => void
}) {
  const [name, setName] = useState("张三 / Alex Zhang")
  const [company, setCompany] = useState("示例科技有限公司 / Example Technology")
  let config: BadgePrintConfig | null = null
  try { config = parseBadgePrintSettings(settings) } catch { /* Keep invalid drafts available for correction. */ }
  // Preserve incomplete numeric edits instead of replacing them with defaults.
  let raw: Partial<BadgePrintConfig> = { ...defaultBadgePrintConfig }
  try { if (settings.badge_print?.trim()) raw = JSON.parse(settings.badge_print) || {} } catch { raw = {} }
  const update = (patch: Partial<BadgePrintConfig>) => onChange(JSON.stringify({ ...raw, ...patch }))
  const html = config ? buildBadgeHTML({ name, company, ticket_types: { name: "Community Pass", name_zh: "社区票" } }, locale, settings) : null

  async function testPrint() {
    if (!html) return
    let popup: Window | undefined
    try {
      popup = openBadgePrintWindow()
      await printBadgeWindow(popup, html)
    } catch (error) {
      popup?.close()
      const code = error instanceof Error ? error.message : ""
      toast.error(code === "popup_blocked"
        ? (locale === "zh" ? "打印窗口被拦截，请允许弹出窗口后重试。" : "Allow popups and try again.")
        : (locale === "zh" ? "无法打印，请检查标签尺寸和文字是否完整。" : "Unable to print. Check the label size and text fit."))
    }
  }

  return <section data-setting-path="badge_print" className="space-y-5 border-t pt-6" id="badge-print-settings">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">{locale === "zh" ? "胸牌打印" : "Badge printing"}</h2>
      <Button type="button" variant="outline" size="sm" onClick={testPrint} disabled={disabled || !html}><Printer />{locale === "zh" ? "试打样张" : "Print sample"}</Button>
    </div>
    <fieldset disabled={disabled} className="min-w-0 space-y-5">
      <div className="grid gap-5 sm:grid-cols-3">
        {([
          ["widthMm", locale === "zh" ? "纸张宽度（mm）" : "Paper width (mm)", 40, 150],
          ["heightMm", locale === "zh" ? "纸张高度（mm）" : "Paper height (mm)", 25, 150],
          ["paddingMm", locale === "zh" ? "内边距（mm）" : "Padding (mm)", 0, 8],
        ] as const).map(([key, label, min, max]) => <div key={key} className="space-y-2"><Label htmlFor={`badge-${key}`}>{label}</Label><Input id={`badge-${key}`} type="number" min={min} max={max} step="0.5" value={typeof raw[key] === "number" ? raw[key] : ""} aria-invalid={!config} onChange={event => update({ [key]: event.target.value === "" ? undefined : event.target.valueAsNumber })} /></div>)}
      </div>
      <div className="space-y-2"><Label htmlFor="badge-style">{locale === "zh" ? "打印样式" : "Print style"}</Label>
        <select id="badge-style" value={raw.style || ""} onChange={event => update({ style: event.target.value as BadgePrintConfig["style"] })} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
          {!raw.style && <option value="" disabled>{locale === "zh" ? "请选择" : "Select"}</option>}
          <option value="mono">{locale === "zh" ? "黑白标签" : "Black and white"}</option><option value="color">{locale === "zh" ? "绿色彩印" : "Green color badge"}</option>
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">{([
        ["showConference", locale === "zh" ? "大会名称" : "Conference name"],
        ["showCompany", locale === "zh" ? "单位" : "Company"],
        ["showTicket", locale === "zh" ? "票种" : "Ticket type"],
      ] as const).map(([key, label]) => <div key={key} className="flex items-center justify-between gap-3"><Label htmlFor={`badge-${key}`}>{label}</Label><Switch id={`badge-${key}`} checked={raw[key] === true} onCheckedChange={checked => update({ [key]: checked })} /></div>)}</div>
      {!config && <div className="space-y-3"><p role="alert" className="text-sm text-red-700 dark:text-red-400">{locale === "zh" ? "打印配置无效，请检查尺寸和内边距，或恢复默认配置。" : "Invalid print configuration. Check dimensions and padding, or restore defaults."}</p><Button type="button" variant="outline" onClick={() => onChange(JSON.stringify(defaultBadgePrintConfig))}><RotateCcw />{locale === "zh" ? "恢复默认配置" : "Restore defaults"}</Button></div>}
      <div className="grid gap-5 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="badge-sample-name">{locale === "zh" ? "样张姓名" : "Sample name"}</Label><Input id="badge-sample-name" value={name} maxLength={200} onChange={event => setName(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="badge-sample-company">{locale === "zh" ? "样张单位" : "Sample company"}</Label><Input id="badge-sample-company" value={company} maxLength={300} onChange={event => setCompany(event.target.value)} /></div></div>
    </fieldset>
    {html && config && <div className="space-y-3 bg-muted/40 p-4"><p className="text-sm font-medium">{locale === "zh" ? "虚拟信息样张" : "Sample data"} · {config.widthMm} × {config.heightMm} mm</p><BadgePreview html={html} config={config} locale={locale} /></div>}
  </section>
}
