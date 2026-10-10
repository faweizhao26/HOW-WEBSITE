"use server"

import { createServerSupabase } from "@/lib/supabase/server"
import { EmailFlowError, resetAccountPassword } from "@/lib/auth/email"
import type { EmailErrorCode } from "@/lib/auth/email"

export async function updateAccountPassword(input: unknown): Promise<{ success: true } | { success: false; code: EmailErrorCode }> {
  try {
    // Password updates must not overwrite a newer account's browser cookies.
    await resetAccountPassword(await createServerSupabase({ writeCookies: false }), input)
    return { success: true }
  } catch (error) { return { success: false, code: error instanceof EmailFlowError ? error.code : "operation_failed" } }
}
