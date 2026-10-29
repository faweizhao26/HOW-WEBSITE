import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { normalizeRegistrationPhone } from "../registration/service.ts"
import type { GroupWorkspace, GroupOrderDetail } from "./types.ts"

const errors = {
  invalid_input: ["填写内容有误，请检查人数、金额和必填项。", "Check the quantity, amount and required fields."],
  login_required: ["请先登录。", "Please sign in first."],
  email_not_verified: ["请先验证账号邮箱。", "Verify your account email first."],
  account_changed: ["登录账号已变化，请刷新后重试。", "Your account changed. Refresh before continuing."],
  forbidden: ["没有权限操作这笔订单。", "You do not have permission to manage this order."],
  group_unavailable: ["该团体票暂未开放或已过领取期限。", "This group ticket is unavailable or its claim deadline has passed."],
  invalid_state: ["订单状态已变化，请刷新后确认。", "The order status changed. Refresh to check it."],
  code_unavailable: ["兑换码无效、已使用、已作废或已过期。", "The code is invalid, used, revoked or expired."],
  already_registered: ["当前账号已有报名记录，请先在个人中心核对。", "This account already has a registration. Check your profile first."],
  payment_mismatch: ["实收金额必须与订单金额一致，且付款凭证不可重复使用。", "The received amount must match the order and the payment reference must be unique."],
  ticket_in_use: ["请选择尚无个人报名记录的独立团体票种。", "Choose a dedicated ticket type without existing individual registrations."],
  ticket_kind_locked: ["团体票不能改回个人票，请新建个人票种。", "A group ticket cannot become an individual ticket. Create a new ticket instead."],
  ticket_has_channels: ["该票种已关联渠道码，请新建独立团体票种。", "This ticket has channel codes. Create a dedicated group ticket instead."],
  too_many_orders: ["待处理订单过多，请先取消或处理已有订单。", "Resolve or cancel existing pending orders first."],
  invalid_phone: ["请输入有效的手机号码。", "Enter a valid phone number."],
  operation_failed: ["操作未能确认，请刷新核对后重试。", "The operation could not be confirmed. Refresh to check before retrying."],
} as const
export type GroupTicketErrorCode = keyof typeof errors
export class GroupTicketError extends Error {
  code: GroupTicketErrorCode
  constructor(code: GroupTicketErrorCode) { super(code); this.name = "GroupTicketError"; this.code = code }
}
export function groupErrorMessage(error: unknown, locale: "zh" | "en") {
  return errors[error instanceof GroupTicketError ? error.code : "operation_failed"][locale === "zh" ? 0 : 1]
}
const actor = z.object({ expectedUserId: z.uuid() })
const order = actor.extend({ orderId: z.uuid() }).strict()
const groupFields = z.object({ enabled: z.boolean(), minSize: z.number().int().min(2).max(100), maxSize: z.number().int().min(2).max(100), unitPriceCents: z.number().int().min(0).max(100000000), claimDeadline: z.iso.datetime({ offset: true }).nullable() }).strict()
const config = actor.extend({ ticketTypeId: z.uuid(), ...groupFields.shape }).strict().refine(v => v.minSize <= v.maxSize)
const groupRules = groupFields.refine(v => v.minSize <= v.maxSize)
const ticketFields = actor.extend({ ticketTypeId: z.uuid(), name: z.string().trim().min(1).max(200), nameZh: z.string().trim().max(200), description: z.string().trim().max(5000), descriptionZh: z.string().trim().max(5000), active: z.boolean(), sortOrder: z.number().int().min(0).max(9999) })
const ticketSettings = z.discriminatedUnion("kind", [
  ticketFields.extend({ kind: z.literal("individual"), isFree: z.boolean(), requiresCode: z.boolean() }).strict(),
  ticketFields.extend({ kind: z.literal("group"), group: groupRules }).strict(),
])
export type AdminTicketSettings = z.infer<typeof ticketSettings>
const creation = actor.extend({ requestId: z.uuid(), ticketTypeId: z.uuid(), quantity: z.number().int().min(2).max(100), teamName: z.string().trim().min(1).max(200) }).strict()
const activation = order.extend({ paymentReference: z.string().trim().min(1).max(200), receivedCents: z.number().int().min(0).max(10000000000) }).strict()
const closure = order.extend({ reason: z.string().trim().min(1).max(500) }).strict()
const rotation = actor.extend({ seatId: z.uuid() }).strict()
const redemption = actor.extend({ code: z.string().trim().regex(/^HOWG-[a-f0-9]{48}$/i).transform(v => v.toUpperCase()), name: z.string().trim().min(1).max(128), phone: z.string().trim().max(64), company: z.string().trim().max(200).default(""), position: z.string().trim().max(200).default("") }).strict()
function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const value = schema.safeParse(input)
  if (!value.success) throw new GroupTicketError("invalid_input")
  return value.data
}
async function user(client: SupabaseClient, expected?: string, verified = false) {
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) throw new GroupTicketError("login_required")
  if (expected !== undefined && data.user.id !== expected) throw new GroupTicketError("account_changed")
  if (verified && !data.user.email_confirmed_at) throw new GroupTicketError("email_not_verified")
  return data.user.id
}
async function rpc<T>(client: SupabaseClient, name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.rpc(name, args)
  if (error) {
    const code = Object.hasOwn(errors, error.message) ? error.message as GroupTicketErrorCode : error.code === "42501" ? "forbidden" : "operation_failed"
    throw new GroupTicketError(code)
  }
  if (data === null || data === undefined) throw new GroupTicketError("operation_failed")
  return data as T
}
export async function loadGroupWorkspace(client: SupabaseClient, admin = false, page = 0, search = ""): Promise<GroupWorkspace> {
  await user(client)
  if (!Number.isInteger(page) || page < 0 || page > 10000 || search.length > 200) throw new GroupTicketError("invalid_input")
  return rpc(client, "group_ticket_workspace", { p_admin: admin, p_page: page, p_search: search.trim() })
}
export async function loadGroupOrder(client: SupabaseClient, orderId: string): Promise<GroupOrderDetail> {
  await user(client)
  return rpc(client, "group_order_detail", { p_order_id: parse(z.uuid(), orderId) })
}
export async function saveGroupConfig(client: SupabaseClient, input: unknown): Promise<void> {
  const v = parse(config, input); await user(client, v.expectedUserId, true)
  await rpc(client, "group_ticket_config_save", { p_expected_user: v.expectedUserId, p_ticket_id: v.ticketTypeId, p_enabled: v.enabled, p_min_size: v.minSize, p_max_size: v.maxSize, p_unit_price_cents: v.unitPriceCents, p_claim_deadline: v.claimDeadline })
}
export async function saveAdminTicket(client: SupabaseClient, input: unknown): Promise<string> {
  const v = parse(ticketSettings, input); await user(client, v.expectedUserId, true)
  return rpc(client, "admin_ticket_save", {
    p_expected_user: v.expectedUserId, p_ticket_id: v.ticketTypeId, p_name: v.name, p_name_zh: v.nameZh,
    p_description: v.description, p_description_zh: v.descriptionZh, p_active: v.active, p_sort_order: v.sortOrder,
    p_is_free: v.kind === "group" ? v.group.unitPriceCents === 0 : v.isFree,
    p_requires_code: v.kind === "group" ? true : v.requiresCode, p_group: v.kind === "group" ? v.group : null,
  })
}
export async function createGroupOrder(client: SupabaseClient, input: unknown): Promise<string> {
  const v = parse(creation, input); await user(client, v.expectedUserId, true)
  return rpc(client, "group_order_create", { p_expected_user: v.expectedUserId, p_request_id: v.requestId, p_ticket_id: v.ticketTypeId, p_quantity: v.quantity, p_team_name: v.teamName })
}
export async function activateGroupOrder(client: SupabaseClient, input: unknown): Promise<void> {
  const v = parse(activation, input); await user(client, v.expectedUserId, true)
  await rpc(client, "group_order_activate", { p_expected_user: v.expectedUserId, p_order_id: v.orderId, p_payment_reference: v.paymentReference, p_received_cents: v.receivedCents })
}
export async function cancelGroupOrder(client: SupabaseClient, input: unknown): Promise<void> {
  const v = parse(order, input); await user(client, v.expectedUserId)
  await rpc(client, "group_order_cancel", { p_expected_user: v.expectedUserId, p_order_id: v.orderId })
}
export async function closeGroupOrder(client: SupabaseClient, input: unknown): Promise<void> {
  const v = parse(closure, input); await user(client, v.expectedUserId, true)
  await rpc(client, "group_order_close", { p_expected_user: v.expectedUserId, p_order_id: v.orderId, p_reason: v.reason })
}
export async function rotateGroupSeat(client: SupabaseClient, input: unknown): Promise<void> {
  const v = parse(rotation, input); await user(client, v.expectedUserId)
  await rpc(client, "group_seat_rotate", { p_expected_user: v.expectedUserId, p_seat_id: v.seatId })
}
export async function redeemGroupSeat(client: SupabaseClient, input: unknown): Promise<{ registrationId: string }> {
  const v = parse(redemption, input); await user(client, v.expectedUserId, true)
  let phone: string
  try { phone = normalizeRegistrationPhone(v.phone) } catch { throw new GroupTicketError("invalid_phone") }
  const registrationId = await rpc<string>(client, "group_seat_redeem", { p_expected_user: v.expectedUserId, p_code: v.code, p_name: v.name, p_phone: phone, p_company: v.company, p_position: v.position })
  return { registrationId }
}
