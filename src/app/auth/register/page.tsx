"use client"

import { useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { useLocale } from "@/lib/i18n/provider"
import { authErrorCode } from "@/lib/auth/login"
import type { AuthErrorCode } from "@/lib/auth/login"
import { authErrors } from "@/lib/auth/messages"
import { safeAuthRedirect } from "@/lib/auth/redirect"

export default function RegisterPage() {
  const locale = useLocale()
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [errorCode, setErrorCode] = useState<AuthErrorCode | null>(null)
  const pending = useRef(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = safeAuthRedirect(searchParams.get("redirect"))

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (pending.current) return
    pending.current = true
    setLoading(true)
    setErrorCode(null)
    let navigating = false
    try {
      const callback = new URL("/auth/callback", window.location.origin)
      callback.searchParams.set("next", redirect)
      const { data, error } = await createClient().auth.signUp({
        email: email.trim(), password,
        options: { data: { full_name: fullName.trim() }, emailRedirectTo: callback.href },
      })
      if (error) { setErrorCode(authErrorCode(error)); return }
      if (data.session) {
        window.location.assign(redirect)
        navigating = true
        return
      }
      toast.success(locale === "zh" ? "注册成功！请查看邮件确认账号。" : "Registration successful! Check your email to confirm your account.")
      router.push(`/auth/login?redirect=${encodeURIComponent(redirect)}`)
      navigating = true
    } catch { setErrorCode("operation_failed") }
    finally { if (!navigating) { pending.current = false; setLoading(false) } }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <Card className="w-full max-w-md bg-zinc-900 border-zinc-800">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl"><h1>{locale === "zh" ? "创建账号" : "Create Account"}</h1></CardTitle>
          <CardDescription>{locale === "zh" ? "注册 HOW 2027 账号" : "Create your HOW 2027 account"}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">{locale === "zh" ? "姓名" : "Full Name"}</Label>
              <Input
                id="fullName"
                placeholder={locale === "zh" ? "您的姓名" : "Your name"}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={loading}
                autoComplete="name"
              />
            </div>
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
                minLength={6}
                disabled={loading}
                maxLength={4096}
                autoComplete="new-password"
              />
            </div>
            {errorCode && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{authErrors[errorCode][locale]}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (locale === "zh" ? "创建中..." : "Creating account...") : (locale === "zh" ? "创建账号" : "Create Account")}
            </Button>
          </form>
          <p className="text-center text-sm text-zinc-400 mt-4">
            {locale === "zh" ? "已有账号？" : "Already have an account?"}{" "}
            <Link href={`/auth/login?redirect=${encodeURIComponent(redirect)}`} className="text-emerald-400 hover:text-emerald-300">
              {locale === "zh" ? "登录" : "Sign In"}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
