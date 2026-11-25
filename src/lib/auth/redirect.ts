export function authRequestOrigin(request: Request): string {
  const url = new URL(request.url)
  const host = request.headers.get("host")
  if (!host) return url.origin
  if (!/^(?:[a-z0-9.-]+|\[[0-9a-f:.]+\])(?::[0-9]{1,5})?$/i.test(host)) throw new TypeError("Invalid Host")
  // Standalone Next.js can put its internal listener and port in request.url.
  return new URL(`${url.protocol}//${host}`).origin
}

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

export function accountEmailCallbackURL(origin: string, kind: "recovery" | "confirmation", next: unknown): string {
  if (kind === "confirmation") {
    const url = new URL("/auth/confirm", origin)
    url.searchParams.set("redirect", safeAuthRedirect(next))
    return url.href
  }
  const url = new URL("/auth/callback", origin)
  url.searchParams.set("next", safeAuthRedirect(next))
  url.searchParams.set("flow", kind)
  return url.href
}
