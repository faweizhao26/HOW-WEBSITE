"use client"

import { useEffect, useId, useState } from "react"
import { Pencil, Plus, Save } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createClient } from "@/lib/supabase/client"
import { useLocale } from "@/lib/i18n/provider"
import type { TicketType } from "@/lib/db/schema"
import type { GroupConfig } from "@/lib/group-tickets/types"
import { GroupTicketError, groupErrorMessage, saveAdminTicket } from "@/lib/group-tickets/service"
import { decimal, Field, parseCents, text } from "@/components/group-tickets/shared"

function localDate(value: string | null | undefined) {
  if (!value) return ""
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
type Props = { ticket?: TicketType; config?: GroupConfig; onSaved: () => void }

export function TicketForm({ ticket, config, onSaved }: Props) {
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  return <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value) }}>
    <DialogTrigger render={ticket ? <Button variant="ghost" size="icon" className="h-8 w-8" title={text(locale, "编辑票种", "Edit ticket")} aria-label={text(locale, "编辑票种", "Edit ticket")} /> : <Button />}>
      {ticket ? <Pencil className="h-4 w-4" /> : <><Plus />{text(locale, "添加票种", "Add ticket")}</>}
    </DialogTrigger>
    <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-lg border border-border bg-popover sm:max-w-xl">
      <DialogHeader><DialogTitle>{ticket ? text(locale, "编辑票种", "Edit ticket") : text(locale, "添加票种", "Add ticket")}</DialogTitle></DialogHeader>
      {open && <TicketFields ticket={ticket} config={config} onBusy={setBusy} onSaved={() => { setOpen(false); onSaved() }} />}
    </DialogContent>
  </Dialog>
}

function TicketFields({ ticket, config, onBusy, onSaved }: Props & { onBusy: (value: boolean) => void }) {
  const locale = useLocale(), formId = useId()
  const [ticketId] = useState(() => ticket?.id || crypto.randomUUID())
  const [userId, setUserId] = useState<string | null>(null)
  const [kind, setKind] = useState(ticket?.group_only || config ? "group" : "individual")
  const [name, setName] = useState(ticket?.name || ""), [nameZh, setNameZh] = useState(ticket?.name_zh || "")
  const [description, setDescription] = useState(ticket?.description || ""), [descriptionZh, setDescriptionZh] = useState(ticket?.description_zh || "")
  const [free, setFree] = useState(ticket?.is_free ?? true), [code, setCode] = useState(ticket?.requires_code ?? false)
  const [active, setActive] = useState(ticket?.is_active ?? true), [sortOrder, setSortOrder] = useState(String(ticket?.sort_order ?? 99))
  const [price, setPrice] = useState(decimal(config?.unit_price_cents ?? 0))
  const [minimum, setMinimum] = useState(String(config?.min_size ?? 2)), [maximum, setMaximum] = useState(String(config?.max_size ?? 100))
  const [deadline, setDeadline] = useState(localDate(config?.claim_deadline)), [enabled, setEnabled] = useState(config?.enabled ?? false)
  const [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(null)
  const cents = parseCents(price), min = Number(minimum), max = Number(maximum)
  const groupValid = cents !== null && cents <= 100000000 && Number.isInteger(min) && min >= 2 && min <= 100 && Number.isInteger(max) && max >= min && max <= 100 && (!deadline || Number.isFinite(Date.parse(deadline)))
  const valid = Boolean(userId && name.trim() && Number.isInteger(Number(sortOrder)) && Number(sortOrder) >= 0 && Number(sortOrder) <= 9999 && (kind !== "group" || groupValid))

  useEffect(() => {
    const client = createClient(); let alive = true, changed = false, bound: string | null = null
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (bound && session?.user.id !== bound)) {
        changed = true
        if (alive) { setUserId(null); setError(new GroupTicketError("account_changed")) }
      }
    })
    client.auth.getUser().then(({ data, error }) => {
      if (!alive || changed) return
      if (error || !data.user) { setError(new GroupTicketError("login_required")); return }
      bound = data.user.id; setUserId(bound)
    }).catch(() => { if (alive) setError(new GroupTicketError("login_required")) })
    return () => { alive = false; subscription.unsubscribe() }
  }, [])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!valid || busy || !userId) return
    setBusy(true); onBusy(true); setError(null)
    try {
      const common = { expectedUserId: userId, ticketTypeId: ticketId, name, nameZh, description, descriptionZh, active, sortOrder: Number(sortOrder) }
      await saveAdminTicket(createClient(), kind === "group" ? { ...common, kind: "group", group: { enabled, minSize: min, maxSize: max, unitPriceCents: cents, claimDeadline: deadline ? new Date(deadline).toISOString() : null } } : { ...common, kind: "individual", isFree: free, requiresCode: code })
      toast.success(text(locale, "票种及规则已保存", "Ticket and rules saved")); onSaved()
    } catch (error) { setError(error) }
    finally { setBusy(false); onBusy(false) }
  }

  return <form onSubmit={submit} className="min-w-0 space-y-5" aria-busy={busy}>
    <fieldset disabled={busy} className="min-w-0 space-y-5">
      <div className="space-y-2"><Label>{text(locale, "票种类型", "Ticket type")}</Label>
        <Tabs value={kind} onValueChange={setKind}><TabsList aria-label={text(locale, "票种类型", "Ticket type")} className="grid w-full grid-cols-2"><TabsTrigger value="individual" disabled={Boolean(ticket?.group_only || config)}>{text(locale, "个人票", "Individual")}</TabsTrigger><TabsTrigger value="group">{text(locale, "团体票", "Group")}</TabsTrigger></TabsList></Tabs>
      </div>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <Field id={formId + "-name"} label={text(locale, "名称（英文）*", "Name (English) *")}><Input id={formId + "-name"} required maxLength={200} value={name} onChange={e => setName(e.target.value)} /></Field>
        <Field id={formId + "-zh"} label={text(locale, "名称（中文）", "Name (Chinese)")}><Input id={formId + "-zh"} maxLength={200} value={nameZh} onChange={e => setNameZh(e.target.value)} /></Field>
        <Field id={formId + "-desc"} label={text(locale, "权益说明（英文）", "Benefits (English)")}><Textarea id={formId + "-desc"} rows={2} maxLength={5000} value={description} onChange={e => setDescription(e.target.value)} /></Field>
        <Field id={formId + "-desc-zh"} label={text(locale, "权益说明（中文）", "Benefits (Chinese)")}><Textarea id={formId + "-desc-zh"} rows={2} maxLength={5000} value={descriptionZh} onChange={e => setDescriptionZh(e.target.value)} /></Field>
      </div>
      {kind === "group" ? <section className="min-w-0 space-y-4 border-y border-border py-4" aria-label={text(locale, "团体购票规则", "Group rules")}>
        <Field id={formId + "-price"} label={text(locale, "每人单价（人民币元）*", "Price per person (CNY) *")}><Input id={formId + "-price"} inputMode="decimal" required value={price} onChange={e => setPrice(e.target.value)} aria-invalid={cents === null || cents > 100000000} /><p className="text-xs text-muted-foreground">{text(locale, "填 0 为免费团票；总额 = 单价 × 人数。", "0 means free; order total = price × seats.")}</p></Field>
        <div className="grid min-w-0 grid-cols-2 gap-4">
          <Field id={formId + "-min"} label={text(locale, "最少人数 *", "Minimum seats *")}><Input id={formId + "-min"} type="number" min={2} max={100} step={1} required value={minimum} onChange={e => setMinimum(e.target.value)} /></Field>
          <Field id={formId + "-max"} label={text(locale, "最多人数 *", "Maximum seats *")}><Input id={formId + "-max"} type="number" min={Math.max(2, min || 2)} max={100} step={1} required value={maximum} onChange={e => setMaximum(e.target.value)} /></Field>
        </div>
        <Field id={formId + "-deadline"} label={text(locale, "名额领取截止（可选，本地时区）", "Claim deadline (optional, local time)")}><Input id={formId + "-deadline"} type="datetime-local" className="min-w-0" value={deadline} onChange={e => setDeadline(e.target.value)} /></Field>
        <div className="flex items-center justify-between gap-3"><Label htmlFor={formId + "-enabled"}>{text(locale, "开放新团体订单", "Accept new group orders")}</Label><Switch id={formId + "-enabled"} checked={enabled} onCheckedChange={setEnabled} /></div>
        <p className="text-xs text-muted-foreground">{text(locale, "仅通过团体订单领取，不使用渠道码。改价和修改期限不影响已有订单。", "Claim through group orders, not channel codes. Existing order prices and deadlines stay unchanged.")}</p>
      </section> : <div className="space-y-4 border-y border-border py-4">
        <div className="flex items-center justify-between gap-3"><Label htmlFor={formId + "-free"}>{text(locale, "免费票", "Free ticket")}</Label><Switch id={formId + "-free"} checked={free} onCheckedChange={setFree} /></div>
        <div className="flex items-center justify-between gap-3"><Label htmlFor={formId + "-code"}>{text(locale, "需要渠道码", "Requires a channel code")}</Label><Switch id={formId + "-code"} checked={code} onCheckedChange={setCode} /></div>
      </div>}
      <div className="flex items-center justify-between gap-3"><Label htmlFor={formId + "-active"}>{text(locale, "启用票种", "Ticket enabled")}</Label><Switch id={formId + "-active"} checked={active} onCheckedChange={setActive} /></div>
      {kind === "group" && (!active || !enabled) && <p className="text-sm text-muted-foreground">{!active ? text(locale, "票种已停用：无法新建订单或领取名额。", "Ticket disabled: new orders and seat claims are unavailable.") : text(locale, "暂停新订单；已开通订单仍可在期限内领取。", "New orders paused; activated seats can still be claimed before their deadline.")}</p>}
      <Field id={formId + "-sort"} label={text(locale, "显示顺序", "Display order")}><Input id={formId + "-sort"} type="number" min={0} max={9999} required value={sortOrder} onChange={e => setSortOrder(e.target.value)} /></Field>
    </fieldset>
    {Boolean(error) && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{groupErrorMessage(error, locale)} {text(locale, "填写内容已保留。", "Your input has been kept.")}</p>}
    <Button type="submit" className="w-full" disabled={busy || !valid}><Save />{busy ? text(locale, "保存中...", "Saving...") : text(locale, "保存票种", "Save ticket")}</Button>
  </form>
}
