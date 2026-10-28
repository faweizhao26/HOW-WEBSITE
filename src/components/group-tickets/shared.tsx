"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { LogIn, RefreshCw, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { useLocale } from "@/lib/i18n/provider"
import type { Locale } from "@/lib/i18n/translations"
import type { GroupOrder } from "@/lib/group-tickets/types"
import { groupErrorMessage } from "@/lib/group-tickets/service"

export const selectClass = "h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
export const errorClass = "text-sm text-red-700 dark:text-red-300"
export function text(locale: Locale, zh: string, en: string) { return locale === "zh" ? zh : en }
export function money(cents: number, locale: Locale) {
  return new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", { style: "currency", currency: "CNY" }).format(cents / 100)
}
export function decimal(cents: number) { return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}` }
export function parseCents(value: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null
  const [whole, fraction = ""] = value.trim().split(".")
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"))
  return Number.isSafeInteger(cents) && cents >= 0 ? cents : null
}
export function dateLabel(value: string | null, locale: Locale) {
  return value ? new Date(value).toLocaleString(locale === "zh" ? "zh-CN" : "en-US") : text(locale, "无", "None")
}
export function useNow() {
  const [now, setNow] = useState(0)
  useEffect(() => {
    const update = () => setNow(Date.now())
    const initial = setTimeout(update, 0)
    const timer = setInterval(update, 1000)
    return () => { clearTimeout(initial); clearInterval(timer) }
  }, [])
  return now
}
export function orderStatus(order: GroupOrder, now: number): GroupOrder["status"] {
  return order.status === "pending" && now >= Date.parse(order.expires_at) ? "expired" : order.status
}
export function StatusBadge({ order, now }: { order: GroupOrder; now: number }) {
  const locale = useLocale()
  const status = orderStatus(order, now)
  const labels = {
    pending: text(locale, "待核款", "Awaiting verification"), active: text(locale, "已激活", "Active"),
    closed: text(locale, "已关闭", "Closed"), cancelled: text(locale, "已取消", "Cancelled"), expired: text(locale, "已过期", "Expired"),
  }
  return <Badge variant="outline" className={status === "active" ? "border-emerald-300 text-emerald-800 dark:border-emerald-800 dark:text-emerald-300" : status === "pending" ? "border-amber-300 text-amber-800 dark:border-amber-800 dark:text-amber-300" : "text-muted-foreground"}>{labels[status]}</Badge>
}
export function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return <div className="min-w-0 space-y-2"><Label htmlFor={id}>{label}</Label>{children}</div>
}
export function ErrorNotice({ error, retry }: { error: unknown; retry?: () => void }) {
  const locale = useLocale()
  return <div role="alert" className="flex flex-wrap items-center gap-3 border-y border-border py-4">
    <p className={errorClass}>{groupErrorMessage(error, locale)}</p>
    {retry && <Button type="button" variant="outline" onClick={retry}><RefreshCw />{text(locale, "重试", "Retry")}</Button>}
  </div>
}
export function AuthPrompt({ redirect }: { redirect: string }) {
  const locale = useLocale()
  return <div className="space-y-4 border-y border-border py-6">
    <p className="text-sm text-muted-foreground">{text(locale, "请使用本人账号登录后继续。每位参会人需自行登录并领取名额，不会自动创建账号。", "Sign in with your own account to continue. Each attendee must sign in and claim their seat; accounts are never created automatically.")}</p>
    <div className="flex flex-wrap gap-3">
      <Button nativeButton={false} render={<Link href={`/auth/login?redirect=${encodeURIComponent(redirect)}`} />}><LogIn />{text(locale, "登录", "Sign in")}</Button>
      <Button variant="outline" nativeButton={false} render={<Link href={`/auth/register?redirect=${encodeURIComponent(redirect)}`} />}><UserPlus />{text(locale, "注册账号", "Create account")}</Button>
    </div>
  </div>
}
export function Loading() {
  const locale = useLocale()
  return <p role="status" className="py-8 text-sm text-muted-foreground">{text(locale, "加载中...", "Loading...")}</p>
}
