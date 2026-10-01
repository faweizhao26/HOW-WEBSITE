export async function assertSmsVerificationConfiguration(
  url: string | undefined,
  anonKey: string | undefined,
  fetcher: typeof fetch = fetch,
) {
  if (!url || !anonKey) throw new Error("sms_unavailable")
  const response = await fetcher(`${url.replace(/\/$/, "")}/auth/v1/settings`, {
    headers: { apikey: anonKey },
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  })
  if (!response.ok) throw new Error("sms_unavailable")
  const settings = await response.json()
  if (settings.phone_autoconfirm !== false || settings.external?.phone !== true || !settings.sms_provider)
    throw new Error("sms_unavailable")
}
