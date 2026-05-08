"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { cfp, common } from "@/lib/i18n/translations"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { Plus, ChevronRight } from "lucide-react"

type Session = {
  id: string
  title: string
  title_zh: string | null
  abstract: string
  duration: number
  type: "talk" | "workshop" | "panel"
  status: "pending" | "approved" | "rejected"
  admin_feedback: string | null
  created_at: string
}

function getLocaleFromCookie(): "en" | "zh" {
  if (typeof document === "undefined") return "en"
  const match = document.cookie.match(/(?:^|;\s*)lang=([^;]*)/)
  return match?.[1] === "zh" ? "zh" : "en"
}

function statusBadge(status: string, locale: "en" | "zh") {
  switch (status) {
    case "pending":
      return <Badge variant="secondary">{cfp.pending[locale]}</Badge>
    case "approved":
      return <Badge className="bg-emerald-900/50 text-emerald-300 border-emerald-800">{cfp.approved[locale]}</Badge>
    case "rejected":
      return <Badge variant="destructive">{cfp.rejected[locale]}</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

export default function CFPPage() {
  const [locale, setLocale] = useState<"en" | "zh">("en")
  const [user, setUser] = useState<any>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [tab, setTab] = useState("new")

  const [title, setTitle] = useState("")
  const [titleZh, setTitleZh] = useState("")
  const [abstract, setAbstract] = useState("")
  const [abstractZh, setAbstractZh] = useState("")
  const [duration, setDuration] = useState("30")
  const [sessionType, setSessionType] = useState("talk")

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    setLocale(getLocaleFromCookie())
    loadData()
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
    if (user) {
      const { data } = await supabase
        .from("sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
      setSessions(data || [])
    }
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSubmitting(true)

    const { error } = await supabase.from("sessions").insert({
      user_id: user.id,
      title,
      title_zh: titleZh || null,
      abstract,
      abstract_zh: abstractZh || null,
      duration: parseInt(duration),
      type: sessionType,
    })

    setSubmitting(false)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success(cfp.success[locale])
      setTitle("")
      setTitleZh("")
      setAbstract("")
      setAbstractZh("")
      setDuration("30")
      setSessionType("talk")
      setTab("submissions")
      loadData()
    }
  }

  if (loading) {
    return <div className="max-w-3xl mx-auto px-4 py-16 text-center text-zinc-500">{common.loading[locale]}</div>
  }

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-zinc-400 mb-4">{cfp.loginRequired[locale]}</p>
        <Link href="/auth/login?redirect=/cfp">
          <Button className="bg-emerald-600 hover:bg-emerald-500">
            {locale === "en" ? "Login" : "登录"} <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-4xl font-bold mb-8">{cfp.title[locale]}</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-zinc-900 border border-zinc-800 mb-8">
          <TabsTrigger value="new">
            <Plus className="h-4 w-4 mr-1" />
            {cfp.submitTitle[locale]}
          </TabsTrigger>
          <TabsTrigger value="submissions">
            {locale === "zh" ? "我的提案" : "My Proposals"}
            {sessions.length > 0 && (
              <span className="ml-2 text-xs bg-zinc-800 px-2 py-0.5 rounded-full">{sessions.length}</span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="new">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle>{cfp.submitTitle[locale]}</CardTitle>
              <CardDescription>
                {locale === "zh"
                  ? "请用英文和中文（如适用）填写演讲信息。提交后我们的审核团队将评估您的提案。"
                  : "Please fill in your session info in English and Chinese (where applicable). Our review team will evaluate your proposal."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="title">{cfp.titleLabel[locale]} *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Building Modern APIs with PostgreSQL"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="titleZh">{cfp.titleZhLabel[locale]}</Label>
                  <Input
                    id="titleZh"
                    value={titleZh}
                    onChange={(e) => setTitleZh(e.target.value)}
                    placeholder="例如：PostgreSQL 构建现代 API"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="abstract">{cfp.abstractLabel[locale]} *</Label>
                  <Textarea
                    id="abstract"
                    value={abstract}
                    onChange={(e) => setAbstract(e.target.value)}
                    placeholder="Describe your session..."
                    rows={4}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="abstractZh">{cfp.abstractZhLabel[locale]}</Label>
                  <Textarea
                    id="abstractZh"
                    value={abstractZh}
                    onChange={(e) => setAbstractZh(e.target.value)}
                    placeholder="用中文描述您的演讲..."
                    rows={4}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{cfp.durationLabel[locale]} *</Label>
                    <Select value={duration} onValueChange={(v) => setDuration(v || "30")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 min</SelectItem>
                        <SelectItem value="30">30 min</SelectItem>
                        <SelectItem value="45">45 min</SelectItem>
                        <SelectItem value="60">60 min</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{cfp.typeLabel[locale]} *</Label>
                    <Select value={sessionType} onValueChange={(v) => setSessionType(v || "talk")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="talk">{cfp.talk[locale]}</SelectItem>
                        <SelectItem value="workshop">{cfp.workshop[locale]}</SelectItem>
                        <SelectItem value="panel">{cfp.panel[locale]}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 w-full" disabled={submitting}>
                  {submitting ? cfp.submitting[locale] : cfp.submit[locale]}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="submissions">
          {sessions.length === 0 ? (
            <div className="text-center py-16 text-zinc-500">
              <p>{cfp.noSubmissions[locale]}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.map((session) => (
                <Card key={session.id} className="bg-zinc-900/50 border-zinc-800">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          {statusBadge(session.status, locale)}
                          <Badge variant="outline" className="text-zinc-400 border-zinc-700">
                            {session.duration} min · {session.type}
                          </Badge>
                        </div>
                        <h3 className="font-medium text-white mb-1">{session.title}</h3>
                        {session.title_zh && (
                          <p className="text-sm text-zinc-500 mb-2">{session.title_zh}</p>
                        )}
                        <p className="text-sm text-zinc-400 line-clamp-2">{session.abstract}</p>
                        {session.admin_feedback && (
                          <div className="mt-3 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
                            <p className="text-xs text-zinc-500 mb-1">{cfp.pending[locale] === "Pending Review" ? "Admin Feedback" : "管理员反馈"}:</p>
                            <p className="text-sm text-zinc-300">{session.admin_feedback}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
