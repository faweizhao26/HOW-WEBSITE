"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Monitor, Smartphone } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { SettingsPreviewPage } from "./settings-preview-frame"

const pageLabels = {
  home: { en: "Home", zh: "首页" }, about: { en: "About", zh: "关于" },
  attend: { en: "Attend", zh: "参会指南" }, venue: { en: "Venue", zh: "会场" },
  sponsors: { en: "Sponsors", zh: "赞助商" }, privacy: { en: "Privacy", zh: "隐私条款" },
  conduct: { en: "Code of Conduct", zh: "行为准则" }, cfp: { en: "CFP", zh: "征稿" }, faq: { en: "FAQ", zh: "常见问题" },
} satisfies Record<SettingsPreviewPage, { en: string; zh: string }>
const settingsPreviewPages = Object.keys(pageLabels) as SettingsPreviewPage[]

export function SettingsPreview({ open, onOpenChange, settings, locale }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: Record<string, string>
  locale: "en" | "zh"
}) {
  const iframe = useRef<HTMLIFrameElement>(null)
  const [page, setPage] = useState<SettingsPreviewPage>("home")
  const [language, setLanguage] = useState(locale)
  const [theme, setTheme] = useState<"light" | "dark">("light")
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop")
  const sendDraft = useCallback(() => {
    if (!open) return
    iframe.current?.contentWindow?.postMessage({ type: "how-settings-preview", settings, locale: language, page, theme }, window.location.origin)
  }, [open, settings, language, page, theme])

  useEffect(() => {
    function ready(event: MessageEvent) {
      if (event.source !== iframe.current?.contentWindow || event.origin !== window.location.origin) return
      if (event.data?.type === "how-settings-preview-ready") sendDraft()
    }
    window.addEventListener("message", ready)
    sendDraft()
    return () => window.removeEventListener("message", ready)
  }, [sendDraft])

  const selectClass = "h-9 min-w-0 max-w-full rounded-md border bg-background px-2 text-sm"
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92dvh] w-[calc(100%-1rem)] max-w-[1200px] flex-col rounded-lg sm:max-w-[1200px]" aria-describedby={undefined}>
        <DialogHeader className="pr-10"><DialogTitle>{locale === "zh" ? "草稿预览" : "Draft preview"}</DialogTitle></DialogHeader>
        <div className="flex flex-wrap items-end gap-3 border-b pb-3">
          <label className="min-w-0 space-y-1"><span className="block text-xs text-muted-foreground">{locale === "zh" ? "页面" : "Page"}</span><select className={selectClass} value={page} onChange={event => setPage(event.target.value as SettingsPreviewPage)}>{settingsPreviewPages.map(value => <option key={value} value={value}>{pageLabels[value][locale]}</option>)}</select></label>
          <label className="space-y-1"><span className="block text-xs text-muted-foreground">{locale === "zh" ? "语言" : "Language"}</span><select className={selectClass} value={language} onChange={event => setLanguage(event.target.value as "en" | "zh")}><option value="en">EN</option><option value="zh">ZH</option></select></label>
          <label className="space-y-1"><span className="block text-xs text-muted-foreground">{locale === "zh" ? "主题" : "Theme"}</span><select className={selectClass} value={theme} onChange={event => setTheme(event.target.value as "light" | "dark")}><option value="light">{locale === "zh" ? "日间" : "Light"}</option><option value="dark">{locale === "zh" ? "夜间" : "Dark"}</option></select></label>
          <div className="flex gap-1">
            <Button type="button" size="icon" variant={device === "desktop" ? "secondary" : "ghost"} aria-pressed={device === "desktop"} aria-label={locale === "zh" ? "桌面视图" : "Desktop view"} title={locale === "zh" ? "桌面视图" : "Desktop view"} onClick={() => setDevice("desktop")}><Monitor className="size-4" /></Button>
            <Button type="button" size="icon" variant={device === "mobile" ? "secondary" : "ghost"} aria-pressed={device === "mobile"} aria-label={locale === "zh" ? "手机视图" : "Mobile view"} title={locale === "zh" ? "手机视图" : "Mobile view"} onClick={() => setDevice("mobile")}><Smartphone className="size-4" /></Button>
          </div>
        </div>
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden bg-muted/30">
          <iframe ref={iframe} src="/admin/preview" title={locale === "zh" ? "草稿页面预览" : "Draft page preview"} onLoad={sendDraft} className="mx-auto block h-full max-w-full border-0 bg-background" style={{ width: device === "mobile" ? 390 : 1120 }} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
