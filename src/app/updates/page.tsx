import { cookies } from "next/headers"
import { getLocale } from "@/lib/i18n/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar } from "lucide-react"

type NewsPost = {
  id: string
  title: string
  title_zh?: string | null
  content: string
  content_zh?: string | null
  published_at: string
}

async function fetchNews(): Promise<NewsPost[]> {
  try {
    const { createServerSupabase } = await import("@/lib/supabase/server")
    const supabase = await createServerSupabase()
    const { data } = await supabase.from("news_posts").select("*").order("published_at", { ascending: false })
    if (data) return data
  } catch {}
  return []
}

export default async function UpdatesPage() {
  const cookieStore = await cookies()
  const locale = getLocale(cookieStore.get("lang")?.value)
  const posts = await fetchNews()

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-4xl font-bold mb-8">{locale === "zh" ? "会议动态" : "Conference Updates"}</h1>
      <div className="space-y-6">
        {posts.length === 0 && (
          <Card className="border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700/70 dark:bg-zinc-900/30">
            <CardContent className="py-8">
              <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                {locale === "zh"
                  ? "会议筹备动态会在这里更新。当前还没有正式发布的公告。"
                  : "Planning updates will appear here once they are ready. No official announcements have been published yet."}
              </p>
            </CardContent>
          </Card>
        )}
        {posts.map((post) => (
          <Card key={post.id} className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-colors">
            <CardHeader>
              <div className="flex items-center gap-2 text-sm text-zinc-500 mb-2">
                <Calendar className="h-4 w-4" />
                {new Date(post.published_at).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", { year: "numeric", month: "long", day: "numeric" })}
              </div>
              <CardTitle className="text-white text-xl">{locale === "zh" && post.title_zh ? post.title_zh : post.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-zinc-400 whitespace-pre-line leading-relaxed">
                {locale === "zh" && post.content_zh ? post.content_zh : post.content}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
