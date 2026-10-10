"use client"

import { useLocale } from "@/lib/i18n/provider"

import { startTransition, useState, useEffect, useRef } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { CFPError, loadCFPData, parseProposalInput } from "@/lib/cfp/service"
import type { CFPData, CFPErrorCode } from "@/lib/cfp/service"
import { cfpErrors } from "@/lib/cfp/messages"
import { submitCFP } from "./actions"
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
import { Plus, ChevronRight, RotateCw, AlertCircle } from "lucide-react"

function statusBadge(status: string, locale: "en" | "zh") {
  switch (status) {
    case "pending":
      return <Badge variant="secondary">{cfp.pending[locale]}</Badge>
    case "approved":
      return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800">{cfp.approved[locale]}</Badge>
    case "rejected":
      return <Badge variant="destructive">{cfp.rejected[locale]}</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

export default function CFPPage() {
  const locale = useLocale()
  const [data, setData] = useState<CFPData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [accountChanged, setAccountChanged] = useState(false)
  const [loadVersion, setLoadVersion] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<CFPErrorCode | null>(null)
  const [tab, setTab] = useState("new")
  const pending = useRef(false)
  const attempt = useRef<{ fingerprint: string; id: string } | null>(null)
  const draftOwner = useRef<string | null | undefined>(undefined)
  const identity = useRef<{ userId: string | null | undefined; version: number }>({ userId: undefined, version: 0 })
  const user = data?.user
  const sessions = data?.sessions || []

  const [title, setTitle] = useState("")
  const [titleZh, setTitleZh] = useState("")
  const [abstract, setAbstract] = useState("")
  const [abstractZh, setAbstractZh] = useState("")
  const [duration, setDuration] = useState("30")
  const [sessionType, setSessionType] = useState("talk")

  useEffect(() => {
    let active = true
    const version = identity.current.version
    async function load() {
      try {
        const result = await loadCFPData(createClient())
        if (!active || version !== identity.current.version) return
        if (identity.current.userId !== undefined && identity.current.userId !== (result.user?.id || null)) {
          setAccountChanged(true)
          return
        }
        draftOwner.current = result.user?.id || null
        setData(result)
        setLoadError(false)
      } catch { if (active && version === identity.current.version) setLoadError(true) }
      finally { if (active && version === identity.current.version) setLoading(false) }
    }
    void load()
    return () => { active = false }
  }, [loadVersion])

  useEffect(() => {
    const { data: { subscription } } = createClient().auth.onAuthStateChange((_event, session) => {
      const next = session?.user.id || null
      const previous = identity.current.userId !== undefined ? identity.current.userId : draftOwner.current
      identity.current.userId = next
      if (previous === undefined || previous === next) return
      identity.current.version++
      draftOwner.current = undefined
      attempt.current = null
      setData(null)
      setAccountChanged(true)
      setLoading(false)
      setSubmitError(null)
      setTitle(""); setTitleZh(""); setAbstract(""); setAbstractZh("")
      setDuration("30"); setSessionType("talk")
    })
    return () => subscription.unsubscribe()
  }, [])

  function retryLoad() {
    setLoading(true)
    setLoadError(false)
    setAccountChanged(false)
    setLoadVersion(version => version + 1)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pending.current) return
    setSubmitError(null)
    if (!user) { setSubmitError("login_required"); return }
    const fields = { title, titleZh, abstract, abstractZh, duration: Number(duration), type: sessionType }
    const fingerprint = JSON.stringify(fields)
    const id = attempt.current?.fingerprint === fingerprint ? attempt.current.id : crypto.randomUUID()
    let values
    try { values = parseProposalInput({ ...fields, requestId: id, expectedUserId: user.id }) }
    catch (error) { setSubmitError(error instanceof CFPError ? error.code : "invalid_input"); return }
    attempt.current = { fingerprint, id }
    pending.current = true
    setSubmitting(true)
    const owner = user.id
    const version = identity.current.version
    startTransition(async () => {
      try {
        const result = await submitCFP(values)
        if (draftOwner.current !== owner || identity.current.version !== version) return
        if (!result.success) { setSubmitError(result.code); return }
        setData(previous => previous ? { ...previous, sessions: [result.data, ...previous.sessions.filter(session => session.id !== result.data.id)] } : previous)
        attempt.current = null
        toast.success(cfp.success[locale])
        setTitle("")
        setTitleZh("")
        setAbstract("")
        setAbstractZh("")
        setDuration("30")
        setSessionType("talk")
        setTab("submissions")
      } catch { if (draftOwner.current === owner && identity.current.version === version) setSubmitError("operation_failed") }
      finally { pending.current = false; setSubmitting(false) }
    })
  }

  if (loading) {
    return <div className="max-w-3xl mx-auto px-4 py-16 text-center text-muted-foreground">{common.loading[locale]}</div>
  }

  if (loadError || accountChanged) return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
      <h1 className="text-3xl font-bold">{cfp.title[locale]}</h1>
      <p role="alert" className="text-muted-foreground">{cfpErrors[accountChanged ? "account_changed" : "load_failed"][locale]}</p>
      <Button onClick={retryLoad} variant="outline"><RotateCw className="h-4 w-4" />{locale === "zh" ? "重试" : "Retry"}</Button>
    </div>
  )

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-bold mb-6">{cfp.title[locale]}</h1>
        <p className="text-muted-foreground mb-4">{cfp.loginRequired[locale]}</p>
          <Button render={<Link href="/auth/login?redirect=/cfp" />} nativeButton={false} className="bg-emerald-600 hover:bg-emerald-500">
            {locale === "en" ? "Login" : "登录"} <ChevronRight className="h-4 w-4" />
          </Button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-4xl font-bold mb-8">{cfp.title[locale]}</h1>

      <Tabs value={tab} onValueChange={value => { if (!pending.current) setTab(value) }}>
        <TabsList className="bg-zinc-900 border border-zinc-800 mb-8">
          <TabsTrigger value="new" disabled={submitting}>
            <Plus className="h-4 w-4 mr-1" />
            {cfp.submitTitle[locale]}
          </TabsTrigger>
          <TabsTrigger value="submissions" disabled={submitting}>
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
              <form onSubmit={handleSubmit} className="space-y-5" aria-busy={submitting}>
                <fieldset disabled={submitting} className="space-y-5 min-w-0">
                <div className="space-y-2">
                  <Label htmlFor="title">{cfp.titleLabel[locale]} *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Building Modern APIs with PostgreSQL"
                    maxLength={200}
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
                    maxLength={200}
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
                    maxLength={10000}
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
                    maxLength={10000}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cfp-duration">{cfp.durationLabel[locale]} *</Label>
                    <Select value={duration} disabled={submitting} onValueChange={(v) => setDuration(v || "30")}>
                      <SelectTrigger id="cfp-duration">
                        <SelectValue>{duration} {locale === "zh" ? "分钟" : "min"}</SelectValue>
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
                    <Label htmlFor="cfp-type">{cfp.typeLabel[locale]} *</Label>
                    <Select value={sessionType} disabled={submitting} onValueChange={(v) => setSessionType(v || "talk")}>
                      <SelectTrigger id="cfp-type">
                        <SelectValue>{sessionType === "workshop" ? cfp.workshop[locale] : sessionType === "panel" ? cfp.panel[locale] : cfp.talk[locale]}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="talk">{cfp.talk[locale]}</SelectItem>
                        <SelectItem value="workshop">{cfp.workshop[locale]}</SelectItem>
                        <SelectItem value="panel">{cfp.panel[locale]}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                </fieldset>
                {submitError && <div role="alert" className="flex gap-2 text-sm text-red-700 dark:text-red-300"><AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /><p>{cfpErrors[submitError][locale]}</p></div>}
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 w-full" disabled={submitting}>
                  {submitting ? cfp.submitting[locale] : cfp.submit[locale]}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="submissions">
          {sessions.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
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
                          <p className="text-sm text-muted-foreground mb-2">{session.title_zh}</p>
                        )}
                        <p className="text-sm text-zinc-400 line-clamp-2">{session.abstract}</p>
                        {session.admin_feedback && (
                          <div className="mt-3 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
                            <p className="text-xs text-muted-foreground mb-1">{cfp.pending[locale] === "Pending Review" ? "Admin Feedback" : "管理员反馈"}:</p>
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
