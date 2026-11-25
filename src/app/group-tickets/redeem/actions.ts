"use server"

import { createServerSupabase } from "@/lib/supabase/server"
import { GroupTicketError, redeemGroupSeat } from "@/lib/group-tickets/service"

export async function claimGroupSeat(input: unknown) {
  try { return { success: true as const, data: await redeemGroupSeat(await createServerSupabase(), input) } }
  catch (error) { return { success: false as const, code: error instanceof GroupTicketError ? error.code : "operation_failed" as const } }
}
