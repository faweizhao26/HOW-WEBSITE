import "server-only"
import { createClient } from "@supabase/supabase-js"
import { PUBLIC_CONTENT_CACHE_TAG, PUBLIC_CONTENT_REVALIDATE_SECONDS } from "../content/cache-policy.ts"

const publicTables = new Set([
  "published_speakers", "published_sessions", "published_sponsors", "published_news_posts",
  "site_settings_releases", "agenda_releases",
])

// Shared data must never inherit a visitor's cookies, session, or administrator privileges.
export function createPublicContentClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key || url.includes("placeholder") || key.includes("placeholder")) throw new Error("Public content configuration is unavailable")
  const origin = new URL(url).origin
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init = {}) => {
      const target = new URL(input instanceof Request ? input.url : String(input))
      const table = target.pathname.replace(/^\/rest\/v1\//, "")
      const method = init.method || (input instanceof Request ? input.method : "GET")
      if (target.origin !== origin || method !== "GET" || !publicTables.has(table)
        || (table.endsWith("_releases") && (target.searchParams.get("is_current") !== "eq.true" || target.searchParams.get("select") !== "payload"))) {
        throw new Error("Only current published content may use the shared cache")
      }
      const headers = new Headers(init.headers)
      headers.delete("cookie")
      headers.set("apikey", key)
      headers.set("authorization", `Bearer ${key}`)
      // Next deduplicates identical GETs during rendering and caches only HTTP 200 responses.
      return fetch(input, { ...init, headers, cache: "force-cache", next: {
        revalidate: PUBLIC_CONTENT_REVALIDATE_SECONDS, tags: [PUBLIC_CONTENT_CACHE_TAG],
      } })
    } },
  })
}
