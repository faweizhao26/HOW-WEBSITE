import type { SupabaseClient, User } from "@supabase/supabase-js"
import { z } from "zod"

export type CFPErrorCode = "login_required" | "email_not_verified" | "invalid_input" | "load_failed" | "operation_failed" | "request_conflict" | "account_changed"
export class CFPError extends Error {
  code: CFPErrorCode
  constructor(code: CFPErrorCode) { super(code); this.name = "CFPError"; this.code = code }
}

const inputSchema = z.object({
  requestId: z.uuid(),
  expectedUserId: z.uuid(),
  title: z.string().trim().min(1).max(200),
  titleZh: z.string().trim().max(200).optional().default(""),
  abstract: z.string().trim().min(1).max(10000),
  abstractZh: z.string().trim().max(10000).optional().default(""),
  duration: z.number().int().refine(value => [15, 30, 45, 60].includes(value)),
  type: z.enum(["talk", "workshop", "panel"]),
}).strict()

export function parseProposalInput(input: unknown) {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) throw new CFPError("invalid_input")
  return parsed.data
}

export type Proposal = {
  id: string; title: string; title_zh: string | null; abstract: string; abstract_zh: string | null
  duration: number; type: "talk" | "workshop" | "panel"
  status: "pending" | "approved" | "rejected"; admin_feedback: string | null; created_at: string
}
export type CFPData = { user: User | null; sessions: Proposal[] }
const columns = "id,user_id,title,title_zh,abstract,abstract_zh,duration,type,status,admin_feedback,created_at"

export async function loadCFPData(client: SupabaseClient): Promise<CFPData> {
  try {
    const { data: { user }, error } = await client.auth.getUser()
    if (error && error.name !== "AuthSessionMissingError") throw new CFPError("load_failed")
    if (!user) return { user: null, sessions: [] }
    const sessions = await client.from("sessions").select(columns).eq("user_id", user.id).order("created_at", { ascending: false })
    if (sessions.error || !sessions.data) throw new CFPError("load_failed")
    return { user, sessions: sessions.data }
  } catch { throw new CFPError("load_failed") }
}

export async function submitProposal(client: SupabaseClient, input: unknown): Promise<Proposal> {
  const { data: { user }, error: authError } = await client.auth.getUser()
  if (authError || !user) throw new CFPError("login_required")
  if (!user.email_confirmed_at) throw new CFPError("email_not_verified")
  const values = parseProposalInput(input)
  if (values.expectedUserId !== user.id) throw new CFPError("account_changed")
  const fields = { user_id: user.id, title: values.title, title_zh: values.titleZh || null,
    abstract: values.abstract, abstract_zh: values.abstractZh || null, duration: values.duration, type: values.type }
  async function existingProposal() {
    const result = await client.from("sessions").select(columns).eq("id", values.requestId).eq("user_id", fields.user_id).maybeSingle()
    if (result.error) throw new CFPError("operation_failed")
    if (!result.data) return null
    const row = result.data
    if (row.id !== values.requestId || (Object.keys(fields) as (keyof typeof fields)[]).some(key => row[key] !== fields[key])) throw new CFPError("request_conflict")
    return row as Proposal
  }
  const existing = await existingProposal()
  if (existing) return existing
  const { data, error } = await client.from("sessions").insert({
    id: values.requestId, ...fields, status: "pending", publication_status: "draft",
  }).select(columns).single()
  // A write can commit before its response is lost. Recover only this owner's matching request.
  if (error) {
    const recovered = await existingProposal()
    if (recovered) return recovered
    throw new CFPError("operation_failed")
  }
  if (!data?.id || data.id !== values.requestId) throw new CFPError("operation_failed")
  return data as Proposal
}
