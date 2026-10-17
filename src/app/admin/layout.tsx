"use client"

import { useLocale } from "@/lib/i18n/provider"

import { isMockMode } from "@/lib/utils"
import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { common } from "@/lib/i18n/translations"
import { AdminNavigation } from "@/components/admin/navigation"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const locale = useLocale()
  const [loading, setLoading] = useState(() => !isMockMode())
  const [authorized, setAuthorized] = useState(() => isMockMode())
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

  if (pathname === "/admin/preview") return <>{children}</>

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col md:flex-row">
      <AdminNavigation pathname={pathname} locale={locale} onLogout={handleLogout} />

      <main className="min-w-0 flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  )
}
