import type { RegistrationRecord } from "./data"
import type { Locale } from "../i18n/utils"
import { parseBadgePrintSettings } from "./badge-settings.ts"

function escapeText(value: string | null | undefined): string {
  return (value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!)
}

export function buildBadgeHTML(registration: Pick<RegistrationRecord, "name" | "company" | "ticket_types">, locale: Locale, settings: Record<string, string> = {}): string {
  const config = parseBadgePrintSettings(settings)
  const name = escapeText(registration.name)
  const company = escapeText(registration.company)
  const ticket = escapeText(locale === "zh" ? registration.ticket_types?.name_zh || registration.ticket_types?.name : registration.ticket_types?.name)
  const conference = escapeText(settings.conference_name || "HOW 2027")
  const color = config.style === "color"
  return `<!DOCTYPE html><html lang="${locale}"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>${conference}</title><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${config.widthMm}mm;height:${config.heightMm}mm;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
@page{size:${config.widthMm}mm ${config.heightMm}mm;margin:0}
.badge{width:${config.widthMm}mm;height:${config.heightMm}mm;padding:${config.paddingMm}mm;${color ? "background:linear-gradient(135deg,#064e3b,#0f766e);color:#fff" : "background:#fff;color:#000"}}
.badge-content{height:100%;display:flex;flex-direction:column;justify-content:center;gap:2mm;font-size:8mm;line-height:1.15;overflow-wrap:anywhere}
.top{font-size:.42em;font-weight:600;letter-spacing:0}
.name{font-size:1em;font-weight:800;letter-spacing:0}
.company{font-size:.45em;letter-spacing:0}
.ticket{font-size:.42em;font-weight:700;letter-spacing:0}
@media print{body{margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body><div class="badge"><div class="badge-content">
${config.showConference ? `<div class="top">${conference}</div>` : ""}
<div class="name">${name}</div>
${config.showCompany && company ? `<div class="company">${company}</div>` : ""}
${config.showTicket && ticket ? `<div class="ticket">${ticket}</div>` : ""}
</div>
</div></body></html>`
}

export function fitBadgeDocument(document: Document): boolean {
  const content = document.querySelector<HTMLElement>(".badge-content")
  if (!content) return false
  // Reduce all fields together so names and companies wrap without clipping.
  for (let size = 8; size >= 4; size -= 0.25) {
    content.style.fontSize = `${size}mm`
    if (content.scrollHeight <= content.clientHeight + 1 && content.scrollWidth <= content.clientWidth + 1) return true
  }
  return false
}
