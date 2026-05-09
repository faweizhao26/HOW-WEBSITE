"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Locale } from "@/lib/i18n/utils"
import { navigation } from "@/lib/i18n/translations"
import { LanguageSwitcher } from "./language-switcher"
import { Button } from "@/components/ui/button"

const navLinks = [
  { href: "/", key: "home" },
  { href: "/about", key: "about" },
  { href: "/schedule", key: "schedule" },
  { href: "/sponsors", key: "sponsors" },
  { href: "/venue", key: "venue" },
  { href: "/updates", key: "updates" },
  { href: "/code-of-conduct", key: "codeOfConduct" },
  { href: "/register", key: "register" },
] as const

export function Header({ locale }: { locale: Locale }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const pathname = usePathname()

  useEffect(() => {
    try {
      const supabase = createClient()
      supabase.auth.getUser().then(({ data }) => setUser(data.user)).catch(() => {})
    } catch {}
  }, [])

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              HOW 2027
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(({ href, key }) => (
              <Link
                key={href}
                href={href}
                className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                  pathname === href
                    ? "text-white bg-zinc-800"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                }`}
              >
                {navigation[key][locale]}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <LanguageSwitcher locale={locale} />
            <Link href="/cfp">
              <Button variant="outline" size="sm" className="border-emerald-800 text-emerald-400 hover:bg-emerald-950/50 hover:text-emerald-300">
                {navigation.cfp[locale]}
              </Button>
            </Link>
            {user ? (
              <div className="flex items-center gap-1">
                <Link href="/profile">
                  <Button variant="ghost" size="sm" className="text-zinc-400">
                    {locale === "zh" ? "个人中心" : "Profile"}
                  </Button>
                </Link>
                <form action="/auth/signout" method="post">
                  <Button variant="ghost" size="sm" className="text-zinc-500">
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

          <button
            className="md:hidden p-2 text-zinc-400"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-zinc-800 bg-zinc-950">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map(({ href, key }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={`block px-3 py-2 rounded-lg text-sm ${
                  pathname === href ? "text-white bg-zinc-800" : "text-zinc-400"
                }`}
              >
                {navigation[key][locale]}
              </Link>
            ))}
            <hr className="border-zinc-800 my-2" />
            <div className="flex items-center justify-between px-3">
              <LanguageSwitcher locale={locale} />
              <div className="flex items-center gap-3">
                <Link href="/cfp" className="text-sm text-emerald-400 font-medium">
                  {navigation.cfp[locale]}
                </Link>
                {user ? (
                  <Link href="#" onClick={() => {}} className="text-sm text-zinc-400">
                    {navigation.logout[locale]}
                  </Link>
                ) : (
                  <Link href="/auth/login" className="text-sm text-zinc-400">
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
