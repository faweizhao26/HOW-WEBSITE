"use client"

import { startTransition, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { RotateCw } from "lucide-react"
import { useLocale } from "@/lib/i18n/provider"
import { createClient } from "@/lib/supabase/client"
import type { EmailErrorCode } from "@/lib/auth/email"
import { emailErrors } from "@/lib/auth/email-messages"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { updateAccountPassword } from "./actions"

export default function ResetPasswordForm({ userId, initialError, redirect }: { userId: string | null; initialError: EmailErrorCode | null; redirect: string }) {
  const locale = useLocale()
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [error, setError] = useState(initialError)
  const [loading, setLoading] = useState(false)
  const [changed, setChanged] = useState(false)
  const [done, setDone] = useState(false)
  const pending = useRef(false)
  const version = useRef({ value: 0 })
  useEffect(() => {
    if (!userId) return
    const identity = version.current
    const { data: { subscription } } = createClient().auth.onAuthStateChange((_event, session) => {
      if (session?.user.id === userId) return
      identity.value++; setChanged(true); setPassword(""); setConfirmation(""); setDone(false); setError("account_changed")
    })
    return () => { identity.value++; subscription.unsubscribe() }
  }, [userId])
  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (pending.current || !userId || changed) return
    setError(null)
    if (password !== confirmation) { setError("password_mismatch"); return }
    pending.current = true; setLoading(true)
    const current = version.current.value
    startTransition(async () => {
      try {
        // Refresh in the browser so the action never needs to replace session cookies.
        const { data, error: sessionError } = await createClient().auth.getSession()
        if (version.current.value !== current) return
        if (sessionError || !data.session) { setError("session_expired"); return }
        if (data.session.user.id !== userId) { setChanged(true); setError("account_changed"); return }
        const result = await updateAccountPassword({ password, confirmation, expectedUserId: userId })
        if (version.current.value !== current) return
        if (!result.success) { setError(result.code); return }
        setDone(true); setPassword(""); setConfirmation("")
      } catch { if (version.current.value === current) setError("operation_failed") }
      finally { pending.current = false; setLoading(false) }
    })
  }
  const blocked = !userId || changed
  return <div className="min-h-[80vh] flex items-center justify-center px-4 py-10">
    <Card className="w-full max-w-md">
      <CardHeader className="text-center"><CardTitle className="text-2xl"><h1>{locale === "zh" ? "重置密码" : "Reset Password"}</h1></CardTitle></CardHeader>
      <CardContent className="space-y-5">
        {done ? <>
          <p role="status" className="text-sm text-muted-foreground">{locale === "zh" ? "密码已更新。" : "Your password has been updated."}</p>
          <Button className="w-full" onClick={() => window.location.assign(redirect)}>{locale === "zh" ? "继续" : "Continue"}</Button>
        </> : <form onSubmit={submit} className="space-y-4" aria-busy={loading}>
          {!blocked && <fieldset disabled={loading} className="space-y-4 min-w-0">
            <div className="space-y-2"><Label htmlFor="password">{locale === "zh" ? "新密码" : "New Password"}</Label><Input id="password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} value={password} onChange={event => setPassword(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="confirmation">{locale === "zh" ? "确认新密码" : "Confirm New Password"}</Label><Input id="confirmation" type="password" autoComplete="new-password" required minLength={8} maxLength={72} value={confirmation} onChange={event => setConfirmation(event.target.value)} /></div>
          </fieldset>}
          {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{emailErrors[error][locale]}</p>}
          {!blocked && <Button type="submit" className="w-full" disabled={loading}>{loading ? (locale === "zh" ? "更新中..." : "Updating...") : (locale === "zh" ? "更新密码" : "Update Password")}</Button>}
          {blocked && error === "operation_failed" && <Button type="button" variant="outline" onClick={() => window.location.reload()}><RotateCw className="size-4" />{locale === "zh" ? "重试" : "Retry"}</Button>}
        </form>}
        {!done && <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-emerald-700 dark:text-emerald-400">
          <Link className="hover:underline" href={`/auth/forgot-password?redirect=${encodeURIComponent(redirect)}`}>{locale === "zh" ? "获取新重置链接" : "Request a New Link"}</Link>
          <Link className="hover:underline" href={`/auth/login?redirect=${encodeURIComponent(redirect)}`}>{locale === "zh" ? "返回登录" : "Back to Sign In"}</Link>
        </div>}
      </CardContent>
    </Card>
  </div>
}
