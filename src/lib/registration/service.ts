import type { SupabaseClient, User } from "@supabase/supabase-js"
import { parsePhoneNumberFromString } from "libphonenumber-js/max"
import { z } from "zod"

export type RegistrationErrorCode = "login_required" | "email_not_verified" | "invalid_input" | "invalid_phone" | "invalid_ticket" | "invalid_channel" | "already_registered" | "load_failed" | "operation_failed"

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
    ? parsePhoneNumberFromString(value.trim(), { defaultCountry: "CN", extract: false }) : undefined
  if (!phone?.isValid() || phone.ext) throw new RegistrationError("invalid_phone")
  return phone.number
}

const inputSchema = z.object({
  name: z.string().trim().min(1).max(128),
  email: z.email().trim().max(254),
  phone: z.string().trim().min(1).max(64),
  ticketTypeId: z.uuid(),
  channelCode: z.string().trim().max(128).optional().default(""),
  company: z.string().trim().max(200).optional().default(""),
  position: z.string().trim().max(200).optional().default(""),
}).strict()
export type RegistrationInput = z.input<typeof inputSchema>

export function parseRegistrationInput(input: unknown) {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) throw new RegistrationError("invalid_input")
  return { ...parsed.data, phone: normalizeRegistrationPhone(parsed.data.phone) }
}

export type RegistrationTicket = {
  id: string; name: string; name_zh: string | null
  description: string | null; description_zh: string | null
  is_free: boolean; requires_code: boolean; is_active: boolean
}
export type RegistrationSummary = { id: string; status: "confirmed" | "cancelled" }
export type RegistrationData = {
  user: User | null; tickets: RegistrationTicket[]
  profile: { full_name: string | null; phone: string | null; company: string | null } | null
  registration: RegistrationSummary | null
}

async function authenticatedUser(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) throw new RegistrationError("login_required")
  return data.user
}

export async function loadRegistrationData(client: SupabaseClient): Promise<RegistrationData> {
  const [auth, tickets] = await Promise.all([
    client.auth.getUser(),
    client.from("ticket_types").select("id,name,name_zh,description,description_zh,is_free,requires_code,is_active").eq("is_active", true).order("sort_order"),
  ])
  if (tickets.error || (auth.error && auth.error.name !== "AuthSessionMissingError")) throw new RegistrationError("load_failed")
  const user = auth.data.user
  if (!user) return { user: null, tickets: tickets.data || [], profile: null, registration: null }
  const [profile, registration] = await Promise.all([
    client.from("profiles").select("full_name,phone,company").eq("id", user.id).maybeSingle(),
    client.from("registrations").select("id,status").eq("user_id", user.id).maybeSingle(),
  ])
  if (profile.error || registration.error) throw new RegistrationError("load_failed")
  return { user, tickets: tickets.data || [], profile: profile.data, registration: registration.data }
}

export async function lookupRegistrationChannel(client: SupabaseClient, code: string) {
  await authenticatedUser(client)
  const parsed = z.string().trim().min(1).max(128).safeParse(code)
  if (!parsed.success) throw new RegistrationError("invalid_channel")
  const { data, error } = await client.rpc("registration_channel_ticket", { p_code: parsed.data })
  if (error) throw new RegistrationError("operation_failed")
  if (typeof data !== "string") throw new RegistrationError("invalid_channel")
  return { ticketTypeId: data }
}

export async function createRegistration(client: SupabaseClient, input: unknown) {
  const user = await authenticatedUser(client)
  const values = parseRegistrationInput(input)
  if (values.email.toLowerCase() !== user.email?.toLowerCase()) throw new RegistrationError("invalid_input")
  if (!user.email_confirmed_at) throw new RegistrationError("email_not_verified")
  const ticket = await client.from("ticket_types").select("id,name,name_zh,is_active,requires_code").eq("id", values.ticketTypeId).eq("is_active", true).maybeSingle()
  if (ticket.error) throw new RegistrationError("load_failed")
  if (!ticket.data?.is_active) throw new RegistrationError("invalid_ticket")
  if (ticket.data.requires_code && !values.channelCode) throw new RegistrationError("invalid_channel")
  if (values.channelCode) {
    const { data, error } = await client.rpc("registration_ticket_available", { p_ticket_id: values.ticketTypeId, p_code: values.channelCode })
    if (error) throw new RegistrationError("operation_failed")
    if (data !== true) throw new RegistrationError("invalid_channel")
  }
  const existing = await client.from("registrations").select("id").eq("user_id", user.id).maybeSingle()
  if (existing.error) throw new RegistrationError("load_failed")
  if (existing.data) throw new RegistrationError("already_registered")
  const { data, error } = await client.from("registrations").insert({
    user_id: user.id, ticket_type_id: values.ticketTypeId, channel_code: values.channelCode || null,
    name: values.name, email: user.email, phone: values.phone,
    company: values.company || null, position: values.position || null,
    status: "confirmed", checked_in: false, checked_in_at: null,
  }).select("id").single()
  if (error?.code === "23505") throw new RegistrationError("already_registered")
  if (error || !data) throw new RegistrationError("operation_failed")
  return { id: data.id as string, ticketName: ticket.data.name as string, ticketNameZh: ticket.data.name_zh as string | null }
}
