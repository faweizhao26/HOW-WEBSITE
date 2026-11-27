"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Bell, LayoutDashboard, Menu, X } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { watchNavigationUser } from "@/lib/auth/watch-navigation-user"
import type { NavigationUser } from "@/lib/auth/watch-navigation-user"
import { Locale } from "@/lib/i18n/utils"
import { navigation } from "@/lib/i18n/translations"
import { LanguageSwitcher } from "./language-switcher"
import { ThemeToggle } from "./theme-toggle"
import { Button } from "@/components/ui/button"
import { isMockMode } from "@/lib/utils"
import { notificationReadEvent, notificationRpc } from "@/lib/notifications"
import { How2027Logo } from "./how-2027-logo"

const navLinks = [
  { href: "/", key: "home" },
  { href: "/about", key: "about" },
  { href: "/speakers", key: "speakers" },
  { href: "/schedule", key: "schedule" },
  { href: "/attend", key: "attend" },
  { href: "/sponsors", key: "sponsors" },
  { href: "/venue", key: "venue" },
  { href: "/updates", key: "updates" },
  { href: "/code-of-conduct", key: "codeOfConduct" },
  { href: "/register", key: "register" },
] as const

function NotificationLink({ locale, count, onNavigate }: { locale: Locale; count: number; onNavigate?: () => void }) {
  const label = locale === "zh" ? "站内通知" : "Notifications"
  return <Link href="/notifications" title={label} aria-label={count ? (locale === "zh" ? `${label}，${count} 条未读` : `${label}, ${count} unread`) : label}
    onNavigate={onNavigate} className="relative inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2">
    <Bell className="size-4" aria-hidden="true" />
    {count > 0 && <span aria-hidden="true" className="absolute -right-1 -top-0.5 min-w-4 rounded-full bg-emerald-700 px-0.5 text-center text-[10px] leading-4 text-white">{count > 9 ? "9+" : count}</span>}
  </Link>
}

export function Header({ locale, initialTheme }: { locale: Locale; initialTheme: "dark" | "light" }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const logoutPending = useRef(false)
  const [{ user, isAdmin }, setNavigationUser] = useState<NavigationUser>({ user: null, isAdmin: false })
  const [unread, setUnread] = useState<{ userId: string; count: number } | null>(null)
  const userId = user?.id
  const unreadCount = unread?.userId === userId ? unread?.count ?? 0 : 0
  const pathname = usePathname()
  const router = useRouter()
  const isCurrent = (href: string) => pathname === href
  const navClass = (active: boolean) => `inline-flex items-center whitespace-nowrap rounded-md px-2 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${active ? "bg-zinc-100 text-zinc-950 dark:bg-zinc-800 dark:text-white" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800/50 dark:hover:text-white"}`

  async function handleLogout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (logoutPending.current) return
    logoutPending.current = true
    try {
      // The browser SDK broadcasts SIGNED_OUT; a cookie-only POST leaves other tabs stale.
      const { error } = await createClient().auth.signOut()
      if (error) throw error
      router.replace("/")
      router.refresh()
    } catch {
      logoutPending.current = false
      toast.error(locale === "zh" ? "退出失败，请重试。" : "Unable to sign out. Please retry.")
    }
  }

  useEffect(() => {
    if (isMockMode()) return

    try {
      const supabase = createClient()
      return watchNavigationUser(supabase, setNavigationUser)
    } catch {}
  }, [])

  useEffect(() => {
    if (!userId) return
    let active = true
    let revision = 0
    function refresh() {
      if (document.visibilityState === "hidden") return
      const current = ++revision
      void notificationRpc<number>(createClient(),"unread").then(count => {
        if (active && current === revision && userId) setUnread({userId,count})
      }).catch(() => {})
    }
    refresh()
    const timer = window.setInterval(refresh, 60_000)
    window.addEventListener("focus",refresh)
    window.addEventListener(notificationReadEvent,refresh)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener("focus",refresh)
      window.removeEventListener(notificationReadEvent,refresh)
    }
  }, [userId,pathname])

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950/80 dark:shadow-none dark:backdrop-blur-md" onKeyDown={event => {
      if (event.key === "Escape" && mobileOpen) {
        event.preventDefault()
        setMobileOpen(false)
        menuButtonRef.current?.focus()
      }
    }}>
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" aria-label="HOW 2027" className="flex shrink-0 items-center gap-2 whitespace-nowrap">
            <How2027Logo />
          </Link>

          <nav aria-label={locale === "zh" ? "主导航" : "Main navigation"} className="hidden min-[1440px]:flex items-center gap-1">
            {navLinks.map(({ href, key }) => <Link key={href} href={href} aria-current={isCurrent(href) ? "page" : undefined} className={navClass(isCurrent(href))}>{navigation[key][locale]}</Link>)}
          </nav>

          <div className="hidden min-[1440px]:flex shrink-0 items-center gap-2">
            <ThemeToggle initialTheme={initialTheme} />
            <LanguageSwitcher locale={locale} />
            <Link href="/cfp" className="inline-flex h-9 items-center whitespace-nowrap rounded-md border border-emerald-300 px-3 text-sm font-medium text-emerald-700 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/50">{navigation.cfp[locale]}</Link>
            {user ? (
              <div className="flex items-center gap-1">
                {isAdmin && <Link href="/admin" className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-emerald-400 dark:hover:bg-emerald-950/50"><LayoutDashboard className="size-4" aria-hidden="true" />{locale === "zh" ? "管理后台" : "Admin"}</Link>}
                <NotificationLink locale={locale} count={unreadCount} />
                <Link href="/profile">
                  <Button variant="ghost" size="sm" className="text-zinc-400">
                    {locale === "zh" ? "个人中心" : "Profile"}
                  </Button>
                </Link>
                <form action="/auth/signout" method="post" onSubmit={handleLogout}>
                  <Button type="submit" variant="ghost" size="sm" className="text-zinc-400">
                    {navigation.logout[locale]}
                  </Button>
                </form>
              </div>
            ) : (
              <Link href="/auth/login">
                <Button variant="ghost" size="sm" className="text-zinc-400">
                  {navigation.login[locale]}
                </Button>
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2 min-[1440px]:hidden">
            {isAdmin && <Link href="/admin" onNavigate={() => setMobileOpen(false)} className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-emerald-400 dark:hover:bg-emerald-950/50"><LayoutDashboard className="size-4" aria-hidden="true" />{locale === "zh" ? "管理后台" : "Admin"}</Link>}
            {user && <NotificationLink locale={locale} count={unreadCount} onNavigate={() => setMobileOpen(false)} />}
            <button
              ref={menuButtonRef}
              type="button"
              className="min-[1440px]:hidden p-2 text-zinc-600 dark:text-zinc-400"
              aria-label={mobileOpen ? (locale === "zh" ? "关闭菜单" : "Close menu") : (locale === "zh" ? "打开菜单" : "Open menu")}
              aria-expanded={mobileOpen}
              aria-controls="mobile-navigation"
              onClick={() => setMobileOpen(open => !open)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div id="mobile-navigation" className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-zinc-200 bg-white min-[1440px]:hidden dark:border-zinc-800 dark:bg-zinc-950">
          <div className="px-4 py-3 space-y-1">
            <nav aria-label={locale === "zh" ? "手机导航" : "Mobile navigation"} className="space-y-1">
              {navLinks.map(({ href, key }) => <Link key={href} href={href} aria-current={isCurrent(href) ? "page" : undefined} onNavigate={() => setMobileOpen(false)} className={`w-full ${navClass(isCurrent(href))}`}>{navigation[key][locale]}</Link>)}
            </nav>
            <hr className="my-2 border-zinc-200 dark:border-zinc-800" />
            <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
              <div className="flex flex-wrap items-center gap-3">
                <ThemeToggle initialTheme={initialTheme} />
                <LanguageSwitcher locale={locale} />
              </div>
              <div className="flex items-center gap-3">
                <Link href="/cfp" onNavigate={() => setMobileOpen(false)} className="text-sm text-emerald-400 font-medium">
                  {navigation.cfp[locale]}
                </Link>
                {user ? (
                  <>
                    <Link href="/profile" onNavigate={() => setMobileOpen(false)} className="text-sm text-zinc-400">
                      {locale === "zh" ? "个人中心" : "Profile"}
                    </Link>
                  <form action="/auth/signout" method="post" onSubmit={handleLogout}>
                      <button type="submit" className="text-sm text-zinc-400">
                        {navigation.logout[locale]}
                      </button>
                    </form>
                  </>
                ) : (
                  <Link href="/auth/login" onNavigate={() => setMobileOpen(false)} className="text-sm text-zinc-400">
                    {navigation.login[locale]}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
