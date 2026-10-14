import "server-only"
import { getPublishedSettings } from "./public"
import { defaultSiteSettings } from "./settings"
import { parseSiteContent } from "./site-content"
import type { SiteContent } from "./site-content"
import type { PublishedSiteSettings } from "@/lib/db/schema"

export async function getPublishedSiteContent(): Promise<{ status: "ready"; settings: PublishedSiteSettings; content: SiteContent } | { status: "error" }> {
  const result = await getPublishedSettings()
  if (result.status === "error") return { status: "error" }
  const settings = result.status === "empty" ? defaultSiteSettings : result.data
  try { return { status: "ready", settings, content: parseSiteContent(settings) } }
  catch { return { status: "error" } }
}
