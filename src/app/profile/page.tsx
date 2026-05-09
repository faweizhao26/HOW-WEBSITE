"use client"

import { useEffect, useState, useRef } from "react"
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
import { Avatar } from "@/components/ui/avatar"
import { toast } from "sonner"
import {
  User, Mail, Phone, Building, Edit3, Camera, Mic, Calendar, LogOut,
  ChevronRight, Copy, Check, Shield, Key,
} from "lucide-react"

function getLocaleFromCookie(): "en" | "zh" {
  if (typeof document === "undefined") return "en"
  const match = document.cookie.match(/(?:^|;\s*)lang=([^;]*)/)
  return match?.[1] === "zh" ? "zh" : "en"
}

function statusBadge(status: string, locale: "en" | "zh") {
  switch (status) {
    case "pending": return <Badge variant="secondary">{cfpT.pending[locale]}</Badge>
    case "approved": return <Badge className="bg-emerald-900/50 text-emerald-300 border-emerald-800">{cfpT.approved[locale]}</Badge>
    case "rejected": return <Badge variant="destructive">{cfpT.rejected[locale]}</Badge>
    default: return <Badge variant="outline">{status}</Badge>
  }
}

export default function ProfilePage() {
  const [locale] = useState(getLocaleFromCookie())
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [sessions, setSessions] = useState<any[]>([])
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [fullName, setFullName] = useState("")
  const [company, setCompany] = useState("")
  const [bio, setBio] = useState("")
  const [bioZh, setBioZh] = useState("")
  const [phone, setPhone] = useState("")
  const [wechat, setWechat] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/auth/login?redirect=/profile"); return }
    setUser(user)

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()
    setProfile(profile)
    setFullName(profile?.full_name || "")
    setCompany(profile?.company || "")
    setBio(profile?.bio || "")
    setBioZh(profile?.bio_zh || "")
    setPhone(profile?.phone || "")
    setWechat(profile?.wechat || "")
    setAvatarUrl(profile?.avatar_url || "")

    const { data: sessions } = await supabase.from("sessions").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
    setSessions(sessions || [])
    setLoading(false)
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const supabase = createClient()
    const { error: uploadError } = await supabase.storage.from("conference-media").upload(`avatars/${user.id}/${Date.now()}`, file)
    if (uploadError) { toast.error(uploadError.message); return }
    const { data: urlData } = supabase.storage.from("conference-media").getPublicUrl(`avatars/${user.id}/${Date.now()}`)
    // Fix: get the actual uploaded URL
    const { data: existing } = supabase.storage.from("conference-media").getPublicUrl(`avatars/${user.id}/${Date.now()}`)
    // Re-upload with proper path
    const cleanPath = `avatars/${user.id}/${Date.now()}-${file.name}`
    const { error: reErr } = await supabase.storage.from("conference-media").upload(cleanPath, file, { upsert: true })
    if (reErr) { toast.error(reErr.message); return }
    const { data } = supabase.storage.from("conference-media").getPublicUrl(cleanPath)
    setAvatarUrl(data.publicUrl)
    await supabase.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", user.id)
    toast.success(locale === "zh" ? "头像已更新" : "Avatar updated")
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from("profiles").update({
      full_name: fullName,
      company: company || null,
      bio: bio || null,
      bio_zh: bioZh || null,
      phone: phone || null,
      wechat: wechat || null,
    }).eq("id", user.id)
    setSaving(false)
    if (error) toast.error(error.message)
    else {
      toast.success(locale === "zh" ? "资料已保存" : "Profile saved")
      setEditing(false)
    }
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  function copyId() {
    navigator.clipboard.writeText(user.id)
    setCopied(true)
    toast.success(locale === "zh" ? "已复制 ID" : "ID copied")
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return <div className="max-w-4xl mx-auto px-4 py-16 text-center text-zinc-500">{common.loading[locale]}</div>
  }

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
            <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="border-zinc-700">
              <Edit3 className="h-4 w-4 mr-1" /> {locale === "zh" ? "编辑资料" : "Edit"}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-zinc-400">
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
              <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <Avatar className="w-24 h-24 ring-2 ring-emerald-500/30 mb-4">
                  <img src={avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName || user.email)}&background=10b981&color=fff&size=128`} alt="" />
                </Avatar>
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="h-6 w-6 text-white" />
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              </div>
              <h2 className="text-lg font-semibold text-white text-center">{fullName || user.email}</h2>
              {profile?.role === "admin" && (
                <Badge className="mt-2 bg-amber-900/50 text-amber-300 border-amber-800">
                  <Shield className="h-3 w-3 mr-1" /> Admin
                </Badge>
              )}
            </CardContent>
          </Card>

          {/* Basic info */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-zinc-500 shrink-0" />
                <span className="text-zinc-400">{locale === "zh" ? "邮箱" : "Email"}:</span>
                <span className="text-zinc-300 ml-auto truncate">{user.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Key className="h-4 w-4 text-zinc-500 shrink-0" />
                <span className="text-zinc-400">ID:</span>
                <span className="text-zinc-500 text-xs font-mono ml-auto truncate">{user.id.slice(0, 16)}...</span>
                <button onClick={copyId} className="text-zinc-600 hover:text-zinc-300 ml-1">
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
              {phone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-zinc-500 shrink-0" />
                  <span className="text-zinc-400">{locale === "zh" ? "手机" : "Phone"}:</span>
                  <span className="text-zinc-300 ml-auto">{phone}</span>
                </div>
              )}
              {company && (
                <div className="flex items-center gap-3 text-sm">
                  <Building className="h-4 w-4 text-zinc-500 shrink-0" />
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
                <div className="space-y-2"><Label>{locale === "zh" ? "昵称" : "Display Name"}</Label><Input value={fullName} onChange={e => setFullName(e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>{locale === "zh" ? "手机号" : "Phone"}</Label><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+86 138..." /></div>
                  <div className="space-y-2"><Label>{locale === "zh" ? "微信" : "WeChat"}</Label><Input value={wechat} onChange={e => setWechat(e.target.value)} /></div>
                </div>
                <div className="space-y-2"><Label>{locale === "zh" ? "公司" : "Company"}</Label><Input value={company} onChange={e => setCompany(e.target.value)} /></div>
                <div className="space-y-2"><Label>{locale === "zh" ? "个人简介 (EN)" : "Bio (EN)"}</Label><Textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} /></div>
                <div className="space-y-2"><Label>{locale === "zh" ? "个人简介 (中文)" : "Bio (中文)"}</Label><Textarea value={bioZh} onChange={e => setBioZh(e.target.value)} rows={3} /></div>
                <div className="flex gap-3">
                  <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500">{saving ? common.loading[locale] : locale === "zh" ? "保存" : "Save"}</Button>
                  <Button variant="ghost" onClick={() => setEditing(false)}>{common.cancel[locale]}</Button>
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
                    <span className="ml-2 text-xs bg-zinc-700 px-2 py-0.5 rounded-full">{sessions.length}</span>
                  </TabsTrigger>
                  <TabsTrigger value="registration">
                    <Calendar className="h-4 w-4 mr-1" />
                    {locale === "zh" ? "大会报名" : "Registration"}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="sessions">
                  {sessions.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500">
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
                                <span className="text-xs text-zinc-500">{s.duration}min · {s.type}</span>
                              </div>
                              <h4 className="text-sm font-medium text-white">{s.title}</h4>
                              {s.admin_feedback && (
                                <p className="text-xs text-zinc-500 mt-2 italic">"{s.admin_feedback}"</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="registration">
                  <div className="text-center py-8 text-zinc-500">
                    <Calendar className="h-8 w-8 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">{locale === "zh" ? "报名通道尚未开启" : "Registration not yet open"}</p>
                    <Link href="/register">
                      <Button size="sm" variant="outline" className="mt-3 border-emerald-800 text-emerald-400">
                        {locale === "zh" ? "查看报名" : "View Registration"} <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
