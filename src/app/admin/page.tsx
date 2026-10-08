"use client"

import { useLocale } from "@/lib/i18n/provider"
import { isMockMode } from "@/lib/utils"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { admin as adminT } from "@/lib/i18n/translations"
import { Card, CardContent } from "@/components/ui/card"
import { Mic, CheckCircle, Clock, Users, ArrowRight } from "lucide-react"
import { AdminLoadError } from "@/components/admin/load-error"
import { loadDashboardStats, type DashboardStats } from "@/lib/admin/data"



export default function AdminDashboard() {
  const locale = useLocale()
  const [stats, setStats] = useState<DashboardStats | null>(isMockMode() ? {
    totalSessions: 14,
    pending: 10,
    approved: 3,
    rejected: 1,
    speakers: 8,
    agendaSlots: 48,
  } : null)
  const [loading, setLoading] = useState(!isMockMode())
  const [loadError, setLoadError] = useState(false)

  const loadStats = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      setStats(await loadDashboardStats(createClient()))
    } catch {
      setStats(null)
      setLoadError(true)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (isMockMode()) return
    let cancelled = false
    loadDashboardStats(createClient())
      .then(data => { if (!cancelled) setStats(data) })
      .catch(() => { if (!cancelled) { setStats(null); setLoadError(true) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const cards = [
    { title: adminT.totalProposals[locale], value: stats?.totalSessions, icon: Mic, color: "text-blue-400", href: "/admin/sessions" },
    { title: adminT.pendingReview[locale], value: stats?.pending, icon: Clock, color: "text-yellow-400", href: "/admin/sessions" },
    { title: adminT.approved[locale], value: stats?.approved, icon: CheckCircle, color: "text-emerald-400", href: "/admin/sessions" },
    { title: adminT.speakers[locale], value: stats?.speakers, icon: Users, color: "text-purple-400", href: "/admin/speakers" },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">{adminT.dashboard[locale]}</h1>
      <p className="text-sm text-muted-foreground mb-8">
        {isMockMode() ? adminT.demoMode[locale] : adminT.overview[locale]}
      </p>

      {loadError && <AdminLoadError onRetry={loadStats} />}
      {!loadError && <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => (
          <Link key={card.title} href={card.href}>
            <Card className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-400 mb-1">{card.title}</p>
                    <p className="text-3xl font-bold text-white">{loading ? "—" : card.value}</p>
                  </div>
                  <card.icon className={`h-8 w-8 ${card.color}`} />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>}

      {stats && !loading && <div className="flex flex-wrap gap-4">
        <Link href="/admin/sessions">
          <Card className="bg-zinc-900/50 border-zinc-800 hover:border-emerald-800/50 transition-colors cursor-pointer">
            <CardContent className="p-6 flex items-center gap-3">
              <Mic className="h-5 w-5 text-emerald-400" />
              <div>
                <p className="font-medium text-white">{adminT.reviewProposals[locale]}</p>
                <p className="text-sm text-zinc-400">
                  {adminT.pendingReady[locale].replace("{pending}", String(stats.pending)).replace("{approved}", String(stats.approved))}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground ml-2" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/agenda">
          <Card className="bg-zinc-900/50 border-zinc-800 hover:border-emerald-800/50 transition-colors cursor-pointer">
            <CardContent className="p-6 flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-cyan-400" />
              <div>
                <p className="font-medium text-white">{adminT.manageAgenda[locale]}</p>
                <p className="text-sm text-zinc-400">
                  {adminT.slotsReady[locale].replace("{slots}", String(stats.agendaSlots)).replace("{approved}", String(stats.approved))}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground ml-2" />
            </CardContent>
          </Card>
        </Link>
      </div>}
    </div>
  )
}
