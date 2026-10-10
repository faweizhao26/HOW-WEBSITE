import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

export type AuthErrorCode = "invalid_input" | "invalid_credentials" | "email_not_confirmed" | "rate_limited" | "auth_failed" | "operation_failed"
export class LoginError extends Error {
  code: AuthErrorCode
  constructor(code: AuthErrorCode) { super(code); this.name = "LoginError"; this.code = code }
}
export function authErrorCode(error: unknown): AuthErrorCode {
  if (!error || typeof error !== "object") return "operation_failed"
  if ("status" in error && error.status === 429) return "rate_limited"
  if ("code" in error) {
    if (error.code === "invalid_credentials" || error.code === "email_not_confirmed") return error.code
    if (["over_request_rate_limit", "over_email_send_rate_limit"].includes(String(error.code))) return "rate_limited"
  }
  return "operation_failed"
}
const loginSchema = z.object({ email: z.string().trim().max(254).pipe(z.email()), password: z.string().min(1).max(4096) }).strict()
export async function signInAccount(client: SupabaseClient, input: unknown) {
  const parsed = loginSchema.safeParse(input)
  if (!parsed.success) throw new LoginError("invalid_input")
  try {
    const { data, error } = await client.auth.signInWithPassword(parsed.data)
    if (error) throw new LoginError(authErrorCode(error))
    if (!data.user || !data.session) throw new LoginError("operation_failed")
    return data
  } catch (error) { throw error instanceof LoginError ? error : new LoginError("operation_failed") }
}
