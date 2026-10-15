import { Badge } from "@/components/ui/badge"
import type { CFPPolicy } from "@/lib/cfp/settings"
import { getCFPState } from "@/lib/cfp/settings"

export function CFPPolicySummary({ policy, locale }: { policy: CFPPolicy; locale: "en" | "zh" }) {
  const state = getCFPState(policy)
  const intro = policy.intro[locale] || policy.intro.en
  const requirements = policy.requirements[locale] || policy.requirements.en
  const reviewNotes = policy.reviewNotes[locale] || policy.reviewNotes.en
  return <section className="mb-8 space-y-5 border-y py-5">
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <Badge variant="outline">{state === "open" ? (locale === "zh" ? "征稿开放中" : "CFP open") : state === "expired" ? (locale === "zh" ? "征稿已截止" : "CFP deadline passed") : (locale === "zh" ? "征稿已关闭" : "CFP closed")}</Badge>
      <span className="text-muted-foreground">{policy.deadline ? `${locale === "zh" ? "截止" : "Deadline"}: ${policy.deadline} 23:59 (UTC+8)` : (locale === "zh" ? "截止日期待公布" : "Deadline to be announced")}</span>
    </div>
    {intro && <p className="whitespace-pre-line break-words text-sm leading-6 text-muted-foreground">{intro}</p>}
    {requirements && <div><h2 className="mb-2 text-sm font-semibold">{locale === "zh" ? "提交要求" : "Submission requirements"}</h2><p className="whitespace-pre-line break-words text-sm leading-6 text-muted-foreground">{requirements}</p></div>}
    {reviewNotes && <div><h2 className="mb-2 text-sm font-semibold">{locale === "zh" ? "审核及结果通知" : "Review and result notification"}</h2><p className="whitespace-pre-line break-words text-sm leading-6 text-muted-foreground">{reviewNotes}</p></div>}
    {policy.contactEmail && <a href={`mailto:${policy.contactEmail}`} className="block break-all text-sm text-emerald-700 underline dark:text-emerald-400">{policy.contactEmail}</a>}
  </section>
}
