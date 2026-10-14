import type { ReactNode } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, ExternalLink } from "lucide-react"
import { contentText } from "@/lib/content/site-content"
import type { ContentBlock, SiteContent } from "@/lib/content/site-content"

type Locale = "en" | "zh"

export function ContentLink({ href, children }: { href: string; children: ReactNode }) {
  const className = "inline-flex max-w-full items-center gap-2 break-words text-emerald-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 dark:text-emerald-400"
  if (href.startsWith("/")) {
    return <Link href={href} className={className}><span className="min-w-0 [overflow-wrap:anywhere]">{children}</span><ArrowRight className="size-4 shrink-0" aria-hidden="true" /></Link>
  }
  return <a href={href} target="_blank" rel="noopener noreferrer" className={className}><span className="min-w-0 [overflow-wrap:anywhere]">{children}</span><ExternalLink className="size-4 shrink-0" aria-hidden="true" /></a>
}

export function ContentBlocks({ blocks, locale, className = "" }: {
  blocks: ContentBlock[]
  locale: Locale
  className?: string
}) {
  return (
    <div className={`space-y-10 ${className}`}>
      {blocks.filter(block => block.enabled).map(block => {
        const title = contentText(block.title, locale)
        const body = contentText(block.body, locale)
        const items = block.items.map(item => contentText(item, locale)).filter(Boolean)
        return (
          <section key={block.id} data-content-block={block.id} className="min-w-0 space-y-4 [overflow-wrap:anywhere]">
            {title && <h2 className="whitespace-pre-line text-2xl font-semibold text-zinc-950 dark:text-white">{title}</h2>}
            {body && <p className="whitespace-pre-line leading-relaxed text-zinc-600 dark:text-zinc-400">{body}</p>}
            {items.length > 0 && (
              <ul className="list-disc space-y-2 pl-6 text-zinc-700 dark:text-zinc-300">
                {items.map((item, index) => <li key={index} className="whitespace-pre-line leading-relaxed">{item}</li>)}
              </ul>
            )}
            {block.imageUrl && (
              <div className="relative aspect-video w-full">
                <Image src={block.imageUrl} alt={contentText(block.imageAlt, locale) || title} fill unoptimized sizes="(max-width: 768px) 100vw, 896px" className="object-contain" />
              </div>
            )}
            {block.linkUrl && <ContentLink href={block.linkUrl}>{contentText(block.linkLabel, locale) || (locale === "zh" ? "查看详情" : "View details")}</ContentLink>}
          </section>
        )
      })}
    </div>
  )
}

export function ContentContact({ email, locale, sponsor = false }: { email: string; locale: Locale; sponsor?: boolean }) {
  if (!email) return null
  return (
    <p className="leading-relaxed text-zinc-600 [overflow-wrap:anywhere] dark:text-zinc-400">
      {sponsor ? (locale === "zh" ? "赞助咨询：" : "Sponsor inquiries: ") : (locale === "zh" ? "联系邮箱：" : "Email: ")}
      <a href={`mailto:${email}`} className="font-medium text-emerald-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 dark:text-emerald-400">{email}</a>
    </p>
  )
}

export function ContentPage({ page, locale, children }: { page: SiteContent["pages"]["about"]; locale: Locale; children?: ReactNode }) {
  const intro = contentText(page.intro, locale)
  const subtitle = contentText(page.subtitle, locale)
  return (
    <div data-content-state="ready" className="mx-auto max-w-4xl px-4 py-16 [overflow-wrap:anywhere] sm:px-6 lg:px-8">
      <header className="mb-10 space-y-4">
        <h1 className="whitespace-pre-line text-4xl font-bold text-zinc-950 dark:text-white">{contentText(page.title, locale)}</h1>
        {subtitle && <p className="whitespace-pre-line text-zinc-600 dark:text-zinc-400">{subtitle}</p>}
        {intro && <p className="whitespace-pre-line text-lg leading-relaxed text-zinc-700 dark:text-zinc-300">{intro}</p>}
      </header>
      <ContentBlocks blocks={page.sections} locale={locale} />
      {children && <div className="mt-8">{children}</div>}
    </div>
  )
}

export function ContentUnavailable({ title, locale }: { title: string; locale: Locale }) {
  return (
    <div data-content-state="error" className="mx-auto min-h-[50vh] max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-4xl font-bold text-zinc-950 dark:text-white">{title}</h1>
      <p className="text-zinc-600 dark:text-zinc-400">{locale === "zh" ? "页面信息暂时无法加载，请稍后再试。" : "Page information is temporarily unavailable. Please try again later."}</p>
    </div>
  )
}
