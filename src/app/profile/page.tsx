"use client"

import { useLocale } from "@/lib/i18n/provider"

import { useCallback, useEffect, useState, useRef } from "react"
import type { User as AuthUser } from "@supabase/supabase-js"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { navigation, cfp as cfpT, common } from "@/lib/i18n/translations"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { toast } from "sonner"
import {
  Mail, Phone, Building, Edit3, Camera, Mic, Calendar, LogOut,
  ChevronRight, Copy, Check, Shield, Key, XCircle, RotateCcw, RefreshCw,
} from "lucide-react"
import type { Profile } from "@/lib/db/schema"
import type { RegistrationRecord } from "@/lib/admin/data"
import { loadProfileData, saveProfile, updateOwnRegistration, uploadProfileAvatar, type ProfileSession } from "@/lib/profile/data"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"

function statusBadge(status: string, locale: "en" | "zh") {
  switch (status) {
    case "pending": return <Badge variant="secondary">{cfpT.pending[locale]}</Badge>
    case "approved": return <Badge className="bg-emerald-900/50 text-emerald-300 border-emerald-800">{cfpT.approved[locale]}</Badge>
    case "rejected": return <Badge variant="destructive">{cfpT.rejected[locale]}</Badge>
    default: return <Badge variant="outline">{status}</Badge>
  }
}

export default function ProfilePage() {
  const locale = useLocale()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [sessions, setSessions] = useState<ProfileSession[]>([])
  const [registrations, setRegistrations] = useState<RegistrationRecord[]>([])
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [registrationError, setRegistrationError] = useState(false)
  const [confirmRegistration, setConfirmRegistration] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mutationInFlight = useRef(false)
  const loadRequest = useRef(0)
  const busy = saving || uploading || updating

  const [fullName, setFullName] = useState("")
  const [company, setCompany] = useState("")
  const [bio, setBio] = useState("")
  const [bioZh, setBioZh] = useState("")
  const [phone, setPhone] = useState("")
  const [wechat, setWechat] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")

  const loadData = useCallback(async () => {
    const request = ++loadRequest.current
    try {
      const supabase = createClient()
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error && error.name !== "AuthSessionMissingError") throw error
      if (!user) { router.replace("/auth/login?redirect=/profile"); return }
      const data = await loadProfileData(supabase, user.id)
      if (request !== loadRequest.current) return
      setUser(user)
      setProfile(data.profile)
      setFullName(data.profile.full_name || "")
      setCompany(data.profile.company || "")
      setBio(data.profile.bio || "")
      setBioZh(data.profile.bio_zh || "")
      setPhone(data.profile.phone || "")
      setWechat(data.profile.wechat || "")
      setAvatarUrl(data.profile.avatar_url || "")
      setSessions(data.sessions)
      setRegistrations(data.registrations)
      setLoadError(false)
    } catch { if (request === loadRequest.current) setLoadError(true) }
    finally { if (request === loadRequest.current) setLoading(false) }
  }, [router])

  useEffect(() => {
    const request = loadRequest
    const timer = setTimeout(() => { void loadData() }, 0)
    return () => { clearTimeout(timer); request.current++ }
  }, [loadData])

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !user || mutationInFlight.current) return
    mutationInFlight.current = true
    setUploading(true)
    try {
      const saved = await uploadProfileAvatar(createClient(), user.id, file)
      setAvatarUrl(saved.avatar_url || "")
      setProfile(saved)
      toast.success(locale === "zh" ? "头像已更新" : "Avatar updated")
    } catch { toast.error(locale === "zh" ? "头像更新失败，请重试。" : "Unable to update avatar. Please try again.") }
    finally { mutationInFlight.current = false; setUploading(false) }
  }

  async function handleSave() {
    if (!user || mutationInFlight.current) return
    mutationInFlight.current = true
    setSaving(true)
    setSaveError(false)
    try {
      const saved = await saveProfile(createClient(), user.id, {
      full_name: fullName,
      company: company || null,
      bio: bio || null,
      bio_zh: bioZh || null,
      phone: phone || null,
      wechat: wechat || null,
      })
      setProfile(saved)
      toast.success(locale === "zh" ? "资料已保存" : "Profile saved")
      setEditing(false)
    } catch { setSaveError(true) }
    finally { mutationInFlight.current = false; setSaving(false) }
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  async function cancelRegistration(regId: string, currentStatus: string) {
    if (!user || mutationInFlight.current) return
    mutationInFlight.current = true
    setUpdating(true)
    setRegistrationError(false)
    const newStatus = currentStatus === "cancelled" ? "confirmed" : "cancelled"
    try {
      const saved = await updateOwnRegistration(createClient(), user.id, regId, newStatus)
      setRegistrations(prev => prev.map(r => r.id === saved.id ? { ...r, status: saved.status } : r))
      setConfirmRegistration(null)
      toast.success(saved.status === "cancelled" ? (locale === "zh" ? "已取消报名" : "Registration cancelled") : (locale === "zh" ? "已恢复报名" : "Registration restored"))
    } catch { setRegistrationError(true) }
    finally { mutationInFlight.current = false; setUpdating(false) }
  }

  async function copyId() {
    if (!user) return
    try {
      await navigator.clipboard.writeText(user.id)
      setCopied(true)
      toast.success(locale === "zh" ? "已复制 ID" : "ID copied")
      setTimeout(() => setCopied(false), 2000)
    } catch { toast.error(locale === "zh" ? "复制失败，请重试。" : "Unable to copy. Please try again.") }
  }

  if (loading) {
    return <div className="max-w-4xl mx-auto px-4 py-16 text-center text-muted-foreground">{common.loading[locale]}</div>
  }

  if (loadError) return <div className="max-w-4xl mx-auto px-4 py-16">
    <h1 className="text-2xl font-bold mb-8">{locale === "zh" ? "个人中心" : "Profile"}</h1>
    <div role="alert" className="flex flex-wrap items-center gap-3 border-y py-6">
      <p className="text-sm text-muted-foreground">{locale === "zh" ? "资料加载失败，请重试。" : "Unable to load your profile. Please try again."}</p>
      <Button variant="outline" size="sm" onClick={() => { setLoading(true); void loadData() }}><RefreshCw className="size-4" />{locale === "zh" ? "重试" : "Retry"}</Button>
    </div>
  </div>

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-zinc-400 mb-4">{locale === "zh" ? "请先登录" : "Please login first"}</p>
        <Link href="/auth/login?redirect=/profile">
          <Button className="bg-emerald-600 hover:bg-emerald-500">{locale === "zh" ? "登录" : "Login"}</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">{locale === "zh" ? "个人中心" : "Profile"}</h1>
        <div className="flex items-center gap-3">
          {!editing && (
            <Button variant="outline" size="sm" disabled={busy} onClick={() => { setSaveError(false); setEditing(true) }} className="border-zinc-700">
              <Edit3 className="h-4 w-4 mr-1" /> {locale === "zh" ? "编辑资料" : "Edit"}
            </Button>
          )}
          <Button variant="ghost" size="sm" disabled={busy} onClick={handleLogout} className="text-zinc-400">
            <LogOut className="h-4 w-4 mr-1" /> {navigation.logout[locale]}
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left: Profile card */}
        <div className="lg:col-span-1 space-y-6">
          {/* Avatar card */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="pt-6 pb-6 flex flex-col items-center">
              <button type="button" disabled={busy} aria-label={locale === "zh" ? "更新头像" : "Update avatar"} className="relative group cursor-pointer disabled:cursor-wait mb-4 rounded-full" onClick={() => fileInputRef.current?.click()}>
                <Avatar className="w-24 h-24 ring-2 ring-emerald-500/30 overflow-hidden">
                  <AvatarImage src={avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName || user.email || "")}&background=10b981&color=fff&size=128`} alt="" />
                  <AvatarFallback>{(fullName || user.email || "?").slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="h-6 w-6 text-white" />
                </div>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" disabled={busy} className="hidden" onChange={handleAvatarUpload} />
              {uploading && <p role="status" className="mb-2 text-sm text-muted-foreground">{locale === "zh" ? "上传中..." : "Uploading..."}</p>}
              <h2 className="text-lg font-semibold text-white text-center break-all">{fullName || user.email}</h2>
              {profile?.role === "admin" && (
                <Badge className="mt-2 bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800">
                  <Shield className="h-3 w-3 mr-1" /> {locale === "zh" ? "管理员" : "Admin"}
                </Badge>
              )}
            </CardContent>
          </Card>

          {/* Basic info */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-zinc-400">{locale === "zh" ? "邮箱" : "Email"}:</span>
                <span className="text-zinc-300 ml-auto truncate">{user.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Key className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-zinc-400">ID:</span>
                <span className="text-muted-foreground text-xs font-mono ml-auto truncate">{user.id.slice(0, 16)}...</span>
                <button onClick={copyId} className="text-muted-foreground hover:text-zinc-300 ml-1">
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
              {phone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-zinc-400">{locale === "zh" ? "手机" : "Phone"}:</span>
                  <span className="text-zinc-300 ml-auto">{phone}</span>
                </div>
              )}
              {company && (
                <div className="flex items-center gap-3 text-sm">
                  <Building className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-zinc-400">{locale === "zh" ? "公司" : "Company"}:</span>
                  <span className="text-zinc-300 ml-auto">{company}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bio */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader><CardTitle className="text-sm text-zinc-400">{locale === "zh" ? "个人简介" : "Bio"}</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-300">{bio || (locale === "zh" ? "暂无简介" : "No bio yet")}</p>
              {bioZh && <p className="text-sm text-zinc-400 mt-2">{bioZh}</p>}
            </CardContent>
          </Card>
        </div>

        {/* Right: Content area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Edit form */}
          {editing && (
            <Card className="bg-zinc-900/50 border-zinc-800 border-emerald-800/50">
              <CardHeader><CardTitle>{locale === "zh" ? "编辑个人资料" : "Edit Profile"}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <fieldset disabled={busy} className="space-y-4">
                <div className="space-y-2"><Label>{locale === "zh" ? "昵称" : "Display Name"}</Label><Input value={fullName} onChange={e => setFullName(e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>{locale === "zh" ? "手机号" : "Phone"}</Label><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+86 138..." /></div>
                  <div className="space-y-2"><Label>{locale === "zh" ? "微信" : "WeChat"}</Label><Input value={wechat} onChange={e => setWechat(e.target.value)} /></div>
                </div>
                <div className="space-y-2"><Label>{locale === "zh" ? "公司" : "Company"}</Label><Input value={company} onChange={e => setCompany(e.target.value)} /></div>
                <div className="space-y-2"><Label>{locale === "zh" ? "个人简介 (EN)" : "Bio (EN)"}</Label><Textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} /></div>
                <div className="space-y-2"><Label>{locale === "zh" ? "个人简介 (中文)" : "Bio (中文)"}</Label><Textarea value={bioZh} onChange={e => setBioZh(e.target.value)} rows={3} /></div>
                </fieldset>
                {saveError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{locale === "zh" ? "资料保存失败，填写内容已保留，请重试。" : "Unable to save your profile. Your input has been kept; please try again."}</p>}
                <div className="flex gap-3">
                  <Button onClick={handleSave} disabled={busy} className="bg-emerald-600 hover:bg-emerald-500">{saving ? common.loading[locale] : locale === "zh" ? "保存" : "Save"}</Button>
                  <Button disabled={busy} variant="ghost" onClick={() => setEditing(false)}>{common.cancel[locale]}</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Activity tabs */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader><CardTitle>{locale === "zh" ? "我的活动" : "My Activity"}</CardTitle></CardHeader>
            <CardContent>
              <Tabs defaultValue="sessions">
                <TabsList className="bg-zinc-800 border border-zinc-700 mb-4">
                  <TabsTrigger value="sessions">
                    <Mic className="h-4 w-4 mr-1" />
                    {locale === "zh" ? "我的议题" : "My Sessions"}
                    <span className="ml-2 text-xs text-zinc-200 bg-zinc-700 px-2 py-0.5 rounded-full">{sessions.length}</span>
                  </TabsTrigger>
                  <TabsTrigger value="registration">
                    <Calendar className="h-4 w-4 mr-1" />
                    {locale === "zh" ? "大会报名" : "Registration"}
                    <span className="ml-2 text-xs text-zinc-200 bg-zinc-700 px-2 py-0.5 rounded-full">{registrations.length}</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="sessions">
                  {sessions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Mic className="h-8 w-8 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">{locale === "zh" ? "还没有提交任何议题" : "No sessions submitted yet"}</p>
                      <Link href="/cfp">
                        <Button size="sm" variant="outline" className="mt-3 border-emerald-800 text-emerald-400">
                          <ChevronRight className="h-4 w-4 mr-1" />{locale === "zh" ? "去提交" : "Submit one"}
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {sessions.map(s => (
                        <div key={s.id} className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/30">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                {statusBadge(s.status, locale)}
                                <span className="text-xs text-muted-foreground">{s.duration}min · {s.type}</span>
                              </div>
                              <h4 className="text-sm font-medium text-white">{s.title}</h4>
                              {s.admin_feedback && (
                                <p className="text-xs text-muted-foreground mt-2 italic">&quot;{s.admin_feedback}&quot;</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="registration">
                  {registrations.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Calendar className="h-8 w-8 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">{locale === "zh" ? "还没有报名记录" : "No registration records"}</p>
                      <Link href="/register">
                        <Button size="sm" variant="outline" className="mt-3 border-emerald-800 text-emerald-400">
                          {locale === "zh" ? "去报名" : "Register Now"} <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {registrations.map(reg => (
                        <div key={reg.id} className={`p-3 rounded-lg border ${reg.status === "cancelled" ? "border-red-200 bg-red-50 dark:border-red-900/30 dark:bg-red-950/10" : "border-emerald-200 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-950/10"}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <Badge className={`max-w-full whitespace-normal break-all ${reg.status === "cancelled" ? "bg-red-100 text-red-900 border-red-200 dark:bg-red-900/50 dark:text-red-200 dark:border-red-800" : "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-200 dark:border-emerald-800"}`}>
                                  {locale === "zh" && reg.ticket_types?.name_zh ? reg.ticket_types.name_zh : reg.ticket_types?.name || (locale === "zh" ? "报名" : "Registered")}
                                </Badge>
                                {reg.status === "cancelled" && <Badge variant="outline" className="text-[10px] bg-red-100 text-red-900 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-800">{locale === "zh" ? "已取消" : "Cancelled"}</Badge>}
                                {reg.checked_in && <Badge variant="outline" className="text-[10px] text-cyan-900 border-cyan-700 dark:text-cyan-300 dark:border-cyan-800">{locale === "zh" ? "已签到" : "Checked in"}</Badge>}
                              </div>
                              <div className="text-xs text-zinc-700 dark:text-zinc-400 space-y-0.5 break-all">
                                <p>{reg.email}</p>
                                {reg.phone && <p>{reg.phone}</p>}
                                {reg.company && <p>{reg.company}{reg.position && ` · ${reg.position}`}</p>}
                              </div>
                              <p className="text-xs text-zinc-700 dark:text-zinc-400 mt-1">
                                {new Date(reg.created_at).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", { year: "numeric", month: "long", day: "numeric" })}
                              </p>
                            </div>
                            <AlertDialog open={confirmRegistration === reg.id} onOpenChange={open => { if (!mutationInFlight.current) { setConfirmRegistration(open ? reg.id : null); setRegistrationError(false) } }}>
                              <AlertDialogTrigger disabled={busy} render={<Button variant="ghost" size="icon" title={reg.status === "cancelled" ? (locale === "zh" ? "恢复报名" : "Restore registration") : (locale === "zh" ? "取消报名" : "Cancel registration")} className="h-8 w-8 text-muted-foreground hover:text-red-400 shrink-0" />}>
                                  {reg.status === "cancelled" ? <RotateCcw className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-zinc-900 border-zinc-800">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    {reg.status === "cancelled"
                                      ? (locale === "zh" ? "恢复报名？" : "Restore registration?")
                                      : (locale === "zh" ? "确认取消？" : "Confirm cancellation?")}
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {reg.status === "cancelled"
                                      ? (locale === "zh" ? "您的报名将被恢复" : "Your registration will be restored.")
                                      : (locale === "zh" ? "您的报名将被取消" : "Your registration will be cancelled.")}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                {registrationError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{locale === "zh" ? "操作失败，报名状态未更新，请重试。" : "Unable to update registration. Please try again."}</p>}
                                <AlertDialogFooter>
                                  <AlertDialogCancel disabled={busy} className="border-zinc-700">{locale === "zh" ? "返回" : "Back"}</AlertDialogCancel>
                                  <AlertDialogAction disabled={busy} onClick={() => cancelRegistration(reg.id, reg.status)} className={reg.status === "cancelled" ? "bg-emerald-600" : "bg-red-600"}>
                                    {updating ? common.loading[locale] : reg.status === "cancelled" ? (locale === "zh" ? "恢复" : "Restore") : (locale === "zh" ? "取消" : "Cancel")}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
