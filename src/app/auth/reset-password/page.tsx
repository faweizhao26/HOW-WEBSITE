import { createServerSupabase } from "@/lib/supabase/server"
import { safeAuthRedirect } from "@/lib/auth/redirect"
import type { EmailErrorCode } from "@/lib/auth/email"
import ResetPasswordForm from "./reset-password-form"

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ redirect?: string; error?: string }> }) {
  const params = await searchParams
  let userId: string | null = null
  let error: EmailErrorCode | null = params.error ? "auth_failed" : null
  if (!error) {
    try {
      const result = await (await createServerSupabase()).auth.getUser()
      if (result.error && result.error.name !== "AuthSessionMissingError") error = "operation_failed"
      else if (!result.data.user?.email_confirmed_at) error = "session_expired"
      else userId = result.data.user.id
    } catch { error = "operation_failed" }
  }
  return <ResetPasswordForm userId={userId} initialError={error} redirect={safeAuthRedirect(params.redirect)} />
}
