import assert from "node:assert/strict"
import { readFile, writeFile } from "node:fs/promises"
import { randomUUID, createHmac } from "node:crypto"
import { execFileSync } from "node:child_process"
import { createClient } from "@supabase/supabase-js"

assert.equal(process.env.PUBLICATION_TEST_ISOLATED_PROJECT, "true", "Explicit local test environment required")
const file = "/private/tmp/how-cfp-settings-qa.json"
const fixture = JSON.parse(await readFile(file, "utf8"))
assert.equal(fixture.url, "http://127.0.0.1:55421")
const auth = JSON.parse(execFileSync("docker", ["inspect", "supabase_auth_how-publication-stack"], { encoding: "utf8" }))[0]
const secret = auth.Config.Env.find(value => value.startsWith("GOTRUE_JWT_SECRET=")).slice("GOTRUE_JWT_SECRET=".length)
const head = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")
const body = Buffer.from(JSON.stringify({ role: "service_role", iss: "supabase", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")
const key = `${head}.${body}.${createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url")}`
const trusted = createClient(fixture.url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const unwrap = async query => { const result = await query; assert.ifError(result.error); return result.data }
if (process.argv.includes("--cleanup")) {
  for (const user of fixture.accountQA ?? []) {
    const actor = createClient(fixture.url, fixture.anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
    await unwrap(actor.auth.signInWithPassword({ email: user.email, password: user.password }))
    await unwrap(actor.auth.signOut({ scope: "global" }))
    // Remove only the isolated user's generated audit rows before deleting the fixture.
    execFileSync("docker", ["exec", "supabase_db_how-publication-stack", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", `DELETE FROM public.account_role_changes WHERE target_id='${user.id}' OR actor_id='${user.id}';`])
    await unwrap(trusted.auth.admin.deleteUser(user.id))
    assert.ok((await trusted.auth.admin.getUserById(user.id)).error)
  }
  delete fixture.accountQA
  console.log("Removed local account fixtures, revoked sessions and cleared their audit rows.")
} else {
  assert.ok(!fixture.accountQA?.length, "Do not overwrite retained fixtures")
  const email = `account-access-${randomUUID().slice(0, 8)}@example.test`
  const password = randomUUID() + "!Qa9"
  const { user } = await unwrap(trusted.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "Account Access QA" } }))
  fixture.accountQA = [{ id: user.id, email, password }]
  console.log("Created a temporary ordinary account in the isolated local project; credentials remain in the private fixture.")
}
await writeFile(file, JSON.stringify(fixture), { mode: 0o600 })
