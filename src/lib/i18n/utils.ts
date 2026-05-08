import { Locale, defaultLocale } from "./translations"

export type { Locale }

export function getLocale(cookieValue?: string): Locale {
  if (cookieValue === "zh") return "zh"
  return defaultLocale
}

export function getLocaleName(locale: Locale): string {
  return locale === "zh" ? "中文" : "EN"
}

export function oppositeLocale(locale: Locale): Locale {
  return locale === "zh" ? "en" : "zh"
}
