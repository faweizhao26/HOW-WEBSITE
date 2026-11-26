import type { SupabaseClient, User } from "@supabase/supabase-js"
import { z } from "zod"
import { cfpDurationOptions, cfpSessionTypes, getCFPState, parseCFPSettings } from "./settings.ts"
import type { CFPPolicy, CFPType } from "./settings.ts"
import type { ProposalReviewStatus } from "../db/schema.ts"

export type CFPErrorCode = "login_required" | "email_not_verified" | "invalid_input" | "load_failed" | "operation_failed" | "request_conflict" | "account_changed" | "cfp_closed" | "cfp_options_changed"
export class CFPError extends Error {
  code: CFPErrorCode
  constructor(code: CFPErrorCode) { super(code); this.name = "CFPError"; this.code = code }
}

const detailsSchema = z.object({
  language: z.enum(["en","zh"]),
  full_name: z.string().trim().min(1).max(128),
  company: z.string().trim().min(1).max(200),
  position: z.string().trim().min(1).max(200),
  bio: z.string().trim().min(1).max(4000),
  outline: z.string().trim().max(6000),
  photo_url: z.string().max(2048).url().nullable(),
}).strict()
export type ProposalDetails = z.infer<typeof detailsSchema>

const inputSchema = z.object({
  requestId: z.uuid(),
  expectedUserId: z.uuid(),
  title: z.string().trim().min(1).max(200),
  titleZh: z.string().trim().max(200).optional().default(""),
  abstract: z.string().trim().min(1).max(10000),
  abstractZh: z.string().trim().max(10000).optional().default(""),
  duration: z.number().int().refine(value => [5, 15, 30, 45, 60].includes(value)),
  type: z.enum(cfpSessionTypes),
  proposalDetails: detailsSchema.optional(),
}).strict().refine(value => value.proposalDetails ? (
  cfpDurationOptions[value.type].includes(value.duration) && (value.type === "lightning" || value.proposalDetails.outline.length > 0)
  && !value.titleZh && !value.abstractZh
) : value.type !== "lightning" && value.duration !== 5)

export function parseProposalInput(input: unknown) {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) throw new CFPError("invalid_input")
  return parsed.data
}

export type Proposal = {
  id: string; title: string; title_zh: string | null; abstract: string; abstract_zh: string | null
  duration: number; type: CFPType
  proposal_details?: ProposalDetails | null
  status: ProposalReviewStatus; admin_feedback: string | null; created_at: string
}
export type CFPData = { user: User | null; sessions: Proposal[]; policy: CFPPolicy | null; speaker?: {
  full_name: string; company: string | null; bio: string | null; bio_zh: string | null; avatar_url: string | null
} | null }
const columns = "id,user_id,title,title_zh,abstract,abstract_zh,duration,type,status,admin_feedback,created_at,proposal_details"

async function readPolicy(client: SupabaseClient): Promise<CFPPolicy> {
  const result = await client.from("site_settings_releases").select("payload").eq("is_current", true).maybeSingle()
  if (result.error || !result.data?.payload) throw new Error("settings_unavailable")
  return parseCFPSettings(result.data.payload)
}

export async function loadCFPData(client: SupabaseClient): Promise<CFPData> {
  try {
    const { data: { user }, error } = await client.auth.getUser()
    if (error && error.name !== "AuthSessionMissingError") throw new CFPError("load_failed")
    if (!user) return { user: null, sessions: [], policy: null }
    const [policy, sessions, profile] = await Promise.all([
      readPolicy(client),
      client.from("sessions").select(columns).eq("user_id", user.id).order("created_at", { ascending: false }),
      Promise.resolve().then(() => client.from("profiles").select("full_name,company,bio,bio_zh,avatar_url").eq("id", user.id).maybeSingle()).catch(() => null),
    ])
    if (sessions.error || !sessions.data) throw new CFPError("load_failed")
    return { user, sessions: sessions.data, policy, speaker: profile?.error ? null : profile?.data ?? null }
  } catch { throw new CFPError("load_failed") }
}

export async function submitProposal(client: SupabaseClient, input: unknown, requireDetails = false): Promise<Proposal> {
  const { data: { user }, error: authError } = await client.auth.getUser()
  if (authError || !user) throw new CFPError("login_required")
  if (!user.email_confirmed_at) throw new CFPError("email_not_verified")
  const values = parseProposalInput(input)
  if (values.expectedUserId !== user.id) throw new CFPError("account_changed")
  if (values.proposalDetails?.photo_url && !ownedProposalPhoto(values.proposalDetails.photo_url,user.id)) throw new CFPError("invalid_input")
  const fields = { user_id: user.id, title: values.title, title_zh: values.titleZh || null,
    abstract: values.abstract, abstract_zh: values.abstractZh || null, duration: values.duration, type: values.type }
  async function existingProposal() {
    const result = await client.from("sessions").select(columns).eq("id", values.requestId).eq("user_id", fields.user_id).maybeSingle()
    if (result.error) throw new CFPError("operation_failed")
    if (!result.data) return null
    const row = result.data as unknown as Proposal & { user_id: string }
    if (row.id !== values.requestId || (Object.keys(fields) as (keyof typeof fields)[]).some(key => row[key] !== fields[key])) throw new CFPError("request_conflict")
    const details = values.proposalDetails
    if (details && (!row.proposal_details || (Object.keys(details) as (keyof ProposalDetails)[]).some(key => row.proposal_details?.[key] !== details[key]))) throw new CFPError("request_conflict")
    return row as Proposal
  }
  const existing = await existingProposal()
  if (existing) return existing
  if (requireDetails && !values.proposalDetails) throw new CFPError("invalid_input")
  let policy: CFPPolicy
  try { policy = await readPolicy(client) } catch { throw new CFPError("operation_failed") }
  if (getCFPState(policy) !== "open") throw new CFPError("cfp_closed")
  if (!policy.sessionTypes.includes(values.type) || (!values.proposalDetails && !policy.durations.includes(values.duration as 15 | 30 | 45 | 60))) throw new CFPError("cfp_options_changed")
  const { data, error } = await client.from("sessions").insert({
    id: values.requestId, ...fields, status: "pending", publication_status: "draft",
    ...(values.proposalDetails ? { proposal_details:values.proposalDetails } : {}),
  }).select(columns).single()
  // A write can commit before its response is lost. Recover only this owner's matching request.
  if (error) {
    const recovered = await existingProposal()
    if (recovered) return recovered
    if (error.message === "cfp_closed") throw new CFPError("cfp_closed")
    if (error.message === "cfp_option_not_allowed") throw new CFPError("cfp_options_changed")
    throw new CFPError("operation_failed")
  }
  if (!data?.id || data.id !== values.requestId) throw new CFPError("operation_failed")
  return data as Proposal
}

export function ownedProposalPhoto(value: string, userId: string) {
  try {
    const url = new URL(value)
    const expected = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!)
    const prefix = `/storage/v1/object/public/conference-media/avatars/${userId}/`
    return url.origin === expected.origin && !url.username && !url.password && !url.search && !url.hash
      && url.pathname.startsWith(prefix) && /^[a-zA-Z0-9._-]+$/.test(url.pathname.slice(prefix.length))
  } catch { return false }
}

export async function uploadProposalPhoto(client: SupabaseClient, userId: string, file: File) {
  const extension = ({ "image/jpeg":"jpg","image/png":"png","image/webp":"webp" })[file.type]
  if (!extension || file.size > 5 * 1024 * 1024 || !file.size) throw new CFPError("invalid_input")
  const { data: { user } } = await client.auth.getUser()
  if (user?.id !== userId || !user.email_confirmed_at) throw new CFPError("account_changed")
  const bucket = client.storage.from("conference-media")
  const path = `avatars/${userId}/cfp-${crypto.randomUUID()}.${extension}`
  if ((await bucket.upload(path,file,{contentType:file.type})).error) throw new CFPError("operation_failed")
  return bucket.getPublicUrl(path).data.publicUrl
}
