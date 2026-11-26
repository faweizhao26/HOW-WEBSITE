import type { SupabaseClient } from "@supabase/supabase-js"
import type { ProposalDecision } from "./db/schema.ts"
import { cfp as reviewLabels } from "./i18n/translations.ts"

export const proposalDecisions = ["approved","waitlisted","rejected"] as const satisfies readonly ProposalDecision[]
export const audiences = ["all","not_registered","registered",...proposalDecisions,"manual"] as const
export const topicTypes = ["talk","workshop","panel","lightning"] as const
export type Audience = typeof audiences[number]
export type NotificationFilter = { audience: Audience; mode: "general" | "result"; query?: string; ids?: string[]; type?: typeof topicTypes[number]; language?: "zh" | "en" }
export type Recipient = { id: string; account_id: string; name: string; email: string | null; proposal_title: string | null; proposal_status: ProposalDecision | null; proposal_type: typeof topicTypes[number] | null; proposal_duration: number | null; proposal_language: string | null }
export type NotificationPreview = { count: number; accounts: number; token: string; rows: Recipient[]; offset: number }
export type NotificationHistory = { id: string; title: string; created_at: string; count: number; mode: NotificationFilter["mode"]; audience: Audience }
export type InboxRow = { id: string; title: string; body: string; created_at: string; read_at: string | null; proposal_title: string | null; proposal_status: ProposalDecision | null }
export type Inbox = { unread: number; total: number; rows: InboxRow[] }
export const notificationReadEvent = "how-notification-read"
export const notificationPageSize = 30

export function isProposalDecision(value: string | null): value is ProposalDecision {
  return proposalDecisions.some(status => status === value)
}

export function proposalDecisionLabel(status: ProposalDecision | null, locale: "zh" | "en"): string {
  return isProposalDecision(status) ? reviewLabels[status][locale] : ""
}

export async function notificationRpc<T>(client: SupabaseClient, method: "preview" | "export" | "send" | "history" | "inbox" | "read" | "unread", args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.rpc(`notification_${method}`, args)
  if (error || data == null) throw new Error(error?.message || "NOTIFICATION_FAILED")
  return data as T
}

function escapeCell(value: unknown) {
  let text = String(value ?? "")
  if (/^[\t\r\n]|^\s*[=+@-]/.test(text)) text = "'" + text
  return `"${text.replaceAll('"', '""')}"`
}

export function notificationCsv(rows: readonly Recipient[], mode: NotificationFilter["mode"], zh: boolean) {
  const headers = zh ? ["姓名","邮箱"] : ["Name","Email"]
  if (mode === "result") headers.push(...(zh ? ["议题标题","审核结果","类型","时长（分钟）"] : ["Proposal","Decision","Type","Minutes"]))
  const result = rows.filter(row => row.email).map(row => mode === "result" ? [
    row.name,row.email,row.proposal_title,
    proposalDecisionLabel(row.proposal_status, zh ? "zh" : "en"),
    row.proposal_type ? topicLabels[row.proposal_type][zh ? 0 : 1] : "",row.proposal_duration,
  ] : [row.name,row.email])
  return { count: result.length, csv: "\uFEFF" + [headers,...result].map(row => row.map(escapeCell).join(",")).join("\r\n") }
}

export const audienceLabels: Record<Audience, [string,string]> = {
  all: ["所有注册账号","All accounts"],
  not_registered: ["尚未确认参会","Without confirmed registration"],
  registered: ["已确认参会","Confirmed attendees"],
  approved: ["已录取的提案","Accepted proposals"],
  waitlisted: ["候补提案","Waitlisted proposals"],
  rejected: ["未录取的提案","Declined proposals"],
  manual: ["手动选择账号","Manually selected accounts"],
}

export const topicLabels: Record<typeof topicTypes[number], [string,string]> = {
  talk: ["普通演讲","Talk"], workshop: ["工作坊","Workshop"], panel: ["圆桌讨论","Panel"], lightning: ["闪电演讲","Lightning talk"],
}
