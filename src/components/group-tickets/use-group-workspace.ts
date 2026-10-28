"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { watchAuthUser } from "@/lib/auth/watch-auth-user"
import { GroupTicketError, loadGroupWorkspace } from "@/lib/group-tickets/service"
import type { GroupWorkspace } from "@/lib/group-tickets/types"

export function useGroupWorkspace(admin = false, page = 0, search = "") {
  const [data, setData] = useState<GroupWorkspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [accountVersion, setAccountVersion] = useState(0)
  const identity = useRef<{ id: string | null | undefined; version: number }>({ id: undefined, version: 0 })
  const request = useRef(0)

  useEffect(() => {
    const account = identity.current
    const requests = request
    const stop = watchAuthUser(createClient().auth, user => {
      const id = user?.id ?? null
      if (account.id === id) return
      account.id = id
      account.version++
      requests.current++
      setData(null)
      setError(null)
      setLoading(id !== null)
      setAccountVersion(account.version)
    })
    return () => { stop(); account.version++; requests.current++ }
  }, [])

  const reload = useCallback(async () => {
    const current = ++request.current
    const version = identity.current.version
    const expected = identity.current.id
    const valid = () => current === request.current && version === identity.current.version
    setLoading(true)
    setData(null)
    setError(null)
    try {
      const client = createClient()
      const { data: { user }, error: authError } = await client.auth.getUser()
      if (!valid()) return
      if (authError && authError.name !== "AuthSessionMissingError") throw authError
      if (!user) return
      if (expected !== undefined && expected !== user.id) throw new GroupTicketError("account_changed")
      const workspace = await loadGroupWorkspace(client, admin, page, search)
      if (!valid()) return
      if (workspace && workspace.userId !== user.id) throw new GroupTicketError("account_changed")
      setData(workspace)
    } catch (failure) {
      if (valid() && !(failure instanceof GroupTicketError && failure.code === "login_required")) setError(failure)
    }
    finally { if (valid()) setLoading(false) }
  }, [admin, page, search])

  useEffect(() => {
    const timer = setTimeout(() => { void reload() }, 0)
    const requests = request
    return () => { clearTimeout(timer); requests.current++ }
  }, [reload, accountVersion])

  return { data, loading, error, reload, accountVersion }
}

export function useGroupMutation() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const lock = useRef(false)
  const generation = useRef(0)
  useEffect(() => {
    const version = generation
    return () => { version.current++ }
  }, [])
  async function run(task: () => Promise<void>) {
    if (lock.current) return false
    lock.current = true
    setBusy(true)
    setError(null)
    const version = generation.current
    try {
      await task()
      return version === generation.current
    } catch (failure) {
      if (version === generation.current) setError(failure)
      return false
    } finally {
      if (version === generation.current) { lock.current = false; setBusy(false) }
    }
  }
  return { busy, error, run }
}
