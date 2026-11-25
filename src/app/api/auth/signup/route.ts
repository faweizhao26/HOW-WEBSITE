import { z } from "zod"
import { authRequestOrigin, safeAuthRedirect } from "@/lib/auth/redirect"

const signup = z.object({
  email: z.email().max(254), password: z.string().min(6).max(4096),
  data: z.object({ full_name: z.string().trim().min(1).max(128), privacyAccepted: z.literal(true) }).strict(),
  code_challenge: z.string().max(128).nullish(),
  code_challenge_method: z.enum(["s256", "plain"]).nullish(),
  gotrue_meta_security: z.object({ captcha_token: z.string().max(4096).optional() }).optional(),
}).strict()

const authApiVersion = "2024-01-01"
const headers = { "Content-Type": "application/json", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Supabase-Api-Version": authApiVersion }
function failure(code: string, status: number) { return Response.json({ code, msg: code }, { status, headers }) }

export async function POST(request: Request) {
  const target = new URL(request.url)
  let origin
  try { origin = authRequestOrigin(request) } catch { return failure("invalid_input", 400) }
  if (request.headers.get("origin") && request.headers.get("origin") !== origin) return failure("invalid_input", 403)
  if (!request.headers.get("content-type")?.includes("application/json")) return failure("invalid_input", 400)
  if (Number(request.headers.get("content-length")) > 20000) return failure("invalid_input", 413)
  try {
    const raw = await request.text()
    if (raw.length > 20000) return failure("invalid_input", 413)
    let input: unknown
    try { input = JSON.parse(raw) } catch { return failure("invalid_input", 400) }
    const parsed = signup.safeParse(input)
    if (!parsed.success) return failure(parsed.error.issues.some(issue => issue.path.join(".") === "data.privacyAccepted") ? "privacy_required" : "invalid_input", 400)
    const redirect = new URL(target.searchParams.get("redirect_to") || "", origin)
    if (redirect.origin !== origin || redirect.pathname !== "/auth/callback") return failure("invalid_input", 400)
    const callback = new URL("/auth/callback", origin)
    callback.searchParams.set("next", safeAuthRedirect(redirect.searchParams.get("next")))
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key || url.includes("placeholder") || key.includes("placeholder")) return failure("operation_failed", 503)
    const upstream = new URL("/auth/v1/signup", url)
    upstream.searchParams.set("redirect_to", callback.href)
    const { data, ...credentials } = parsed.data
    const response = await fetch(upstream, {
      method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Supabase-Api-Version": authApiVersion },
      body: JSON.stringify({ ...credentials, data: { full_name: data.full_name, privacy_consent: { accepted: true, accepted_at: new Date().toISOString(), policy_path: "/privacy" } } }),
      cache: "no-store", signal: AbortSignal.timeout(15000),
    })
    const resultHeaders = new Headers(headers)
    const retry = response.headers.get("retry-after")
    if (retry) resultHeaders.set("Retry-After", retry)
    return new Response(await response.text(), { status: response.status, headers: resultHeaders })
  } catch { return failure("operation_failed", 503) }
}
