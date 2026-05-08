"use client"

import { isMockMode } from "@/lib/utils"
import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { admin as adminLabels, common } from "@/lib/i18n/translations"
import {
  LayoutDashboard,
  Mic,
  CalendarDays,
  Star,
  Newspaper,
  Settings,
  LogOut,
  ChevronLeft,
} from "lucide-react"
import { Button } from "@/components/ui/button"

const navItems = [
  { href: "/admin", icon: LayoutDashboard, key: "dashboard" },
  { href: "/admin/sessions", icon: Mic, key: "sessions" },
  { href: "/admin/agenda", icon: CalendarDays, key: "agenda" },
  { href: "/admin/sponsors", icon: Star, key: "sponsors" },
  { href: "/admin/updates", icon: Newspaper, key: "updates" },
  { href: "/admin/settings", icon: Settings, key: "settings" },
] as const

function getLocaleFromCookie(): "en" | "zh" {
  if (typeof document === "undefined") return "en"
  const match = document.cookie.match(/(?:^|;\s*)lang=([^;]*)/)
  return match?.[1] === "zh" ? "zh" : "en"
}


export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<"en" | "zh">("en")
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    setLocale(getLocaleFromCookie())
    checkAuth()
  }, [])

  async function checkAuth() {
    if (isMockMode()) {
      setAuthorized(true)
      setLoading(false)
      return
    }

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/auth/login")
        return
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()
      if (profile?.role !== "admin") {
        router.push("/")
        return
      }
      setAuthorized(true)
    } catch {
      setAuthorized(true)
    }
    setLoading(false)
  }

  async function handleLogout() {
    if (isMockMode()) {
      router.push("/")
      return
    }
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } catch {}
    router.push("/")
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-zinc-500">{common.loading[locale]}</div>
  }

  if (!authorized) return null

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <aside className={`${collapsed ? "w-16" : "w-60"} border-r border-zinc-800 bg-zinc-950/50 flex flex-col transition-all duration-200`}>
        <div className="p-4 flex items-center justify-between">
          {!collapsed && (
            <Link href="/" className="text-sm font-semibold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              HOW 2027 Admin
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="h-8 w-8 text-zinc-400"
          >
            <ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
          </Button>
        </div>

        <nav className="flex-1 px-2 space-y-1">
          {navItems.map(({ href, icon: Icon, key }) => {
            const isActive = pathname === href || (href !== "/admin" && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-emerald-950/50 text-emerald-400 border border-emerald-900/50"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                }`}
                title={collapsed ? adminLabels[key][locale] : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{adminLabels[key][locale]}</span>}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-zinc-800">
          <button
            onClick={handleLogout}
            className={`flex items-center gap-3 text-sm text-zinc-500 hover:text-zinc-300 w-full ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>{adminLabels.logout?.[locale] || (locale === "zh" ? "退出登录" : "Logout")}</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-6 lg:p-8">
        {children}
      </main>
    </div>
  )
}
