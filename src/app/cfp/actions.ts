"use server"

import { createServerSupabase } from "@/lib/supabase/server"
import { CFPError, submitProposal } from "@/lib/cfp/service"
import type { CFPErrorCode, Proposal } from "@/lib/cfp/service"

export async function submitCFP(input: unknown): Promise<{ success: true; data: Proposal } | { success: false; code: CFPErrorCode }> {
  try { return { success: true, data: await submitProposal(await createServerSupabase(), input) } }
  catch (error) { return { success: false, code: error instanceof CFPError ? error.code : "operation_failed" } }
}
