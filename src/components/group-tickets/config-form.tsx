"use client"

import { useId, useState } from "react"
import { Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useLocale } from "@/lib/i18n/provider"
import { createClient } from "@/lib/supabase/client"
import { saveGroupConfig } from "@/lib/group-tickets/service"
import type { GroupConfig, GroupWorkspace } from "@/lib/group-tickets/types"
import { decimal, ErrorNotice, Field, parseCents, selectClass, text } from "./shared"
import { useGroupMutation } from "./use-group-workspace"

function localDate(value: string | null | undefined) {
  if (!value) return ""
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export function ConfigForm({ config, workspace, onSaved, onCancel }: {
  config?: GroupConfig; workspace: GroupWorkspace; onSaved: () => void; onCancel: () => void
}) {
  const locale = useLocale()
  const id = useId()
  const [ticketId, setTicketId] = useState(config?.ticket_type_id || "")
  const [enabled, setEnabled] = useState(config?.enabled ?? false)
  const [minimum, setMinimum] = useState(String(config?.min_size ?? 2))
  const [maximum, setMaximum] = useState(String(config?.max_size ?? 100))
  const [price, setPrice] = useState(decimal(config?.unit_price_cents ?? 0))
  const [deadline, setDeadline] = useState(localDate(config?.claim_deadline))
  const mutation = useGroupMutation()
  const cents = parseCents(price)
  const min = Number(minimum), max = Number(maximum)
  const valid = Boolean(ticketId && Number.isInteger(min) && min >= 2 && min <= 100 && Number.isInteger(max) && max >= min && max <= 100 && cents !== null && cents <= 100000000 && (!deadline || Number.isFinite(Date.parse(deadline))))

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!valid) return
    const ok = await mutation.run(async () => {
      await saveGroupConfig(createClient(), { expectedUserId: workspace.userId, ticketTypeId: ticketId, enabled, minSize: min, maxSize: max, unitPriceCents: cents, claimDeadline: deadline ? new Date(deadline).toISOString() : null })
    })
    if (ok) onSaved()
  }

  return <form onSubmit={submit} className="space-y-4 border-y border-border py-5" aria-busy={mutation.busy}>
    <h3 className="font-semibold">{config ? text(locale, "编辑团票配置", "Edit group configuration") : text(locale, "新增团票配置", "New group configuration")}</h3>
    <p className="text-sm text-muted-foreground">{text(locale, "请选择独立团票票种，不能使用已有个人报名的票种。保存后该票种不再出现在普通报名中。配置变更不影响已有订单的金额及领取期限。", "Choose a dedicated group ticket type without existing individual registrations. Once saved, it will no longer appear in ordinary registration. Changes do not alter amounts or deadlines of existing orders.")}</p>
    <fieldset disabled={mutation.busy} className="grid min-w-0 gap-4 sm:grid-cols-2">
      <Field id={id + "-ticket"} label={text(locale, "现有票种 *", "Existing ticket *")}><select id={id + "-ticket"} required disabled={Boolean(config)} value={ticketId} onChange={e => setTicketId(e.target.value)} className={selectClass}>
        <option value="">{text(locale, "选择票种", "Select a ticket")}</option>
        {workspace.tickets.map(ticket => <option key={ticket.id} value={ticket.id} disabled={!config && workspace.configs.some(c => c.ticket_type_id === ticket.id)}>{locale === "zh" ? ticket.name_zh || ticket.name : ticket.name}</option>)}
        {config && !workspace.tickets.some(ticket => ticket.id === config.ticket_type_id) && <option value={config.ticket_type_id}>{locale === "zh" ? config.ticket_name_zh || config.ticket_name : config.ticket_name}</option>}
      </select></Field>
      <Field id={id + "-price"} label={text(locale, "每人单价（人民币元）*", "Unit price (CNY) *")}><Input id={id + "-price"} inputMode="decimal" required value={price} onChange={e => setPrice(e.target.value)} aria-invalid={cents === null || cents > 100000000} aria-describedby={id + "-price-note"} /><p id={id + "-price-note"} className="text-xs text-muted-foreground">{text(locale, "0–1,000,000 元，最多两位小数。", "CNY 0–1,000,000, up to two decimal places.")}</p></Field>
      <Field id={id + "-min"} label={text(locale, "最少人数 *", "Minimum seats *")}><Input id={id + "-min"} type="number" min={2} max={100} step={1} required value={minimum} onChange={e => setMinimum(e.target.value)} /></Field>
      <Field id={id + "-max"} label={text(locale, "最多人数 *", "Maximum seats *")}><Input id={id + "-max"} type="number" min={Math.max(2, min || 2)} max={100} step={1} required value={maximum} onChange={e => setMaximum(e.target.value)} /></Field>
      <div className="sm:col-span-2"><Field id={id + "-deadline"} label={text(locale, "领取截止时间（可选，本地时区）", "Claim deadline (optional, local time)")}><Input id={id + "-deadline"} type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} /></Field></div>
      <div className="flex items-center gap-3 sm:col-span-2"><Switch id={id + "-enabled"} checked={enabled} onCheckedChange={setEnabled} /><Label htmlFor={id + "-enabled"}>{text(locale, "开放创建订单", "Enable new orders")}</Label></div>
    </fieldset>
    {Boolean(mutation.error) && <ErrorNotice error={mutation.error} />}
    <div className="flex flex-wrap gap-3"><Button type="submit" disabled={mutation.busy || !valid}><Save />{mutation.busy ? text(locale, "保存中...", "Saving...") : text(locale, "保存配置", "Save configuration")}</Button><Button type="button" variant="outline" disabled={mutation.busy} onClick={onCancel}>{text(locale, "取消", "Cancel")}</Button></div>
  </form>
}
