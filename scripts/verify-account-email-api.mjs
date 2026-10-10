import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { readFile, writeFile, unlink } from "node:fs/promises"
import { createClient } from "@supabase/supabase-js"
import { requestAccountEmail, resetAccountPassword } from "../src/lib/auth/email.ts"

const env = process.env, url = env.PUBLICATION_TEST_SUPABASE_URL
assert.equal(env.PUBLICATION_TEST_ISOLATED_PROJECT, "true")
assert.ok(url && ["localhost", "127.0.0.1"].includes(new URL(url).hostname), "Local test only")
const mailbox = "http://127.0.0.1:55624"
const file = "/private/tmp/how-account-email-fixture.json"
const options = { auth: { autoRefreshToken: false, persistSession: false } }
const trusted = createClient(url, env.PUBLICATION_TEST_SUPABASE_SERVICE_ROLE_KEY, options)
const publicClient = () => createClient(url, env.PUBLICATION_TEST_SUPABASE_ANON_KEY, options)
const unwrap = async task => { const result = await task; if (result.error) throw result.error; return result.data }
let fixture
async function clean() {
  if (!fixture) return
  const { users } = await unwrap(trusted.auth.admin.listUsers({ page: 1, perPage: 1000 }))
  for (const user of users.filter(user => fixture.emails.includes(user.email))) await unwrap(trusted.auth.admin.deleteUser(user.id))
  for (const email of fixture.emails) await fetch(`${mailbox}/api/v1/mailbox/${encodeURIComponent(email.split("@")[0])}`, { method: "DELETE" })
  await unlink(file).catch(error => { if (error.code !== "ENOENT") throw error })
}
async function mailLink(email) {
  const name = encodeURIComponent(email.split("@")[0])
  for (let i = 0; i < 50; i++) {
    const messages = await (await fetch(`${mailbox}/api/v1/mailbox/${name}`)).json()
    if (messages.length) {
      const message = await (await fetch(`${mailbox}/api/v1/mailbox/${name}/${messages.at(-1).id}`)).json()
      const links = (message.body.text || message.body.html || "").match(/https?:\/\/[^\s"<>]+/g) || []
      const link = links.map(value => value.replaceAll("&amp;", "&")).find(value => value.includes("/auth/v1/verify"))
      if (link) { await fetch(`${mailbox}/api/v1/mailbox/${name}`, { method: "DELETE" }); return link }
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw Error("Expected real local email was not captured")
}
async function consumeImplicitLink(client, link) {
  const response = await fetch(link, { redirect: "manual" })
  const destination = new URL(response.headers.get("location"))
  const params = new URLSearchParams(destination.hash.slice(1))
  assert.ok(params.get("access_token"), "Email verification must yield an Auth session")
  await unwrap(client.auth.setSession({ access_token: params.get("access_token"), refresh_token: params.get("refresh_token") }))
}
if (env.EMAIL_QA_CLEANUP === "true") {
  fixture = JSON.parse(await readFile(file, "utf8")); assert.equal(fixture.url, url)
  await clean(); console.log("Only generated local email QA accounts removed")
} else {
  assert.equal(await readFile(file, "utf8").catch(() => null), null, "Existing private fixture must be cleaned first")
  const suffix = randomUUID().slice(0, 8)
  fixture = { url, emails: [`email-qa-${suffix}@example.test`, `signup-qa-${suffix}@example.test`], password: randomUUID() + "Qa9!", newPassword: randomUUID() + "New9!" }
  try {
    const { user } = await unwrap(trusted.auth.admin.createUser({ email: fixture.emails[0], password: fixture.password, email_confirm: false }))
    fixture.userId = user.id
    const account = publicClient()
    await requestAccountEmail(account, { kind: "confirmation", email: fixture.emails[0], callbackURL: "http://localhost:3026/auth/confirm?redirect=%2Fcfp" })
    await consumeImplicitLink(account, await mailLink(fixture.emails[0]))
    assert.ok((await unwrap(account.auth.getUser())).user.email_confirmed_at)
    console.log("PASS real local signup confirmation resend, SMTP email capture and one-use link verification")
    await requestAccountEmail(account, { kind: "recovery", email: fixture.emails[0], callbackURL: "http://localhost:3026/auth/callback?next=%2Fcfp&flow=recovery" })
    const recovery = await mailLink(fixture.emails[0])
    await consumeImplicitLink(account, recovery)
    await resetAccountPassword(account, { expectedUserId: user.id, password: fixture.newPassword, confirmation: fixture.newPassword })
    const old = await publicClient().auth.signInWithPassword({ email: fixture.emails[0], password: fixture.password })
    assert.ok(old.error)
    await unwrap(publicClient().auth.signInWithPassword({ email: fixture.emails[0], password: fixture.newPassword }))
    const reused = await fetch(recovery, { redirect: "manual" })
    assert.match(reused.headers.get("location"), /error/)
    console.log("PASS real recovery email, new password login, old password rejection and consumed-link rejection")
    if (env.EMAIL_QA_KEEP_FIXTURES === "true") {
      await writeFile(file, JSON.stringify(fixture), { mode: 0o600 })
      console.log("Private synthetic fixture retained; no credentials printed")
    } else await clean()
  } catch (error) { await clean(); throw error }
}
