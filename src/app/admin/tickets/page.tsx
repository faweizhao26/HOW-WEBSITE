"use client"

import { useLocale } from "@/lib/i18n/provider"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { Plus, Trash2, Pencil, Copy, Link, Ticket, Tag } from "lucide-react"
import { AdminLoadError } from "@/components/admin/load-error"
import { deleteChannelRecord, deleteTicketRecord, loadTicketWorkspace, saveChannel, saveTicket } from "@/lib/admin/data"
import type { ChannelCode, TicketType } from "@/lib/db/schema"


function TicketForm({ ticket, onSaved }: { ticket?: TicketType; onSaved: () => void }) {
  const locale = useLocale()
  const [name, setName] = useState(ticket?.name || "")
  const [nameZh, setNameZh] = useState(ticket?.name_zh || "")
  const [desc, setDesc] = useState(ticket?.description || "")
  const [descZh, setDescZh] = useState(ticket?.description_zh || "")
  const [isFree, setIsFree] = useState(ticket?.is_free ?? true)
  const [requiresCode, setRequiresCode] = useState(ticket?.requires_code ?? false)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setSaveError(false)
    try {
      await saveTicket(createClient(), { name, name_zh: nameZh, description: desc, description_zh: descZh, is_free: isFree, requires_code: requiresCode }, ticket?.id)
      toast.success(ticket ? (locale === "zh" ? "已更新" : "Updated") : (locale === "zh" ? "已创建" : "Created"))
      setOpen(false)
      onSaved()
    } catch { setSaveError(true) }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!saving) { setOpen(value); setSaveError(false) } }}>
      <DialogTrigger render={ticket ? <Button variant="ghost" size="icon" className="h-8 w-8" title={locale === "zh" ? "编辑票种" : "Edit Ticket"} /> : <Button className="bg-emerald-600 hover:bg-emerald-500" />}>{ticket ? <Pencil className="h-4 w-4" /> : <><Plus className="h-4 w-4 mr-1" />{locale === "zh" ? "添加票种" : "Add Ticket"}</>}</DialogTrigger>
      <DialogContent className="bg-zinc-900 border-zinc-800">
        <DialogHeader><DialogTitle>{ticket ? (locale === "zh" ? "编辑票种" : "Edit Ticket") : (locale === "zh" ? "添加票种" : "Add Ticket")}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={saving} className="space-y-4">
          <div className="space-y-2"><Label>{locale === "zh" ? "名称（英文）" : "Name (English)"}</Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
          <div className="space-y-2"><Label>{locale === "zh" ? "名称（中文）" : "Name (Chinese)"}</Label><Input value={nameZh} onChange={e => setNameZh(e.target.value)} /></div>
          <div className="space-y-2"><Label>{locale === "zh" ? "说明（英文）" : "Description (English)"}</Label><Textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} /></div>
          <div className="space-y-2"><Label>{locale === "zh" ? "说明（中文）" : "Description (Chinese)"}</Label><Textarea value={descZh} onChange={e => setDescZh(e.target.value)} rows={2} /></div>
          <div className="flex items-center justify-between"><Label>{locale === "zh" ? "免费票" : "Free Ticket"}</Label><Switch checked={isFree} onCheckedChange={setIsFree} /></div>
          <div className="flex items-center justify-between"><Label>{locale === "zh" ? "需要渠道码" : "Requires Code"}</Label><Switch checked={requiresCode} onCheckedChange={setRequiresCode} /></div>
          </fieldset>
          {saveError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{locale === "zh" ? "票种保存失败，请重试。填写内容已保留。" : "Unable to save ticket. Your input has been kept; please try again."}</p>}
          <Button type="submit" disabled={saving} className="w-full bg-emerald-600 hover:bg-emerald-500">{saving ? (locale === "zh" ? "保存中..." : "Saving...") : ticket ? (locale === "zh" ? "保存" : "Save") : (locale === "zh" ? "创建" : "Create")}</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ChannelForm({ channel, tickets, onSaved }: { channel?: ChannelCode; tickets: TicketType[]; onSaved: () => void }) {
  const locale = useLocale()
  const [code, setCode] = useState(channel?.code || "")
  const [name, setName] = useState(channel?.name || "")
  const [ticketId, setTicketId] = useState(channel?.ticket_type_id || "")
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<"duplicate" | "failed" | null>(null)

  const registerLink = `https://how-website.vercel.app/register?code=${encodeURIComponent(code)}`

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setSaveError(null)
    try {
      await saveChannel(createClient(), { code, name, ticket_type_id: ticketId || null }, channel?.id)
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
      <DialogContent className="bg-zinc-900 border-zinc-800">
        <DialogHeader><DialogTitle>{channel ? (locale === "zh" ? "编辑渠道码" : "Edit Channel") : (locale === "zh" ? "新建渠道码" : "New Channel")}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={saving} className="space-y-4">
          <div className="space-y-2"><Label>{locale === "zh" ? "渠道码" : "Code"}</Label><Input value={code} onChange={e => setCode(e.target.value)} placeholder="VIP-2027" required /></div>
          <div className="space-y-2"><Label>{locale === "zh" ? "名称" : "Name"}</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder={locale === "zh" ? "合作伙伴渠道" : "Partner channel"} required /></div>
          <div className="space-y-2"><Label>{locale === "zh" ? "关联票种" : "Linked Ticket"}</Label>
            <select value={ticketId} onChange={e => setTicketId(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300">
              <option value="">{locale === "zh" ? "不关联" : "None"}</option>
              {tickets.map(t => <option key={t.id} value={t.id}>{locale === "zh" && t.name_zh ? t.name_zh : t.name}</option>)}
            </select>
          </div>
          {code && <div className="p-3 bg-zinc-800 rounded-lg"><p className="text-xs text-zinc-400 mb-2">{locale === "zh" ? "报名链接" : "Registration Link"}:</p><div className="flex items-center gap-2"><code className="min-w-0 text-xs text-cyan-400 flex-1 truncate">{registerLink}</code><Button type="button" size="icon" variant="ghost" className="h-6 w-6 shrink-0" title={locale === "zh" ? "复制链接" : "Copy link"} onClick={copyLink}><Copy className="h-3 w-3" /></Button></div></div>}
          </fieldset>
          {saveError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{saveError === "duplicate" ? (locale === "zh" ? "渠道码已存在，请更换。" : "This code already exists. Please choose another.") : (locale === "zh" ? "渠道码保存失败，请重试。填写内容已保留。" : "Unable to save channel. Your input has been kept; please try again.")}</p>}
          <Button type="submit" disabled={saving} className="w-full bg-cyan-600 hover:bg-cyan-500">{saving ? (locale === "zh" ? "保存中..." : "Saving...") : channel ? (locale === "zh" ? "保存" : "Save") : (locale === "zh" ? "创建" : "Create")}</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function AdminTicketsPage() {
  const locale = useLocale()
  const [tickets, setTickets] = useState<TicketType[]>([])
  const [channels, setChannels] = useState<ChannelCode[]>([])
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
    } catch { setLoadError(true) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    let cancelled = false
    loadTicketWorkspace(createClient())
      .then(data => { if (!cancelled) { setTickets(data.tickets); setChannels(data.channels) } })
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

  if (loading) return <div><h1 className="text-2xl font-bold mb-8">{locale === "zh" ? "票种 & 渠道码" : "Tickets & Channels"}</h1><div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16 bg-zinc-800" />)}</div></div>
  if (loadError) return <div><h1 className="text-2xl font-bold mb-8">{locale === "zh" ? "票种 & 渠道码" : "Tickets & Channels"}</h1><AdminLoadError onRetry={loadAll} /></div>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-8">{locale === "zh" ? "票种 & 渠道码" : "Tickets & Channels"}</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-zinc-900 border border-zinc-800 mb-6">
          <TabsTrigger value="tickets"><Ticket className="h-4 w-4 mr-1" />{locale === "zh" ? "票种" : "Tickets"} ({tickets.length})</TabsTrigger>
          <TabsTrigger value="channels"><Tag className="h-4 w-4 mr-1" />{locale === "zh" ? "渠道码" : "Channels"} ({channels.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="tickets">
          <div className="flex items-center justify-between mb-4"><p className="text-sm text-muted-foreground">{locale === "zh" ? "管理可选的票种" : "Manage available ticket types"}</p><TicketForm onSaved={loadAll} /></div>
          <div className="space-y-3">
            {tickets.map(t => (
              <Card key={t.id} className="bg-zinc-900/50 border-zinc-800">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-white">{locale === "zh" && t.name_zh ? t.name_zh : t.name}</span>
                      {t.name_zh && <span className="text-muted-foreground text-sm">{t.name_zh}</span>}
                      {t.is_free ? <Badge variant="outline" className="text-emerald-400 border-emerald-800 text-[10px]">{locale === "zh" ? "免费" : "Free"}</Badge> : <Badge variant="outline" className="text-amber-400 border-amber-800 text-[10px]">{locale === "zh" ? "收费" : "Paid"}</Badge>}
                      {t.requires_code && <Badge variant="secondary" className="text-[10px]">{locale === "zh" ? "需渠道码" : "Code req'd"}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{t.description}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0"><TicketForm ticket={t} onSaved={loadAll} /><Button variant="ghost" size="icon" disabled={!!deleting} title={locale === "zh" ? "删除票种" : "Delete ticket"} className="h-8 w-8 hover:text-red-400" onClick={() => deleteRecord("ticket", t.id)}><Trash2 className="h-4 w-4" /></Button></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="channels">
          <div className="flex items-center justify-between mb-4"><p className="text-sm text-muted-foreground">{locale === "zh" ? "创建不同渠道的报名链接和渠道码" : "Create channel codes for different registration sources"}</p><ChannelForm tickets={tickets} onSaved={loadAll} /></div>
          <div className="space-y-3">
            {channels.map(c => (
              <Card key={c.id} className="bg-zinc-900/50 border-zinc-800">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className="bg-cyan-900/50 text-cyan-300 border-cyan-800 font-mono">{c.code}</Badge>
                      <span className="text-zinc-300 text-sm">{c.name}</span>
                      {c.ticket_type_id && (
                        <span className="text-xs text-muted-foreground">
                          → {tickets.find(t => t.id === c.ticket_type_id)?.name || c.ticket_type_id}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <Link className="h-3 w-3" />
                      <code className="text-cyan-500">/register?code={c.code}</code>
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
