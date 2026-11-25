import { createBrowserClient } from "@supabase/ssr"
import { createPrivacyFetch } from "@/lib/auth/privacy-fetch"

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { detectSessionInUrl: false }, global: { fetch: createPrivacyFetch(process.env.NEXT_PUBLIC_SUPABASE_URL!) } }
  )
}
