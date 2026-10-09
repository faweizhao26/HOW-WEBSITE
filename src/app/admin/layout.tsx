"use client"

import { useLocale } from "@/lib/i18n/provider"

import { isMockMode } from "@/lib/utils"
import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { admin as adminLabels, common } from "@/lib/i18n/translations"
import {
  LayoutDashboard,
  Mic,
  ContactRound,
  CalendarDays,
  Star,
  Newspaper,
  Settings,
  LogOut,
  ChevronLeft,
  Users,
  Ticket,
  UserCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"

const navItems = [
  { href: "/admin", icon: LayoutDashboard, key: "dashboard" },
  { href: "/admin/sessions", icon: Mic, key: "sessions" },
  { href: "/admin/speakers", icon: ContactRound, key: "speakers" },
  { href: "/admin/agenda", icon: CalendarDays, key: "agenda" },
  { href: "/admin/registrations", icon: Users, key: "registrations" },
  { href: "/admin/checkin", icon: UserCheck, key: "checkin" },
  { href: "/admin/tickets", icon: Ticket, key: "tickets" },
  { href: "/admin/sponsors", icon: Star, key: "sponsors" },
  { href: "/admin/updates", icon: Newspaper, key: "updates" },
  { href: "/admin/settings", icon: Settings, key: "settings" },
] as const



export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const locale = useLocale()
  const [loading, setLoading] = useState(() => !isMockMode())
  const [authorized, setAuthorized] = useState(() => isMockMode())
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    let active = true
    async function checkAuth() {
      if (isMockMode()) return
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!active) return
        if (!user) {
          router.push("/auth/login")
          return
        }
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single()
        if (!active) return
        if (profile?.role !== "admin") {
          router.push("/")
          return
        }
        setAuthorized(true)
      } catch {
        if (!active) return
        setAuthorized(false)
        setLoading(false)
        router.push("/auth/login")
        return
      }
      setLoading(false)
    }
    void checkAuth()
    return () => { active = false }
  }, [router])

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
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">{common.loading[locale]}</div>
  }

  if (!authorized) return null

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col md:flex-row">
      <aside className={`w-full ${collapsed ? "md:w-16" : "md:w-60"} shrink-0 border-b border-zinc-800 bg-zinc-950/50 transition-all duration-200 md:flex md:flex-col md:border-b-0 md:border-r`}>
        <div className="p-4 flex items-center justify-between">
          <Link href="/" className={`${collapsed ? "md:hidden" : ""} text-sm font-semibold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent`}>
            {(adminLabels.how2027Admin?.[locale]) || (locale === "zh" ? "HOW 2027 管理后台" : "HOW 2027 Admin")}
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="hidden h-8 w-8 text-zinc-400 md:inline-flex"
          >
            <ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
          </Button>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-2 pb-3 md:flex-1 md:flex-col md:space-y-1 md:overflow-visible md:pb-0">
          {navItems.map(({ href, icon: Icon, key }) => {
            const isActive = pathname === href || (href !== "/admin" && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "bg-emerald-950/50 text-emerald-400 border border-emerald-900/50"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                }`}
                title={collapsed ? adminLabels[key][locale] : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className={collapsed ? "md:hidden" : undefined}>{adminLabels[key][locale]}</span>
              </Link>
            )
          })}
          <button
            onClick={handleLogout}
            className="flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-zinc-800/50 hover:text-zinc-300 md:hidden"
          >
            <LogOut className="h-4 w-4" />
            <span>{adminLabels.logout?.[locale] || (locale === "zh" ? "退出登录" : "Logout")}</span>
          </button>
        </nav>

        <div className="hidden border-t border-zinc-800 p-4 md:block">
          <button
            onClick={handleLogout}
            className={`flex items-center gap-3 text-sm text-muted-foreground hover:text-zinc-300 w-full ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>{adminLabels.logout?.[locale] || (locale === "zh" ? "退出登录" : "Logout")}</span>}
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  )
}
