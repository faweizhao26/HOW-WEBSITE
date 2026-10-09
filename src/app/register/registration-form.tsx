"use client"

import { startTransition, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import type { Locale } from "@/lib/i18n/utils"
import { loadRegistrationData, parseRegistrationInput, RegistrationError } from "@/lib/registration/service"
import type { RegistrationData, RegistrationErrorCode } from "@/lib/registration/service"
import { registrationMessages } from "@/lib/registration/messages"
import { checkRegistrationChannel, submitRegistration } from "./actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { CheckCircle, Ticket, User, Phone, Mail, Building, Briefcase, ChevronRight, AlertCircle, RotateCw } from "lucide-react"

type ChannelState = { code: string; status: "idle" | "checking" | "valid" | "invalid" | "error"; error?: RegistrationErrorCode }

export default function RegistrationForm({ locale }: { locale: Locale }) {
  const searchParams = useSearchParams()
  const [data, setData] = useState<RegistrationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [loadVersion, setLoadVersion] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [registeredTicket, setRegisteredTicket] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<RegistrationErrorCode | null>(null)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [company, setCompany] = useState("")
  const [position, setPosition] = useState("")
  const [selectedTicket, setSelectedTicket] = useState("")
  const [channelCode, setChannelCode] = useState(searchParams.get("code") || "")
  const [channel, setChannel] = useState<ChannelState>({ code: channelCode.trim(), status: channelCode.trim() ? "checking" : "idle" })
  const [channelRetry, setChannelRetry] = useState(0)
  const initialized = useRef(false)
  const pending = useRef(false)
  const channelRequest = useRef(0)
  const ticketChoice = useRef(0)
  const user = data?.user
  const tickets = data?.tickets || []
  const email = user?.email || ""

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const result = await loadRegistrationData(createClient())
        if (!active) return
        setData(result)
        if (!initialized.current) {
          setName(result.profile?.full_name || result.user?.user_metadata?.full_name || "")
          setPhone(result.profile?.phone || "")
          setCompany(result.profile?.company || "")
          setSelectedTicket(result.tickets.find(ticket => ticket.is_free && !ticket.requires_code)?.id || "")
          initialized.current = true
        }
        setLoadError(false)
      } catch {
        if (active) setLoadError(true)
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [loadVersion])

  useEffect(() => {
    let active = true
    const request = ++channelRequest.current
    const choice = ticketChoice.current
    const code = channelCode.trim()
    if (!code || !user) return
    const timer = setTimeout(() => {
      startTransition(async () => {
        try {
          const result = await checkRegistrationChannel(code)
          if (!active || request !== channelRequest.current) return
          if (!result.success) {
            setChannel({ code, status: result.code === "invalid_channel" ? "invalid" : "error", error: result.code })
          } else {
            setChannel({ code, status: "valid" })
            if (choice === ticketChoice.current) setSelectedTicket(result.data.ticketTypeId)
          }
        } catch {
          if (active && request === channelRequest.current) setChannel({ code, status: "error", error: "operation_failed" })
        }
      })
    }, 300)
    return () => { active = false; clearTimeout(timer) }
  }, [channelCode, user, channelRetry])

  function changeChannel(value: string) {
    channelRequest.current++
    setChannelCode(value)
    setChannel({ code: value.trim(), status: value.trim() ? "checking" : "idle" })
    setSubmitError(null)
  }

  function retryLoad() {
    channelRequest.current++
    setLoading(true)
    setLoadError(false)
    setLoadVersion(version => version + 1)
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (pending.current) return
    setSubmitError(null)
    if (!user) { setSubmitError("login_required"); return }
    if (channelCode.trim() && channel.status !== "valid") { setSubmitError(channel.error || "invalid_channel"); return }
    let values
    try {
      values = parseRegistrationInput({ name, email, phone, company, position, ticketTypeId: selectedTicket, channelCode })
    } catch (error) {
      setSubmitError(error instanceof RegistrationError ? error.code : "invalid_input")
      return
    }
    pending.current = true
    setSubmitting(true)
    startTransition(async () => {
      try {
        const result = await submitRegistration(values)
        if (!result.success) { setSubmitError(result.code); return }
        setRegisteredTicket(locale === "zh" ? result.data.ticketNameZh || result.data.ticketName : result.data.ticketName)
        toast.success(locale === "zh" ? "报名成功" : "Registration confirmed")
      } catch {
        setSubmitError("operation_failed")
      } finally {
        pending.current = false
        setSubmitting(false)
      }
    })
  }

  if (loading) return <div className="max-w-2xl mx-auto px-4 py-16 text-center text-muted-foreground" role="status">{locale === "zh" ? "加载中..." : "Loading..."}</div>
  if (loadError) return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
      <h1 className="text-2xl font-semibold">{locale === "zh" ? "报名参加" : "Register"}</h1>
      <p role="alert">{registrationMessages.load_failed[locale]}</p>
      <Button variant="outline" onClick={retryLoad}><RotateCw />{locale === "zh" ? "重试" : "Retry"}</Button>
    </div>
  )
  if (registeredTicket !== null || data?.registration) return (
    <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
      <CheckCircle className="h-10 w-10 mx-auto text-emerald-700 dark:text-emerald-400" />
      <h1 className="text-3xl font-bold">{registeredTicket !== null ? (locale === "zh" ? "报名成功！" : "Registration Confirmed!") : (locale === "zh" ? "你已有报名记录" : "You Already Have a Registration")}</h1>
      {registeredTicket !== null ? <p>{registeredTicket}</p> : <p className="text-muted-foreground">{data?.registration?.status === "cancelled" ? (locale === "zh" ? "报名已取消，可在个人中心恢复。" : "Registration cancelled. Manage it in your profile.") : (locale === "zh" ? "报名已确认。" : "Your registration is confirmed.")}</p>}
      <div className="flex flex-wrap gap-3 justify-center">
        <Button variant="outline" render={<Link href="/profile" />} nativeButton={false}>{locale === "zh" ? "查看报名" : "View in Profile"}</Button>
        <Button render={<Link href="/" />} nativeButton={false}>{locale === "zh" ? "返回首页" : "Home"}</Button>
      </div>
    </div>
  )

  const codeStatus = channel.code === channelCode.trim() ? channel.status : "checking"
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold mb-4">{locale === "zh" ? "报名参加" : "Register"}</h1>
        <p className="text-muted-foreground">{locale === "zh" ? "HOW 2027 PostgreSQL 生态大会" : "HOW 2027 PostgreSQL Eco Conference"}</p>
      </div>
      <Card className="mb-6">
        <CardHeader><CardTitle className="flex items-center gap-2"><Ticket className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />{locale === "zh" ? "选择票种" : "Select Ticket"}</CardTitle></CardHeader>
        <CardContent>
          <fieldset className="space-y-3" disabled={submitting} aria-label={locale === "zh" ? "票种" : "Ticket"}>
            {tickets.map(ticket => (
              <label key={ticket.id} className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-ring ${selectedTicket === ticket.id ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" : "border-border hover:bg-muted/50"}`}>
                <input type="radio" name="ticket" value={ticket.id} checked={selectedTicket === ticket.id} onChange={() => { ticketChoice.current++; setSelectedTicket(ticket.id); setSubmitError(null) }} className="sr-only" />
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${selectedTicket === ticket.id ? "border-emerald-600" : "border-zinc-500"}`} aria-hidden="true">{selectedTicket === ticket.id && <div className="w-2.5 h-2.5 rounded-full bg-emerald-600" />}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium break-words">{locale === "zh" && ticket.name_zh ? ticket.name_zh : ticket.name}</span>
                    <Badge variant="outline" className="text-emerald-800 dark:text-emerald-300 border-emerald-600 text-xs">{ticket.is_free ? (locale === "zh" ? "免费" : "Free") : (locale === "zh" ? "渠道票" : "Partner Pass")}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 break-words">{locale === "zh" && ticket.description_zh ? ticket.description_zh : ticket.description}</p>
                  {ticket.requires_code && <p className="text-xs text-amber-800 dark:text-amber-300 mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{locale === "zh" ? "需要渠道码" : "Requires channel code"}</p>}
                </div>
              </label>
            ))}
            {!tickets.length && <p role="status" className="text-muted-foreground">{locale === "zh" ? "暂无可用票种" : "No tickets available"}</p>}
          </fieldset>
        </CardContent>
      </Card>
      <Card className="mb-6">
        <CardHeader><CardTitle className="text-sm"><Label htmlFor="channel-code">{locale === "zh" ? "渠道码（选填）" : "Channel Code (optional)"}</Label></CardTitle></CardHeader>
        <CardContent>
          <Input id="channel-code" value={channelCode} onChange={event => changeChannel(event.target.value)} maxLength={128} disabled={submitting} aria-describedby="channel-status" aria-invalid={codeStatus === "invalid"} />
          <div id="channel-status" aria-live="polite" className="text-xs mt-2">
            {channelCode.trim() && !user ? <p className="text-muted-foreground">{locale === "zh" ? "请先登录" : "Please log in first"}</p> : <>
              {codeStatus === "checking" && <p className="text-muted-foreground">{locale === "zh" ? "验证中..." : "Checking..."}</p>}
              {codeStatus === "valid" && <p className="text-emerald-800 dark:text-emerald-300">{locale === "zh" ? "渠道码有效" : "Valid channel code"}</p>}
              {(codeStatus === "invalid" || codeStatus === "error") && <p className="text-red-700 dark:text-red-300">{registrationMessages[channel.error || "invalid_channel"][locale]}</p>}
              {codeStatus === "error" && <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => { channelRequest.current++; setChannel({ code: channelCode.trim(), status: "checking" }); setChannelRetry(value => value + 1) }}><RotateCw />{locale === "zh" ? "重试" : "Retry"}</Button>}
            </>}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{locale === "zh" ? "报名信息" : "Registration Info"}</CardTitle><CardDescription>{locale === "zh" ? "* 为必填项" : "* required fields"}</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" aria-busy={submitting}>
            <fieldset className="space-y-4 min-w-0" disabled={submitting}>
              <div className="space-y-2"><Label htmlFor="registration-name">{locale === "zh" ? "姓名" : "Name"} *</Label><div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground shrink-0" /><Input id="registration-name" autoComplete="name" value={name} onChange={event => setName(event.target.value)} maxLength={128} required /></div></div>
              <div className="space-y-2"><Label htmlFor="registration-email">{locale === "zh" ? "邮箱" : "Email"} *</Label><div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground shrink-0" /><Input id="registration-email" type="email" autoComplete="email" value={email} readOnly required /></div></div>
              <div className="space-y-2"><Label htmlFor="registration-phone">{locale === "zh" ? "手机号" : "Phone"} * <span className="text-xs font-normal text-muted-foreground">{locale === "zh" ? "未验证" : "Unverified"}</span></Label><div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground shrink-0" /><Input id="registration-phone" type="tel" autoComplete="tel" value={phone} onChange={event => setPhone(event.target.value)} placeholder="+86 13812345678" maxLength={64} required /></div></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label htmlFor="registration-company">{locale === "zh" ? "公司" : "Company"}</Label><div className="flex items-center gap-2"><Building className="h-4 w-4 text-muted-foreground shrink-0" /><Input id="registration-company" autoComplete="organization" value={company} onChange={event => setCompany(event.target.value)} maxLength={200} /></div></div>
                <div className="space-y-2"><Label htmlFor="registration-position">{locale === "zh" ? "职位" : "Position"}</Label><div className="flex items-center gap-2"><Briefcase className="h-4 w-4 text-muted-foreground shrink-0" /><Input id="registration-position" autoComplete="organization-title" value={position} onChange={event => setPosition(event.target.value)} maxLength={200} /></div></div>
              </div>
            </fieldset>
            {submitError && <div role="alert" className="space-y-2"><p className="text-sm text-red-700 dark:text-red-300">{registrationMessages[submitError][locale]}</p>{submitError === "already_registered" && <Link href="/profile" className="text-sm underline">{locale === "zh" ? "查看报名" : "View in Profile"}</Link>}</div>}
            {!user || submitError === "login_required" ? <div className="text-center space-y-3"><p className="text-sm text-muted-foreground">{locale === "zh" ? "请先登录后提交报名" : "Please log in to register"}</p><Button render={<Link href="/auth/login?redirect=/register" />} nativeButton={false}>{locale === "zh" ? "登录 / 注册" : "Login / Register"}<ChevronRight className="h-4 w-4" /></Button></div> : <Button type="submit" disabled={submitting || !selectedTicket || !tickets.length || (Boolean(channelCode.trim()) && codeStatus === "checking")} className="w-full">{submitting ? (locale === "zh" ? "提交中..." : "Submitting...") : (locale === "zh" ? "确认报名" : "Confirm Registration")}</Button>}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
