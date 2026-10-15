"use client"

import { CFPPolicySummary } from "@/components/content/cfp-policy-summary"
import { useEffect, useState } from "react"
import type { MouseEvent, FormEvent } from "react"
import { HomeView, SitePageView, VenueView, SponsorsView } from "@/components/content/site-views"
import { ContentUnavailable } from "@/components/content/content-blocks"
import { LocaleProvider } from "@/lib/i18n/provider"
import { getSettingsIssues } from "@/lib/content/settings-validation"
import { contentText, parseSiteContent } from "@/lib/content/site-content"
import type { SiteContent } from "@/lib/content/site-content"
import { getConferenceAnswer } from "@/lib/content/conference-faq"
import { parseCFPSettings } from "@/lib/cfp/settings"
import { cfp } from "@/lib/i18n/translations"
import type { PublishedSession, PublishedSponsor, PublicContentResult } from "@/lib/content/types"

export const settingsPreviewPages = ["home", "about", "attend", "venue", "sponsors", "privacy", "conduct", "cfp", "faq"] as const
export type SettingsPreviewPage = typeof settingsPreviewPages[number]
export type SettingsPreviewMessage = {
  type: "how-settings-preview"
  settings: Record<string, string>
  locale: "en" | "zh"
  page: SettingsPreviewPage
  theme: "light" | "dark"
}

function isSettings(value: unknown): value is Record<string, string> {
  return !!value && typeof value === "object" && !Array.isArray(value)
    && Object.values(value).every(entry => typeof entry === "string")
}

export function readSettingsPreviewMessage(event: Pick<MessageEvent, "source" | "origin" | "data">, parent: Window, origin: string): SettingsPreviewMessage | null {
  if (event.source !== parent || event.origin !== origin) return null
  const data: unknown = event.data
  if (!data || typeof data !== "object" || Array.isArray(data)) return null
  const message = data as Record<string, unknown>
  if (message.type !== "how-settings-preview" || !isSettings(message.settings)
    || (message.locale !== "en" && message.locale !== "zh")
    || (message.theme !== "light" && message.theme !== "dark")
    || !settingsPreviewPages.includes(message.page as SettingsPreviewPage)) return null
  try {
    if (getSettingsIssues(message.settings).length) return null
    return { type: "how-settings-preview", settings: { ...message.settings }, locale: message.locale, page: message.page as SettingsPreviewPage, theme: message.theme }
  } catch { return null }
}

function CFPPreview({ settings, locale }: { settings: Record<string, string>; locale: "en" | "zh" }) {
  const policy = parseCFPSettings(settings)
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 [overflow-wrap:anywhere] sm:px-6 lg:px-8">
      <h1 className="mb-8 text-4xl font-bold">{cfp.title[locale]}</h1>
      <CFPPolicySummary policy={policy} locale={locale} />
      <dl className="space-y-2 text-sm">
        <div><dt className="font-semibold">{locale === "zh" ? "演讲时长" : "Duration"}</dt><dd>{policy.durations.join(", ")} {locale === "zh" ? "分钟" : "min"}</dd></div>
        <div><dt className="font-semibold">{locale === "zh" ? "投稿类型" : "Session type"}</dt><dd>{policy.sessionTypes.map(type => cfp[type][locale]).join(", ")}</dd></div>
      </dl>
    </div>
  )
}

function FAQPreview({ settings, content, locale }: { settings: Record<string, string>; content: SiteContent; locale: "en" | "zh" }) {
  const [input, setInput] = useState("")
  const [question, setQuestion] = useState("")
  const questions = locale === "zh" ? ["大会时间", "会场地址", "投稿要求", "赞助咨询", "联系邮箱"] : ["Conference dates", "Venue address", "CFP", "Sponsorship", "Contact email"]
  function ask(event: FormEvent) {
    event.preventDefault()
    setQuestion(input.trim())
  }
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-16 [overflow-wrap:anywhere] sm:px-6 lg:px-8">
      <h1 className="text-4xl font-bold">{locale === "zh" ? "常见问题" : "FAQ"}</h1>
      <p className="whitespace-pre-line">{contentText(content.faq.greeting, locale)}</p>
      <div className="flex flex-wrap gap-3">{questions.map(value => <button key={value} type="button" className="text-emerald-700 underline underline-offset-4 dark:text-emerald-400" onClick={() => setQuestion(value)}>{value}</button>)}</div>
      <form onSubmit={ask} className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 space-y-2"><span className="text-sm">{locale === "zh" ? "问题" : "Question"}</span><input className="block w-full rounded-md border bg-background p-2" value={input} onChange={event => setInput(event.target.value)} /></label>
        <button type="submit" className="rounded-md bg-emerald-700 px-4 py-2 text-white">{locale === "zh" ? "提问" : "Ask"}</button>
      </form>
      {question && <section aria-live="polite" className="space-y-3 border-y py-5"><h2 className="font-semibold">{question}</h2><p className="whitespace-pre-line leading-relaxed">{getConferenceAnswer(question, locale, { settings, content })}</p></section>}
    </div>
  )
}

function blockNavigation(event: MouseEvent<HTMLDivElement>) {
  if (event.target instanceof Element && event.target.closest("a[href]")) {
    event.preventDefault()
    event.stopPropagation()
  }
}

export function SettingsPreviewFrame({ settings, locale, theme, sessions, sponsors }: {
  settings: Record<string, string> | null
  locale: "en" | "zh"
  theme: "light" | "dark"
  sessions: PublicContentResult<Pick<PublishedSession, "id">[]>
  sponsors: PublicContentResult<PublishedSponsor[]>
}) {
  const [draft, setDraft] = useState({ settings, locale, theme, page: "home" as SettingsPreviewPage })
  useEffect(() => {
    function receive(event: MessageEvent) {
      const message = readSettingsPreviewMessage(event, window.parent, window.location.origin)
      if (message) setDraft(message)
    }
    window.addEventListener("message", receive)
    if (window.parent !== window) window.parent.postMessage({ type: "how-settings-preview-ready" }, window.location.origin)
    return () => window.removeEventListener("message", receive)
  }, [])
  useEffect(() => {
    const root = document.documentElement
    const previousTheme = root.classList.contains("light") ? "light" : "dark"
    const previousLanguage = root.lang
    root.classList.remove("light", "dark")
    root.classList.add(draft.theme)
    root.lang = draft.locale
    return () => {
      root.classList.remove("light", "dark")
      root.classList.add(previousTheme)
      root.lang = previousLanguage
    }
  }, [draft.theme, draft.locale])

  let content: SiteContent | null = null
  try {
    if (draft.settings && !getSettingsIssues(draft.settings).length) content = parseSiteContent(draft.settings)
  } catch { /* Invalid saved drafts are not rendered. */ }
  const props = content && draft.settings ? { settings: draft.settings, content, locale: draft.locale } : null
  return (
    <div data-settings-preview onClickCapture={blockNavigation} onAuxClickCapture={blockNavigation} onSubmitCapture={event => event.preventDefault()}>
      <style>{`body:has([data-settings-preview]) > header, body:has([data-settings-preview]) > footer { display: none !important; }
body:has([data-settings-preview]) > main { padding-top: 0 !important; }`}</style>
      <LocaleProvider locale={draft.locale}>
        {!props ? <ContentUnavailable title={draft.locale === "zh" ? "草稿预览不可用" : "Draft preview unavailable"} locale={draft.locale} />
          : draft.page === "home" ? <HomeView {...props} sessions={sessions} />
          : draft.page === "venue" ? <VenueView {...props} />
          : draft.page === "sponsors" ? <SponsorsView {...props} sponsors={sponsors} />
          : draft.page === "cfp" ? <CFPPreview settings={props.settings} locale={draft.locale} />
          : draft.page === "faq" ? <FAQPreview {...props} />
          : <SitePageView {...props} page={draft.page} />}
      </LocaleProvider>
    </div>
  )
}
