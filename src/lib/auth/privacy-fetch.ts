export function createPrivacyFetch(supabaseUrl: string, fetcher: typeof fetch = (...args) => fetch(...args)): typeof fetch {
  const signup = new URL("/auth/v1/signup", supabaseUrl)
  return async (input, init) => {
    const request = input instanceof Request ? input : null
    const url = new URL(request ? request.url : String(input), supabaseUrl)
    if (url.origin !== signup.origin || url.pathname !== signup.pathname || (init?.method || request?.method || "GET").toUpperCase() !== "POST") return fetcher(input, init)
    return fetcher(`/api/auth/signup${url.search}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "omit",
      body: init?.body ?? (request ? await request.clone().text() : undefined), signal: init?.signal ?? request?.signal,
    })
  }
}
