"use client"

import { useLocale } from "@/lib/i18n/provider"

import { useCallback, useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { Pencil, Plus, Star, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { unpublishSponsor } from "@/app/admin/actions/publication"
import { PublicationActions } from "@/components/admin/publication-actions"
import { PublicationBadge } from "@/components/admin/publication-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import type { Sponsor } from "@/lib/db/schema"
import { admin as adminT, common } from "@/lib/i18n/translations"
import { addSponsor as addToStore, getSponsors, removeSponsor as removeFromStore, updateSponsor as updateInStore } from "@/lib/mock-data"
import { createClient } from "@/lib/supabase/client"
import { isMockMode } from "@/lib/utils"

const tiers = [
  { value: "diamond", label: { en: "Diamond", zh: "钻石" }, color: "bg-cyan-600" },
  { value: "gold", label: { en: "Gold", zh: "金牌" }, color: "bg-amber-500" },
  { value: "silver", label: { en: "Silver", zh: "银牌" }, color: "bg-zinc-400" },
  { value: "bronze", label: { en: "Bronze", zh: "铜牌" }, color: "bg-orange-700" },
] as const


async function fetchSponsorRows() {
  const { data, error } = await createClient().from("sponsors").select("*").order("sort_order")
  if (error) throw error
  return (data ?? []) as Sponsor[]
}

function SponsorForm({ sponsor, locale, onSaved }: { sponsor?: Sponsor; locale: "en" | "zh"; onSaved: () => void }) {
  const [name, setName] = useState(sponsor?.name || "")
  const [tier, setTier] = useState<Sponsor["tier"]>(sponsor?.tier || "silver")
  const [websiteUrl, setWebsiteUrl] = useState(sponsor?.website_url || "")
  const [logoPreview, setLogoPreview] = useState(sponsor?.logo_url || "")
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const mockMode = isMockMode()

  function changeOpen(nextOpen: boolean) {
    if (nextOpen) {
      setName(sponsor?.name ?? "")
      setTier(sponsor?.tier ?? "silver")
      setWebsiteUrl(sponsor?.website_url ?? "")
      setLogoPreview(sponsor?.logo_url ?? "")
    }
    setOpen(nextOpen)
  }

  function handleLogoPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setLogoPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    const now = new Date().toISOString()

    try {
      if (mockMode) {
        if (sponsor) {
          updateInStore(sponsor.id, { name: name.trim(), tier, website_url: websiteUrl.trim() || null, logo_url: logoPreview || sponsor.logo_url, updated_at: now })
        } else {
          addToStore({
            id: `msp-${Date.now()}`,
            name: name.trim(),
            logo_url: logoPreview,
            tier,
            website_url: websiteUrl.trim() || null,
            sort_order: 99,
            publication_status: "draft",
            published_at: null,
            published_by: null,
            created_at: now,
            updated_at: now,
          })
        }
      } else {
        const supabase = createClient()
        let logoUrl = sponsor?.logo_url || ""
        if (logoPreview && logoPreview !== sponsor?.logo_url) {
          const path = `sponsors/${Date.now()}.png`
          const blob = await (await fetch(logoPreview)).blob()
          const { error: uploadError } = await supabase.storage.from("conference-media").upload(path, blob)
          if (uploadError) throw uploadError
          logoUrl = supabase.storage.from("conference-media").getPublicUrl(path).data.publicUrl
        }

        const payload = { name: name.trim(), tier, website_url: websiteUrl.trim() || null, logo_url: logoUrl }
        const query = sponsor
          ? supabase.from("sponsors").update(payload).eq("id", sponsor.id)
          : supabase.from("sponsors").insert({ ...payload, sort_order: 99 })
        const { error } = await query
        if (error) throw error
      }

      toast.success(sponsor ? adminT.sponsorUpdated[locale] : adminT.sponsorAdded[locale])
      setOpen(false)
      onSaved()
    } catch {
      toast.error(locale === "zh" ? "赞助商草稿保存失败" : "Unable to save sponsor draft")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger render={sponsor ? <Button variant="outline" size="sm" /> : <Button />}>
        {sponsor ? <><Pencil />{locale === "zh" ? "编辑" : "Edit"}</> : <><Plus />{adminT.addSponsor[locale]}</>}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{sponsor ? adminT.editSponsor[locale] : adminT.addSponsor[locale]}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2"><Label htmlFor={`sponsor-name-${sponsor?.id ?? "new"}`}>{common.name[locale]}</Label><Input id={`sponsor-name-${sponsor?.id ?? "new"}`} value={name} onChange={(event) => setName(event.target.value)} required /></div>
          <div className="space-y-2"><Label>{common.type[locale]}</Label><Select value={tier} onValueChange={(value) => setTier((value || "silver") as Sponsor["tier"])}><SelectTrigger><SelectValue>{tiers.find((item) => item.value === tier)?.label[locale]}</SelectValue></SelectTrigger><SelectContent>{tiers.map((item) => <SelectItem key={item.value} value={item.value}>{item.label[locale]}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label htmlFor={`sponsor-website-${sponsor?.id ?? "new"}`}>{adminT.website[locale]}</Label><Input id={`sponsor-website-${sponsor?.id ?? "new"}`} type="url" value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} placeholder="https://..." /></div>
          <div className="space-y-2">
            <Label htmlFor={`sponsor-logo-${sponsor?.id ?? "new"}`}>Logo</Label>
            <Input id={`sponsor-logo-${sponsor?.id ?? "new"}`} type="file" accept="image/*" onChange={handleLogoPick} />
            {logoPreview && <div className="sponsor-logo-surface relative mt-2 h-20 w-32 overflow-hidden rounded"><Image src={logoPreview} alt="" fill unoptimized className="sponsor-logo-image object-contain p-2" /></div>}
          </div>
          <Button type="submit" disabled={saving} className="w-full">{saving ? adminT.saving[locale] : (locale === "zh" ? "保存草稿" : "Save draft")}</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function AdminSponsorsPage() {
  const locale = useLocale()
  const mockMode = isMockMode()
  const [sponsors, setSponsors] = useState<Sponsor[]>(() => mockMode ? getSponsors() : [])
  const [loading, setLoading] = useState(!mockMode)

  const loadSponsors = useCallback(async () => {
    if (mockMode) {
      setSponsors(getSponsors())
      setLoading(false)
      return
    }
    try {
      setSponsors(await fetchSponsorRows())
    } catch {
      toast.error(locale === "zh" ? "赞助商数据加载失败" : "Unable to load sponsors")
    } finally {
      setLoading(false)
    }
  }, [locale, mockMode])

  useEffect(() => {
    if (mockMode) return
    let cancelled = false
    fetchSponsorRows()
      .then((rows) => {
        if (!cancelled) setSponsors(rows)
      })
      .catch(() => {
        if (!cancelled) toast.error(locale === "zh" ? "赞助商数据加载失败" : "Unable to load sponsors")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [locale, mockMode])

  const sortedSponsors = useMemo(() => [...sponsors].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)), [sponsors])

  async function deleteSponsor(sponsor: Sponsor) {
    try {
      if (mockMode) {
        removeFromStore(sponsor.id)
      } else {
        if (sponsor.publication_status === "published") {
          const result = await unpublishSponsor(sponsor.id)
          if (!result.ok) throw new Error(result.message)
        }
        const { error } = await createClient().from("sponsors").delete().eq("id", sponsor.id)
        if (error) throw error
      }
      toast.success(adminT.sponsorRemoved[locale])
      loadSponsors()
    } catch {
      toast.error(locale === "zh" ? "删除失败" : "Unable to delete sponsor")
    }
  }

  if (loading) return <div className="space-y-4"><Skeleton className="h-10 w-52" /><div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-40" /><Skeleton className="h-40" /></div></div>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{adminT.sponsors[locale]}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{locale === "zh" ? "编辑只保存草稿；再次发布后官网才会更新。" : "Edits stay in draft until you publish them."}</p>
        </div>
        <SponsorForm locale={locale} onSaved={loadSponsors} />
      </div>

      {sortedSponsors.length === 0 ? (
        <div className="border-y py-20 text-center text-muted-foreground"><Star className="mx-auto mb-4 size-10 opacity-50" /><p>{adminT.noSponsors[locale]}</p></div>
      ) : tiers.map((tier) => {
        const tierSponsors = sortedSponsors.filter((sponsor) => sponsor.tier === tier.value)
        if (tierSponsors.length === 0) return null
        return (
          <section key={tier.value} className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold"><span className={`size-3 ${tier.color}`} />{tier.label[locale]}</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {tierSponsors.map((sponsor) => {
                const hasPendingChanges = sponsor.publication_status === "published" && sponsor.published_at !== null && sponsor.updated_at > sponsor.published_at
                return (
                  <Card key={sponsor.id}>
                    <CardContent className="space-y-4 p-4">
                      <div className="sponsor-logo-surface relative flex h-24 w-full items-center justify-center overflow-hidden rounded-lg">
                        {sponsor.logo_url ? <Image src={sponsor.logo_url} alt={sponsor.name} fill unoptimized className="sponsor-logo-image object-contain p-3" /> : <span className="font-semibold text-zinc-800">{sponsor.name}</span>}
                      </div>
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2"><h3 className="font-medium">{sponsor.name}</h3><PublicationBadge status={sponsor.publication_status} publishedAt={sponsor.published_at} updatedAt={sponsor.updated_at} locale={locale} /></div>
                        {sponsor.website_url && <p className="truncate text-xs text-muted-foreground">{sponsor.website_url}</p>}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <SponsorForm sponsor={sponsor} locale={locale} onSaved={loadSponsors} />
                        {!mockMode && <PublicationActions id={sponsor.id} kind="sponsor" locale={locale} status={sponsor.publication_status} hasPendingChanges={hasPendingChanges} onCompleted={loadSponsors} />}
                        <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-red-500" onClick={() => deleteSponsor(sponsor)} aria-label={locale === "zh" ? "删除赞助商" : "Delete sponsor"}><Trash2 /></Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
