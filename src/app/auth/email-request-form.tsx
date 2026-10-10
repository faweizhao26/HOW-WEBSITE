"use client"

import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Mail } from "lucide-react"
import { useLocale } from "@/lib/i18n/provider"
import { createClient } from "@/lib/supabase/client"
import { EmailFlowError, requestAccountEmail } from "@/lib/auth/email"
import type { EmailErrorCode } from "@/lib/auth/email"
import { emailErrors } from "@/lib/auth/email-messages"
import { safeAuthRedirect, accountEmailCallbackURL } from "@/lib/auth/redirect"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function EmailRequestForm({ kind }: { kind: "recovery" | "confirmation" }) {
  const locale = useLocale(), params = useSearchParams()
  const redirect = safeAuthRedirect(params.get("redirect"))
  const recovery = kind === "recovery"
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<EmailErrorCode | null>(null)
  const [seconds, setSeconds] = useState(0)
  const [until, setUntil] = useState(0)
  const pending = useRef(false)
  const cooldown = useRef(0)
  useEffect(() => {
    if (!until) return
    const update = () => setSeconds(Math.max(0, Math.ceil((until - Date.now()) / 1000)))
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [until])
  function pause() { cooldown.current = Date.now() + 60000; setUntil(cooldown.current); setSeconds(60) }
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (pending.current || Date.now() < cooldown.current) return
    pending.current = true; setLoading(true); setError(null); setSent(false)
    try {
      await requestAccountEmail(createClient(), { kind, email, callbackURL: accountEmailCallbackURL(window.location.origin, kind, redirect) })
      setSent(true); pause()
    } catch (cause) {
      const code = cause instanceof EmailFlowError ? cause.code : "operation_failed"
      setError(code)
      if (code === "rate_limited") pause()
    } finally { pending.current = false; setLoading(false) }
  }
  const title = recovery ? { en: "Forgot Password", zh: "找回密码" } : { en: "Confirm Your Email", zh: "确认邮箱" }
  return <div className="min-h-[80vh] flex items-center justify-center px-4 py-10">
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl"><h1>{title[locale]}</h1></CardTitle>
        <CardDescription>{recovery ? (locale === "zh" ? "获取密码重置邮件" : "Request a password reset email") : (locale === "zh" ? "重新获取账号确认邮件" : "Request another account confirmation email")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <form onSubmit={submit} className="space-y-4" aria-busy={loading}>
          <div className="space-y-2">
            <Label htmlFor="email">{locale === "zh" ? "邮箱" : "Email"}</Label>
            <Input id="email" type="email" autoComplete="email" maxLength={254} required disabled={loading} value={email} onChange={event => { setEmail(event.target.value); setSent(false) }} placeholder="you@example.com" />
          </div>
          {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{emailErrors[error][locale]}</p>}
          {sent && <p role="status" className="text-sm text-muted-foreground">{recovery ? (locale === "zh" ? "如果该邮箱已有账号，重置邮件将发送至收件箱，请同时查看垃圾邮件。" : "If an account exists, a reset email will arrive. Check your spam folder too.") : (locale === "zh" ? "如果该账号仍需确认邮箱，确认邮件将发送至收件箱，请同时查看垃圾邮件。" : "If this account still needs confirmation, an email will arrive. Check your spam folder too.")}</p>}
          <Button type="submit" className="w-full" disabled={loading || seconds > 0}>
            <Mail className="size-4" />{loading ? (locale === "zh" ? "发送中..." : "Sending...") : seconds > 0 ? (locale === "zh" ? `${seconds} 秒后重发` : `Resend in ${seconds}s`) : (locale === "zh" ? "发送邮件" : "Send Email")}
          </Button>
        </form>
        <Link href={`/auth/login?redirect=${encodeURIComponent(redirect)}`} className="inline-flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400 hover:underline"><ArrowLeft className="size-4" />{locale === "zh" ? "返回登录" : "Back to Sign In"}</Link>
      </CardContent>
    </Card>
  </div>
}
