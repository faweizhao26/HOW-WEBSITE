import type { SupabaseClient, User } from "@supabase/supabase-js"
import { parsePhoneNumberFromString } from "libphonenumber-js/max"
import { z } from "zod"

export type RegistrationErrorCode =
  | "login_required" | "invalid_phone" | "phone_not_verified" | "email_not_verified"
  | "invalid_code" | "rate_limited" | "sms_unavailable" | "phone_in_use"
  | "invalid_input" | "invalid_channel" | "already_registered" | "not_found" | "operation_failed"

export class RegistrationError extends Error {
  code: RegistrationErrorCode
  constructor(code: RegistrationErrorCode) {
    super(code)
    this.name = "RegistrationError"
    this.code = code
  }
}

export function normalizeRegistrationPhone(value: string): string {
  const phone = typeof value === "string" && value.length <= 64
    ? parsePhoneNumberFromString(value.trim(), "CN") : undefined
  if (!phone?.isValid()) throw new RegistrationError("invalid_phone")
  return phone.number
}

export function hasVerifiedRegistrationPhone(user: Pick<User, "phone" | "phone_confirmed_at">, phone: string): boolean {
  return Boolean(user.phone_confirmed_at && user.phone && user.phone.replace(/^\+/, "") === phone.replace(/^\+/, ""))
}

async function authenticatedUser(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) throw new RegistrationError("login_required")
  return data.user
}

function authFailure(error: { code?: string; status?: number }, fallback: RegistrationErrorCode): never {
  if (error.status === 429 || error.code?.includes("rate_limit")) throw new RegistrationError("rate_limited")
  if (error.code === "phone_exists") throw new RegistrationError("phone_in_use")
  throw new RegistrationError(fallback)
}

export async function requestRegistrationCode(client: SupabaseClient, rawPhone: string) {
  const phone = normalizeRegistrationPhone(rawPhone)
  const user = await authenticatedUser(client)
  if (hasVerifiedRegistrationPhone(user, phone)) return { phone, verified: true }
  const { error } = await client.auth.updateUser({ phone })
  if (error) authFailure(error, "sms_unavailable")
  return { phone, verified: false }
}

export async function confirmRegistrationCode(client: SupabaseClient, rawPhone: string, token: string) {
  const phone = normalizeRegistrationPhone(rawPhone)
  if (typeof token !== "string" || !/^\d{6}$/.test(token)) throw new RegistrationError("invalid_code")
  const currentUser = await authenticatedUser(client)
  if (currentUser.new_phone?.replace(/^\+/, "") !== phone.replace(/^\+/, ""))
    throw new RegistrationError("invalid_code")
  const { data, error } = await client.auth.verifyOtp({ phone, token, type: "phone_change" })
  if (error) authFailure(error, "invalid_code")
  if (data.user && data.user.id !== currentUser.id) {
    // verifyOtp saves the returned session before the caller can inspect its user.
    await client.auth.signOut({ scope: "local" })
    throw new RegistrationError("invalid_code")
  }
  if (!data.user || !hasVerifiedRegistrationPhone(data.user, phone))
    throw new RegistrationError("invalid_code")
  return { phone, verified: true }
}

const registrationInput = z.object({
  name: z.string().trim().min(1).max(128),
  phone: z.string().max(64).transform(normalizeRegistrationPhone),
  ticketTypeId: z.uuid(),
  channelCode: z.string().trim().max(128).optional().default(""),
  company: z.string().trim().max(200).optional().default(""),
  position: z.string().trim().max(200).optional().default(""),
}).strict()

export type RegistrationInput = z.input<typeof registrationInput>

export function parseRegistrationInput(input: unknown) {
  const result = registrationInput.safeParse(input)
  if (!result.success) throw new RegistrationError("invalid_input")
  return result.data
}

export async function createRegistration(client: SupabaseClient, input: unknown) {
  const values = parseRegistrationInput(input)
  const user = await authenticatedUser(client)
  if (!user.email || !user.email_confirmed_at) throw new RegistrationError("email_not_verified")
  if (!hasVerifiedRegistrationPhone(user, values.phone)) throw new RegistrationError("phone_not_verified")
  const { data, error } = await client.from("registrations").insert({
    user_id: user.id,
    ticket_type_id: values.ticketTypeId,
    channel_code: values.channelCode || null,
    name: values.name,
    email: user.email,
    phone: values.phone,
    company: values.company || null,
    position: values.position || null,
    status: "confirmed",
    checked_in: false,
    checked_in_at: null,
  }).select("id").single()
  if (error?.code === "23505") throw new RegistrationError("already_registered")
  if (error || !data) throw new RegistrationError("operation_failed")
  return { id: data.id as string }
}

export async function lookupRegistrationChannel(client: SupabaseClient, code: string) {
  await authenticatedUser(client)
  const result = z.string().trim().min(1).max(128).safeParse(code)
  if (!result.success) throw new RegistrationError("invalid_channel")
  const { data, error } = await client.rpc("registration_channel_ticket", { p_code: result.data })
  if (error || typeof data !== "string") throw new RegistrationError("invalid_channel")
  return { ticketTypeId: data }
}

export async function changeOwnRegistrationStatus(client: SupabaseClient, id: string, status: "confirmed" | "cancelled") {
  if (!z.uuid().safeParse(id).success || !["confirmed", "cancelled"].includes(status))
    throw new RegistrationError("invalid_input")
  const user = await authenticatedUser(client)
  const { data, error } = await client.from("registrations").update({ status })
    .eq("id", id).eq("user_id", user.id).select("id,status").maybeSingle()
  if (error) throw new RegistrationError("operation_failed")
  if (!data) throw new RegistrationError("not_found")
  return { id: data.id as string, status: data.status as "confirmed" | "cancelled" }
}
