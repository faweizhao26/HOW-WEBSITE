import { NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase/server"
import { safeAuthRedirect } from "@/lib/auth/redirect"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = safeAuthRedirect(searchParams.get("next"))
  const recovery = searchParams.get("flow") === "recovery" || searchParams.get("type") === "recovery"
  const reset = `/auth/reset-password?redirect=${encodeURIComponent(next)}`
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type")

  if (code || (tokenHash && (type === "signup" || type === "recovery"))) {
    try {
      const supabase = await createServerSupabase()
      const result = code ? await supabase.auth.exchangeCodeForSession(code)
        : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: type as "signup" | "recovery" })
      if (!result.error && result.data.session) {
        const actualRecovery = "redirectType" in result.data && result.data.redirectType === "recovery"
        const response = NextResponse.redirect(new URL(recovery || actualRecovery ? reset : next, origin))
        response.headers.set("Cache-Control", "no-store")
        response.headers.set("Referrer-Policy", "no-referrer")
        return response
      }
    } catch { /* Failed exchanges use the same readable login state as expired links. */ }
  }

  const login = new URL(recovery ? "/auth/reset-password" : "/auth/login", origin)
  login.searchParams.set("error", "auth_failed")
  login.searchParams.set("redirect", next)
  const response = NextResponse.redirect(login)
  response.headers.set("Cache-Control", "no-store")
  response.headers.set("Referrer-Policy", "no-referrer")
  return response
}
