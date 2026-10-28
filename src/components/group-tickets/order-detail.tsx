"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, Copy, Link2, RotateCcw, ShieldCheck, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useLocale } from "@/lib/i18n/provider"
import { createClient } from "@/lib/supabase/client"
import { activateGroupOrder, cancelGroupOrder, closeGroupOrder, GroupTicketError, loadGroupOrder, rotateGroupSeat } from "@/lib/group-tickets/service"
import type { GroupOrderDetail } from "@/lib/group-tickets/types"
import { dateLabel, decimal, errorClass, ErrorNotice, Field, Loading, money, orderStatus, parseCents, StatusBadge, text, useNow } from "./shared"
import { useGroupMutation } from "./use-group-workspace"

type Confirmation = "activate" | "cancel" | "close" | { seatId: string } | null

export function OrderDetail({ orderId, userId, admin = false, onChanged }: {
  orderId: string; userId: string; admin?: boolean; onChanged: () => void
}) {
  const locale = useLocale()
  const now = useNow()
  const [detail, setDetail] = useState<GroupOrderDetail | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [revision, setRevision] = useState(0)
  const mutation = useGroupMutation()
  const [confirmation, setConfirmation] = useState<Confirmation>(null)
  const [reference, setReference] = useState("")
  const [amount, setAmount] = useState("")
  const [reason, setReason] = useState("")
  const [copied, setCopied] = useState<string | null>(null)
  const [copyError, setCopyError] = useState(false)
  const reload = useCallback(() => setRevision(value => value + 1), [])

  useEffect(() => {
    let active = true
    const timer = setTimeout(() => {
      setDetail(null)
      setError(null)
      loadGroupOrder(createClient(), orderId).then(result => {
        if (active) {
          setDetail(result)
          if (!result) setError(new GroupTicketError("operation_failed"))
        }
      }).catch(failure => { if (active) setError(failure) })
    }, 0)
    return () => { active = false; clearTimeout(timer) }
  }, [orderId, userId, revision])

  if (error) return <ErrorNotice error={error} retry={reload} />
  if (!detail) return <Loading />

  const { order, seats } = detail
  const status = orderStatus(order, now)
  const deadlineEnded = Boolean(order.claim_deadline && now >= Date.parse(order.claim_deadline))
  const canClaim = status === "active" && !deadlineEnded && now > 0
  const amountMatches = parseCents(amount) === order.total_cents
  const confirmationAllowed = confirmation === "activate" ? status === "pending" && !deadlineEnded && amountMatches && Boolean(reference.trim())
    : confirmation === "cancel" ? status === "pending"
    : confirmation === "close" ? status === "active" && Boolean(reason.trim())
    : confirmation !== null && canClaim && seats.some(seat => seat.id === confirmation.seatId && !seat.claimed)

  async function confirm() {
    if (!confirmation || !confirmationAllowed) return
    const ok = await mutation.run(async () => {
      const client = createClient()
      const expectedUserId = userId
      if (confirmation === "activate") await activateGroupOrder(client, { expectedUserId, orderId, paymentReference: reference.trim(), receivedCents: parseCents(amount)! })
      else if (confirmation === "cancel") await cancelGroupOrder(client, { expectedUserId, orderId })
      else if (confirmation === "close") await closeGroupOrder(client, { expectedUserId, orderId, reason: reason.trim() })
      else await rotateGroupSeat(client, { expectedUserId, seatId: confirmation.seatId })
    })
    if (ok) { setConfirmation(null); setCopied(null); setCopyError(false); reload(); onChanged() }
  }

  async function copy(value: string, key: string) {
    setCopyError(false)
    setCopied(null)
    try { await navigator.clipboard.writeText(value); setCopied(key) }
    catch { setCopyError(true) }
  }

  return <section aria-label={text(locale, "订单详情", "Order details")} className="min-w-0 space-y-6 border-t border-border pt-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><h2 className="break-words text-lg font-semibold">{order.team_name}</h2><p className="mt-1 break-all font-mono text-xs text-muted-foreground">{order.id}</p></div>
      <StatusBadge order={order} now={now} />
    </div>
    <dl className="grid min-w-0 grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
      <div><dt className="text-muted-foreground">{text(locale, "票种", "Ticket")}</dt><dd className="mt-1 break-words">{locale === "zh" ? order.ticket_name_zh || order.ticket_name : order.ticket_name}</dd></div>
      <div><dt className="text-muted-foreground">{text(locale, "人数 / 已领取", "Seats / Claimed")}</dt><dd className="mt-1 tabular-nums">{order.quantity} / {order.claimed_count}</dd></div>
      <div><dt className="text-muted-foreground">{text(locale, "单价 / 总额", "Unit price / Total")}</dt><dd className="mt-1 tabular-nums">{money(order.unit_price_cents, locale)} / {money(order.total_cents, locale)}</dd></div>
      <div><dt className="text-muted-foreground">{text(locale, "创建时间", "Created")}</dt><dd className="mt-1">{dateLabel(order.created_at, locale)}</dd></div>
      <div><dt className="text-muted-foreground">{text(locale, "待核款过期时间", "Activation expires")}</dt><dd className="mt-1">{dateLabel(order.expires_at, locale)}</dd></div>
      <div><dt className="text-muted-foreground">{text(locale, "领取截止时间", "Claim deadline")}</dt><dd className="mt-1">{dateLabel(order.claim_deadline, locale)}</dd></div>
      {admin && order.payment_reference && <div className="sm:col-span-2"><dt className="text-muted-foreground">{text(locale, "外部核款凭据", "External payment reference")}</dt><dd className="mt-1 break-all">{order.payment_reference}</dd></div>}
    </dl>

    {status === "expired" && <p role="status" className="text-sm text-muted-foreground">{text(locale, "订单已过期，不能再激活或取消。请新建订单。", "This order has expired and cannot be activated or cancelled. Create a new order.")}</p>}
    {deadlineEnded && <p role="status" className="text-sm text-muted-foreground">{text(locale, "领取期限已结束，不能激活、领取或更新未领取兑换码。", "The claim deadline has passed. Activation, claims and code rotation are unavailable.")}</p>}
    {status === "closed" && <p className="text-sm text-muted-foreground">{text(locale, "订单已关闭，不能继续领取；已领取的报名仍然有效。", "This order is closed to further claims. Existing registrations remain valid.")}</p>}
    {status === "cancelled" && <p className="text-sm text-muted-foreground">{text(locale, "订单已取消，没有可领取名额。", "This order was cancelled; no seats can be claimed.")}</p>}
    {status === "pending" && <div className="flex flex-wrap items-center gap-3">
      <p className="text-sm text-muted-foreground">{text(locale, "等待管理员核实外部收款并激活。在线支付未启用。", "Waiting for an administrator to verify external payment and activate the order. Online payment is not enabled.")}</p>
      <Button variant="outline" disabled={mutation.busy || !now} onClick={() => setConfirmation("cancel")}><XCircle />{text(locale, "取消订单", "Cancel order")}</Button>
    </div>}

    {admin && status === "pending" && <form className="space-y-4 border-y border-border py-5" onSubmit={event => { event.preventDefault(); if (amountMatches && reference.trim()) setConfirmation("activate") }}>
      <h3 className="font-medium">{text(locale, "外部核款记录", "Record external verification")}</h3>
      <p className="text-sm text-muted-foreground">{text(locale, "请先在系统外核实到账。本操作仅记录凭据并激活名额，不会扣款。", "Verify receipt of funds outside this system first. This action only records the reference and activates seats; it does not charge anyone.")}</p>
      <fieldset disabled={mutation.busy || deadlineEnded || !now} className="grid min-w-0 gap-4 sm:grid-cols-2">
        <Field id="group-payment-reference" label={text(locale, "核款凭据 / 流水号 *", "Verification reference *")}><Input id="group-payment-reference" required maxLength={200} value={reference} onChange={e => setReference(e.target.value)} /></Field>
        <Field id="group-received" label={text(locale, "实收金额（人民币元）*", "Exact amount received (CNY) *")}><Input id="group-received" required inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder={decimal(order.total_cents)} aria-invalid={Boolean(amount && !amountMatches)} aria-describedby="group-amount-note" /></Field>
      </fieldset>
      <p id="group-amount-note" className={amount && !amountMatches ? errorClass : "text-sm text-muted-foreground"}>{text(locale, `实收金额必须与订单总额 ${money(order.total_cents, locale)} 完全一致。`, `The amount received must exactly equal the order total of ${money(order.total_cents, locale)}.`)}</p>
      <Button type="submit" disabled={mutation.busy || deadlineEnded || !now || !reference.trim() || !amountMatches}><ShieldCheck />{text(locale, "核对并激活", "Review activation")}</Button>
    </form>}

    {admin && status === "active" && <form className="space-y-3 border-y border-border py-5" onSubmit={event => { event.preventDefault(); setConfirmation("close") }}>
      <Field id="group-close-reason" label={text(locale, "关闭原因 *", "Reason for closing *")}><Textarea id="group-close-reason" required maxLength={500} rows={2} disabled={mutation.busy} value={reason} onChange={e => setReason(e.target.value)} /></Field>
      <p className="text-sm text-muted-foreground">{text(locale, "关闭将停止后续领取，已报名成员仍有效。这不是退款操作。", "Closing stops future claims and keeps existing registrations valid. This is not a refund.")}</p>
      <Button type="submit" variant="destructive" disabled={mutation.busy || !reason.trim()}><XCircle />{text(locale, "关闭订单", "Close order")}</Button>
    </form>}

    {(status === "active" || status === "closed") && <div className="space-y-3">
      <h3 className="font-medium">{text(locale, "团队名额", "Team seats")}</h3>
      {copyError && <p role="alert" className={errorClass}>{text(locale, "复制失败。请手动选择兑换码复制，或检查浏览器剪贴板权限后重试。", "Copy failed. Select and copy the code manually, or check browser clipboard permissions and try again.")}</p>}
      {copied && <p role="status" className="text-sm text-emerald-800 dark:text-emerald-300">{text(locale, "已复制", "Copied")}</p>}
      {!seats.length && <p className="text-sm text-muted-foreground">{text(locale, "暂无名额记录。", "No seat records.")}</p>}
      <ol className="divide-y divide-border">
        {seats.map((seat, index) => <li key={seat.id} className="flex min-w-0 flex-wrap items-center gap-3 py-3">
          <span className="w-8 shrink-0 text-sm tabular-nums text-muted-foreground">{index + 1}</span>
          <div className="min-w-0 flex-1">
            {seat.claimed ? <p className="flex items-center gap-2 break-words text-sm"><Check className="size-4 shrink-0 text-emerald-700 dark:text-emerald-400" />{seat.member_name || text(locale, "已领取", "Claimed")}</p> : <><p className="text-xs text-muted-foreground">{text(locale, "未领取", "Unclaimed")}</p>{seat.code && <code className="select-all break-all text-sm">{seat.code}</code>}</>}
          </div>
          {!seat.claimed && seat.code && <div className="flex shrink-0 gap-1">
            <Button variant="ghost" size="icon" title={text(locale, "复制兑换码", "Copy code")} aria-label={text(locale, "复制兑换码", "Copy code")} disabled={!canClaim || mutation.busy} onClick={() => void copy(seat.code!, `${seat.id}-code`)}><Copy /></Button>
            <Button variant="ghost" size="icon" title={text(locale, "复制领取链接", "Copy claim link")} aria-label={text(locale, "复制领取链接", "Copy claim link")} disabled={!canClaim || mutation.busy} onClick={() => void copy(new URL(`/group-tickets/redeem?code=${encodeURIComponent(seat.code!)}`, window.location.origin).href, `${seat.id}-link`)}><Link2 /></Button>
            <Button variant="ghost" size="icon" title={text(locale, "更新兑换码", "Rotate code")} aria-label={text(locale, "更新兑换码", "Rotate code")} disabled={!canClaim || mutation.busy} onClick={() => setConfirmation({ seatId: seat.id })}><RotateCcw /></Button>
          </div>}
        </li>)}
      </ol>
    </div>}
    {Boolean(mutation.error) && !confirmation && <ErrorNotice error={mutation.error} />}

    <AlertDialog open={confirmation !== null} onOpenChange={open => { if (!open && !mutation.busy) setConfirmation(null) }}>
      <AlertDialogContent className="max-h-[85dvh] overflow-y-auto rounded-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>{confirmation === "activate" ? text(locale, "确认外部核款并激活", "Confirm external verification") : confirmation === "cancel" ? text(locale, "确认取消订单", "Cancel this order?") : confirmation === "close" ? text(locale, "确认关闭订单", "Close this order?") : text(locale, "确认更新兑换码", "Rotate this code?")}</AlertDialogTitle>
          <AlertDialogDescription>{confirmation === "activate" ? text(locale, "我已在系统外核实以下款项确实到账。确认只会记录核款并开放领取，不会发起支付或扣款。", "I have independently verified receipt of these funds outside this system. Confirming records verification and enables claims; it does not initiate payment or charge anyone.") : confirmation === "cancel" ? text(locale, "取消后该订单不能再激活。", "This order cannot be activated after cancellation.") : confirmation === "close" ? text(locale, "后续领取将被停止，已领取的报名保持有效。这不是退款，也不会退回任何款项。", "Future claims will stop. Existing registrations remain valid. This is not a refund and no funds will be returned.") : text(locale, "原兑换码和领取链接将立即失效。请向成员发送新的链接。", "The previous code and claim link will stop working immediately. Share the new link with the attendee.")}</AlertDialogDescription>
        </AlertDialogHeader>
        {confirmation === "activate" && <dl className="space-y-2 break-all text-sm"><div><dt className="text-muted-foreground">{text(locale, "凭据", "Reference")}</dt><dd>{reference}</dd></div><div><dt className="text-muted-foreground">{text(locale, "实收金额", "Amount received")}</dt><dd>{money(parseCents(amount) ?? 0, locale)}</dd></div></dl>}
        {confirmation === "close" && <p className="break-words text-sm">{reason}</p>}
        {!confirmationAllowed && <p role="status" className={errorClass}>{text(locale, "当前订单状态或截止时间已改变，请关闭此窗口并刷新订单。", "The order state or deadline has changed. Dismiss this dialog and refresh the order.")}</p>}
        {Boolean(mutation.error) && <ErrorNotice error={mutation.error} />}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" disabled={mutation.busy} onClick={() => setConfirmation(null)}>{text(locale, "返回", "Back")}</Button>
          <Button disabled={mutation.busy || !confirmationAllowed} onClick={() => void confirm()}>{mutation.busy ? text(locale, "处理中...", "Working...") : confirmation === "activate" ? text(locale, "已核实到账，确认激活", "Verified; activate seats") : text(locale, "确认", "Confirm")}</Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  </section>
}
