import type { SupabaseClient, User } from "@supabase/supabase-js"
import { watchAuthUser } from "./watch-auth-user.ts"

export type NavigationUser = { user: User | null; isAdmin: boolean }

export function watchNavigationUser(client: Pick<SupabaseClient, "auth" | "from">, receive: (value: NavigationUser) => void) {
  let active = true
  let generation = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let current: NavigationUser = { user: null, isAdmin: false }
  const update = (next: NavigationUser) => { current = next; receive(next) }
  const stop = watchAuthUser(client.auth, user => {
    const version = ++generation
    clearTimeout(timer)
    update({ user, isAdmin: !!user && current.user?.id === user.id && current.isAdmin })
    if (!user) return
    // Auth callbacks hold a client lock; defer the profile query until it is released.
    timer = setTimeout(() => {
      if (!active || version !== generation) return
      void (async () => {
        try {
          const result = await client.from("profiles").select("role").eq("id", user.id).single()
          if (active && version === generation) update({ user, isAdmin: !result.error && result.data?.role === "admin" })
        } catch {
          if (active && version === generation) update({ user, isAdmin: false })
        }
      })()
    }, 0)
  })
  return () => {
    active = false
    generation++
    clearTimeout(timer)
    stop()
  }
}
