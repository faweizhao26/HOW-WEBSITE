export const registrationToggleKeys = ["registration_onsite_enabled", "registration_external_enabled"] as const

export function parseExternalRegistrationUrl(value?: string): string | null {
  const text = value?.trim()
  if (!text || !/^https?:\/\/[^/]/i.test(text) || /[\s\\]/.test(text)) return null
  try {
    const url = new URL(text)
    if (!url.hostname || url.username || url.password) return null
    return url.href
  } catch { return null }
}

export function getRegistrationOptions(settings: Record<string, string> | null) {
  const onsite = settings !== null && (settings.registration_onsite_enabled === "true" ||
    registrationToggleKeys.every(key => settings[key] === undefined))
  const externalUrl = settings?.registration_external_enabled === "true" ? parseExternalRegistrationUrl(settings.register_url) : null
  return { onsite, externalUrl, href: onsite ? "/register" : externalUrl }
}

export function resolveRegistrationLink(href: string, registrationHref: string | null | undefined) {
  if (registrationHref === undefined || registrationHref === "/register" || !/^\/register\/?(?:[?#]|$)/.test(href)) return href
  return registrationHref
}

export function invalidRegistrationSettings(settings: Record<string, string>) {
  const issues: string[] = registrationToggleKeys.filter(key => settings[key] !== undefined && settings[key] !== "true" && settings[key] !== "false")
  if (settings.registration_external_enabled === "true" && !parseExternalRegistrationUrl(settings.register_url)) issues.push("register_url")
  return issues
}
