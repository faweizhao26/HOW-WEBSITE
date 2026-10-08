"use client"

import { createContext, useContext, type ReactNode } from "react"
import type { Locale } from "./utils"

const LocaleContext = createContext<Locale | null>(null)

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
}

export function useLocale(): Locale {
  const locale = useContext(LocaleContext)
  if (locale === null) throw new Error("LocaleProvider is missing")
  return locale
}
