"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { useLocale } from "@/lib/i18n/provider"

export default function LoginPage() {
  const locale = useLocale()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get("redirect") || "/"
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success(locale === "zh" ? "登录成功" : "Logged in!")
      router.push(redirect)
      router.refresh()
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <Card className="w-full max-w-md bg-zinc-900 border-zinc-800">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl"><h1>{locale === "zh" ? "登录" : "Sign In"}</h1></CardTitle>
          <CardDescription>{locale === "zh" ? "登录 HOW 2027 账号" : "Sign in to your HOW 2027 account"}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{locale === "zh" ? "邮箱" : "Email"}</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
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
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (locale === "zh" ? "登录中..." : "Signing in...") : (locale === "zh" ? "登录" : "Sign In")}
            </Button>
          </form>
          <p className="text-center text-sm text-zinc-400 mt-4">
            {locale === "zh" ? "还没有账号？" : "Don't have an account?"}{" "}
            <Link href="/auth/register" className="text-emerald-400 hover:text-emerald-300">
              {locale === "zh" ? "注册" : "Register"}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
