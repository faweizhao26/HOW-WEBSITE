import type { Metadata } from "next"
import { cookies } from "next/headers"
import "./globals.css"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { ChatbotWidget } from "@/components/chatbot"
import { getLocale } from "@/lib/i18n/utils"
import { Toaster } from "./toaster"
import { LocaleProvider } from "@/lib/i18n/provider"
import { getPublishedSiteContent } from "@/lib/content/site-public"
import { siteOrigin } from "@/lib/seo/metadata"

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: "HOW 2027 — PostgreSQL Eco Conference",
  description: "A community-driven event focused on open-source innovations and database technology in Jinan, China.",
  // Public pages opt in with their own canonical metadata; account/admin routes stay unindexed.
  robots: { index: false, follow: false },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const locale = getLocale(cookieStore.get("lang")?.value)
  const theme = cookieStore.get("theme")?.value === "light" ? "light" : "dark"
  const published = await getPublishedSiteContent()

  return (
    <html lang={locale} className={theme} suppressHydrationWarning>
      <body className="font-sans bg-background text-foreground antialiased min-h-screen flex flex-col">
        <LocaleProvider locale={locale}>
          <Header locale={locale} initialTheme={theme} />
          <main className="flex-1 pt-16">{children}</main>
          <Footer locale={locale} />
          <ChatbotWidget published={published.status === "ready" ? { settings: published.settings, content: published.content } : null} />
          <Toaster />
        </LocaleProvider>
      </body>
    </html>
  )
}
