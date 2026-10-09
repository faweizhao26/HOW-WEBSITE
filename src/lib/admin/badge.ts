import type { RegistrationRecord } from "./data"
import type { Locale } from "../i18n/utils"

function escapeText(value: string | null | undefined): string {
  return (value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!)
}

export function buildBadgeHTML(registration: Pick<RegistrationRecord, "name" | "company" | "ticket_types">, locale: Locale): string {
  const name = escapeText(registration.name)
  const company = escapeText(registration.company)
  const ticket = escapeText(locale === "zh" ? registration.ticket_types?.name_zh || registration.ticket_types?.name : registration.ticket_types?.name)
  return `<!DOCTYPE html><html lang="${locale}"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>HOW 2027</title><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
@page{size:90mm 55mm;margin:0}
.badge{width:90mm;height:55mm;padding:6mm 8mm;display:flex;flex-direction:column;justify-content:space-between;background:linear-gradient(135deg,#064e3b,#0f766e);color:#fff;position:relative;overflow:hidden}
.badge::after{content:"HOW 2027";position:absolute;right:-5mm;bottom:-3mm;font-size:22mm;font-weight:900;opacity:.06}
.top{font-size:3.5mm;opacity:.7;font-weight:600;letter-spacing:1mm}
.name{font-size:8mm;font-weight:800;line-height:1.1;margin:1mm 0;overflow-wrap:anywhere}
.row{display:flex;justify-content:space-between;align-items:flex-end;gap:2mm}
.company{font-size:3.2mm;opacity:.85;max-width:50mm;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ticket{font-size:3mm;background:rgba(255,255,255,.15);padding:1mm 3mm;border-radius:2mm;font-weight:600;overflow-wrap:anywhere}
@media print{body{margin:0;print-color-adjust:exact}}
</style></head><body><div class="badge"><div class="top">HOW 2027 · PostgreSQL Eco Conference</div>
<div><div class="name">${name}</div>${company ? `<div class="row"><span class="company">${company}</span><span class="ticket">${ticket}</span></div>` : `<span class="ticket" style="display:inline-block;margin-top:1mm">${ticket}</span>`}</div>
</div></body></html>`
}
