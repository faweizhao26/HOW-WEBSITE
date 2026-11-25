import { NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase/server"
import { authRequestOrigin } from "@/lib/auth/redirect"

export async function POST(request: Request) {
  let origin
  try { origin = authRequestOrigin(request) } catch { return new Response(null, { status: 400 }) }
  const supabase = await createServerSupabase({ writeCookies: true })
  await supabase.auth.signOut()

  return NextResponse.redirect(new URL("/", origin), { status: 303 })
}
