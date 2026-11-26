"use client"

import { CFPPolicySummary } from "@/components/content/cfp-policy-summary"
import { useLocale } from "@/lib/i18n/provider"

import { startTransition, useState, useEffect, useRef } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { AccountRequestError, prepareAccountRequest } from "@/lib/auth/prepare-account-request"
import { watchAuthUser } from "@/lib/auth/watch-auth-user"
import { CFPError, loadCFPData, ownedProposalPhoto, parseProposalInput, uploadProposalPhoto } from "@/lib/cfp/service"
import type { CFPData, CFPErrorCode } from "@/lib/cfp/service"
import { cfpErrors } from "@/lib/cfp/messages"
import { cfpDurationOptions, getCFPState } from "@/lib/cfp/settings"
import type { CFPType } from "@/lib/cfp/settings"
import { submitCFP } from "./actions"
import { cfp, common } from "@/lib/i18n/translations"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { Plus, ChevronRight, RotateCw, AlertCircle } from "lucide-react"

const emptySpeaker = { full_name:"", company:"", position:"", bio:"" }
const selectClass = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm"

function statusBadge(status: string, locale: "en" | "zh") {
  switch (status) {
    case "pending":
      return <Badge variant="secondary">{cfp.pending[locale]}</Badge>
    case "approved":
      return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800">{cfp.approved[locale]}</Badge>
    case "waitlisted":
      return <Badge className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">{cfp.waitlisted[locale]}</Badge>
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
  const [hasAttempt, setHasAttempt] = useState(false)
  const [tab, setTab] = useState("new")
  const pending = useRef(false)
  const attempt = useRef<{ fingerprint: string; id: string; values: ReturnType<typeof parseProposalInput> } | null>(null)
  const draftOwner = useRef<string | null | undefined>(undefined)
  const identity = useRef<{ userId: string | null | undefined; version: number }>({ userId: undefined, version: 0 })
  const user = data?.user
  const sessions = data?.sessions || []
  const policy = data?.policy
  const policyState = policy ? getCFPState(policy) : "closed"

  const [title, setTitle] = useState("")
  const [abstract, setAbstract] = useState("")
  const [language, setLanguage] = useState(locale)
  const [outline, setOutline] = useState("")
  const [speaker, setSpeaker] = useState(emptySpeaker)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [photoError, setPhotoError] = useState(false)
  const [duration, setDuration] = useState("30")
  const [sessionType, setSessionType] = useState<CFPType>("talk")
  const selectedType = policy?.sessionTypes.includes(sessionType) ? sessionType : policy?.sessionTypes[0] ?? "talk"
  const durations = cfpDurationOptions[selectedType]
  const selectedDuration = durations.includes(Number(duration)) ? duration : String(durations[0])
  const profilePhoto = data?.speaker?.avatar_url
  const mayUseAvatar = profilePhoto && user && ownedProposalPhoto(profilePhoto,user.id)
  const zh = locale === "zh"

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
        if (result.user && draftOwner.current !== result.user.id) {
          const p = result.speaker
          setSpeaker({
            full_name: p?.full_name || String(result.user.user_metadata?.full_name || ""),
            company: p?.company || "", position: "",
            bio: locale === "zh" ? p?.bio_zh || "" : p?.bio || "",
          })
        }
        draftOwner.current = result.user?.id || null
        setData(result)
        setLoadError(false)
      } catch { if (active && version === identity.current.version) setLoadError(true) }
      finally { if (active && version === identity.current.version) setLoading(false) }
    }
    void load()
    return () => { active = false }
  }, [loadVersion,locale])

  useEffect(() => {
    const stop = watchAuthUser(createClient().auth, user => {
      const next = user?.id || null
      const previous = identity.current.userId !== undefined ? identity.current.userId : draftOwner.current
      identity.current.userId = next
      if (previous === undefined || previous === next) return
      identity.current.version++
      draftOwner.current = undefined
      attempt.current = null
      setHasAttempt(false)
      setData(null)
      setAccountChanged(true)
      setLoading(false)
      setSubmitError(null)
      pending.current = false
      setSubmitting(false)
      setTitle(""); setAbstract(""); setOutline(""); setSpeaker(emptySpeaker)
      setPhotoUrl(null); setPhotoError(false); setUploading(false); setLanguage(locale)
      setDuration("30"); setSessionType("talk")
    })
    return stop
  }, [locale])

  function retryLoad() {
    setLoading(true)
    setLoadError(false)
    setAccountChanged(false)
    setLoadVersion(version => version + 1)
  }

  async function uploadPhoto(file?: File) {
    if (!file || !user || uploading || submitting) return
    const version = identity.current.version, owner = user.id
    const stillOwns = () => draftOwner.current === owner && identity.current.version === version
    setUploading(true); setPhotoError(false)
    try {
      const photo = await uploadProposalPhoto(createClient(),owner,file)
      if (stillOwns()) setPhotoUrl(photo)
    } catch { if (stillOwns()) setPhotoError(true) }
    finally { if (stillOwns()) setUploading(false) }
  }

  function handleSubmit(e: React.SyntheticEvent, recover = false) {
    e.preventDefault()
    if (pending.current || uploading) return
    setSubmitError(null)
    if (!user) { setSubmitError("login_required"); return }
    const savedAttempt = recover ? attempt.current : null
    if (recover && !savedAttempt) return
    if (policyState !== "open" && !savedAttempt) { setSubmitError("cfp_closed"); return }
    const fields = { title, abstract, duration:Number(selectedDuration), type:selectedType,
      proposalDetails:{ language,...speaker,outline,photo_url:photoUrl } }
    const fingerprint = savedAttempt?.fingerprint ?? JSON.stringify(fields)
    const id = savedAttempt?.id ?? (attempt.current?.fingerprint === fingerprint ? attempt.current.id : crypto.randomUUID())
    let values
    try { values = savedAttempt?.values ?? parseProposalInput({ ...fields, requestId: id, expectedUserId: user.id }) }
    catch (error) { setSubmitError(error instanceof CFPError ? error.code : "invalid_input"); return }
    if (values.expectedUserId !== user.id) { setSubmitError("account_changed"); return }
    const preserveDraft = recover && fingerprint !== JSON.stringify(fields)
    attempt.current = { fingerprint, id, values }
    setHasAttempt(true)
    pending.current = true
    setSubmitting(true)
    const owner = user.id
    const version = identity.current.version
    startTransition(async () => {
      try {
        await prepareAccountRequest(createClient().auth, owner)
        if (draftOwner.current !== owner || identity.current.version !== version) return
        const result = await submitCFP(values)
        if (draftOwner.current !== owner || identity.current.version !== version) return
        if (!result.success) { setSubmitError(result.code); return }
        setData(previous => previous ? { ...previous, sessions: [result.data, ...previous.sessions.filter(session => session.id !== result.data.id)] } : previous)
        attempt.current = null
        setHasAttempt(false)
        toast.success(cfp.success[locale])
        if (!preserveDraft) {
          setTitle("")
          setAbstract("")
          setOutline("")
          setDuration("30")
          setSessionType("talk")
        }
        setTab("submissions")
      } catch (error) { if (draftOwner.current === owner && identity.current.version === version) setSubmitError(error instanceof AccountRequestError ? error.code : "operation_failed") }
      finally { if (identity.current.version === version) { pending.current = false; setSubmitting(false) } }
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
      {policy && <CFPPolicySummary policy={policy} locale={locale} />}

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
          {policyState !== "open" ? <div className="space-y-4 border-y py-8">
            <p role="status" className="text-muted-foreground">{locale === "zh" ? "当前不接受新提案，已提交提案仍可在“我的提案”查看。" : "New proposals are not being accepted. Existing proposals remain available in My Proposals."}</p>
            {submitError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{cfpErrors[submitError][locale]}</p>}
            <div className="flex flex-wrap gap-3">
              {hasAttempt && <Button type="button" variant="outline" disabled={submitting} onClick={event => handleSubmit(event, true)}><RotateCw />{locale === "zh" ? "确认上次提交结果" : "Check last submission"}</Button>}
              <Button type="button" variant="outline" onClick={retryLoad} disabled={submitting}><RotateCw />{locale === "zh" ? "更新征稿信息" : "Refresh CFP information"}</Button>
            </div>
          </div> :
          <Card>
            <CardHeader><CardTitle>{cfp.submitTitle[locale]}</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={event => handleSubmit(event)} className="space-y-5" aria-busy={submitting || uploading}>
                <fieldset disabled={submitting || uploading} className="space-y-5 min-w-0">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="cfp-language">{zh ? "投稿语言" : "Proposal language"}</Label>
                      <select id="cfp-language" className={selectClass} value={language} onChange={e => setLanguage(e.target.value as typeof language)}>
                        <option value="zh">中文</option><option value="en">English</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cfp-type">{cfp.typeLabel[locale]}</Label>
                      <select id="cfp-type" className={selectClass} value={selectedType} onChange={e => { setSessionType(e.target.value as CFPType); setDuration("30") }}>
                        {policy?.sessionTypes.map(type => <option key={type} value={type}>{cfp[type][locale]}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cfp-duration">{cfp.durationLabel[locale]}</Label>
                      {durations.length === 1 ? <Input id="cfp-duration" value={selectedDuration} readOnly /> :
                        <select id="cfp-duration" className={selectClass} value={selectedDuration} onChange={e => setDuration(e.target.value)}>
                          {durations.map(value => <option key={value} value={value}>{value}</option>)}
                        </select>}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="title">{cfp.titleLabel[locale]} *</Label>
                    <Input id="title" value={title} onChange={e => setTitle(e.target.value)} maxLength={200} required lang={language} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="abstract">{cfp.abstractLabel[locale]} *</Label>
                    <Textarea id="abstract" value={abstract} onChange={e => setAbstract(e.target.value)} rows={4} maxLength={10000} required lang={language} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cfp-outline">{zh ? "议题大纲" : "Proposal outline"} {selectedType === "lightning" ? (zh ? "（选填）" : "(optional)") : "*"}</Label>
                    <Textarea id="cfp-outline" value={outline} onChange={e => setOutline(e.target.value)} rows={4} maxLength={6000} required={selectedType !== "lightning"} lang={language} />
                  </div>
                  <div className="space-y-4 border-t pt-5">
                    <h2 className="font-semibold">{zh ? "讲者资料" : "Speaker details"}</h2>
                    <div className="grid gap-4 sm:grid-cols-3">
                      {([
                        ["full_name",zh ? "姓名" : "Name","name",128],
                        ["company",zh ? "单位" : "Organization","organization",200],
                        ["position",zh ? "职位" : "Job title","organization-title",200],
                      ] as const).map(([key,label,autoComplete,maxLength]) => <div key={key} className="space-y-2">
                        <Label htmlFor={`cfp-${key}`}>{label} *</Label>
                        <Input id={`cfp-${key}`} value={speaker[key]} autoComplete={autoComplete} maxLength={maxLength} required
                          onChange={e => setSpeaker(current => ({...current,[key]:e.target.value}))} />
                      </div>)}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cfp-bio">{zh ? "个人简介" : "Speaker bio"} *</Label>
                      <Textarea id="cfp-bio" value={speaker.bio} onChange={e => setSpeaker(current => ({...current,bio:e.target.value}))} rows={4} maxLength={4000} required lang={language} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cfp-photo">{zh ? "个人照片（选填）" : "Speaker photo (optional)"}</Label>
                      <Input id="cfp-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => {
                        const file = e.target.files?.[0]
                        e.target.value = ""
                        void uploadPhoto(file)
                      }} />
                      <div className="flex flex-wrap items-center gap-2">
                        {mayUseAvatar && <Button type="button" variant="outline" size="sm" onClick={() => { setPhotoUrl(profilePhoto); setPhotoError(false) }}>{zh ? "使用账号头像" : "Use profile photo"}</Button>}
                        {photoUrl && <><span role="status" className="text-sm">{zh ? "已添加照片" : "Photo attached"}</span><Button type="button" variant="ghost" size="sm" onClick={() => setPhotoUrl(null)}>{zh ? "移除照片" : "Remove photo"}</Button></>}
                      </div>
                      {uploading && <p role="status" className="text-sm">{zh ? "正在上传照片…" : "Uploading photo…"}</p>}
                      {photoError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{zh ? "照片上传失败，请使用不超过 5 MB 的 JPEG、PNG 或 WebP 图片重试。" : "Photo upload failed. Try a JPEG, PNG or WebP image up to 5 MB."}</p>}
                    </div>
                  </div>
                </fieldset>
                {submitError && <div role="alert" className="flex gap-2 text-sm text-red-700 dark:text-red-300"><AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /><p>{cfpErrors[submitError][locale]}</p></div>}
                {submitError && hasAttempt && <Button type="button" variant="outline" disabled={submitting} onClick={event => handleSubmit(event, true)}><RotateCw />{locale === "zh" ? "确认上次提交结果" : "Check last submission"}</Button>}
                {(submitError === "cfp_options_changed" || submitError === "cfp_closed" || submitError === "operation_failed") && <Button type="button" variant="outline" onClick={retryLoad} disabled={submitting}><RotateCw />{locale === "zh" ? "更新征稿信息" : "Refresh CFP information"}</Button>}
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 w-full" disabled={submitting || uploading}>
                  {submitting ? cfp.submitting[locale] : cfp.submit[locale]}
                </Button>
              </form>
            </CardContent>
          </Card>}
        </TabsContent>

        <TabsContent value="submissions">
          {sessions.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p>{cfp.noSubmissions[locale]}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.map((session) => (
                <Card key={session.id}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          {statusBadge(session.status, locale)}
                          <Badge variant="outline" className="text-zinc-400 border-zinc-700">
                            {session.duration} {zh ? "分钟" : "min"} · {cfp[session.type][locale]}
                            {session.proposal_details && (session.proposal_details.language === "zh" ? " · 中文" : " · English")}
                          </Badge>
                        </div>
                        <h3 className="break-words font-medium mb-1">{session.title}</h3>
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
