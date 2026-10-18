import type { SupabaseClient } from "@supabase/supabase-js"

export class AccountRequestError extends Error {
  code: "login_required" | "account_changed"
  constructor(code: "login_required" | "account_changed") {
    super(code)
    this.code = code
    this.name = "AccountRequestError"
  }
}

export async function prepareAccountRequest(auth: Pick<SupabaseClient["auth"], "getSession">, expectedUserId: string) {
  // getSession refreshes and persists an expiring browser session before a read-only server client is used.
  const { data, error } = await auth.getSession()
  if (error || !data.session) throw new AccountRequestError("login_required")
  if (data.session.user.id !== expectedUserId) throw new AccountRequestError("account_changed")
}
