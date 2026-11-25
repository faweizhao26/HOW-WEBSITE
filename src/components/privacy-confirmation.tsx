import Link from "next/link"
import { ExternalLink } from "lucide-react"

export function PrivacyConfirmation({ id, locale, checked, disabled = false, onChange }: {
  id: string; locale: "en" | "zh"; checked: boolean; disabled?: boolean; onChange: (value: boolean) => void
}) {
  return <div className="flex min-w-0 items-start gap-3 text-sm leading-6 text-zinc-700 dark:text-zinc-200">
    <input id={id} name="privacyAccepted" type="checkbox" required checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} className="mt-1 size-4 shrink-0 accent-emerald-700 dark:accent-emerald-400" />
    <label htmlFor={id} className="min-w-0 [overflow-wrap:anywhere]">
      {locale === "zh" ? "我已阅读并同意" : "I have read and agree to the "}
      <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-emerald-800 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-emerald-300">
        {locale === "zh" ? "《隐私条款》" : "Privacy Policy"}<ExternalLink className="size-3 shrink-0" aria-hidden="true" />
      </Link>
    </label>
  </div>
}
