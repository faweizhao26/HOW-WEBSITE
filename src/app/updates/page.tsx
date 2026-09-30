import { cookies } from "next/headers"
import Image from "next/image"
import { Calendar } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getPublishedNews } from "@/lib/content/public"
import { getLocale } from "@/lib/i18n/utils"

export default async function UpdatesPage() {
  const cookieStore = await cookies()
  const locale = getLocale(cookieStore.get("lang")?.value)
  const result = await getPublishedNews()
  const posts = result.status === "ready" ? result.data : []

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="mb-8 text-4xl font-bold text-zinc-950 dark:text-white">
        {locale === "zh" ? "会议动态" : "Conference Updates"}
      </h1>

      {result.status === "error" && (
        <div className="border-y border-zinc-200 py-10 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          {locale === "zh" ? "会议动态暂时无法加载，请稍后再试。" : "Conference updates are temporarily unavailable. Please try again later."}
        </div>
      )}

      {result.status === "empty" && (
        <div className="border-y border-zinc-200 py-10 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          {locale === "zh"
            ? "会议筹备动态会在这里更新。当前还没有正式发布的公告。"
            : "Planning updates will appear here once they are ready. No official announcements have been published yet."}
        </div>
      )}

      {result.status === "ready" && (
        <div className="space-y-5">
          {posts.map((post) => (
            <Card key={post.id} className="border-zinc-200 bg-white/80 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-zinc-700">
              {post.cover_url && (
                <div className="relative aspect-[16/7] overflow-hidden border-b border-zinc-200 dark:border-zinc-800">
                  <Image src={post.cover_url} alt="" fill unoptimized className="object-cover" />
                </div>
              )}
              <CardHeader>
                <div className="mb-2 flex items-center gap-2 text-sm text-zinc-500">
                  <Calendar className="size-4" />
                  {new Date(post.published_at).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", { year: "numeric", month: "long", day: "numeric" })}
                </div>
                <CardTitle className="text-xl text-zinc-950 dark:text-white">
                  {locale === "zh" && post.title_zh ? post.title_zh : post.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {locale === "zh" && post.content_zh ? post.content_zh : post.content}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
