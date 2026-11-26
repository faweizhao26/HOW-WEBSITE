"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Bell, ChevronLeft, ChevronRight, Clipboard, Download, Eye, RefreshCw, Search, Send } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { watchAuthUser } from "@/lib/auth/watch-auth-user"
import { useLocale } from "@/lib/i18n/provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { audiences, audienceLabels, isProposalDecision, notificationCsv, notificationPageSize, notificationRpc, proposalDecisionLabel, topicLabels, topicTypes } from "@/lib/notifications"
import type { Audience, NotificationFilter, NotificationHistory, NotificationPreview, Recipient } from "@/lib/notifications"

const selectClass = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
const formatDate = (value: string, zh: boolean) => new Date(value).toLocaleString(zh ? "zh-CN" : "en-GB", { timeZone: "Asia/Shanghai" })
const templates = [
  { name: ["大会信息","Conference update"], title: ["HOW 2027 大会信息","HOW 2027 conference update"], body: ["大会安排已更新，请查看大会官网获取最新信息。","Conference details have been updated. Please check the website for the latest information."] },
  { name: ["报名提醒","Registration reminder"], title: ["HOW 2027 报名提醒","HOW 2027 registration reminder"], body: ["参会报名已开放，欢迎登录大会官网完成报名。","Registration is open. Sign in to the conference website to register."] },
  { name: ["会前安排","Before the conference"], title: ["HOW 2027 会前安排","HOW 2027 pre-conference information"], body: ["大会即将开始，请查看官网的议程、会场和签到安排。","The conference is approaching. Please review the schedule, venue details and check-in information."] },
  { name: ["提案结果","Proposal result"], title: ["HOW 2027 提案审核结果","HOW 2027 proposal decision"], body: ["感谢提交提案。请查看下方对应议题的审核结果。","Thank you for submitting a proposal. Please see the decision for the topic below."] },
  { name: ["提案候补","Proposal waitlist"], title: ["HOW 2027 提案候补通知","HOW 2027 proposal waitlist"], body: ["感谢提交提案。该议题已列为候补，暂未安排场次。如有空位，我们会另行通知。","Thank you for submitting a proposal. This topic is on the waitlist and does not have a session slot yet. We will let you know if a slot opens."] },
  { name: ["讲者材料提醒","Speaker materials reminder"], title: ["HOW 2027 讲者材料提醒","HOW 2027 speaker materials reminder"], body: ["请在大会要求的截止日期前提交演示材料。","Please submit your slides by the conference deadline."] },
]

type SendDraft = { filter: NotificationFilter; preview: NotificationPreview; title: string; body: string; requestId: string }

function Workspace({ initial }: { initial: NotificationFilter }) {
  const zh = useLocale() === "zh", l = zh ? 0 : 1
  const t = (cn: string, en: string) => zh ? cn : en
  const [filters, setFilters] = useState<NotificationFilter>(initial)
  const [pick, setPick] = useState(initial.audience === "manual")
  const [selected, setSelected] = useState<string[]>([])
  const [results, setResults] = useState<NotificationPreview | null>(null)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [history, setHistory] = useState<NotificationHistory[] | null>(null)
  const [historyError, setHistoryError] = useState(false)
  const [draft, setDraft] = useState<SendDraft | null>(null)
  const [dialog, setDialog] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [changed, setChanged] = useState(false)
  const pending = useRef(false)
  const epoch = useRef(0)

  useEffect(() => {
    let active = true
    let owner: string | null | undefined
    const client = createClient()
    const stop = watchAuthUser(client.auth, user => {
      const next = user?.id ?? null
      if (owner !== undefined && owner !== next) {
        epoch.current++
        pending.current = false
        setChanged(true); setBusy(false); setHistory(null); setResults(null); setSelected([]); setDraft(null); setDialog(false)
      }
      owner = next
    })
    const generation = epoch.current
    void notificationRpc<NotificationHistory[]>(client,"history")
      .then(items => { if (active && epoch.current === generation) setHistory(items) })
      .catch(() => { if (active && epoch.current === generation) setHistoryError(true) })
    return () => { active = false; stop() }
  }, [])

  const proposalAudience = isProposalDecision(filters.audience)
  const needsSelection = pick || filters.audience === "manual"
  const validScope = !needsSelection || selected.length > 0
  const target: NotificationFilter = needsSelection
    ? { ...filters, ...(filters.audience === "manual" ? { query: undefined } : {}), ids: [...selected].sort() }
    : filters

  function update(patch: Partial<NotificationFilter>, clearSelected = true) {
    setFilters(current => ({ ...current,...patch })); setResults(null); setDraft(null); setError("")
    if (clearSelected) setSelected([])
  }

  async function run(work: (generation: number) => Promise<void>) {
    if (pending.current || changed) return
    pending.current = true; setBusy(true); setError("")
    const generation = epoch.current
    try { await work(generation) }
    catch (cause) {
      if (epoch.current !== generation) return
      const message = cause instanceof Error ? cause.message : ""
      if (message === "NOTIFICATION_PREVIEW_CHANGED") { setDraft(null); setDialog(false) }
      setError(message === "NOTIFICATION_PREVIEW_CHANGED" ? t("名单或审核结果已变化，请重新预览。","The recipients or decisions changed. Preview again.")
        : message === "NOTIFICATION_TOO_MANY_RECIPIENTS" ? t("匹配项超过 10,000，请缩小范围。","More than 10,000 matches. Narrow the filters.")
        : t("操作失败，请重试。","The request failed. Please retry."))
    } finally { if (epoch.current === generation) { pending.current = false; setBusy(false) } }
  }

  const search = (offset = 0) => run(async generation => {
    const list = await notificationRpc<NotificationPreview>(createClient(),"preview",{p_filter:filters,p_offset:offset})
    if (epoch.current === generation) setResults(list)
  })

  const review = () => run(async generation => {
    const preview = await notificationRpc<NotificationPreview>(createClient(),"preview",{p_filter:target})
    if (epoch.current !== generation) return
    if (!preview.count) { setError(t("没有匹配的收件人。","No matching recipients.")); return }
    const canRetry = draft?.preview.token === preview.token && draft.title === title.trim() && draft.body === body.trim()
    setDraft({ filter:target,preview,title:title.trim(),body:body.trim(),requestId:canRetry ? draft.requestId : crypto.randomUUID() })
    setDialog(true)
  })

  const send = () => run(async generation => {
    if (!draft) return
    const client = createClient()
    const sent = await notificationRpc<{ count: number }>(client,"send",{
      p_filter:draft.filter,p_token:draft.preview.token,p_request_id:draft.requestId,p_title:draft.title,p_body:draft.body,
    })
    if (epoch.current !== generation) return
    setDialog(false); setDraft(null); setTitle(""); setBody("")
    toast.success(t(`已发送 ${sent.count} 条通知`,`Sent ${sent.count} notifications`))
    void notificationRpc<NotificationHistory[]>(client,"history").then(items => {
      if (epoch.current === generation) { setHistory(items); setHistoryError(false) }
    }).catch(() => { if (epoch.current === generation) setHistoryError(true) })
  })

  const download = () => run(async generation => {
    const rows = await notificationRpc<Recipient[]>(createClient(),"export",{p_filter:target})
    if (epoch.current !== generation) return
    const {csv,count} = notificationCsv(rows,target.mode,zh)
    if (!count) { setError(t("当前范围没有可导出的邮箱。","No email addresses to export for this selection.")); return }
    const href = URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}))
    const a = document.createElement("a")
    a.href = href; a.download = `how-${target.audience}-${target.mode}-emails.csv`
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(href),0)
    toast.success(t(`已导出 ${count} 条记录`,`Exported ${count} rows`))
  })

  if (changed) return <p role="alert">{t("登录账号已变化，请重新打开通知管理。","Your account changed. Reopen the notification workspace.")}</p>

  return <div className="mx-auto max-w-6xl space-y-6">
    <h1 className="flex items-center gap-2 text-2xl font-bold"><Bell className="size-5" aria-hidden="true" />{t("站内通知","Site notifications")}</h1>
    <section className="space-y-4 border-y py-5" aria-labelledby="notify-audience-heading">
      <h2 id="notify-audience-heading" className="text-lg font-semibold">{t("收件范围","Recipients")}</h2>
      <form onSubmit={event => { event.preventDefault(); void search() }}>
        <fieldset disabled={busy} className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2"><Label htmlFor="notify-audience">{t("接收对象","Audience")}</Label><select id="notify-audience" className={selectClass} value={filters.audience} onChange={event => {
            const audience = event.target.value as Audience
            setPick(audience === "manual")
            update({ audience, mode:audience === "rejected" || audience === "waitlisted" ? "result" : "general", type:undefined, language:undefined })
          }}>{audiences.map(a => <option key={a} value={a}>{audienceLabels[a][l]}</option>)}</select></div>
          {proposalAudience && <>
            <div className="space-y-2"><Label htmlFor="notify-mode">{t("通知方式","Delivery mode")}</Label><select id="notify-mode" className={selectClass} value={filters.mode} onChange={e => update({mode:e.target.value as NotificationFilter["mode"]})}><option value="general">{t("按账号：通用通知","By account: general")}</option><option value="result">{t("按提案：审核结果","By proposal: decision")}</option></select></div>
            <div className="space-y-2"><Label htmlFor="notify-type">{t("议题类型","Proposal type")}</Label><select id="notify-type" className={selectClass} value={filters.type ?? ""} onChange={e => update({type:e.target.value as NotificationFilter["type"] || undefined})}><option value="">{t("全部类型","All types")}</option>{topicTypes.map(type => <option value={type} key={type}>{topicLabels[type][l]}</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor="notify-language">{t("投稿语言","Proposal language")}</Label><select id="notify-language" className={selectClass} value={filters.language ?? ""} onChange={e => update({language:e.target.value as NotificationFilter["language"] || undefined})}><option value="">{t("所有语言","All languages")}</option><option value="zh">中文</option><option value="en">English</option></select></div>
          </>}
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="notify-query">{proposalAudience ? t("姓名、邮箱或议题标题","Name, email or proposal title") : t("姓名或邮箱","Name or email")}</Label><Input id="notify-query" type="search" autoComplete="off" maxLength={200} value={filters.query ?? ""} onChange={e => update({query:e.target.value},filters.audience !== "manual")} /></div>
          {filters.audience !== "manual" && <label className="flex items-center gap-2 self-end py-2 text-sm"><input type="checkbox" checked={pick} onChange={e => { setPick(e.target.checked); setSelected([]); setDraft(null) }} />{t("仅发送给勾选项","Only selected entries")}</label>}
          <div className="self-end"><Button type="submit" variant="outline"><Search className="size-4" />{t("查找收件人","Find recipients")}</Button></div>
        </fieldset>
      </form>
      <p role="status" className="text-sm text-muted-foreground">{needsSelection ? t(`已勾选 ${selected.length} 项`,`${selected.length} selected`) : results ? t(`${results.accounts} 个账号 · ${results.count} 条记录`,`${results.accounts} accounts · ${results.count} entries`) : ""}</p>
      {results && <><RecipientList rows={results.rows} zh={zh} check={needsSelection ? (id => {
        setSelected(items => items.includes(id) ? items.filter(item => item !== id) : [...items,id])
        setDraft(null)
      }) : undefined} selected={selected} disabled={busy} />
      <PageButtons offset={results.offset} total={results.count} change={offset => void search(offset)} disabled={busy} zh={zh} /></>}
      <Button variant="outline" disabled={!validScope || busy || (!results && !needsSelection) || (!needsSelection && results?.count === 0)} onClick={() => void download()}><Download className="size-4" />{t("导出邮箱 CSV","Export email CSV")}</Button>
    </section>

    <section className="space-y-4" aria-labelledby="notify-compose-heading">
      <h2 id="notify-compose-heading" className="text-lg font-semibold">{t("通知内容","Message")}</h2>
      <fieldset disabled={busy} className="grid min-w-0 gap-4">
        <div className="space-y-2 sm:max-w-sm"><Label htmlFor="notify-template">{t("模板","Template")}</Label><select id="notify-template" className={selectClass} value="" onChange={e => {
          if (!e.target.value) return
          const template = templates[Number(e.target.value)]
          setTitle(template.title[l]); setBody(template.body[l]); setDraft(null)
        }}><option value="">{t("选择模板","Choose template")}</option>{templates.map((item,i) => <option key={i} value={i}>{item.name[l]}</option>)}</select></div>
        <div className="space-y-2"><Label htmlFor="notify-title">{t("标题","Title")}</Label><Input id="notify-title" maxLength={160} value={title} onChange={e => { setTitle(e.target.value); setDraft(null) }} /></div>
        <div className="space-y-2"><Label htmlFor="notify-body">{t("正文","Message body")}</Label><Textarea id="notify-body" rows={5} maxLength={5000} value={body} onChange={e => { setBody(e.target.value); setDraft(null) }} /></div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={!validScope || !title.trim() || !body.trim() || busy} onClick={() => void review()}><Eye className="size-4" />{t("预览发送","Preview delivery")}</Button>
          <Button variant="outline" disabled={!title.trim() && !body.trim()} onClick={async () => {
            try { await navigator.clipboard.writeText(title.trim() + "\n\n" + body.trim()); toast.success(t("已复制","Copied")) }
            catch { setError(t("复制失败，可手动选中正文复制。","Unable to copy. Select the text to copy it.")) }
          }}><Clipboard className="size-4" />{t("复制邮件文案","Copy email text")}</Button>
        </div>
      </fieldset>
      {error && !dialog && <p className="text-sm text-red-700 dark:text-red-300" role="alert">{error}</p>}
    </section>

    <section className="space-y-3 border-t pt-5" aria-labelledby="notify-history-heading">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="notify-history-heading" className="text-lg font-semibold">{t("发送记录","Send history")}</h2>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => void run(async generation => {
          const items = await notificationRpc<NotificationHistory[]>(createClient(),"history")
          if (epoch.current === generation) { setHistory(items); setHistoryError(false) }
        })}><RefreshCw className="size-4" />{t("刷新记录","Refresh history")}</Button></div>
      {historyError ? <p className="text-sm text-muted-foreground" role="alert">{t("发送记录暂不可用。","Send history is unavailable.")}</p>
        : !history ? <p className="text-sm text-muted-foreground">{t("加载中…","Loading…")}</p>
        : !history.length ? <p className="text-sm text-muted-foreground">{t("暂无发送记录","No notifications sent")}</p>
        : <ol className="divide-y">{history.map(item => <li key={item.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
          <div className="min-w-0"><p className="break-words font-medium">{item.title}</p><p className="text-muted-foreground">{audienceLabels[item.audience][l]} · {item.count}</p></div><time dateTime={item.created_at} className="text-muted-foreground">{formatDate(item.created_at,zh)}</time>
        </li>)}</ol>}
    </section>

    <Dialog open={dialog} onOpenChange={open => { if (!open && !busy) setDialog(false) }}>
      {draft && <DialogContent showCloseButton={!busy} className="max-h-[90dvh] overflow-y-auto rounded-lg">
        <DialogHeader><DialogTitle>{t("确认发送站内通知","Confirm notification delivery")}</DialogTitle><DialogDescription>
          {t(`将向 ${draft.preview.accounts} 个账号发送 ${draft.preview.count} 条站内通知。`,`Send ${draft.preview.count} notifications to ${draft.preview.accounts} accounts.`)}
        </DialogDescription></DialogHeader>
        <div className="min-w-0 space-y-2 border-y py-3 text-sm"><p className="break-words font-semibold">{draft.title}</p><p className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words">{draft.body}</p></div>
        <div className="max-h-52 overflow-y-auto"><RecipientList rows={draft.preview.rows} zh={zh} /></div>
        <PageButtons offset={draft.preview.offset} total={draft.preview.count} disabled={busy} change={offset => void run(async generation => {
          const preview = await notificationRpc<NotificationPreview>(createClient(),"preview",{p_filter:draft.filter,p_offset:offset})
          if (epoch.current !== generation) return
          if (preview.token !== draft.preview.token) throw new Error("NOTIFICATION_PREVIEW_CHANGED")
          setDraft({ ...draft,preview })
        })} zh={zh} />
        {error && <p className="text-sm text-red-700 dark:text-red-300" role="alert">{error}</p>}
        <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setDialog(false)}>{t("取消","Cancel")}</Button><Button disabled={busy} onClick={() => void send()}><Send className="size-4" />{t("确认发送","Send notification")}</Button></DialogFooter>
      </DialogContent>}
    </Dialog>
  </div>
}

function RecipientList({ rows, zh, check, selected = [], disabled }: { rows: Recipient[]; zh: boolean; check?: (id: string) => void; selected?: string[]; disabled?: boolean }) {
  if (!rows.length) return <p className="py-2 text-sm text-muted-foreground">{zh ? "没有匹配的收件人" : "No matching recipients"}</p>
  return <ul className="divide-y border-y">{rows.map(row => <li key={row.id} className="py-2 text-sm">
    <label className="flex items-start gap-2">
      {check && <input className="mt-1 size-4 shrink-0" type="checkbox" checked={selected.includes(row.id)} disabled={disabled} onChange={() => check(row.id)} />}
      <span className="min-w-0"><span className="font-medium break-words">{row.name || (zh ? "未填写姓名" : "Unnamed account")}</span>
        {row.email && <span className="ml-2 break-all text-muted-foreground">{row.email}</span>}
        {row.proposal_title && <span className="block break-words">{row.proposal_title} · {proposalDecisionLabel(row.proposal_status, zh ? "zh" : "en")}</span>}
      </span>
    </label>
  </li>)}</ul>
}

function PageButtons({ offset,total,change,disabled,zh }: { offset: number; total: number; change: (offset: number) => void; disabled?: boolean; zh: boolean }) {
  if (total <= notificationPageSize) return null
  return <div className="flex items-center justify-end gap-3 text-sm">
    <Button variant="outline" size="icon" title={zh ? "上一页" : "Previous page"} aria-label={zh ? "上一页" : "Previous page"} disabled={disabled || offset === 0} onClick={() => change(offset-notificationPageSize)}><ChevronLeft className="size-4" /></Button>
    <span className="tabular-nums">{offset/notificationPageSize+1} / {Math.ceil(total/notificationPageSize)}</span>
    <Button variant="outline" size="icon" title={zh ? "下一页" : "Next page"} aria-label={zh ? "下一页" : "Next page"} disabled={disabled || offset+notificationPageSize >= total} onClick={() => change(offset+notificationPageSize)}><ChevronRight className="size-4" /></Button>
  </div>
}

function FromSearch() {
  const params = useSearchParams()
  const value = params.get("audience") as Audience
  const audience = audiences.includes(value) ? value : "manual"
  const mode = isProposalDecision(audience) && (params.get("mode") === "result" || audience === "waitlisted") ? "result" : "general"
  const query = params.get("query")?.slice(0,200)
  return <Workspace key={JSON.stringify([audience,mode,query])} initial={{audience,mode,query}} />
}

export default function AdminNotificationsPage() {
  return <Suspense><FromSearch /></Suspense>
}
