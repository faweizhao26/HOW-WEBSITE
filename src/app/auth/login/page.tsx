"use client"

import { useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { useLocale } from "@/lib/i18n/provider"
import { LoginError, signInAccount } from "@/lib/auth/login"
import type { AuthErrorCode } from "@/lib/auth/login"
import { authErrors } from "@/lib/auth/messages"
import { safeAuthRedirect } from "@/lib/auth/redirect"

export default function LoginPage() {
  const locale = useLocale()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [loginError, setLoginError] = useState<AuthErrorCode | null>(null)
  const pending = useRef(false)
  const searchParams = useSearchParams()
  const redirect = safeAuthRedirect(searchParams.get("redirect"))
  const errorCode = loginError || (searchParams.get("error") === "auth_failed" ? "auth_failed" : null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (pending.current) return
    pending.current = true
    setLoading(true)
    setLoginError(null)
    let navigating = false
    try {
      await signInAccount(createClient(), { email, password })
      toast.success(locale === "zh" ? "登录成功" : "Logged in!")
      // A full navigation cannot reuse a protected-route redirect prefetched before login.
      window.location.assign(redirect)
      navigating = true
    } catch (error) { setLoginError(error instanceof LoginError ? error.code : "operation_failed") }
    finally { if (!navigating) { pending.current = false; setLoading(false) } }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <Card className="w-full max-w-md bg-zinc-900 border-zinc-800">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl"><h1>{locale === "zh" ? "登录" : "Sign In"}</h1></CardTitle>
          <CardDescription>{locale === "zh" ? "登录 HOW 2027 账号" : "Sign in to your HOW 2027 account"}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4" aria-busy={loading}>
            <div className="space-y-2">
              <Label htmlFor="email">{locale === "zh" ? "邮箱" : "Email"}</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                maxLength={254}
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{locale === "zh" ? "密码" : "Password"}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                maxLength={4096}
                autoComplete="current-password"
              />
            </div>
            {errorCode && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{authErrors[errorCode][locale]}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (locale === "zh" ? "登录中..." : "Signing in...") : (locale === "zh" ? "登录" : "Sign In")}
            </Button>
          </form>
          <p className="text-center text-sm text-zinc-400 mt-4">
            {locale === "zh" ? "还没有账号？" : "Don't have an account?"}{" "}
            <Link href={`/auth/register?redirect=${encodeURIComponent(redirect)}`} className="text-emerald-400 hover:text-emerald-300">
              {locale === "zh" ? "注册" : "Register"}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
