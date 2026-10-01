"use server"

import { revalidatePath } from "next/cache"
import { createServerSupabase } from "@/lib/supabase/server"
import { assertSmsVerificationConfiguration } from "@/lib/registration/sms-config"
import {
  changeOwnRegistrationStatus, confirmRegistrationCode, createRegistration,
  lookupRegistrationChannel, RegistrationError, requestRegistrationCode,
  type RegistrationErrorCode, type RegistrationInput,
} from "@/lib/registration/service"

export type RegistrationActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: RegistrationErrorCode }

async function run<T>(operation: (client: Awaited<ReturnType<typeof createServerSupabase>>) => Promise<T>, needsVerifiedPhone = false): Promise<RegistrationActionResult<T>> {
  try {
    if (needsVerifiedPhone) {
      try {
        await assertSmsVerificationConfiguration(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
      } catch { throw new RegistrationError("sms_unavailable") }
    }
    return { ok: true, data: await operation(await createServerSupabase()) }
  } catch (error) {
    return { ok: false, error: error instanceof RegistrationError ? error.code : "operation_failed" }
  }
}

export async function sendRegistrationCode(phone: string) {
  return run((client) => requestRegistrationCode(client, phone), true)
}

export async function confirmRegistrationPhone(phone: string, token: string) {
  return run((client) => confirmRegistrationCode(client, phone, token), true)
}

export async function checkRegistrationChannel(code: string) {
  return run((client) => lookupRegistrationChannel(client, code))
}

export async function submitRegistration(input: RegistrationInput) {
  const result = await run((client) => createRegistration(client, input), true)
  if (result.ok) {
    revalidatePath("/register")
    revalidatePath("/profile")
    revalidatePath("/admin/registrations")
  }
  return result
}

export async function setMyRegistrationStatus(id: string, status: "confirmed" | "cancelled") {
  const result = await run((client) => changeOwnRegistrationStatus(client, id, status))
  if (result.ok) {
    revalidatePath("/profile")
    revalidatePath("/register")
    revalidatePath("/admin/registrations")
  }
  return result
}
