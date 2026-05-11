"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { Plus, Trash2, Pencil, Copy, Link, Ticket, Tag } from "lucide-react"

function getLocaleFromCookie(): "en" | "zh" {
  if (typeof document === "undefined") return "en"
  const match = document.cookie.match(/(?:^|;\s*)lang=([^;]*)/)
  return match?.[1] === "zh" ? "zh" : "en"
}

function TicketForm({ ticket, onSaved }: { ticket?: any; onSaved: () => void }) {
  const [name, setName] = useState(ticket?.name || "")
  const [nameZh, setNameZh] = useState(ticket?.name_zh || "")
  const [desc, setDesc] = useState(ticket?.description || "")
  const [descZh, setDescZh] = useState(ticket?.description_zh || "")
  const [isFree, setIsFree] = useState(ticket?.is_free ?? true)
  const [requiresCode, setRequiresCode] = useState(ticket?.requires_code ?? false)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const supabase = createClient()
    if (ticket) await supabase.from("ticket_types").update({ name, name_zh: nameZh, description: desc, description_zh: descZh, is_free: isFree, requires_code: requiresCode }).eq("id", ticket.id)
    else await supabase.from("ticket_types").insert({ name, name_zh: nameZh, description: desc, description_zh: descZh, is_free: isFree, requires_code: requiresCode, sort_order: 99 })
    toast.success(ticket ? (getLocaleFromCookie() === "zh" ? "已更新" : "Updated") : (getLocaleFromCookie() === "zh" ? "已创建" : "Created"))
    setSaving(false); setOpen(false); onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>{ticket ? <Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="h-4 w-4" /></Button> : <Button className="bg-emerald-600 hover:bg-emerald-500"><Plus className="h-4 w-4 mr-1" /> {getLocaleFromCookie() === "zh" ? "添加票种" : "Add Ticket"}</Button>}</DialogTrigger>
      <DialogContent className="bg-zinc-900 border-zinc-800">
        <DialogHeader><DialogTitle>{ticket ? (getLocaleFromCookie() === "zh" ? "编辑票种" : "Edit Ticket") : (getLocaleFromCookie() === "zh" ? "添加票种" : "Add Ticket")}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2"><Label>Name (EN)</Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
          <div className="space-y-2"><Label>Name (中文)</Label><Input value={nameZh} onChange={e => setNameZh(e.target.value)} /></div>
          <div className="space-y-2"><Label>Description (EN)</Label><Textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} /></div>
          <div className="space-y-2"><Label>Description (中文)</Label><Textarea value={descZh} onChange={e => setDescZh(e.target.value)} rows={2} /></div>
          <div className="flex items-center justify-between"><Label>{getLocaleFromCookie() === "zh" ? "免费票" : "Free Ticket"}</Label><Switch checked={isFree} onCheckedChange={setIsFree} /></div>
          <div className="flex items-center justify-between"><Label>{getLocaleFromCookie() === "zh" ? "需要渠道码" : "Requires Code"}</Label><Switch checked={requiresCode} onCheckedChange={setRequiresCode} /></div>
          <Button type="submit" disabled={saving} className="w-full bg-emerald-600 hover:bg-emerald-500">{saving ? "..." : ticket ? (getLocaleFromCookie() === "zh" ? "保存" : "Save") : (getLocaleFromCookie() === "zh" ? "创建" : "Create")}</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ChannelForm({ channel, tickets, onSaved }: { channel?: any; tickets: any[]; onSaved: () => void }) {
  const [code, setCode] = useState(channel?.code || "")
  const [name, setName] = useState(channel?.name || "")
  const [ticketId, setTicketId] = useState(channel?.ticket_type_id || "")
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const registerLink = `https://how-website.vercel.app/register?code=${code}`

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const supabase = createClient()
    if (channel) await supabase.from("channel_codes").update({ code, name, ticket_type_id: ticketId || null }).eq("id", channel.id)
    else await supabase.from("channel_codes").insert({ code, name, ticket_type_id: ticketId || null })
    toast.success(channel ? "Updated" : "Created")
    setSaving(false); setOpen(false); onSaved()
  }

  function copyLink() { navigator.clipboard.writeText(registerLink); toast.success(getLocaleFromCookie() === "zh" ? "链接已复制" : "Link copied") }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        {channel ? <Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>
        : <Button className="bg-cyan-600 hover:bg-cyan-500"><Plus className="h-4 w-4 mr-1" />{getLocaleFromCookie() === "zh" ? "添加渠道码" : "Add Channel"}</Button>}
      </DialogTrigger>
      <DialogContent className="bg-zinc-900 border-zinc-800">
        <DialogHeader><DialogTitle>{channel ? (getLocaleFromCookie() === "zh" ? "编辑渠道码" : "Edit Channel") : (getLocaleFromCookie() === "zh" ? "新建渠道码" : "New Channel")}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2"><Label>Code</Label><Input value={code} onChange={e => setCode(e.target.value)} placeholder="VIP-2027" required /></div>
          <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="合作伙伴渠道" required /></div>
          <div className="space-y-2"><Label>{getLocaleFromCookie() === "zh" ? "关联票种" : "Linked Ticket"}</Label>
            <select value={ticketId} onChange={e => setTicketId(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300">
              <option value="">{getLocaleFromCookie() === "zh" ? "不关联" : "None"}</option>
              {tickets.map((t: any) => <option key={t.id} value={t.id}>{getLocaleFromCookie() === "zh" && t.name_zh ? t.name_zh : t.name}</option>)}
            </select>
          </div>
          {code && <div className="p-3 bg-zinc-800 rounded-lg"><p className="text-xs text-zinc-400 mb-2">{getLocaleFromCookie() === "zh" ? "报名链接" : "Registration Link"}:</p><div className="flex items-center gap-2"><code className="text-xs text-cyan-400 flex-1 truncate">{registerLink}</code><Button size="icon" variant="ghost" className="h-6 w-6" onClick={copyLink}><Copy className="h-3 w-3" /></Button></div></div>}
          <Button type="submit" disabled={saving} className="w-full bg-cyan-600 hover:bg-cyan-500">{saving ? "..." : channel ? (getLocaleFromCookie() === "zh" ? "保存" : "Save") : (getLocaleFromCookie() === "zh" ? "创建" : "Create")}</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function AdminTicketsPage() {
  const [locale] = useState(getLocaleFromCookie())
  const [tickets, setTickets] = useState<any[]>([])
  const [channels, setChannels] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const supabase = createClient()
    const [tRes, cRes] = await Promise.all([
      supabase.from("ticket_types").select("*").order("sort_order"),
      supabase.from("channel_codes").select("*").order("created_at", { ascending: false }),
    ])
    setTickets(tRes.data || [])
    setChannels(cRes.data || [])
    setLoading(false)
  }

  async function deleteTicket(id: string) { const supabase = createClient(); await supabase.from("ticket_types").delete().eq("id", id); toast.success("Deleted"); loadAll() }
  async function deleteChannel(id: string) { const supabase = createClient(); await supabase.from("channel_codes").delete().eq("id", id); toast.success("Deleted"); loadAll() }

  if (loading) return <div><h1 className="text-2xl font-bold mb-8">{locale === "zh" ? "票种 & 渠道码" : "Tickets & Channels"}</h1><div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16 bg-zinc-800" />)}</div></div>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-8">{locale === "zh" ? "票种 & 渠道码" : "Tickets & Channels"}</h1>

      <Tabs defaultValue="tickets">
        <TabsList className="bg-zinc-900 border border-zinc-800 mb-6">
          <TabsTrigger value="tickets"><Ticket className="h-4 w-4 mr-1" />{locale === "zh" ? "票种" : "Tickets"} ({tickets.length})</TabsTrigger>
          <TabsTrigger value="channels"><Tag className="h-4 w-4 mr-1" />{locale === "zh" ? "渠道码" : "Channels"} ({channels.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="tickets">
          <div className="flex items-center justify-between mb-4"><p className="text-sm text-zinc-500">{locale === "zh" ? "管理可选的票种" : "Manage available ticket types"}</p><TicketForm onSaved={loadAll} /></div>
          <div className="space-y-3">
            {tickets.map(t => (
              <Card key={t.id} className="bg-zinc-900/50 border-zinc-800">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-white">{locale === "zh" && t.name_zh ? t.name_zh : t.name}</span>
                      {t.name_zh && <span className="text-zinc-500 text-sm">{t.name_zh}</span>}
                      {t.is_free ? <Badge variant="outline" className="text-emerald-400 border-emerald-800 text-[10px]">{locale === "zh" ? "免费" : "Free"}</Badge> : <Badge variant="outline" className="text-amber-400 border-amber-800 text-[10px]">{locale === "zh" ? "收费" : "Paid"}</Badge>}
                      {t.requires_code && <Badge variant="secondary" className="text-[10px]">{locale === "zh" ? "需渠道码" : "Code req'd"}</Badge>}
                    </div>
                    <p className="text-xs text-zinc-500">{t.description}</p>
                  </div>
                  <div className="flex items-center gap-1"><TicketForm ticket={t} onSaved={loadAll} /><Button variant="ghost" size="icon" className="h-8 w-8 hover:text-red-400" onClick={() => deleteTicket(t.id)}><Trash2 className="h-4 w-4" /></Button></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="channels">
          <div className="flex items-center justify-between mb-4"><p className="text-sm text-zinc-500">{locale === "zh" ? "创建不同渠道的报名链接和渠道码" : "Create channel codes for different registration sources"}</p><ChannelForm tickets={tickets} onSaved={loadAll} /></div>
          <div className="space-y-3">
            {channels.map(c => (
              <Card key={c.id} className="bg-zinc-900/50 border-zinc-800">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className="bg-cyan-900/50 text-cyan-300 border-cyan-800 font-mono">{c.code}</Badge>
                      <span className="text-zinc-300 text-sm">{c.name}</span>
                      {c.ticket_type_id && (
                        <span className="text-xs text-zinc-500">
                          → {tickets.find(t => t.id === c.ticket_type_id)?.name || c.ticket_type_id}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-600 mt-1">
                      <Link className="h-3 w-3" />
                      <code className="text-cyan-500">/register?code={c.code}</code>
                      <button onClick={() => { navigator.clipboard.writeText(`https://how-website.vercel.app/register?code=${c.code}`); toast.success(locale === "zh" ? "已复制" : "Copied") }}><Copy className="h-3 w-3" /></button>
                    </div>
                  </div>
                  <div className="flex items-center gap-1"><ChannelForm channel={c} tickets={tickets} onSaved={loadAll} /><Button variant="ghost" size="icon" className="h-8 w-8 hover:text-red-400" onClick={() => deleteChannel(c.id)}><Trash2 className="h-4 w-4" /></Button></div>
                </CardContent>
              </Card>
            ))}
            {channels.length === 0 && <div className="text-center py-12 text-zinc-500"><Tag className="h-8 w-8 mx-auto mb-3 opacity-50" /><p>{locale === "zh" ? "还没有渠道码" : "No channels yet"}</p></div>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
