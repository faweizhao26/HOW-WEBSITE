import type { SupabaseClient, User } from "@supabase/supabase-js"

export function watchAuthUser(
  auth: Pick<SupabaseClient["auth"], "getUser" | "onAuthStateChange">,
  setUser: (user: User | null) => void
) {
  let active = true
  let receivedEvent = false
  const { data: { subscription } } = auth.onAuthStateChange((_event, session) => {
    receivedEvent = true
    if (active) setUser(session?.user ?? null)
  })

  auth.getUser().then(({ data }) => {
    // A delayed initial read must not replace a newer login or logout event.
    if (active && !receivedEvent) setUser(data.user)
  }).catch(() => {})

  return () => {
    active = false
    subscription.unsubscribe()
  }
}
