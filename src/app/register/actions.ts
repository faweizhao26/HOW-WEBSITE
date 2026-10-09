"use server"

import { createServerSupabase } from "@/lib/supabase/server"
import { createRegistration, lookupRegistrationChannel, RegistrationError } from "@/lib/registration/service"
import type { RegistrationErrorCode } from "@/lib/registration/service"

type ActionResult<T> = { success: true; data: T } | { success: false; code: RegistrationErrorCode }
async function run<T>(operation: () => Promise<T>): Promise<ActionResult<T>> {
  try { return { success: true, data: await operation() } }
  catch (error) { return { success: false, code: error instanceof RegistrationError ? error.code : "operation_failed" } }
}

export async function submitRegistration(input: unknown) {
  return run(async () => createRegistration(await createServerSupabase(), input))
}

export async function checkRegistrationChannel(code: string) {
  return run(async () => lookupRegistrationChannel(await createServerSupabase(), code))
}
