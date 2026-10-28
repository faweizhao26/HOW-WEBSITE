"use client"

import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { CheckCircle2, TicketCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useLocale } from "@/lib/i18n/provider"
import { createClient } from "@/lib/supabase/client"
import { watchAuthUser } from "@/lib/auth/watch-auth-user"
import { redeemGroupSeat } from "@/lib/group-tickets/service"
import { AuthPrompt, ErrorNotice, Field, Loading, text } from "./shared"
import { useGroupMutation } from "./use-group-workspace"

function ClaimForm({ userId, initialCode }: { userId: string; initialCode: string }) {
  const locale = useLocale()
  const [code, setCode] = useState(initialCode)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [company, setCompany] = useState("")
  const [position, setPosition] = useState("")
  const [success, setSuccess] = useState(false)
  const mutation = useGroupMutation()
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const ok = await mutation.run(async () => {
      await redeemGroupSeat(createClient(), { expectedUserId: userId, code: code.trim(), name: name.trim(), phone: phone.trim(), company: company.trim(), position: position.trim() })
    })
    if (ok) setSuccess(true)
  }
  if (success) return <section className="space-y-4 border-y border-border py-6" role="status">
    <h2 className="flex items-center gap-2 text-lg font-semibold"><CheckCircle2 className="size-5 text-emerald-700 dark:text-emerald-400" />{text(locale, "领取成功", "Seat claimed")}</h2>
    <p className="text-sm text-muted-foreground">{text(locale, "参会报名已关联到当前账号。", "Your registration is now linked to this account.")}</p>
    <Button nativeButton={false} render={<Link href="/profile" />}>{text(locale, "查看我的报名", "View my registration")}</Button>
  </section>
  return <form onSubmit={submit} className="space-y-5" aria-busy={mutation.busy}>
    <p className="text-sm text-muted-foreground">{text(locale, "仅在确认领取时验证兑换码。请填写本人信息，每个账号只能有一份报名，已有报名不会被替换。账号邮箱须已验证。", "The code is checked only when you confirm your claim. Enter your own details. Each account can have one registration; an existing registration will not be replaced. Your account email must be verified.")}</p>
    <fieldset disabled={mutation.busy} className="grid min-w-0 gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><Field id="claim-code" label={text(locale, "兑换码 *", "Seat code *")}><Input id="claim-code" required value={code} onChange={e => setCode(e.target.value)} maxLength={128} autoComplete="off" spellCheck={false} autoCapitalize="characters" /></Field></div>
      <Field id="claim-name" label={text(locale, "姓名 *", "Name *")}><Input id="claim-name" autoComplete="name" required maxLength={128} value={name} onChange={e => setName(e.target.value)} /></Field>
      <Field id="claim-phone" label={text(locale, "手机号 *", "Phone *")}><Input id="claim-phone" type="tel" autoComplete="tel" required maxLength={64} value={phone} onChange={e => setPhone(e.target.value)} /></Field>
      <Field id="claim-company" label={text(locale, "公司", "Company")}><Input id="claim-company" autoComplete="organization" maxLength={200} value={company} onChange={e => setCompany(e.target.value)} /></Field>
      <Field id="claim-position" label={text(locale, "职位", "Position")}><Input id="claim-position" autoComplete="organization-title" maxLength={200} value={position} onChange={e => setPosition(e.target.value)} /></Field>
    </fieldset>
    {Boolean(mutation.error) && <div className="space-y-2"><ErrorNotice error={mutation.error} /><Link href="/profile" className="text-sm underline underline-offset-4">{text(locale, "在个人中心核对已有报名", "Check existing registrations in your profile")}</Link></div>}
    <Button type="submit" disabled={mutation.busy || !code.trim() || !name.trim() || !phone.trim()}><TicketCheck />{mutation.busy ? text(locale, "领取中...", "Claiming...") : text(locale, "确认领取本人名额", "Claim my seat")}</Button>
  </form>
}

export function RedeemWorkspace() {
  const locale = useLocale()
  const params = useSearchParams()
  const initialCode = params.get("code") || ""
  const [code, setCode] = useState(initialCode)
  const [session, setSession] = useState<{ userId: string | null; version: number } | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [retry, setRetry] = useState(0)
  const version = useRef(0)
  useEffect(() => {
    const currentVersion = version
    let active = true
    let observedId: string | null | undefined
    const client = createClient()
    const timer = setTimeout(() => { if (active) { setSession(null); setError(null) } }, 0)
    const stop = watchAuthUser(client.auth, user => {
      if (!active || observedId === (user?.id ?? null)) return
      clearTimeout(timer)
      observedId = user?.id ?? null
      version.current++
      setCode(initialCode)
      setError(null)
      setSession({ userId: observedId, version: version.current })
    })
    const readVersion = version.current
    client.auth.getUser().then(result => {
      if (!active || readVersion !== version.current) return
      clearTimeout(timer)
      if (result.error && result.error.name !== "AuthSessionMissingError") setError(result.error)
      else if (observedId === undefined) {
        observedId = result.data.user?.id ?? null
        setError(null)
        setSession({ userId: observedId, version: ++version.current })
      }
    }).catch(failure => { if (active && readVersion === version.current) { clearTimeout(timer); setError(failure) } })
    return () => { active = false; clearTimeout(timer); stop(); currentVersion.current++ }
  }, [initialCode, retry])
  const redirect = "/group-tickets/redeem" + (code.trim() ? "?code=" + encodeURIComponent(code.trim()) : "")
  return <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-10 sm:px-6">
    <header className="space-y-3"><h1 className="text-2xl font-bold">{text(locale, "领取团票名额", "Claim a group seat")}</h1><Link href="/group-tickets" className="text-sm text-emerald-800 underline underline-offset-4 dark:text-emerald-300">{text(locale, "团队订单", "Group orders")}</Link></header>
    {error ? <ErrorNotice error={error} retry={() => setRetry(value => value + 1)} /> : !session ? <Loading /> : !session.userId ? <>
      <Field id="guest-claim-code" label={text(locale, "兑换码", "Seat code")}><Input id="guest-claim-code" value={code} onChange={e => setCode(e.target.value)} maxLength={128} autoComplete="off" spellCheck={false} /></Field>
      <AuthPrompt redirect={redirect} />
    </> : <ClaimForm key={session.userId + "-" + session.version} userId={session.userId} initialCode={code} />}
  </main>
}
