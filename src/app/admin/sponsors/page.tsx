"use client"

import { isMockMode } from "@/lib/utils"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { getSponsors, addSponsor as addToStore, updateSponsor as updateInStore, removeSponsor as removeFromStore } from "@/lib/mock-data"
import { admin as adminT, common } from "@/lib/i18n/translations"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { Plus, Trash2, Pencil, Star } from "lucide-react"

type Sponsor = { id: string; name: string; logo_url: string; tier: string; website_url: string | null; sort_order: number }

const tiers = [
  { value: "diamond", label: { en: "Diamond", zh: "钻石" }, color: "bg-cyan-600" },
  { value: "gold", label: { en: "Gold", zh: "金牌" }, color: "bg-amber-500" },
  { value: "silver", label: { en: "Silver", zh: "银牌" }, color: "bg-zinc-400" },
  { value: "bronze", label: { en: "Bronze", zh: "铜牌" }, color: "bg-orange-700" },
]

function getLocaleFromCookie(): "en" | "zh" {
  if (typeof document === "undefined") return "en"
  const match = document.cookie.match(/(?:^|;\s*)lang=([^;]*)/)
  return match?.[1] === "zh" ? "zh" : "en"
}

function SponsorForm({ sponsor, setSponsors, locale }: { sponsor?: Sponsor; setSponsors: React.Dispatch<React.SetStateAction<Sponsor[]>>; locale: "en" | "zh" }) {
  const [name, setName] = useState(sponsor?.name || "")
  const [tier, setTier] = useState(sponsor?.tier || "silver")
  const [websiteUrl, setWebsiteUrl] = useState(sponsor?.website_url || "")
  const [logoPreview, setLogoPreview] = useState<string>(sponsor?.logo_url || "")
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  function handleLogoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setLogoPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  function resetForm() {
    setName(""); setTier("silver"); setWebsiteUrl(""); setLogoPreview("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    if (isMockMode()) {
      if (sponsor) { updateInStore(sponsor.id, { name, tier, website_url: websiteUrl, logo_url: logoPreview || sponsor.logo_url }); setSponsors(getSponsors()) }
      else { addToStore({ id: "msp-" + Date.now(), name, logo_url: logoPreview, tier, website_url: websiteUrl, sort_order: 99 }); setSponsors(getSponsors()) }
      toast.success(sponsor ? adminT.sponsorUpdated[locale] : adminT.sponsorAdded[locale])
      setOpen(false); setSaving(false); resetForm(); return
    }
    try {
      const supabase = createClient()
      let logoUrl = sponsor?.logo_url || ""
      if (logoPreview && logoPreview !== sponsor?.logo_url) {
        const path = `sponsors/${Date.now()}.png`
        const blob = await (await fetch(logoPreview)).blob()
        const { error: upErr } = await supabase.storage.from("conference-media").upload(path, blob)
        if (!upErr) { const { data: urlData } = supabase.storage.from("conference-media").getPublicUrl(path); logoUrl = urlData.publicUrl }
      }
      if (sponsor) await supabase.from("sponsors").update({ name, tier, website_url: websiteUrl, logo_url: logoUrl }).eq("id", sponsor.id)
      else await supabase.from("sponsors").insert({ name, logo_url: logoUrl, tier, website_url: websiteUrl, sort_order: 99 })
      toast.success(sponsor ? adminT.sponsorUpdated[locale] : adminT.sponsorAdded[locale])
    } catch {}
    setSaving(false); setOpen(false); resetForm()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        {sponsor ? <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500"><Pencil className="h-4 w-4" /></Button>
        : <Button className="bg-emerald-600 hover:bg-emerald-500"><Plus className="h-4 w-4 mr-1" /> {adminT.addSponsor[locale]}</Button>}
      </DialogTrigger>
      <DialogContent className="bg-zinc-900 border-zinc-800">
        <DialogHeader><DialogTitle>{sponsor ? adminT.editSponsor[locale] : adminT.addSponsor[locale]}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2"><Label>{common.name[locale]}</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div className="space-y-2"><Label>{common.type[locale]}</Label>
            <Select value={tier} onValueChange={(v) => setTier(v || "silver")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{tiers.map(t => <SelectItem key={t.value} value={t.value}>{t.label[locale]}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-2"><Label>{adminT.website[locale]}</Label><Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://..." /></div>
          <div className="space-y-2"><Label>Logo</Label>
            <Input type="file" accept="image/*" onChange={handleLogoPick} />
            {logoPreview && <img src={logoPreview} alt="Preview" className="w-20 h-20 object-contain rounded border border-zinc-700 mt-2" />}
          </div>
          <Button type="submit" disabled={saving} className="w-full bg-emerald-600 hover:bg-emerald-500">{saving ? adminT.saving[locale] : sponsor ? adminT.update[locale] : adminT.add[locale]}</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function AdminSponsorsPage() {
  const [locale] = useState<"en" | "zh">(getLocaleFromCookie())
  const [sponsors, setSponsors] = useState<Sponsor[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (isMockMode()) { setSponsors(getSponsors()); setLoading(false); return }; loadSponsors() }, [])

  async function loadSponsors() {
    try { const supabase = createClient(); const { data } = await supabase.from("sponsors").select("*").order("sort_order"); setSponsors(data || []) } catch {}
    setLoading(false)
  }
  async function deleteSponsor(id: string) {
    if (isMockMode()) { removeFromStore(id); setSponsors(getSponsors()); toast.success(adminT.sponsorRemoved[locale]); return }
    try { const supabase = createClient(); await supabase.from("sponsors").delete().eq("id", id); toast.success(adminT.sponsorRemoved[locale]); loadSponsors() } catch {}
  }

  if (loading) return <div><div className="flex items-center justify-between mb-8"><h1 className="text-2xl font-bold">{adminT.sponsors[locale]}</h1></div><div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-36 bg-zinc-800" />)}</div></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-8"><h1 className="text-2xl font-bold">{adminT.sponsors[locale]}</h1><SponsorForm setSponsors={setSponsors} locale={locale} /></div>
      {tiers.map((tier) => {
        const ts = sponsors.filter(s => s.tier === tier.value)
        if (ts.length === 0 && sponsors.length > 0) return null
        return (
          <div key={tier.value} className="mb-8">
            <h2 className="text-lg font-semibold text-zinc-300 mb-3 flex items-center gap-2"><span className={`w-3 h-3 rounded-full ${tier.color} inline-block`} />{tier.label[locale]}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {ts.map(s => (
                <Card key={s.id} className="bg-zinc-900/50 border-zinc-800">
                  <CardContent className="p-4">
                    <div className="w-full h-20 bg-zinc-800 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                      {s.logo_url ? <img src={s.logo_url} alt={s.name} className="max-w-full max-h-full object-contain p-2" /> : <span className="text-zinc-600 text-sm">{s.name}</span>}
                    </div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-white truncate">{s.name}</h3>
                      <div className="flex items-center gap-1"><SponsorForm sponsor={s} setSponsors={setSponsors} locale={locale} /><Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-red-400" onClick={() => deleteSponsor(s.id)}><Trash2 className="h-4 w-4" /></Button></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )
      })}
      {sponsors.length === 0 && <div className="text-center py-20 text-zinc-500"><Star className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>{adminT.noSponsors[locale]}</p></div>}
    </div>
  )
}
