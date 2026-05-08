"use client"

import { useRouter } from "next/navigation"
import { Globe } from "lucide-react"
import { Locale, oppositeLocale, getLocaleName } from "@/lib/i18n/utils"

export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const router = useRouter()

  function switchLang() {
    document.cookie = `lang=${oppositeLocale(locale)};path=/;max-age=31536000`
    router.refresh()
  }

  return (
    <button
      onClick={switchLang}
      className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
    >
      <Globe className="h-4 w-4" />
      <span>{getLocaleName(oppositeLocale(locale))}</span>
    </button>
  )
}
