import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

const role = z.enum(["user", "admin"])
const account = z.object({
  id: z.uuid(), fullName: z.string(), email: z.string().nullable(), role,
  createdAt: z.string(),
})
const workspace = z.object({
  accounts: z.array(account), total: z.number().int().nonnegative(),
  page: z.number().int().positive(), pageSize: z.literal(20),
  adminCount: z.number().int().nonnegative(), currentUserId: z.uuid(),
  history: z.array(z.object({
    id: z.uuid(), actorName: z.string(), targetName: z.string(),
    targetEmail: z.string().nullable(), oldRole: role, newRole: role, createdAt: z.string(),
  })),
})
const filters = z.object({
  query: z.string().trim().max(200).default(""),
  role: z.enum(["all", "user", "admin"]).default("all"),
  page: z.number().int().min(1).max(100000).default(1),
})
const edit = z.object({ id: z.uuid(), role, expectedRole: role })

export type AccountRole = z.infer<typeof role>
export type ManagedAccount = z.infer<typeof account>
export type AccountWorkspace = z.infer<typeof workspace>
export type AccountFilters = z.input<typeof filters>
export type AccountRoleEdit = z.infer<typeof edit>
export type AccountErrorCode = "invalid" | "forbidden" | "conflict" | "last_admin" | "self_revoke" | "not_found" | "failed"

export class AccountManagementError extends Error {
  code: AccountErrorCode
  constructor(code: AccountErrorCode) {
    super("Account management request failed")
    this.code = code
  }
}

function databaseError(error: { message?: string }) {
  const codes: Record<string, AccountErrorCode> = {
    ACCOUNT_FORBIDDEN: "forbidden", ACCOUNT_ROLE_CONFLICT: "conflict", ACCOUNT_LAST_ADMIN: "last_admin",
    ACCOUNT_SELF_REVOKE: "self_revoke", ACCOUNT_NOT_FOUND: "not_found", ACCOUNT_INVALID: "invalid",
  }
  return new AccountManagementError(codes[error.message ?? ""] ?? "failed")
}

// Keep provider-specific calls here; pages depend only on business roles and account DTOs.
export async function loadManagedAccounts(client: Pick<SupabaseClient, "rpc">, input: AccountFilters) {
  const parsed = filters.safeParse(input)
  if (!parsed.success) throw new AccountManagementError("invalid")
  const { query, role, page } = parsed.data
  const { data, error } = await client.rpc("list_managed_accounts", { p_query: query, p_role: role, p_page: page })
  if (error) throw databaseError(error)
  const result = workspace.safeParse(data)
  if (!result.success) throw new AccountManagementError("failed")
  return result.data
}

export async function changeManagedAccountRole(client: Pick<SupabaseClient, "rpc">, input: AccountRoleEdit) {
  const parsed = edit.safeParse(input)
  if (!parsed.success) throw new AccountManagementError("invalid")
  const { id, role, expectedRole } = parsed.data
  const { data, error } = await client.rpc("change_managed_account_role", { p_account_id: id, p_role: role, p_expected_role: expectedRole })
  if (error) throw databaseError(error)
  const result = z.object({ id: z.uuid(), role: z.enum(["user", "admin"]), changed: z.boolean() }).safeParse(data)
  if (!result.success || result.data.id !== id || result.data.role !== role) throw new AccountManagementError("failed")
  return result.data
}
