import type { MetadataRoute } from "next"
import { indexingEnabled, publicPagePaths, siteOrigin } from "../lib/seo/metadata.ts"

export default function sitemap(): MetadataRoute.Sitemap {
  if (!indexingEnabled()) return []
  return publicPagePaths.map(path => ({ url: `${siteOrigin()}${path}` }))
}
