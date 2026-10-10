import { NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase/server"
import { safeAuthRedirect } from "@/lib/auth/redirect"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = safeAuthRedirect(searchParams.get("next"))

  if (code) {
    try {
      const supabase = await createServerSupabase()
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error && data.session) return NextResponse.redirect(new URL(next, origin))
    } catch { /* Failed exchanges use the same readable login state as expired links. */ }
  }

  const login = new URL("/auth/login", origin)
  login.searchParams.set("error", "auth_failed")
  login.searchParams.set("redirect", next)
  return NextResponse.redirect(login)
}
