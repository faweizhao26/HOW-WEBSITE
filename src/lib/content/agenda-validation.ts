import type { AgendaSlot } from "@/lib/db/schema"

type ValidationSlot = Pick<AgendaSlot, "date" | "start_time" | "end_time" | "type" | "session_id" | "label">
export type AgendaIssue = "empty" | "date" | "time" | "session" | "label"

export function validateAgendaDraft(slots: ValidationSlot[], dates: readonly string[], publishedIds: readonly string[]): AgendaIssue[] {
  if (slots.length === 0) return ["empty"]
  const issues = new Set<AgendaIssue>()
  const published = new Set(publishedIds)
  for (const slot of slots) {
    if (!dates.includes(slot.date)) issues.add("date")
    if (!slot.start_time || !slot.end_time || slot.start_time >= slot.end_time) issues.add("time")
    if ((slot.type === "session" && !slot.session_id) || (slot.session_id && !published.has(slot.session_id))) issues.add("session")
    if (!slot.session_id && !slot.label.trim()) issues.add("label")
  }
  return [...issues]
}
