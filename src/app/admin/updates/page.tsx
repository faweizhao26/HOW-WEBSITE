"use client"

import { isMockMode } from "@/lib/utils"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { getNews, addNews as addToStore, updateNews as updateInStore, removeNews as removeFromStore } from "@/lib/mock-data"
import { admin as adminT, common } from "@/lib/i18n/translations"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { Plus, Trash2, Pencil, Calendar, Newspaper } from "lucide-react"

type NewsPost = { id: string; title: string; title_zh: string | null; content: string; content_zh: string | null; published_at: string }

function getLocaleFromCookie(): "en" | "zh" {
  if (typeof document === "undefined") return "en"
  const match = document.cookie.match(/(?:^|;\s*)lang=([^;]*)/)
  return match?.[1] === "zh" ? "zh" : "en"
}

function PostForm({ post, setPosts, locale }: { post?: NewsPost; setPosts: React.Dispatch<React.SetStateAction<NewsPost[]>>; locale: "en" | "zh" }) {
  const [title, setTitle] = useState(post?.title || "")
  const [titleZh, setTitleZh] = useState(post?.title_zh || "")
  const [content, setContent] = useState(post?.content || "")
  const [contentZh, setContentZh] = useState(post?.content_zh || "")
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    if (isMockMode()) {
      if (post) { updateInStore(post.id, { title, title_zh: titleZh || "", content, content_zh: contentZh || "" }); setPosts(getNews()) }
      else { addToStore({ id: "mn-" + Date.now(), title, title_zh: titleZh || "", content, content_zh: contentZh || "", published_at: new Date().toISOString() }); setPosts(getNews()) }
      toast.success(post ? adminT.postUpdated[locale] : adminT.postPublished[locale])
      setOpen(false); setSaving(false); return
    }
    try {
      const supabase = createClient()
      if (post) await supabase.from("news_posts").update({ title, title_zh: titleZh || null, content, content_zh: contentZh || null }).eq("id", post.id)
      else await supabase.from("news_posts").insert({ title, title_zh: titleZh || null, content, content_zh: contentZh || null, published_at: new Date().toISOString() })
      toast.success(post ? adminT.postUpdated[locale] : adminT.postPublished[locale])
    } catch {}
    setSaving(false); setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        {post ? <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500"><Pencil className="h-4 w-4" /></Button>
        : <Button className="bg-emerald-600 hover:bg-emerald-500"><Plus className="h-4 w-4 mr-1" /> {adminT.newPost[locale]}</Button>}
      </DialogTrigger>
      <DialogContent className="bg-zinc-900 border-zinc-800 max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{post ? adminT.editPost[locale] : adminT.newPost[locale]}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2"><Label>{common.title[locale]} (EN)</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
          <div className="space-y-2"><Label>{common.title[locale]} (中文)</Label><Input value={titleZh} onChange={(e) => setTitleZh(e.target.value)} /></div>
          <div className="space-y-2"><Label>{common.content[locale]} (EN)</Label><Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={6} required /></div>
          <div className="space-y-2"><Label>{common.content[locale]} (中文)</Label><Textarea value={contentZh} onChange={(e) => setContentZh(e.target.value)} rows={6} /></div>
          <Button type="submit" disabled={saving} className="w-full bg-emerald-600 hover:bg-emerald-500">{saving ? adminT.saving[locale] : post ? adminT.update[locale] : adminT.publish[locale]}</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function AdminUpdatesPage() {
  const [locale] = useState<"en" | "zh">(getLocaleFromCookie())
  const [posts, setPosts] = useState<NewsPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (isMockMode()) { setPosts(getNews()); setLoading(false); return }; loadPosts() }, [])

  async function loadPosts() {
    try { const supabase = createClient(); const { data } = await supabase.from("news_posts").select("*").order("published_at", { ascending: false }); setPosts(data || []) } catch {}
    setLoading(false)
  }
  async function deletePost(id: string) {
    if (isMockMode()) { removeFromStore(id); setPosts(getNews()); toast.success(adminT.postDeleted[locale]); return }
    try { const supabase = createClient(); await supabase.from("news_posts").delete().eq("id", id); toast.success(adminT.postDeleted[locale]); loadPosts() } catch {}
  }

  if (loading) return <div><div className="flex items-center justify-between mb-8"><h1 className="text-2xl font-bold">{adminT.updates[locale]}</h1></div><div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-24 bg-zinc-800" />)}</div></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-8"><h1 className="text-2xl font-bold">{adminT.updates[locale]}</h1><PostForm setPosts={setPosts} locale={locale} /></div>
      {posts.length === 0 ? (
        <div className="text-center py-20 text-zinc-500"><Newspaper className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>{adminT.noUpdates[locale]}</p></div>
      ) : (
        <div className="space-y-4">
          {posts.map(post => (
            <Card key={post.id} className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm text-zinc-500 mb-2"><Calendar className="h-4 w-4" />{new Date(post.published_at).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", { year: "numeric", month: "long", day: "numeric" })}</div>
                    <h3 className="font-medium text-white mb-1">{locale === "zh" && post.title_zh ? post.title_zh : post.title}</h3>
                  </div>
                  <div className="flex items-center gap-1 shrink-0"><PostForm post={post} setPosts={setPosts} locale={locale} /><Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-red-400" onClick={() => deletePost(post.id)}><Trash2 className="h-4 w-4" /></Button></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
