"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Bell, Check, CheckCheck, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react"
import { useLocale } from "@/lib/i18n/provider"
import { watchAuthUser } from "@/lib/auth/watch-auth-user"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { notificationPageSize, notificationReadEvent, notificationRpc, proposalDecisionLabel } from "@/lib/notifications"
import type { Inbox } from "@/lib/notifications"

export default function NotificationsPage() {
  const zh = useLocale() === "zh"
  const t = (cn: string, en: string) => zh ? cn : en
  const [userId, setUserId] = useState<string | null | undefined>(undefined)
  const [offset, setOffset] = useState(0)
  const [version, refresh] = useState(0)
  const [snapshot, setSnapshot] = useState<{ key: string; inbox: Inbox | null } | null>(null)
  const [marking, setMarking] = useState(false)
  const [markError, setMarkError] = useState(false)
  const pending = useRef(false), identity = useRef({ id: undefined as string | null | undefined, epoch: 0 })
  const key = JSON.stringify([userId,offset,version])
  const current = snapshot?.key === key ? snapshot : null
  const inbox = current?.inbox

  useEffect(() => {
    const client = createClient()
    return watchAuthUser(client.auth, user => {
      const id = user?.id ?? null
      if (identity.current.id === id) return
      identity.current = { id,epoch:identity.current.epoch+1 }
      pending.current = false
      setSnapshot(null); setOffset(0); setMarking(false); setMarkError(false); setUserId(id)
    })
  }, [])

  useEffect(() => {
    if (!userId) return
    const client = createClient()
    const epoch = identity.current.epoch
    let active = true
    function apply(value: Inbox | null) {
      if (active && identity.current.epoch === epoch) setSnapshot({key,inbox:value})
    }
    void notificationRpc<Inbox>(client,"inbox",{p_offset:offset}).then(apply).catch(() => apply(null))
    return () => { active = false }
  }, [key,offset,userId])

  async function mark(id?: string) {
    if (pending.current || !userId || identity.current.id !== userId) return
    const epoch = identity.current.epoch
    pending.current = true; setMarking(true); setMarkError(false)
    try {
      await notificationRpc<number>(createClient(),"read",id ? {p_id:id} : {})
      if (identity.current.epoch === epoch) {
        refresh(v => v+1)
        window.dispatchEvent(new Event(notificationReadEvent))
      }
    } catch { if (identity.current.epoch === epoch) setMarkError(true) }
    finally { if (identity.current.epoch === epoch) { pending.current = false; setMarking(false) } }
  }

  return <div className="mx-auto max-w-3xl space-y-5 px-4 py-10 sm:px-6 sm:py-14">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="flex items-center gap-2 text-2xl font-bold"><Bell className="size-5" aria-hidden="true" />{t("通知","Notifications")}</h1>
      {inbox && <div className="flex items-center gap-2">
        <Badge variant="secondary">{t(`未读 ${inbox.unread}`,`${inbox.unread} unread`)}</Badge>
        <Button variant="outline" size="sm" disabled={marking || !inbox.unread} onClick={() => void mark()}><CheckCheck className="size-4" />{t("全部标为已读","Mark all as read")}</Button>
      </div>}
    </div>
    {userId === null ? <Button render={<Link href="/auth/login?redirect=/notifications" />} nativeButton={false}>{t("登录查看通知","Sign in to see notifications")}</Button>
      : !current ? <p role="status" className="border-y py-6 text-sm text-muted-foreground">{t("加载通知中…","Loading notifications…")}</p>
      : !inbox ? <div className="flex flex-wrap items-center gap-3 border-y py-6">
        <p role="alert" className="text-sm text-muted-foreground">{t("未能加载通知。","Could not load notifications.")}</p>
        <Button variant="outline" onClick={() => refresh(v => v+1)}><RefreshCw className="size-4" />{t("重试","Retry")}</Button>
      </div> : <>
        {markError && <p className="text-sm text-red-700 dark:text-red-300" role="alert">{t("未能标记已读，请重试。","Could not mark as read. Try again.")}</p>}
        {!inbox.rows.length ? <p className="border-y py-8 text-sm text-muted-foreground">{t("暂无通知","No notifications")}</p> :
          <ol className="divide-y border-y">
            {inbox.rows.map(item => <li key={item.id} className="space-y-2 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 basis-48">
                  <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold"><span className="min-w-0 break-words">{item.title}</span>{!item.read_at && <Badge>{t("未读","Unread")}</Badge>}</h2>
                  <time className="text-xs text-muted-foreground" dateTime={item.created_at}>{new Date(item.created_at).toLocaleString(zh ? "zh-CN" : "en-GB",{timeZone:"Asia/Shanghai"})}</time>
                </div>
                {!item.read_at && <Button size="sm" variant="ghost" disabled={marking} onClick={() => void mark(item.id)}><Check className="size-4" />{t("标为已读","Mark as read")}</Button>}
              </div>
              <p className="whitespace-pre-wrap break-words text-sm">{item.body}</p>
              {item.proposal_title && <div className="flex flex-wrap items-center gap-2 border-l-2 border-emerald-600 pl-3 text-sm">
                <Link href="/cfp" className="min-w-0 break-words underline underline-offset-4">{item.proposal_title}</Link>
                <Badge variant={item.proposal_status === "approved" ? "secondary" : "outline"}>{proposalDecisionLabel(item.proposal_status, zh ? "zh" : "en")}</Badge>
              </div>}
            </li>)}
          </ol>}
        {inbox.total > notificationPageSize && <div className="flex items-center justify-end gap-3 text-sm">
          <Button variant="outline" size="icon" aria-label={t("上一页","Previous page")} title={t("上一页","Previous page")} disabled={offset === 0 || marking} onClick={() => setOffset(v => Math.max(0,v-notificationPageSize))}><ChevronLeft className="size-4" /></Button>
          <span className="tabular-nums">{offset/notificationPageSize+1} / {Math.ceil(inbox.total/notificationPageSize)}</span>
          <Button variant="outline" size="icon" aria-label={t("下一页","Next page")} title={t("下一页","Next page")} disabled={offset+notificationPageSize >= inbox.total || marking} onClick={() => setOffset(v => v+notificationPageSize)}><ChevronRight className="size-4" /></Button>
        </div>}
      </>}
  </div>
}
