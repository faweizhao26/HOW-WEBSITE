import type { SupabaseClient, User } from "@supabase/supabase-js"

export function watchAuthUser(
  auth: Pick<SupabaseClient["auth"], "getUser" | "onAuthStateChange">,
  setUser: (user: User | null) => void
) {
  let active = true
  let eventVersion = 0
  let readVersion = 0
  const { data: { subscription } } = auth.onAuthStateChange((_event, session) => {
    eventVersion++
    if (active) setUser(session?.user ?? null)
  })

  function reconcile() {
    const version = eventVersion
    const read = ++readVersion
    auth.getUser().then(({ data, error }) => {
      // Cookie-only server changes do not emit Auth events. Recheck on return to this tab.
      if (active && version === eventVersion && read === readVersion && (!error || error.name === "AuthSessionMissingError")) setUser(data.user)
    }).catch(() => {})
  }
  const target = typeof window === "undefined" ? null : window
  const doc = typeof document === "undefined" ? null : document
  const visible = () => { if (doc?.visibilityState === "visible") reconcile() }
  target?.addEventListener("focus", reconcile)
  target?.addEventListener("pageshow", reconcile)
  doc?.addEventListener("visibilitychange", visible)
  reconcile()

  return () => {
    active = false
    readVersion++
    target?.removeEventListener("focus", reconcile)
    target?.removeEventListener("pageshow", reconcile)
    doc?.removeEventListener("visibilitychange", visible)
    subscription.unsubscribe()
  }
}
