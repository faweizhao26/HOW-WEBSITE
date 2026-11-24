import { ChevronDown } from "lucide-react"
import { getBrowsableFAQ } from "@/lib/content/conference-faq"
import type { FAQPublishedContent } from "@/lib/content/conference-faq"

export function ConferenceFAQ({ settings, content, locale }: FAQPublishedContent & { locale: "en" | "zh" }) {
  const rows = getBrowsableFAQ(locale, { settings, content })
  return <section id="faq" aria-labelledby="faq-heading" className="scroll-mt-24 border-t border-border py-12 sm:py-16">
    <div className="grid gap-8 lg:grid-cols-[1fr_2fr] lg:gap-16">
      <h2 id="faq-heading" className="text-2xl font-semibold text-zinc-950 dark:text-white">{locale === "zh" ? "常见问题" : "Frequently asked questions"}</h2>
      <div className="min-w-0 divide-y divide-border border-y border-border">
        {rows.map(row => <details key={row.id} data-faq={row.id} className="group min-w-0">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4 py-5 text-base font-medium text-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:text-zinc-100 [&::-webkit-details-marker]:hidden">
            <span className="min-w-0 [overflow-wrap:anywhere]">{row.question}</span>
            <ChevronDown aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-zinc-500 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
          </summary>
          <p className="whitespace-pre-line pb-5 pr-9 text-sm leading-7 text-zinc-600 [overflow-wrap:anywhere] dark:text-zinc-300">{row.answer}</p>
        </details>)}
      </div>
    </div>
  </section>
}
