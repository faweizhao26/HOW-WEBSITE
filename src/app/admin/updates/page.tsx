"use client"

import { useCallback, useEffect, useState } from "react"
import { Calendar, Newspaper, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { unpublishNewsPost } from "@/app/admin/actions/publication"
import { PublicationActions } from "@/components/admin/publication-actions"
import { PublicationBadge } from "@/components/admin/publication-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import type { NewsPost, PublishedNewsPost } from "@/lib/db/schema"
import { hasNewsChanges } from "@/lib/content/publication-state"
import { admin as adminT, common } from "@/lib/i18n/translations"
import { addNews as addToStore, getNews, getPublishedMockNews, removeNews as removeFromStore, updateNews as updateInStore } from "@/lib/mock-data"
import { createClient } from "@/lib/supabase/client"
import { isMockMode } from "@/lib/utils"

function getLocaleFromCookie(): "en" | "zh" {
  if (typeof document === "undefined") return "en"
  return document.cookie.match(/(?:^|;\s*)lang=([^;]*)/)?.[1] === "zh" ? "zh" : "en"
}

async function fetchNewsRows() {
  const supabase = createClient()
  const [drafts, published] = await Promise.all([
    supabase.from("news_posts").select("*").order("updated_at", { ascending: false }),
    supabase.from("published_news_posts").select("*"),
  ])
  if (drafts.error) throw drafts.error
  if (published.error) throw published.error
  return { drafts: (drafts.data ?? []) as NewsPost[], published: (published.data ?? []) as PublishedNewsPost[] }
}

function PostForm({ post, locale, onSaved }: { post?: NewsPost; locale: "en" | "zh"; onSaved: () => void }) {
  const [title, setTitle] = useState(post?.title || "")
  const [titleZh, setTitleZh] = useState(post?.title_zh || "")
  const [content, setContent] = useState(post?.content || "")
  const [contentZh, setContentZh] = useState(post?.content_zh || "")
  const [coverUrl, setCoverUrl] = useState(post?.cover_url || "")
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const mockMode = isMockMode()

  function changeOpen(nextOpen: boolean) {
    if (nextOpen) {
      setTitle(post?.title ?? "")
      setTitleZh(post?.title_zh ?? "")
      setContent(post?.content ?? "")
      setContentZh(post?.content_zh ?? "")
      setCoverUrl(post?.cover_url ?? "")
    }
    setOpen(nextOpen)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    const now = new Date().toISOString()
    const payload = {
      title: title.trim(),
      title_zh: titleZh.trim() || null,
      content: content.trim(),
      content_zh: contentZh.trim() || null,
      cover_url: coverUrl.trim() || null,
    }

    try {
      if (mockMode) {
        if (post) {
          updateInStore(post.id, { ...payload, updated_at: now })
        } else {
          addToStore({
            ...payload,
            id: `mn-${Date.now()}`,
            publication_status: "draft",
            published_at: null,
            published_by: null,
            created_at: now,
            updated_at: now,
          })
        }
      } else {
        const supabase = createClient()
        const query = post
          ? supabase.from("news_posts").update(payload).eq("id", post.id)
          : supabase.from("news_posts").insert(payload)
        const { error } = await query
        if (error) throw error
      }

      toast.success(post ? adminT.postUpdated[locale] : adminT.postPublished[locale])
      setOpen(false)
      onSaved()
    } catch {
      toast.error(locale === "zh" ? "动态草稿保存失败" : "Unable to save news draft")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger render={post ? <Button variant="outline" size="sm" /> : <Button />}>
        {post ? <><Pencil />{locale === "zh" ? "编辑" : "Edit"}</> : <><Plus />{adminT.newPost[locale]}</>}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{post ? adminT.editPost[locale] : adminT.newPost[locale]}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor={`post-title-${post?.id ?? "new"}`}>{common.title[locale]} (EN)</Label><Input id={`post-title-${post?.id ?? "new"}`} value={title} onChange={(event) => setTitle(event.target.value)} required /></div>
            <div className="space-y-2"><Label htmlFor={`post-title-zh-${post?.id ?? "new"}`}>{common.title[locale]} (中文)</Label><Input id={`post-title-zh-${post?.id ?? "new"}`} value={titleZh} onChange={(event) => setTitleZh(event.target.value)} /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor={`post-content-${post?.id ?? "new"}`}>{common.content[locale]} (EN)</Label><Textarea id={`post-content-${post?.id ?? "new"}`} value={content} onChange={(event) => setContent(event.target.value)} rows={7} required /></div>
            <div className="space-y-2"><Label htmlFor={`post-content-zh-${post?.id ?? "new"}`}>{common.content[locale]} (中文)</Label><Textarea id={`post-content-zh-${post?.id ?? "new"}`} value={contentZh} onChange={(event) => setContentZh(event.target.value)} rows={7} /></div>
          </div>
          <div className="space-y-2"><Label htmlFor={`post-cover-${post?.id ?? "new"}`}>{locale === "zh" ? "封面图片 URL（可选）" : "Cover image URL (optional)"}</Label><Input id={`post-cover-${post?.id ?? "new"}`} type="url" value={coverUrl} onChange={(event) => setCoverUrl(event.target.value)} placeholder="https://..." /></div>
          <Button type="submit" disabled={saving} className="w-full">{saving ? adminT.saving[locale] : (locale === "zh" ? "保存草稿" : "Save draft")}</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function AdminUpdatesPage() {
  const [locale] = useState<"en" | "zh">(getLocaleFromCookie())
  const mockMode = isMockMode()
  const [posts, setPosts] = useState<NewsPost[]>(() => mockMode ? getNews() : [])
  const [publishedPosts, setPublishedPosts] = useState<PublishedNewsPost[]>(() => mockMode ? getPublishedMockNews() : [])
  const [loading, setLoading] = useState(!mockMode)

  const loadPosts = useCallback(async () => {
    if (mockMode) {
      setPosts(getNews())
      setLoading(false)
      return
    }
    try {
      const rows = await fetchNewsRows()
      setPosts(rows.drafts)
      setPublishedPosts(rows.published)
    } catch {
      toast.error(locale === "zh" ? "动态数据加载失败" : "Unable to load news drafts")
    } finally {
      setLoading(false)
    }
  }, [locale, mockMode])

  useEffect(() => {
    if (mockMode) return
    let cancelled = false
    fetchNewsRows()
      .then((rows) => {
        if (!cancelled) {
          setPosts(rows.drafts)
          setPublishedPosts(rows.published)
        }
      })
      .catch(() => {
        if (!cancelled) toast.error(locale === "zh" ? "动态数据加载失败" : "Unable to load news drafts")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [locale, mockMode])

  async function deletePost(post: NewsPost) {
    try {
      if (mockMode) {
        removeFromStore(post.id)
      } else {
        if (post.publication_status === "published") {
          const result = await unpublishNewsPost(post.id)
          if (!result.ok) throw new Error(result.message)
        }
        const { error } = await createClient().from("news_posts").delete().eq("id", post.id)
        if (error) throw error
      }
      toast.success(adminT.postDeleted[locale])
      loadPosts()
    } catch {
      toast.error(locale === "zh" ? "删除失败" : "Unable to delete news draft")
    }
  }

  if (loading) return <div className="space-y-4"><Skeleton className="h-10 w-52" />{[1, 2, 3].map((item) => <Skeleton key={item} className="h-28" />)}</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{adminT.updates[locale]}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{locale === "zh" ? "发布日期由发布操作生成；编辑草稿不会立即修改官网。" : "Publication time is set when you publish; draft edits do not immediately change the site."}</p>
        </div>
        <PostForm locale={locale} onSaved={loadPosts} />
      </div>

      {posts.length === 0 ? (
        <div className="border-y py-20 text-center text-muted-foreground"><Newspaper className="mx-auto mb-4 size-10 opacity-50" /><p>{adminT.noUpdates[locale]}</p></div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => {
            const hasPendingChanges = hasNewsChanges(post, publishedPosts.find((published) => published.id === post.id))
            return (
              <Card key={post.id}>
                <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <PublicationBadge status={post.publication_status} publishedAt={post.published_at} updatedAt={post.updated_at} locale={locale} hasPendingChanges={hasPendingChanges} />
                      {post.published_at && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Calendar className="size-3.5" />{new Date(post.published_at).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", { year: "numeric", month: "long", day: "numeric" })}</span>}
                    </div>
                    <h2 className="font-medium">{locale === "zh" && post.title_zh ? post.title_zh : post.title}</h2>
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{locale === "zh" && post.content_zh ? post.content_zh : post.content}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <PostForm post={post} locale={locale} onSaved={loadPosts} />
                    {!mockMode && <PublicationActions id={post.id} kind="news" locale={locale} status={post.publication_status} hasPendingChanges={hasPendingChanges} onCompleted={loadPosts} />}
                    <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-red-500" onClick={() => deletePost(post)} aria-label={locale === "zh" ? "删除动态" : "Delete news draft"}><Trash2 /></Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
