"use client"
import { isMockMode } from "@/lib/utils"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { admin as adminT, common } from "@/lib/i18n/translations"
import { Card, CardContent } from "@/components/ui/card"
import { Mic, CheckCircle, Clock, Users, ArrowRight } from "lucide-react"

function getLocaleFromCookie(): "en" | "zh" {
  if (typeof document === "undefined") return "en"
  const match = document.cookie.match(/(?:^|;\s*)lang=([^;]*)/)
  return match?.[1] === "zh" ? "zh" : "en"
}


export default function AdminDashboard() {
  const [locale] = useState<"en" | "zh">(getLocaleFromCookie())
  const [stats, setStats] = useState({
    totalSessions: 14,
    pending: 10,
    approved: 3,
    rejected: 1,
    speakers: 8,
    agendaSlots: 48,
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isMockMode()) { setLoading(false); return }
    loadStats()
  }, [])

  async function loadStats() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: sessions } = await supabase.from("sessions").select("status, user_id")
      const { count: slotCount } = await supabase.from("agenda_slots").select("*", { count: "exact", head: true })
      if (sessions) {
        const uniqueSpeakers = new Set(sessions.map((s) => s.user_id))
        setStats({
          totalSessions: sessions.length,
          pending: sessions.filter((s) => s.status === "pending").length,
          approved: sessions.filter((s) => s.status === "approved").length,
          rejected: sessions.filter((s) => s.status === "rejected").length,
          speakers: uniqueSpeakers.size,
          agendaSlots: slotCount || 0,
        })
      }
    } catch {}
    setLoading(false)
  }

  const cards = [
    { title: adminT.totalProposals[locale], value: stats.totalSessions, icon: Mic, color: "text-blue-400", href: "/admin/sessions" },
    { title: adminT.pendingReview[locale], value: stats.pending, icon: Clock, color: "text-yellow-400", href: "/admin/sessions" },
    { title: adminT.approved[locale], value: stats.approved, icon: CheckCircle, color: "text-emerald-400", href: "/admin/sessions" },
    { title: adminT.speakers[locale], value: stats.speakers, icon: Users, color: "text-purple-400", href: "/admin/sessions" },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">{adminT.dashboard[locale]}</h1>
      <p className="text-sm text-zinc-500 mb-8">
        {isMockMode() ? adminT.demoMode[locale] : adminT.overview[locale]}
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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
      </div>

      <div className="flex flex-wrap gap-4">
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
              <ArrowRight className="h-4 w-4 text-zinc-500 ml-2" />
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
              <ArrowRight className="h-4 w-4 text-zinc-500 ml-2" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
