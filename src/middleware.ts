import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

function isMockMode() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  return !url || url.includes("placeholder")
}

export async function middleware(request: NextRequest) {
  // In mock/demo mode, skip all auth checks
  if (isMockMode()) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protect /admin routes
  if (request.nextUrl.pathname.startsWith("/admin")) {
    if (!user) {
      return NextResponse.redirect(new URL("/auth/login", request.url))
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (profile?.role !== "admin") {
      return NextResponse.redirect(new URL("/", request.url))
    }
  }

  // Protect /cfp route
  if (request.nextUrl.pathname.startsWith("/cfp")) {
    if (!user) {
      return NextResponse.redirect(
        new URL("/auth/login?redirect=/cfp", request.url)
      )
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ["/admin/:path*", "/cfp/:path*"],
}
