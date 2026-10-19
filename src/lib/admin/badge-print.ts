import { fitBadgeDocument } from "./badge.ts"

export function openBadgePrintWindow(): Window {
  const popup = window.open("", "_blank", "width=600,height=500")
  if (!popup) throw new Error("popup_blocked")
  return popup
}

export async function printBadgeWindow(popup: Window, html: string): Promise<void> {
  if (popup.closed) return
  popup.document.open()
  popup.document.write(html)
  popup.document.close()
  if (popup.document.readyState !== "complete") await new Promise<void>(resolve => popup.addEventListener("load", () => resolve(), { once: true }))
  await popup.document.fonts.ready
  if (popup.closed) return
  if (!fitBadgeDocument(popup.document)) throw new Error("badge_overflow")
  popup.focus()
  popup.print()
}
