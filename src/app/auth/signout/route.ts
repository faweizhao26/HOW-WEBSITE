import { NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const supabase = await createServerSupabase({ writeCookies: true })
  await supabase.auth.signOut()

  return NextResponse.redirect(new URL("/", request.url), { status: 303 })
}
