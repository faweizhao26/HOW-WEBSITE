import type { RegistrationRecord } from "./data"
import type { Locale } from "../i18n/utils"

function csvField(value: unknown): string {
  let text = String(value ?? "")
  // Keep spreadsheet apps from interpreting attendee input as a formula.
  if (/^[\t\r\n]|^\s*[=+@-]/.test(text)) text = "'" + text
  return `"${text.replaceAll('"', '""')}"`
}

export function registrationsToCSV(records: RegistrationRecord[], locale: Locale): string {
  const zh = locale === "zh"
  const headers = zh
    ? ["姓名", "邮箱", "手机号", "公司", "职位", "票种", "渠道码", "状态", "签到", "报名时间"]
    : ["Name", "Email", "Phone", "Company", "Position", "Ticket", "Channel", "Status", "Checked In", "Date"]
  const rows = records.map(record => [
    record.name, record.email, record.phone, record.company, record.position,
    zh ? record.ticket_types?.name_zh || record.ticket_types?.name : record.ticket_types?.name,
    record.channel_code,
    record.status === "cancelled" ? (zh ? "已取消" : "Cancelled") : (zh ? "已确认" : "Confirmed"),
    record.checked_in ? (zh ? "是" : "Yes") : (zh ? "否" : "No"),
    new Date(record.created_at).toLocaleString(zh ? "zh-CN" : "en-US", { timeZone: "Asia/Shanghai", hour12: false }),
  ])
  return "\uFEFF" + [headers, ...rows].map(row => row.map(csvField).join(",")).join("\r\n")
}
