import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

export type EmailErrorCode = "invalid_email" | "invalid_password" | "password_mismatch" | "same_password" | "weak_password" | "rate_limited" | "session_expired" | "account_changed" | "operation_failed" | "auth_failed"
export class EmailFlowError extends Error {
  code: EmailErrorCode
  constructor(code: EmailErrorCode) { super(code); this.name = "EmailFlowError"; this.code = code }
}
function failure(error: unknown): EmailFlowError {
  if (error instanceof EmailFlowError) return error
  if (error && typeof error === "object") {
    if ("status" in error && error.status === 429) return new EmailFlowError("rate_limited")
    if ("code" in error) {
      if (error.code === "same_password" || error.code === "weak_password") return new EmailFlowError(error.code)
      if (["over_email_send_rate_limit", "over_request_rate_limit"].includes(String(error.code))) return new EmailFlowError("rate_limited")
    }
  }
  return new EmailFlowError("operation_failed")
}
const emailSchema = z.object({
  kind: z.enum(["recovery", "confirmation"]),
  email: z.string().trim().max(254).pipe(z.email()),
  callbackURL: z.url().refine(value => {
    const url = new URL(value)
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password && ["/auth/callback", "/auth/confirm"].includes(url.pathname)
  }),
}).strict()

export async function requestAccountEmail(client: SupabaseClient, input: unknown) {
  const parsed = emailSchema.safeParse(input)
  if (!parsed.success) throw new EmailFlowError("invalid_email")
  const { kind, email, callbackURL } = parsed.data
  try {
    const result = kind === "recovery"
      ? await client.auth.resetPasswordForEmail(email, { redirectTo: callbackURL })
      : await client.auth.resend({ type: "signup", email, options: { emailRedirectTo: callbackURL } })
    if (result.error) {
      // Do not reveal whether a submitted address has an account needing confirmation.
      if (result.error.code === "user_not_found") return
      throw failure(result.error)
    }
  } catch (error) { throw failure(error) }
}

const passwordSchema = z.object({
  expectedUserId: z.uuid(),
  password: z.string().min(8).max(72).refine(value => value.trim().length > 0),
  confirmation: z.string(),
}).strict()
export async function resetAccountPassword(client: SupabaseClient, input: unknown) {
  const parsed = passwordSchema.safeParse(input)
  if (!parsed.success) throw new EmailFlowError("invalid_password")
  if (parsed.data.password !== parsed.data.confirmation) throw new EmailFlowError("password_mismatch")
  try {
    const { data: { user }, error } = await client.auth.getUser()
    if (error?.name === "AuthSessionMissingError" || (!error && !user)) throw new EmailFlowError("session_expired")
    if (error) throw failure(error)
    if (!user || !user.email_confirmed_at) throw new EmailFlowError("session_expired")
    if (user.id !== parsed.data.expectedUserId) throw new EmailFlowError("account_changed")
    const result = await client.auth.updateUser({ password: parsed.data.password })
    if (result.error) throw failure(result.error)
    if (result.data.user?.id !== user.id) throw new EmailFlowError("operation_failed")
    return result.data.user
  } catch (error) { throw failure(error) }
}
