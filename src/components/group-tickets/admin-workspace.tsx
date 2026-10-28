"use client"

import { useState } from "react"
import { ArrowLeft, ArrowRight, Pencil, Plus, RefreshCw, Search, Settings2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useLocale } from "@/lib/i18n/provider"
import { ConfigForm } from "./config-form"
import { OrderDetail } from "./order-detail"
import { AuthPrompt, dateLabel, ErrorNotice, Field, Loading, money, orderStatus, selectClass, StatusBadge, text, useNow } from "./shared"
import { useGroupWorkspace } from "./use-group-workspace"
import type { GroupOrder } from "@/lib/group-tickets/types"

export function AdminGroupWorkspace() {
  const locale = useLocale()
  const [page, setPage] = useState(0)
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [tab, setTab] = useState("orders")
  const [status, setStatus] = useState("all")
  const workspace = useGroupWorkspace(true, page, search)
  const [selection, setSelection] = useState<{ id: string; userId: string; version: number } | null>(null)
  const [edit, setEdit] = useState<{ id: string; userId: string; version: number } | null>(null)
  const now = useNow()
  const data = workspace.data
  const selected = data && selection?.userId === data.userId && selection.version === workspace.accountVersion ? selection.id : null
  const editing = data && edit?.userId === data.userId && edit.version === workspace.accountVersion ? edit.id : null
  const orders = data?.orders.filter(order => status === "all" || orderStatus(order, now) === status) ?? []
  function createConfig() {
    if (data) setEdit({ id: "new", userId: data.userId, version: workspace.accountVersion })
  }

  return <div className="min-w-0 space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold">{text(locale, "团票订单", "Group orders")}</h1><Button variant="ghost" size="icon" title={text(locale, "刷新", "Refresh")} aria-label={text(locale, "刷新", "Refresh")} disabled={workspace.loading} onClick={() => void workspace.reload()}><RefreshCw /></Button></header>
    <p className="text-sm text-muted-foreground">{text(locale, "在线支付未启用。激活仅记录已在系统外核实的收款，不会扣款；关闭订单不是退款。", "Online payment is not enabled. Activation records externally verified funds and does not charge anyone. Closing an order is not a refund.")}</p>
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList><TabsTrigger value="orders"><Users />{text(locale, "订单", "Orders")}</TabsTrigger><TabsTrigger value="configs"><Settings2 />{text(locale, "团票配置", "Configurations")}</TabsTrigger></TabsList>
      <TabsContent value="orders" className="space-y-5 pt-3">
        <form className="flex min-w-0 flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); setPage(0); setSearch(searchInput.trim()); setSelection(null) }}>
          <div className="min-w-0 flex-1"><Field id="group-order-search" label={text(locale, "搜索团队名称或订单号", "Search team or order ID")}><Input id="group-order-search" type="search" maxLength={200} value={searchInput} onChange={e => setSearchInput(e.target.value)} /></Field></div>
          <Button type="submit" disabled={workspace.loading}><Search />{text(locale, "搜索", "Search")}</Button>
          <div className="w-full sm:w-52"><Field id="group-status" label={text(locale, "本页状态筛选", "Status on this page")}><select id="group-status" className={selectClass} value={status} onChange={e => setStatus(e.target.value)}><option value="all">{text(locale, "全部", "All")}</option>{(["pending", "active", "expired", "cancelled", "closed"] as GroupOrder["status"][]).map((value, i) => <option value={value} key={value}>{locale === "zh" ? ["待核款", "已激活", "已过期", "已取消", "已关闭"][i] : ["Awaiting verification", "Active", "Expired", "Cancelled", "Closed"][i]}</option>)}</select></Field></div>
        </form>
        {workspace.loading ? <Loading /> : workspace.error ? <ErrorNotice error={workspace.error} retry={() => void workspace.reload()} /> : !data ? <AuthPrompt redirect="/admin/group-orders" /> : <>
          <p className="text-xs text-muted-foreground">{text(locale, "共 " + data.total + " 笔匹配订单，每页 20 笔。", data.total + " matching orders; 20 per page.")}</p>
          {!orders.length && <p className="py-5 text-sm text-muted-foreground">{text(locale, "当前页无匹配订单。", "No matching orders on this page.")}</p>}
          <ul className="divide-y divide-border">{orders.map(order => <li key={order.id}><button type="button" aria-pressed={selected === order.id} onClick={() => setSelection({ id: order.id, userId: data.userId, version: workspace.accountVersion })} className={"flex w-full min-w-0 flex-wrap items-center justify-between gap-3 rounded-lg px-3 py-4 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring " + (selected === order.id ? "bg-muted" : "")}>
            <span className="min-w-0 basis-full sm:basis-0 sm:flex-1"><span className="block break-words font-medium">{order.team_name}</span><span className="mt-1 block break-all font-mono text-xs text-muted-foreground">{order.id}</span><span className="mt-1 block text-xs text-muted-foreground">{dateLabel(order.created_at, locale)}</span></span>
            <span className="text-sm tabular-nums">{order.claimed_count}/{order.quantity} · {money(order.total_cents, locale)}</span><StatusBadge order={order} now={now} />
          </button></li>)}</ul>
          <nav aria-label={text(locale, "订单分页", "Order pages")} className="flex items-center justify-between gap-3 border-t border-border pt-4">
            <Button variant="outline" size="icon" disabled={!page} title={text(locale, "上一页", "Previous page")} aria-label={text(locale, "上一页", "Previous page")} onClick={() => { setPage(value => value - 1); setSelection(null) }}><ArrowLeft /></Button>
            <span className="text-sm tabular-nums">{page + 1} / {Math.max(1, Math.ceil(data.total / 20))}</span>
            <Button variant="outline" size="icon" disabled={(page + 1) * 20 >= data.total} title={text(locale, "下一页", "Next page")} aria-label={text(locale, "下一页", "Next page")} onClick={() => { setPage(value => value + 1); setSelection(null) }}><ArrowRight /></Button>
          </nav>
          {selected && <OrderDetail key={data.userId + "-" + workspace.accountVersion + "-" + selected} orderId={selected} userId={data.userId} admin onChanged={() => void workspace.reload()} />}
        </>}
      </TabsContent>
      <TabsContent value="configs" className="space-y-5 pt-3">
        {workspace.loading ? <Loading /> : workspace.error ? <ErrorNotice error={workspace.error} retry={() => void workspace.reload()} /> : !data ? <AuthPrompt redirect="/admin/group-orders" /> : <>
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{text(locale, "团票配置", "Group configurations")}</h2><Button onClick={createConfig}><Plus />{text(locale, "新增配置", "New configuration")}</Button></div>
          {editing && <ConfigForm key={data.userId + "-" + workspace.accountVersion + "-" + editing} config={data.configs.find(config => config.ticket_type_id === editing)} workspace={data} onCancel={() => setEdit(null)} onSaved={() => { setEdit(null); void workspace.reload() }} />}
          {!data.configs.length && <p className="py-5 text-sm text-muted-foreground">{text(locale, "暂无团票配置。新配置默认关闭。", "No group configurations yet. New configurations are disabled by default.")}</p>}
          <ul className="divide-y divide-border">{data.configs.map(config => <li key={config.ticket_type_id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-4">
            <div className="min-w-0 flex-1"><p className="break-words font-medium">{locale === "zh" ? config.ticket_name_zh || config.ticket_name : config.ticket_name}</p><p className="mt-1 text-sm text-muted-foreground">{money(config.unit_price_cents, locale)} · {config.min_size}–{config.max_size} {text(locale, "人", "seats")}</p><p className="mt-1 text-xs text-muted-foreground">{text(locale, "领取截止：", "Claim deadline: ")}{dateLabel(config.claim_deadline, locale)}</p></div>
            <Badge variant="outline">{!config.enabled ? text(locale, "未启用", "Disabled") : config.claim_deadline && now >= Date.parse(config.claim_deadline) ? text(locale, "已截止", "Deadline passed") : text(locale, "已启用", "Enabled")}</Badge>
            <Button variant="ghost" size="icon" title={text(locale, "编辑配置", "Edit configuration")} aria-label={text(locale, "编辑配置", "Edit configuration")} onClick={() => setEdit({ id: config.ticket_type_id, userId: data.userId, version: workspace.accountVersion })}><Pencil /></Button>
          </li>)}</ul>
        </>}
      </TabsContent>
    </Tabs>
  </div>
}
