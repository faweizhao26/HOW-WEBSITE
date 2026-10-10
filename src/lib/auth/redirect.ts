export function safeAuthRedirect(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.length > 2048) return "/"
  try {
    const decoded = decodeURIComponent(value)
    if (decoded.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(decoded) || /\s/.test(value)) return "/"
    const base = "https://internal.invalid"
    const url = new URL(value, base)
    const decodedURL = new URL(decoded, base)
    if (url.origin !== base || decodedURL.origin !== base || /^\/auth(?:\/|$)/.test(decodedURL.pathname)) return "/"
    const target = url.pathname + url.search + url.hash
    if (target.startsWith("//") || new URL(target, base).origin !== base) return "/"
    return target
  } catch { return "/" }
}
