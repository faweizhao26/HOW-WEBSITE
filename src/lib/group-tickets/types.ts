export type GroupConfig = {
  ticket_type_id: string; enabled: boolean; min_size: number; max_size: number
  unit_price_cents: number; claim_deadline: string | null; ticket_name: string; ticket_name_zh: string | null
}
export type GroupOrder = {
  id: string; owner_id: string; team_name: string; ticket_type_id: string
  ticket_name: string; ticket_name_zh: string | null; quantity: number; unit_price_cents: number
  total_cents: number; status: "pending" | "active" | "closed" | "cancelled" | "expired"
  claimed_count: number; created_at: string; expires_at: string; claim_deadline: string | null
  activated_at: string | null; payment_reference: string | null
}
export type GroupSeat = { id: string; code: string | null; claimed: boolean; member_name: string | null }
export type GroupOrderDetail = { order: GroupOrder; seats: GroupSeat[] }
export type GroupWorkspace = {
  configs: GroupConfig[]; tickets: { id: string; name: string; name_zh: string | null }[]
  orders: GroupOrder[]; total: number; userId: string
}
