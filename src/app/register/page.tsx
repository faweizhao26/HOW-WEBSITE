"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { CheckCircle, Ticket, User, Phone, Mail, Building, Briefcase, ChevronRight, Shield, AlertCircle } from "lucide-react"

function getLocaleFromCookie(): "en" | "zh" {
  if (typeof document === "undefined") return "en"
  const match = document.cookie.match(/(?:^|;\s*)lang=([^;]*)/)
  return match?.[1] === "zh" ? "zh" : "en"
}

export default function RegisterPage() {
  const [locale] = useState(getLocaleFromCookie())
  const [user, setUser] = useState<any>(null)
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [registeredTicket, setRegisteredTicket] = useState<string>("")
  const searchParams = useSearchParams()
  const router = useRouter()

  // Form fields
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [verifyCode, setVerifyCode] = useState("")
  const [codeSent, setCodeSent] = useState(false)
  const [codeTimer, setCodeTimer] = useState(0)
  const [company, setCompany] = useState("")
  const [position, setPosition] = useState("")
  const [selectedTicket, setSelectedTicket] = useState("")
  const [channelCode, setChannelCode] = useState(searchParams.get("code") || "")
  const [channelValid, setChannelValid] = useState<boolean | null>(null)
  const [channelValidating, setChannelValidating] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      if (data.user) {
        setName(data.user.user_metadata?.full_name || "")
        setEmail(data.user.email || "")
        supabase.from("profiles").select("full_name,phone,company").eq("id", data.user.id).single().then(({ data: p }) => {
          if (p) { if (p.full_name) setName(p.full_name); if (p.phone) setPhone(p.phone); if (p.company) setCompany(p.company) }
        })
      }
    })
    supabase.from("ticket_types").select("*").eq("is_active", true).order("sort_order").then(({ data }) => {
      setTickets(data || [])
      const free = data?.find(t => t.is_free && !t.requires_code)
      if (free) setSelectedTicket(free.id)
    })
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!channelCode) { setChannelValid(null); return }
    setChannelValidating(true)
    const supabase = createClient()
    const timer = setTimeout(() => {
      supabase.from("channel_codes").select("*, ticket_types(*)").eq("code", channelCode).eq("is_active", true).maybeSingle().then(({ data }) => {
        setChannelValid(!!data)
        if (data?.ticket_type_id) setSelectedTicket(data.ticket_type_id)
      })
      setChannelValidating(false)
    }, 500)
    return () => clearTimeout(timer)
  }, [channelCode])

  // Countdown for code resend
  useEffect(() => {
    if (codeTimer > 0) {
      const t = setTimeout(() => setCodeTimer(codeTimer - 1), 1000)
      return () => clearTimeout(t)
    }
  }, [codeTimer])

  function sendVerifyCode() {
    if (!phone) { toast.error(locale === "zh" ? "请先输入手机号" : "Enter phone first"); return }
    setCodeSent(true)
    setCodeTimer(60)
    toast.success(locale === "zh" ? "验证码已发送（Demo: 输入 888888）" : "Code sent (Demo: enter 888888)")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) { toast.error(locale === "zh" ? "请先登录" : "Please login first"); return }
    if (!name || !email || !phone) { toast.error(locale === "zh" ? "请填写必填字段" : "Required fields missing"); return }
    if (codeSent && verifyCode !== "888888" && verifyCode !== "123456") {
      toast.error(locale === "zh" ? "验证码不正确" : "Invalid code")
      return
    }

    const ticket = tickets.find(t => t.id === selectedTicket)
    if (ticket?.requires_code && !channelCode) {
      toast.error(locale === "zh" ? "该票种需要渠道码" : "This ticket requires a channel code")
      return
    }

    setSubmitting(true)
    const supabase = createClient()
    const { error } = await supabase.from("registrations").insert({
      user_id: user.id,
      ticket_type_id: selectedTicket || null,
      channel_code: channelCode || null,
      name, email, phone,
      company: company || null,
      position: position || null,
      status: "confirmed",
    })

    if (error) {
      toast.error(error.message)
    } else {
      setRegisteredTicket(ticket?.name || "Community Pass")
      setSubmitted(true)
    }
    setSubmitting(false)
  }

  if (loading) return <div className="max-w-2xl mx-auto px-4 py-16 text-center text-zinc-500">{locale === "zh" ? "加载中..." : "Loading..."}</div>

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="h-8 w-8 text-emerald-400" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-4">{locale === "zh" ? "报名成功！" : "Registration Confirmed!"}</h1>
        <p className="text-zinc-400 mb-2">{locale === "zh" ? "您已成功报名 HOW 2027" : "You are registered for HOW 2027"}</p>
        <p className="text-emerald-400 font-medium mb-8">{registeredTicket}</p>
        <div className="flex gap-4 justify-center">
          <Link href="/profile"><Button variant="outline" className="border-zinc-700">{locale === "zh" ? "查看报名" : "View in Profile"}</Button></Link>
          <Link href="/"><Button className="bg-emerald-600 hover:bg-emerald-500">{locale === "zh" ? "返回首页" : "Home"}</Button></Link>
        </div>
      </div>
    )
  }

  const hasFreeTicket = tickets.some(t => t.is_free && !t.requires_code)

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold mb-4">{locale === "zh" ? "报名参加" : "Register"}</h1>
        <p className="text-zinc-400">{locale === "zh" ? "HOW 2027 PostgreSQL 生态大会" : "HOW 2027 PostgreSQL Eco Conference"}</p>
      </div>

      {/* Ticket selection */}
      <Card className="bg-zinc-900/50 border-zinc-800 mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Ticket className="h-5 w-5 text-emerald-400" />{locale === "zh" ? "选择票种" : "Select Ticket"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {tickets.map(ticket => (
              <label
                key={ticket.id}
                className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                  selectedTicket === ticket.id ? "border-emerald-500/50 bg-emerald-950/20" : "border-zinc-800 hover:border-zinc-700 bg-zinc-900/30"
                }`}
              >
                <input type="radio" name="ticket" value={ticket.id} checked={selectedTicket === ticket.id} onChange={() => setSelectedTicket(ticket.id)} className="sr-only" />
                <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0"
                  style={{ borderColor: selectedTicket === ticket.id ? "#10b981" : "#52525b" }}>
                  {selectedTicket === ticket.id && <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{locale === "zh" && ticket.name_zh ? ticket.name_zh : ticket.name}</span>
                    {ticket.is_free ? <Badge variant="outline" className="text-emerald-400 border-emerald-800 text-[10px]">{locale === "zh" ? "免费" : "Free"}</Badge> : <Badge variant="outline" className="text-amber-400 border-amber-800 text-[10px]">{locale === "zh" ? "渠道码" : "Code"}</Badge>}
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">{locale === "zh" && ticket.description_zh ? ticket.description_zh : ticket.description}</p>
                  {ticket.requires_code && (
                    <p className="text-xs text-amber-500 mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{locale === "zh" ? "需要渠道码" : "Requires channel code"}</p>
                  )}
                </div>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Channel code */}
      <Card className="bg-zinc-900/50 border-zinc-800 mb-6">
        <CardHeader>
          <CardTitle className="text-sm text-zinc-400">{locale === "zh" ? "渠道码（选填）" : "Channel Code (optional)"}</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            value={channelCode}
            onChange={e => setChannelCode(e.target.value)}
            placeholder={locale === "zh" ? "如有邀请码请填写" : "Enter invite code if you have one"}
            className={channelValid === true ? "border-emerald-500" : channelValid === false ? "border-red-500" : ""}
          />
          {channelValidating && <p className="text-xs text-zinc-500 mt-1">{locale === "zh" ? "验证中..." : "Checking..."}</p>}
          {channelValid === false && <p className="text-xs text-red-400 mt-1">{locale === "zh" ? "无效的渠道码" : "Invalid channel code"}</p>}
          {channelValid === true && <p className="text-xs text-emerald-400 mt-1">{locale === "zh" ? "渠道码有效" : "Valid channel code"}</p>}
        </CardContent>
      </Card>

      {/* Registration form */}
      <Card className="bg-zinc-900/50 border-zinc-800 mb-6">
        <CardHeader>
          <CardTitle>{locale === "zh" ? "报名信息" : "Registration Info"}</CardTitle>
          <CardDescription>{locale === "zh" ? "* 为必填项" : "* required fields"}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>{locale === "zh" ? "姓名" : "Name"} *</Label>
              <div className="flex items-center gap-2"><User className="h-4 w-4 text-zinc-500 shrink-0" /><Input value={name} onChange={e => setName(e.target.value)} required /></div>
            </div>
            <div className="space-y-2">
              <Label>{locale === "zh" ? "邮箱" : "Email"} *</Label>
              <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-zinc-500 shrink-0" /><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
            </div>
            <div className="space-y-2">
              <Label>{locale === "zh" ? "手机号" : "Phone"} *</Label>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2"><Phone className="h-4 w-4 text-zinc-500 shrink-0" /><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+86 138..." required /></div>
                {!codeSent ? (
                  <Button type="button" variant="outline" size="sm" onClick={sendVerifyCode} className="border-zinc-700 shrink-0">{locale === "zh" ? "发送验证码" : "Send Code"}</Button>
                ) : (
                  <Button type="button" variant="outline" size="sm" disabled={codeTimer > 0} onClick={sendVerifyCode} className="border-zinc-700 shrink-0">
                    {codeTimer > 0 ? `${codeTimer}s` : locale === "zh" ? "重新发送" : "Resend"}
                  </Button>
                )}
              </div>
              {codeSent && (
                <div className="space-y-1 mt-2">
                  <Input value={verifyCode} onChange={e => setVerifyCode(e.target.value)} placeholder={locale === "zh" ? "输入验证码 (Demo: 888888)" : "Enter code (Demo: 888888)"} maxLength={6} className="w-40" />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{locale === "zh" ? "公司" : "Company"}</Label>
                <div className="flex items-center gap-2"><Building className="h-4 w-4 text-zinc-500 shrink-0" /><Input value={company} onChange={e => setCompany(e.target.value)} /></div>
              </div>
              <div className="space-y-2">
                <Label>{locale === "zh" ? "职位" : "Position"}</Label>
                <div className="flex items-center gap-2"><Briefcase className="h-4 w-4 text-zinc-500 shrink-0" /><Input value={position} onChange={e => setPosition(e.target.value)} /></div>
              </div>
            </div>

            {!user ? (
              <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
                <p className="text-sm text-zinc-400 mb-3">{locale === "zh" ? "请先登录后提交报名" : "Please login to submit registration"}</p>
                <Link href="/auth/login?redirect=/register">
                  <Button className="bg-emerald-600 hover:bg-emerald-500">{locale === "zh" ? "登录 / 注册" : "Login / Register"} <ChevronRight className="h-4 w-4 ml-1" /></Button>
                </Link>
              </div>
            ) : (
              <Button type="submit" disabled={submitting} className="w-full bg-emerald-600 hover:bg-emerald-500">
                {submitting ? (locale === "zh" ? "提交中..." : "Submitting...") : (locale === "zh" ? "确认报名" : "Confirm Registration")}
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
