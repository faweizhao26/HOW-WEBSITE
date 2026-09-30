import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { test } from "node:test"

const moduleUrl = new URL("../src/lib/auth/watch-auth-user.ts", import.meta.url)
const load = async () => {
  assert.ok(existsSync(moduleUrl), "Auth watcher must keep the header in sync with login and logout")
  return (await import(moduleUrl.href)).watchAuthUser
}

function fixture() {
  let resolve, listener, unsubscribed = false
  const initial = new Promise((done) => { resolve = done })
  const values = []
  return {
    auth: {
      getUser: () => initial,
      onAuthStateChange: (callback) => {
        listener = callback
        return { data: { subscription: { unsubscribe: () => { unsubscribed = true } } } }
      },
    },
    resolve: (user) => resolve({ data: { user } }),
    emit: (user) => listener(user ? "SIGNED_IN" : "SIGNED_OUT", user ? { user } : null),
    values,
    setUser: (user) => values.push(user),
    unsubscribed: () => unsubscribed,
  }
}

test("auth watcher reads the existing user", async () => {
  const watch = await load(), f = fixture(), user = { id: "existing" }
  const stop = watch(f.auth, f.setUser)
  f.resolve(user)
  await Promise.resolve()
  assert.deepEqual(f.values, [user])
  stop()
})

test("auth watcher updates login and logout without a page reload", async () => {
  const watch = await load(), f = fixture(), user = { id: "signed-in" }
  const stop = watch(f.auth, f.setUser)
  f.emit(user)
  f.emit(null)
  assert.deepEqual(f.values, [user, null])
  stop()
})

test("a late initial user read cannot overwrite a newer auth event", async () => {
  const watch = await load(), f = fixture(), user = { id: "new-session" }
  const stop = watch(f.auth, f.setUser)
  f.emit(user)
  f.resolve(null)
  await Promise.resolve()
  assert.deepEqual(f.values, [user])
  stop()
})

test("auth watcher unsubscribes and ignores reads after unmount", async () => {
  const watch = await load(), f = fixture()
  const stop = watch(f.auth, f.setUser)
  stop()
  f.emit({ id: "after-unmount" })
  f.resolve({ id: "late-read" })
  await Promise.resolve()
  assert.equal(f.unsubscribed(), true)
  assert.deepEqual(f.values, [])
})
