"use client"

import { useId, useState, type MouseEvent } from "react"
import Link from "next/link"
import {
  LayoutDashboard, Mic, ContactRound, CalendarDays, Star, Newspaper, Settings,
  LogOut, ChevronLeft, ChevronDown, Users, Ticket, UserCheck, ShieldCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { admin as labels, type Locale } from "@/lib/i18n/translations"

const navItems = [
  { href: "/admin", icon: LayoutDashboard, key: "dashboard" },
  { href: "/admin/sessions", icon: Mic, key: "sessions" },
  { href: "/admin/speakers", icon: ContactRound, key: "speakers" },
  { href: "/admin/agenda", icon: CalendarDays, key: "agenda" },
  { href: "/admin/registrations", icon: Users, key: "registrations" },
  { href: "/admin/checkin", icon: UserCheck, key: "checkin" },
  { href: "/admin/accounts", icon: ShieldCheck, key: "accounts" },
  { href: "/admin/tickets", icon: Ticket, key: "tickets" },
  { href: "/admin/group-orders", icon: Users, key: "groupOrders" },
  { href: "/admin/sponsors", icon: Star, key: "sponsors" },
  { href: "/admin/updates", icon: Newspaper, key: "updates" },
  { href: "/admin/settings", icon: Settings, key: "settings" },
] as const

function closeMobileNavigation(event: MouseEvent<HTMLAnchorElement>) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  const details = event.currentTarget.closest("details")
  if (details) details.open = false
}

export function AdminNavigation({ pathname, locale, onLogout }: {
  pathname: string
  locale: Locale
  onLogout: () => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const mobileMenuId = useId()
  const active = navItems.find(item => pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href + "/"))) ?? navItems[0]
  const ActiveIcon = active.icon
  const navLabel = locale === "zh" ? "后台导航" : "Admin navigation"
  const logoutLabel = labels.logout[locale]
  const collapseLabel = collapsed ? (locale === "zh" ? "展开侧栏" : "Expand sidebar") : (locale === "zh" ? "收起侧栏" : "Collapse sidebar")

  function links(mobile: boolean) {
    return navItems.map(({ href, icon: Icon, key }) => <Link
      key={href}
      href={href}
      aria-current={active.href === href ? "page" : undefined}
      onClick={mobile ? closeMobileNavigation : undefined}
      title={!mobile && collapsed ? labels[key][locale] : undefined}
      className={`flex min-h-11 min-w-0 items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${active.href === href
        ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/50 dark:text-emerald-400"
        : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"}`}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className={!mobile && collapsed ? "sr-only" : "min-w-0 break-words"}>{labels[key][locale]}</span>
    </Link>)
  }

  return <aside className={`w-full ${collapsed ? "md:w-16" : "md:w-60"} shrink-0 border-b border-border bg-background transition-[width] duration-200 md:flex md:flex-col md:border-b-0 md:border-r`}>
    <div className="flex items-center justify-between p-4">
      <Link href="/" className={`${collapsed ? "md:hidden" : ""} min-w-0 text-sm font-semibold text-emerald-700 dark:text-emerald-400`}>
        {labels.how2027Admin[locale]}
      </Link>
      <Button variant="ghost" size="icon" onClick={() => setCollapsed(value => !value)} aria-label={collapseLabel} title={collapseLabel} className="hidden size-8 text-muted-foreground md:inline-flex">
        <ChevronLeft className={`size-4 transition-transform ${collapsed ? "rotate-180" : ""}`} aria-hidden="true" />
      </Button>
    </div>

    <details key={pathname} className="group mx-4 mb-3 rounded-lg border border-border md:hidden" onKeyDown={event => {
      if (event.key === "Escape" && event.currentTarget.open) {
        event.currentTarget.open = false
        event.currentTarget.querySelector("summary")?.focus()
        event.stopPropagation()
      }
    }}>
      <summary aria-label={`${navLabel}: ${labels[active.key][locale]}`} aria-controls={mobileMenuId} className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden">
        <ActiveIcon className="size-4 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
        <span className="min-w-0 flex-1 break-words">{labels[active.key][locale]}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div id={mobileMenuId} className="border-t border-border">
        <nav aria-label={navLabel} className="grid max-h-[min(55dvh,28rem)] grid-cols-1 gap-1 overflow-y-auto overscroll-contain p-2 min-[360px]:grid-cols-2">
          {links(true)}
        </nav>
        <div className="border-t border-border p-2">
          <button type="button" onClick={onLogout} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2">
            <LogOut className="size-4 shrink-0" aria-hidden="true" />{logoutLabel}
          </button>
        </div>
      </div>
    </details>

    <nav aria-label={navLabel} className="hidden flex-1 flex-col gap-1 px-2 pb-3 md:flex">{links(false)}</nav>
    <div className="hidden border-t border-border p-4 md:block">
      <button type="button" onClick={onLogout} aria-label={logoutLabel} title={collapsed ? logoutLabel : undefined} className={`flex min-h-11 w-full items-center gap-3 rounded-lg text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 ${collapsed ? "justify-center" : ""}`}>
        <LogOut className="size-4 shrink-0" aria-hidden="true" />
        {!collapsed && <span>{logoutLabel}</span>}
      </button>
    </div>
  </aside>
}
