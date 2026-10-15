"use server"

import { requireAdmin } from "@/lib/auth/require-admin"
import { createServerSupabase } from "@/lib/supabase/server"
import {
  AccountManagementError, changeManagedAccountRole, loadManagedAccounts,
  type AccountErrorCode, type AccountFilters, type AccountRoleEdit,
} from "@/lib/admin/accounts"

type Result<T> = { ok: true; data: T } | { ok: false; code: AccountErrorCode }

async function authorized<T>(run: () => Promise<T>): Promise<Result<T>> {
  try { await requireAdmin() }
  catch { return { ok: false, code: "forbidden" } }
  try { return { ok: true, data: await run() } }
  catch (error) { return { ok: false, code: error instanceof AccountManagementError ? error.code : "failed" } }
}

export async function listAccounts(filters: AccountFilters) {
  return authorized(async () => loadManagedAccounts(await createServerSupabase(), filters))
}

export async function updateAccountRole(edit: AccountRoleEdit) {
  return authorized(async () => changeManagedAccountRole(await createServerSupabase(), edit))
}
