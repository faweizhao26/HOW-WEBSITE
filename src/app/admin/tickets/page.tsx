"use client"

import { useLocale } from "@/lib/i18n/provider"
import NextLink from "next/link"

import { useCallback, useEffect, useId, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { Plus, Trash2, Pencil, Copy, Link, Ticket, Tag } from "lucide-react"
import { AdminLoadError } from "@/components/admin/load-error"
import { deleteChannelRecord, deleteTicketRecord, loadTicketWorkspace, saveChannel } from "@/lib/admin/data"
import type { ChannelCode, TicketType } from "@/lib/db/schema"
import type { GroupConfig } from "@/lib/group-tickets/types"
import { TicketForm } from "@/components/admin/ticket-form"
import { dateLabel, money, selectClass, useNow } from "@/components/group-tickets/shared"



function ChannelForm({ channel, tickets, onSaved }: { channel?: ChannelCode; tickets: TicketType[]; onSaved: () => void }) {
  const locale = useLocale()
  const formId = useId()
  const [code, setCode] = useState(channel?.code || "")
  const [name, setName] = useState(channel?.name || "")
  const [ticketId, setTicketId] = useState(channel?.ticket_type_id || "")
  const [isActive, setIsActive] = useState(channel?.is_active ?? true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<"duplicate" | "failed" | null>(null)

  const registerLink = `https://how-website.vercel.app/register?code=${encodeURIComponent(code)}`

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving || tickets.some(t => t.id === ticketId && t.group_only)) return
    setSaving(true)
    setSaveError(null)
    try {
      await saveChannel(createClient(), { code: code.trim(), name: name.trim(), ticket_type_id: ticketId || null, is_active: isActive }, channel?.id)
      toast.success(channel ? (locale === "zh" ? "已更新" : "Updated") : (locale === "zh" ? "已创建" : "Created"))
      setOpen(false)
      onSaved()
    } catch (error) {
      setSaveError(typeof error === "object" && error !== null && "code" in error && error.code === "23505" ? "duplicate" : "failed")
    } finally { setSaving(false) }
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(registerLink); toast.success(locale === "zh" ? "链接已复制" : "Link copied") }
    catch { toast.error(locale === "zh" ? "复制失败，请重试" : "Unable to copy. Please try again.") }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!saving) { setOpen(value); setSaveError(null) } }}>
      <DialogTrigger render={channel ? <Button variant="ghost" size="icon" className="h-8 w-8" title={locale === "zh" ? "编辑渠道码" : "Edit Channel"} /> : <Button className="bg-cyan-600 hover:bg-cyan-500" />}>
        {channel ? <Pencil className="h-4 w-4" /> : <><Plus className="h-4 w-4 mr-1" />{locale === "zh" ? "添加渠道码" : "Add Channel"}</>}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-lg border border-border bg-popover">
        <DialogHeader><DialogTitle>{channel ? (locale === "zh" ? "编辑渠道码" : "Edit Channel") : (locale === "zh" ? "新建渠道码" : "New Channel")}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={saving} className="space-y-4">
          <div className="space-y-2"><Label htmlFor={`${formId}-code`}>{locale === "zh" ? "渠道码" : "Code"}</Label><Input id={`${formId}-code`} value={code} onChange={e => setCode(e.target.value)} placeholder="VIP-2027" required /></div>
          <div className="space-y-2"><Label htmlFor={`${formId}-name`}>{locale === "zh" ? "名称" : "Name"}</Label><Input id={`${formId}-name`} value={name} onChange={e => setName(e.target.value)} placeholder={locale === "zh" ? "合作伙伴渠道" : "Partner channel"} required /></div>
          <div className="space-y-2"><Label htmlFor={`${formId}-ticket`}>{locale === "zh" ? "关联票种" : "Linked Ticket"}</Label>
            <select id={`${formId}-ticket`} value={ticketId} onChange={e => setTicketId(e.target.value)} className={selectClass}>
              <option value="">{locale === "zh" ? "不关联" : "None"}</option>
              {tickets.filter(t => !t.group_only || t.id === ticketId).map(t => <option key={t.id} value={t.id} disabled={t.group_only}>{locale === "zh" && t.name_zh ? t.name_zh : t.name}{t.group_only ? (locale === "zh" ? "（团体专属，不可关联）" : " (Group only, unavailable)") : ""}</option>)}
            </select>
          </div>
          <div className="flex items-center justify-between"><Label htmlFor={`${formId}-active`}>{locale === "zh" ? "启用渠道码" : "Channel enabled"}</Label><Switch id={`${formId}-active`} checked={isActive} onCheckedChange={setIsActive} /></div>
          {code && <div className="p-3 bg-muted rounded-lg"><p className="text-xs text-muted-foreground mb-2">{locale === "zh" ? "报名链接" : "Registration Link"}:</p><div className="flex items-center gap-2"><code className="min-w-0 text-xs text-cyan-400 flex-1 truncate">{registerLink}</code><Button type="button" size="icon" variant="ghost" className="h-6 w-6 shrink-0" title={locale === "zh" ? "复制链接" : "Copy link"} onClick={copyLink}><Copy className="h-3 w-3" /></Button></div></div>}
          </fieldset>
          {saveError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{saveError === "duplicate" ? (locale === "zh" ? "渠道码已存在，请更换。" : "This code already exists. Please choose another.") : (locale === "zh" ? "渠道码保存失败，请重试。填写内容已保留。" : "Unable to save channel. Your input has been kept; please try again.")}</p>}
          <Button type="submit" disabled={saving || tickets.some(t => t.id === ticketId && t.group_only)} className="w-full bg-cyan-600 hover:bg-cyan-500">{saving ? (locale === "zh" ? "保存中..." : "Saving...") : channel ? (locale === "zh" ? "保存" : "Save") : (locale === "zh" ? "创建" : "Create")}</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function AdminTicketsPage() {
  const locale = useLocale()
  const now = useNow()
  const [tickets, setTickets] = useState<TicketType[]>([])
  const [channels, setChannels] = useState<ChannelCode[]>([])
  const [configs, setConfigs] = useState<GroupConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [tab, setTab] = useState("tickets")

  const loadAll = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const data = await loadTicketWorkspace(createClient())
      setTickets(data.tickets)
      setChannels(data.channels)
      setConfigs(data.configs)
    } catch { setLoadError(true) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    let cancelled = false
    loadTicketWorkspace(createClient())
      .then(data => { if (!cancelled) { setTickets(data.tickets); setChannels(data.channels); setConfigs(data.configs) } })
      .catch(() => { if (!cancelled) setLoadError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  async function deleteRecord(kind: "ticket" | "channel", id: string) {
    if (deleting) return
    setDeleting(id)
    try {
      await (kind === "ticket" ? deleteTicketRecord : deleteChannelRecord)(createClient(), id)
      toast.success(locale === "zh" ? "已删除" : "Deleted")
      await loadAll()
    } catch { toast.error(locale === "zh" ? "删除失败，记录仍保留。请检查是否被引用后重试。" : "Unable to delete. The record remains; check whether it is in use and try again.") }
    finally { setDeleting(null) }
  }

  if (loading) return <div><h1 className="text-2xl font-bold mb-8">{locale === "zh" ? "票种 & 渠道码" : "Tickets & Channels"}</h1><div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16" />)}</div></div>
  if (loadError) return <div><h1 className="text-2xl font-bold mb-8">{locale === "zh" ? "票种 & 渠道码" : "Tickets & Channels"}</h1><AdminLoadError onRetry={loadAll} /></div>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-8">{locale === "zh" ? "票种 & 渠道码" : "Tickets & Channels"}</h1>

      <div className="mb-6"><NextLink href="/admin/group-orders" className="text-sm text-emerald-800 underline underline-offset-4 dark:text-emerald-300">{locale === "zh" ? "查看团票订单与领取情况" : "View group orders and claims"}</NextLink></div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="tickets"><Ticket className="h-4 w-4 mr-1" />{locale === "zh" ? "票种" : "Tickets"} ({tickets.length})</TabsTrigger>
          <TabsTrigger value="channels"><Tag className="h-4 w-4 mr-1" />{locale === "zh" ? "渠道码" : "Channels"} ({channels.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="tickets">
          <div className="flex items-center justify-between mb-4"><p className="text-sm text-muted-foreground">{locale === "zh" ? "管理可选的票种" : "Manage available ticket types"}</p><TicketForm onSaved={loadAll} /></div>
          <div className="space-y-3">
            {tickets.map(t => {
              const group = configs.find(c => c.ticket_type_id === t.id)
              return (
              <Card key={t.id} className="border-border bg-card">
                <CardContent className="p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-medium text-foreground break-words">{locale === "zh" && t.name_zh ? t.name_zh : t.name}</span>
                      <Badge variant="secondary">{t.group_only ? (locale === "zh" ? "团体票" : "Group") : (locale === "zh" ? "个人票" : "Individual")}</Badge>
                      {!t.group_only && (t.is_free ? <Badge variant="outline" className="text-emerald-800 border-emerald-300 dark:text-emerald-300 dark:border-emerald-800 text-xs">{locale === "zh" ? "免费" : "Free"}</Badge> : <Badge variant="outline" className="text-amber-800 border-amber-300 dark:text-amber-300 dark:border-amber-800 text-xs">{locale === "zh" ? "收费" : "Paid"}</Badge>)}
                      {!t.group_only && t.requires_code && <Badge variant="secondary" className="text-[10px]">{locale === "zh" ? "需渠道码" : "Code req'd"}</Badge>}
                      <Badge variant="outline">{t.is_active ? (locale === "zh" ? "已启用" : "Enabled") : (locale === "zh" ? "已停用" : "Disabled")}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground break-words">{locale === "zh" ? t.description_zh || t.description : t.description}</p>
                    {group && <div className="mt-2 space-y-1 text-sm"><p>{money(group.unit_price_cents, locale)}{locale === "zh" ? " / 人" : " / person"} · {group.min_size}–{group.max_size} {locale === "zh" ? "人" : "seats"}</p><p className="text-xs text-muted-foreground">{!t.is_active ? (locale === "zh" ? "票种已停用" : "Ticket disabled") : !group.enabled ? (locale === "zh" ? "暂停新订单" : "New orders paused") : group.claim_deadline && now >= Date.parse(group.claim_deadline) ? (locale === "zh" ? "已截止" : "Deadline passed") : (locale === "zh" ? "开放新订单" : "Accepting new orders")} · {locale === "zh" ? "领取截止：" : "Claim deadline: "}{dateLabel(group.claim_deadline, locale)}</p></div>}
                    <p className="mt-1 text-xs text-muted-foreground">{locale === "zh" ? "顺序" : "Order"}: {t.sort_order}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0"><TicketForm ticket={t} config={group} onSaved={loadAll} /><Button variant="ghost" size="icon" disabled={!!deleting} title={locale === "zh" ? "删除票种" : "Delete ticket"} className="h-8 w-8 hover:text-red-400" onClick={() => deleteRecord("ticket", t.id)}><Trash2 className="h-4 w-4" /></Button></div>
                </CardContent>
              </Card>
            )})}
          </div>
        </TabsContent>

        <TabsContent value="channels">
          <div className="flex items-center justify-between mb-4"><p className="text-sm text-muted-foreground">{locale === "zh" ? "创建不同渠道的报名链接和渠道码" : "Create channel codes for different registration sources"}</p><ChannelForm tickets={tickets} onSaved={loadAll} /></div>
          <div className="space-y-3">
            {channels.map(c => (
              <Card key={c.id} className="border-border bg-card">
                <CardContent className="p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Badge className="bg-cyan-900/50 text-cyan-300 border-cyan-800 font-mono break-all whitespace-normal">{c.code}</Badge>
                      <span className="text-foreground text-sm break-words">{c.name}</span>
                      <Badge variant="outline">{c.is_active ? (locale === "zh" ? "已启用" : "Enabled") : (locale === "zh" ? "已停用" : "Disabled")}</Badge>
                      {c.ticket_type_id && (
                        <span className="text-xs text-muted-foreground">
                          → {tickets.find(t => t.id === c.ticket_type_id)?.name || c.ticket_type_id}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <Link className="h-3 w-3" />
                      <code className="min-w-0 break-all text-cyan-500">/register?code={encodeURIComponent(c.code)}</code>
                      <button title={locale === "zh" ? "复制链接" : "Copy link"} onClick={async () => { try { await navigator.clipboard.writeText(`https://how-website.vercel.app/register?code=${encodeURIComponent(c.code)}`); toast.success(locale === "zh" ? "已复制" : "Copied") } catch { toast.error(locale === "zh" ? "复制失败，请重试" : "Unable to copy. Please try again.") } }}><Copy className="h-3 w-3" /></button>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0"><ChannelForm channel={c} tickets={tickets} onSaved={loadAll} /><Button variant="ghost" size="icon" disabled={!!deleting} title={locale === "zh" ? "删除渠道码" : "Delete channel"} className="h-8 w-8 hover:text-red-400" onClick={() => deleteRecord("channel", c.id)}><Trash2 className="h-4 w-4" /></Button></div>
                </CardContent>
              </Card>
            ))}
            {channels.length === 0 && <div className="text-center py-12 text-muted-foreground"><Tag className="h-8 w-8 mx-auto mb-3 opacity-50" /><p>{locale === "zh" ? "还没有渠道码" : "No channels yet"}</p></div>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
