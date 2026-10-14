"use client"

import { useLocale } from "@/lib/i18n/provider"

import { useState, useRef, useEffect } from "react"
import { usePathname } from "next/navigation"
import { MessageCircle, X, Send, Bot } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getConferenceAnswer, loadConferenceFAQ } from "@/lib/content/conference-faq"
import type { FAQPublishedContent } from "@/lib/content/conference-faq"
import { contentText } from "@/lib/content/site-content"

export function ChatbotWidget({ published }: { published: FAQPublishedContent | null }) {
  const locale = useLocale()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<{ role: "user" | "bot"; text: string }[]>([])
  const [input, setInput] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [currentPublished, setCurrentPublished] = useState(published)
  const [faqLoading, setFaqLoading] = useState(false)
  const [loadedPath, setLoadedPath] = useState(pathname)
  const refreshing = faqLoading || loadedPath !== pathname

  useEffect(() => {
    if (!open || pathname.startsWith("/admin")) return
    const controller = new AbortController()
    void loadConferenceFAQ(fetch, controller.signal).then(result => {
      if (!controller.signal.aborted) { setCurrentPublished(result); setLoadedPath(pathname); setFaqLoading(false) }
    }).catch(() => {
      if (!controller.signal.aborted) { setCurrentPublished(null); setLoadedPath(pathname); setFaqLoading(false) }
    })
    return () => controller.abort()
  }, [open, pathname, published])

  function toggleOpen() {
    if (!open) setFaqLoading(true)
    setOpen(!open)
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  function handleSend() {
    const q = input.trim()
    if (!q || refreshing) return
    const answer = getConferenceAnswer(q, locale, currentPublished)
    setMessages(current => [
      ...current,
      { role: "user", text: q },
      { role: "bot", text: answer },
    ])
    setInput("")
  }

  const greeting = currentPublished ? contentText(currentPublished.content.faq.greeting, locale) : (locale === "zh" ? "大会信息暂时无法加载。" : "Conference information is temporarily unavailable.")

  if (pathname.startsWith("/admin")) return null

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-6 w-[360px] max-w-[calc(100vw-3rem)] h-[520px] max-h-[calc(100vh-10rem)] bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/80 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">{locale === "zh" ? "HOW 2027 助手" : "HOW 2027 Assistant"}</p>
                <p className="text-xs text-zinc-400">{locale === "zh" ? "大会问答" : "Conference FAQ"}</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-zinc-300">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="flex gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="bg-zinc-800 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-zinc-200 max-w-[80%]">
                  {refreshing ? (locale === "zh" ? "正在读取最新大会信息..." : "Loading the latest conference information...") : greeting}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.role === "user" ? "bg-zinc-600" : "bg-gradient-to-br from-emerald-400 to-cyan-400"}`}>
                  {m.role === "user" ? (
                    <span className="text-xs font-bold text-white">U</span>
                  ) : (
                    <Bot className="h-4 w-4 text-white" />
                  )}
                </div>
                <div className={`rounded-2xl px-4 py-3 text-sm max-w-[80%] ${m.role === "user" ? "bg-emerald-600 text-white rounded-tr-sm" : "bg-zinc-800 text-zinc-200 rounded-tl-sm"}`}>
                  {m.text}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 border-t border-zinc-800 flex items-center gap-2 shrink-0">
            <Input
              value={input}
              disabled={refreshing}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key !== "Enter" || e.nativeEvent.isComposing) return
                e.preventDefault()
                handleSend()
              }}
              placeholder={locale === "zh" ? "输入您的问题..." : "Ask a question..."}
              className="border-zinc-700 bg-zinc-800 text-sm h-10"
            />
            <Button size="icon" disabled={refreshing} className="h-10 w-10 bg-emerald-600 hover:bg-emerald-500 shrink-0" onClick={handleSend}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <button
        onClick={toggleOpen}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center z-40"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </>
  )
}
