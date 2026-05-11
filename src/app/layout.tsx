import type { Metadata } from "next"
import { cookies } from "next/headers"
import "./globals.css"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { ChatbotWidget } from "@/components/chatbot"
import { getLocale } from "@/lib/i18n/utils"
import { Toaster } from "./toaster"

export const metadata: Metadata = {
  title: "HOW 2027 — PostgreSQL Eco Conference",
  description: "A community-driven event focused on open-source innovations and database technology in Jinan, China.",
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const locale = getLocale(cookieStore.get("lang")?.value)

  return (
    <html lang={locale} className="dark">
      <body className="font-sans bg-background text-foreground antialiased min-h-screen flex flex-col">
        <Header locale={locale} />
        <main className="flex-1 pt-16">{children}</main>
        <Footer locale={locale} />
        <ChatbotWidget />
        <Toaster />
      </body>
    </html>
  )
}
