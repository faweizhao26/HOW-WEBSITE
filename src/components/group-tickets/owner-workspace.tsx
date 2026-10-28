"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowRight, Plus, RefreshCw, Ticket, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useLocale } from "@/lib/i18n/provider"
import { createClient } from "@/lib/supabase/client"
import { createGroupOrder } from "@/lib/group-tickets/service"
import type { GroupWorkspace } from "@/lib/group-tickets/types"
import { AuthPrompt, ErrorNotice, Field, Loading, money, selectClass, StatusBadge, text, useNow } from "./shared"
import { useGroupMutation, useGroupWorkspace } from "./use-group-workspace"
import { OrderDetail } from "./order-detail"

type OrderDraft = { ticketId: string; quantity: string; teamName: string; requestId: string | null }
const emptyDraft: OrderDraft = { ticketId: "", quantity: "", teamName: "", requestId: null }

function CreateOrder({ workspace, onCreated, draft, onDraftChange }: {
  workspace: GroupWorkspace; onCreated: (id: string) => void
  draft: OrderDraft; onDraftChange: (draft: OrderDraft) => void
}) {
  const locale = useLocale()
  const now = useNow()
  const { ticketId, quantity, teamName } = draft
  const change = (patch: Partial<OrderDraft>) => onDraftChange({ ...draft, ...patch, requestId: null })
  const mutation = useGroupMutation()
  const config = workspace.configs.find(item => item.ticket_type_id === ticketId)
  const available = config?.enabled && (!config.claim_deadline || Date.parse(config.claim_deadline) > now)
  const size = Number(quantity)
  const valid = Boolean(available && now && teamName.trim() && Number.isInteger(size) && size >= (config?.min_size ?? 2) && size <= (config?.max_size ?? 100))

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!valid) return
    const requestId = draft.requestId ?? crypto.randomUUID()
    onDraftChange({ ...draft, requestId })
    let id = ""
    const ok = await mutation.run(async () => {
      id = await createGroupOrder(createClient(), { expectedUserId: workspace.userId, requestId, ticketTypeId: ticketId, quantity: size, teamName: teamName.trim() })
    })
    if (ok) { onDraftChange({ ...emptyDraft, ticketId }); onCreated(id) }
  }

  return <section className="space-y-4 border-y border-border py-6">
    <h2 className="flex items-center gap-2 text-lg font-semibold"><Users className="size-5 text-emerald-700 dark:text-emerald-400" />{text(locale, "新建团队订单", "New group order")}</h2>
    <p className="text-sm text-muted-foreground">{text(locale, "在线支付尚未启用。订单需管理员核实外部收款后激活，24 小时未激活将过期。创建人不自动获得参会名额。", "Online payment is not enabled. An administrator must verify external payment before activation. Unactivated orders expire after 24 hours. Creating an order does not register you as an attendee.")}</p>
    {!workspace.configs.length ? <p className="text-sm text-muted-foreground">{text(locale, "暂无可用的团票配置。", "No group tickets are currently available.")}</p> : <form onSubmit={submit} className="space-y-4">
      <fieldset disabled={mutation.busy} className="grid min-w-0 gap-4 sm:grid-cols-2">
        <Field id="group-ticket-type" label={text(locale, "票种 *", "Ticket *")}><select id="group-ticket-type" className={selectClass} required value={ticketId} onChange={event => { const next = workspace.configs.find(c => c.ticket_type_id === event.target.value); change({ ticketId: event.target.value, quantity: String(next?.min_size ?? 2) }) }}>
          <option value="">{text(locale, "请选择票种", "Select a ticket")}</option>
          {workspace.configs.map(item => <option key={item.ticket_type_id} value={item.ticket_type_id} disabled={!item.enabled || Boolean(item.claim_deadline && now >= Date.parse(item.claim_deadline))}>{locale === "zh" ? item.ticket_name_zh || item.ticket_name : item.ticket_name} · {money(item.unit_price_cents, locale)}{!item.enabled ? text(locale, "（未启用）", " (Disabled)") : item.claim_deadline && now >= Date.parse(item.claim_deadline) ? text(locale, "（已截止）", " (Deadline passed)") : ""}</option>)}
        </select></Field>
        <Field id="group-quantity" label={text(locale, "人数 *", "Quantity *")}><Input id="group-quantity" type="number" inputMode="numeric" min={config?.min_size ?? 2} max={config?.max_size ?? 100} step={1} required value={quantity} onChange={event => change({ quantity: event.target.value })} /></Field>
        <div className="sm:col-span-2"><Field id="group-team-name" label={text(locale, "团队名称 *", "Team name *")}><Input id="group-team-name" required maxLength={200} value={teamName} onChange={event => change({ teamName: event.target.value })} /></Field></div>
      </fieldset>
      {config && <div className="space-y-1 text-sm text-muted-foreground"><p>{text(locale, `人数范围：${config.min_size}–${config.max_size}`, `Group size: ${config.min_size}–${config.max_size}`)}</p>{config.claim_deadline && <p>{text(locale, "领取截止：", "Claim deadline: ")}{new Date(config.claim_deadline).toLocaleString(locale === "zh" ? "zh-CN" : "en-US")}</p>}<p className="font-medium text-foreground">{text(locale, "订单总额：", "Order total: ")}{money(Number.isInteger(size) && size >= 2 && size <= 100 ? size * config.unit_price_cents : 0, locale)}</p></div>}
      {Boolean(mutation.error) && <ErrorNotice error={mutation.error} />}
      <Button type="submit" disabled={mutation.busy || !valid}><Plus />{mutation.busy ? text(locale, "创建中...", "Creating...") : text(locale, "创建订单", "Create order")}</Button>
    </form>}
  </section>
}

export function OwnerWorkspace() {
  const locale = useLocale()
  const [page, setPage] = useState(0)
  const workspace = useGroupWorkspace(false, page)
  const [selected, setSelected] = useState<{ id: string; userId: string; version: number } | null>(null)
  // Keep the attempt and its inputs above the refresh boundary, scoped to this login generation.
  const [savedDraft, setSavedDraft] = useState<{ userId: string; version: number; value: OrderDraft } | null>(null)
  const now = useNow()
  const data = workspace.data
  return <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10 sm:px-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><h1 className="flex items-center gap-2 text-2xl font-bold"><Ticket className="size-6" />{text(locale, "团票订单", "Group ticket orders")}</h1><Link href="/group-tickets/redeem" className="text-sm text-emerald-800 underline underline-offset-4 dark:text-emerald-300">{text(locale, "领取参会名额", "Claim a seat")}</Link></header>
    {workspace.loading ? <Loading /> : workspace.error ? <ErrorNotice error={workspace.error} retry={() => void workspace.reload()} /> : !data ? <AuthPrompt redirect="/group-tickets" /> : <>
      <CreateOrder key={`${data.userId}-${workspace.accountVersion}`} workspace={data}
        draft={savedDraft?.userId === data.userId && savedDraft.version === workspace.accountVersion ? savedDraft.value : emptyDraft}
        onDraftChange={value => setSavedDraft({ userId: data.userId, version: workspace.accountVersion, value })}
        onCreated={id => { setSelected({ id, userId: data.userId, version: workspace.accountVersion }); setPage(0); void workspace.reload() }} />
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{text(locale, "我的订单", "My orders")} <span className="text-sm font-normal text-muted-foreground">({data.total})</span></h2><Button variant="ghost" size="icon" aria-label={text(locale, "刷新订单", "Refresh orders")} title={text(locale, "刷新订单", "Refresh orders")} onClick={() => void workspace.reload()}><RefreshCw /></Button></div>
        {!data.orders.length && <p className="py-4 text-sm text-muted-foreground">{text(locale, "暂无订单。", "No orders yet.")}</p>}
        <ul className="divide-y divide-border">{data.orders.map(order => <li key={order.id}><button type="button" className={"flex w-full min-w-0 flex-wrap items-center justify-between gap-3 rounded-lg px-3 py-4 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring " + (selected?.id === order.id && selected.userId === data.userId && selected.version === workspace.accountVersion ? "bg-muted" : "")} aria-pressed={selected?.id === order.id && selected.userId === data.userId && selected.version === workspace.accountVersion} onClick={() => setSelected({ id: order.id, userId: data.userId, version: workspace.accountVersion })}>
          <span className="min-w-0 basis-full sm:basis-0 sm:flex-1"><span className="block break-words font-medium">{order.team_name}</span><span className="mt-1 block break-all text-xs text-muted-foreground">{order.id}</span></span>
          <span className="text-sm tabular-nums">{order.claimed_count}/{order.quantity} · {money(order.total_cents, locale)}</span><StatusBadge order={order} now={now} />
        </button></li>)}</ul>
        <div className="flex items-center justify-between gap-2 border-t border-border pt-4"><Button variant="outline" size="icon" aria-label={text(locale, "上一页", "Previous page")} title={text(locale, "上一页", "Previous page")} disabled={page === 0} onClick={() => setPage(value => value - 1)}><ArrowLeft /></Button><span className="text-sm tabular-nums">{page + 1} / {Math.max(1, Math.ceil(data.total / 20))}</span><Button variant="outline" size="icon" aria-label={text(locale, "下一页", "Next page")} title={text(locale, "下一页", "Next page")} disabled={(page + 1) * 20 >= data.total} onClick={() => setPage(value => value + 1)}><ArrowRight /></Button></div>
      </section>
      {selected?.userId === data.userId && selected.version === workspace.accountVersion && <OrderDetail key={`${data.userId}-${selected.id}`} orderId={selected.id} userId={data.userId} onChanged={() => void workspace.reload()} />}
    </>}
  </main>
}
