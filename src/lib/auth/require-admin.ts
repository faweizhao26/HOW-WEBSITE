import "server-only"

import { createServerSupabase } from "@/lib/supabase/server"

export class AdminAuthorizationError extends Error {
  constructor() {
    super("Administrator authorization required")
    this.name = "AdminAuthorizationError"
  }
}

export async function requireAdmin() {
  const supabase = await createServerSupabase()
  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError || !authData.user) throw new AdminAuthorizationError()

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .single()

  if (profileError || profile?.role !== "admin") throw new AdminAuthorizationError()

  return authData.user.id
}
