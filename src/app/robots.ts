import type { MetadataRoute } from "next"
import { indexingEnabled, siteOrigin } from "../lib/seo/metadata.ts"

export default function robots(): MetadataRoute.Robots {
  if (!indexingEnabled()) return { rules: { userAgent: "*", disallow: "/" } }
  return {
    // HTML routes must be crawled to read noindex or the protected-route login redirect.
    rules: { userAgent: "*", allow: "/", disallow: ["/api/"] },
    sitemap: `${siteOrigin()}/sitemap.xml`,
  }
}
