"use client"

import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useLocale } from "@/lib/i18n/provider"
import { safeAuthRedirect } from "@/lib/auth/redirect"
import { emailErrors } from "@/lib/auth/email-messages"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

export default function ConfirmEmailPage() {
  const locale = useLocale(), params = useSearchParams()
  const redirect = safeAuthRedirect(params.get("redirect"))
  const [failed, setFailed] = useState(false)
  const operation = useRef<Promise<boolean> | null>(null)
  useEffect(() => {
    let active = true
    if (!operation.current) {
      const hash = new URLSearchParams(window.location.hash.slice(1))
      const access = hash.get("access_token"), refresh = hash.get("refresh_token")
      // Default resend emails use a fragment. Never leave credentials in history.
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search)
      operation.current = (async () => {
        if (!access || !refresh || hash.has("error") || hash.get("type") !== "signup") return false
        try {
          const { data, error } = await createClient().auth.setSession({ access_token: access, refresh_token: refresh })
          return !error && !!data.user?.email_confirmed_at && !!data.session
        } catch { return false }
      })()
    }
    void operation.current.then(success => {
      if (!active) return
      if (success) window.location.replace(redirect)
      else setFailed(true)
    })
    return () => { active = false }
  }, [redirect])
  return <div className="min-h-[80vh] flex items-center justify-center px-4 py-10">
    <Card className="w-full max-w-md">
      <CardHeader className="text-center"><CardTitle className="text-2xl"><h1>{locale === "zh" ? "确认邮箱" : "Confirm Your Email"}</h1></CardTitle></CardHeader>
      <CardContent className="space-y-5">
        {failed ? <>
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">{emailErrors.auth_failed[locale]}</p>
          <Link className="text-sm text-emerald-700 dark:text-emerald-400 hover:underline" href={`/auth/resend-confirmation?redirect=${encodeURIComponent(redirect)}`}>{locale === "zh" ? "重新发送确认邮件" : "Resend Confirmation Email"}</Link>
        </> : <p role="status" className="text-sm text-muted-foreground">{locale === "zh" ? "正在确认邮箱..." : "Confirming your email..."}</p>}
      </CardContent>
    </Card>
  </div>
}
