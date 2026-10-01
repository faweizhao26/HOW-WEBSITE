"use client"

import { useEffect, useState } from "react"
import type { User as AuthUser } from "@supabase/supabase-js"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { CheckCircle, Ticket, User, Phone, Mail, Building, Briefcase, ChevronRight, AlertCircle } from "lucide-react"
import { checkRegistrationChannel, confirmRegistrationPhone, sendRegistrationCode, submitRegistration } from "./actions"
import { registrationErrorMessage } from "@/lib/registration/messages"
import { hasVerifiedRegistrationPhone, normalizeRegistrationPhone } from "@/lib/registration/service"

type TicketType = {
  id: string; name: string; name_zh: string | null; description: string | null;
  description_zh: string | null; is_free: boolean; requires_code: boolean;
}

export default function RegistrationForm({ locale }: { locale: "en" | "zh" }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [tickets, setTickets] = useState<TicketType[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [existingRegistration, setExistingRegistration] = useState<{ id: string; status: string } | null>(null)
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
  const [codePhone, setCodePhone] = useState("")
  const [verifiedPhone, setVerifiedPhone] = useState("")
  const [sendingCode, setSendingCode] = useState(false)
  const [verifyingPhone, setVerifyingPhone] = useState(false)
  const [codeTimer, setCodeTimer] = useState(0)
  const [company, setCompany] = useState("")
  const [position, setPosition] = useState("")
  const [selectedTicket, setSelectedTicket] = useState("")
  const [channelCode, setChannelCode] = useState(searchParams.get("code") || "")
  const [channelValid, setChannelValid] = useState<boolean | null>(null)
  const [checkedChannelCode, setCheckedChannelCode] = useState("")
  const channelValidating = Boolean(user && channelCode.trim() && checkedChannelCode !== channelCode)
  let normalizedPhone = ""
  try { normalizedPhone = normalizeRegistrationPhone(phone) } catch { /* Incomplete input is not verified. */ }
  const phoneVerified = Boolean(normalizedPhone && normalizedPhone === verifiedPhone)
  const codeSent = Boolean(normalizedPhone && normalizedPhone === codePhone)

  useEffect(() => {
    let active = true
    const supabase = createClient()
    async function load() {
      try {
        const { data: ticketData, error: ticketError } = await supabase.from("ticket_types").select("*").eq("is_active", true).order("sort_order")
        if (ticketError) throw ticketError
        const { data: { user } } = await supabase.auth.getUser()
        if (!active) return
        setTickets(ticketData || [])
        setSelectedTicket(ticketData?.find(t => t.is_free && !t.requires_code)?.id || "")
        setUser(user)
        if (user) {
          const { data: profile, error: profileError } = await supabase.from("profiles").select("full_name,phone,company").eq("id", user.id).maybeSingle()
          const { data: registration, error: registrationError } = await supabase.from("registrations").select("id,status").eq("user_id", user.id).maybeSingle()
          if (profileError || registrationError) throw profileError || registrationError
          if (!active) return
          setExistingRegistration(registration)
          setName(profile?.full_name || user.user_metadata?.full_name || "")
          setEmail(user.email || "")
          setCompany(profile?.company || "")
          let confirmed = ""
          try {
            const value = normalizeRegistrationPhone(user.phone ? `+${user.phone.replace(/^\+/, "")}` : "")
            if (hasVerifiedRegistrationPhone(user, value)) confirmed = value
          } catch { /* An account may not have a phone yet. */ }
          setPhone(confirmed || profile?.phone || "")
          setVerifiedPhone(confirmed)
        }
      } catch {
        if (active) setLoadError(true)
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!channelCode.trim() || !user) return
    let active = true
    const timer = setTimeout(async () => {
      try {
        const result = await checkRegistrationChannel(channelCode)
        if (!active) return
        setChannelValid(result.ok)
        if (result.ok) setSelectedTicket(result.data.ticketTypeId)
      } catch {
        if (active) setChannelValid(false)
      } finally {
        if (active) setCheckedChannelCode(channelCode)
      }
    }, 500)
    return () => { active = false; clearTimeout(timer) }
  }, [channelCode, user])

  // Countdown for code resend
  useEffect(() => {
    if (codeTimer > 0) {
      const t = setTimeout(() => setCodeTimer(codeTimer - 1), 1000)
      return () => clearTimeout(t)
    }
  }, [codeTimer])

  async function sendVerifyCode() {
    setSendingCode(true)
    try {
      const result = await sendRegistrationCode(phone)
      if (!result.ok) { toast.error(registrationErrorMessage(result.error, locale)); return }
      if (result.data.verified) setVerifiedPhone(result.data.phone)
      else {
        setCodePhone(result.data.phone)
        setVerifyCode("")
        setCodeTimer(60)
        toast.success(locale === "zh" ? "验证码已发送" : "Code sent")
      }
    } catch { toast.error(registrationErrorMessage("operation_failed", locale)) }
    finally { setSendingCode(false) }
  }

  async function verifyPhone() {
    setVerifyingPhone(true)
    try {
      const result = await confirmRegistrationPhone(phone, verifyCode)
      if (!result.ok) { toast.error(registrationErrorMessage(result.error, locale)); return }
      setVerifiedPhone(result.data.phone)
      setVerifyCode("")
      toast.success(locale === "zh" ? "手机号已验证" : "Phone verified")
    } catch { toast.error(registrationErrorMessage("operation_failed", locale)) }
    finally { setVerifyingPhone(false) }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) { toast.error(locale === "zh" ? "请先登录" : "Please login first"); return }
    if (!name || !email || !phone) { toast.error(locale === "zh" ? "请填写必填字段" : "Required fields missing"); return }
    if (!phoneVerified) {
      toast.error(registrationErrorMessage("phone_not_verified", locale))
      return
    }

    const ticket = tickets.find(t => t.id === selectedTicket)
    if (!ticket) { toast.error(registrationErrorMessage("invalid_input", locale)); return }
    if (ticket?.requires_code && !channelCode) {
      toast.error(locale === "zh" ? "该票种需要渠道码" : "This ticket requires a channel code")
      return
    }
    if (channelCode.trim() && channelValid !== true) {
      toast.error(locale === "zh" ? "请使用有效的渠道码" : "Please use a valid channel code")
      return
    }

    setSubmitting(true)
    try {
      const result = await submitRegistration({ name, phone, ticketTypeId: selectedTicket, channelCode, company, position })
      if (!result.ok) {
        toast.error(registrationErrorMessage(result.error, locale))
        if (result.error === "already_registered") router.push("/profile")
        return
      }
      setRegisteredTicket(locale === "zh" && ticket.name_zh ? ticket.name_zh : ticket.name)
      setSubmitted(true)
    } catch { toast.error(registrationErrorMessage("operation_failed", locale)) }
    finally { setSubmitting(false) }
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

  if (loadError) return <div className="max-w-2xl mx-auto px-4 py-16 text-center"><h1 className="text-2xl font-bold mb-4">{locale === "zh" ? "报名暂不可用" : "Registration Unavailable"}</h1><p>{registrationErrorMessage("operation_failed", locale)}</p></div>

  if (existingRegistration) return <div className="max-w-xl mx-auto px-4 py-16 text-center"><h1 className="text-2xl font-bold mb-4">{locale === "zh" ? "我的报名" : "My Registration"}</h1><p className="mb-6">{existingRegistration.status === "cancelled" ? (locale === "zh" ? "报名已取消" : "Registration cancelled") : (locale === "zh" ? "你已报名" : "You are registered")}</p><Link href="/profile"><Button>{locale === "zh" ? "查看报名" : "View Registration"}</Button></Link></div>

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
            {tickets.length === 0 && <p className="text-sm text-zinc-400">{locale === "zh" ? "报名尚未开放" : "Registration is not open yet"}</p>}
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
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-white break-words min-w-0">{locale === "zh" && ticket.name_zh ? ticket.name_zh : ticket.name}</span>
                    {ticket.is_free ? <Badge variant="outline" className="text-emerald-400 border-emerald-800 text-[10px]">{locale === "zh" ? "免费" : "Free"}</Badge> : <Badge variant="outline" className="text-amber-400 border-amber-800 text-[10px]">{locale === "zh" ? "渠道码" : "Code"}</Badge>}
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">{locale === "zh" && ticket.description_zh ? ticket.description_zh : ticket.description}</p>
                  {ticket.requires_code && (
                    <p className="text-xs text-amber-400 mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3 shrink-0" />{locale === "zh" ? "需要渠道码" : "Requires channel code"}</p>
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
            aria-label={locale === "zh" ? "渠道码" : "Channel code"}
            value={channelCode}
            maxLength={128}
            disabled={!user || submitting}
            onChange={e => { setChannelCode(e.target.value); setChannelValid(null); setCheckedChannelCode("") }}
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
              <Label htmlFor="registration-name">{locale === "zh" ? "姓名" : "Name"} *</Label>
              <div className="flex items-center gap-2"><User className="h-4 w-4 text-zinc-500 shrink-0" /><Input id="registration-name" autoComplete="name" maxLength={128} value={name} onChange={e => setName(e.target.value)} required /></div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="registration-email">{locale === "zh" ? "邮箱" : "Email"} *</Label>
              <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-zinc-500 shrink-0" /><Input id="registration-email" type="email" value={email} readOnly required /></div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="registration-phone">{locale === "zh" ? "手机号" : "Phone"} *</Label>
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1 basis-48 flex items-center gap-2"><Phone className="h-4 w-4 text-zinc-500 shrink-0" /><Input id="registration-phone" type="tel" autoComplete="tel" maxLength={64} value={phone} disabled={sendingCode || verifyingPhone || submitting} onChange={e => { setPhone(e.target.value); setCodePhone(""); setVerifyCode(""); setCodeTimer(0) }} placeholder="+86 138..." required /></div>
                {phoneVerified ? <Badge variant="outline" className="text-emerald-400 border-emerald-800"><CheckCircle className="h-3 w-3 mr-1" />{locale === "zh" ? "已验证" : "Verified"}</Badge> :
                  <Button type="button" variant="outline" size="sm" disabled={!user || sendingCode || verifyingPhone || codeTimer > 0 || !normalizedPhone} onClick={sendVerifyCode} className="border-zinc-700 shrink-0">
                    {sendingCode ? (locale === "zh" ? "发送中..." : "Sending...") : codeTimer > 0 ? `${codeTimer}s` : codeSent ? (locale === "zh" ? "重新发送" : "Resend") : (locale === "zh" ? "发送验证码" : "Send Code")}
                  </Button>}
              </div>
              {codeSent && !phoneVerified && (
                <div className="flex items-center gap-2 mt-2">
                  <Input aria-label={locale === "zh" ? "短信验证码" : "SMS code"} inputMode="numeric" autoComplete="one-time-code" value={verifyCode} disabled={verifyingPhone} onChange={e => setVerifyCode(e.target.value.replace(/\D/g, ""))} placeholder={locale === "zh" ? "输入验证码" : "Enter code"} maxLength={6} className="min-w-0 max-w-40" />
                  <Button type="button" variant="outline" disabled={verifyingPhone || !/^\d{6}$/.test(verifyCode)} onClick={verifyPhone}>{verifyingPhone ? (locale === "zh" ? "验证中..." : "Verifying...") : (locale === "zh" ? "验证" : "Verify")}</Button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="registration-company">{locale === "zh" ? "公司" : "Company"}</Label>
                <div className="flex items-center gap-2"><Building className="h-4 w-4 text-zinc-500 shrink-0" /><Input id="registration-company" maxLength={200} autoComplete="organization" value={company} onChange={e => setCompany(e.target.value)} /></div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="registration-position">{locale === "zh" ? "职位" : "Position"}</Label>
                <div className="flex items-center gap-2"><Briefcase className="h-4 w-4 text-zinc-500 shrink-0" /><Input id="registration-position" maxLength={200} autoComplete="organization-title" value={position} onChange={e => setPosition(e.target.value)} /></div>
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
              <Button type="submit" disabled={submitting || !phoneVerified || !selectedTicket || channelValidating || Boolean(channelCode.trim() && channelValid !== true)} className="w-full bg-emerald-600 hover:bg-emerald-500">
                {submitting ? (locale === "zh" ? "提交中..." : "Submitting...") : (locale === "zh" ? "确认报名" : "Confirm Registration")}
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
