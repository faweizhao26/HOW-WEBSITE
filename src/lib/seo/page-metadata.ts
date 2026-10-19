import "server-only"
import { cookies } from "next/headers"
import { getLocale } from "@/lib/i18n/utils"
import { buildPageMetadata, indexingEnabled, type PublicPagePath } from "./metadata"

export async function pageMetadata(path: PublicPagePath) {
  const cookieStore = await cookies()
  return buildPageMetadata(path, getLocale(cookieStore.get("lang")?.value), { indexable: indexingEnabled() })
}
