import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { readFile, writeFile, unlink } from "node:fs/promises"
import { createClient } from "@supabase/supabase-js"
import { submitProposal, loadCFPData } from "../src/lib/cfp/service.ts"
import { signInAccount } from "../src/lib/auth/login.ts"

const env = process.env, url = env.PUBLICATION_TEST_SUPABASE_URL
assert.equal(env.PUBLICATION_TEST_ISOLATED_PROJECT, "true")
assert.ok(url && ["localhost", "127.0.0.1"].includes(new URL(url).hostname), "Isolated localhost only")
const options = { auth: { autoRefreshToken: false, persistSession: false } }
const trusted = createClient(url, env.PUBLICATION_TEST_SUPABASE_SERVICE_ROLE_KEY, options)
const anonymous = createClient(url, env.PUBLICATION_TEST_SUPABASE_ANON_KEY, options)
const file = env.CFP_QA_FIXTURE_PATH || "/private/tmp/how-cfp-auth-qa-fixture.json"
const unwrap = async operation => { const result = await operation; if (result.error) throw result.error; return result.data }
let fixture
async function cleanup() {
  if (!fixture) return
  for (const id of fixture.users) await unwrap(trusted.from("sessions").delete().eq("user_id", id))
  for (const id of fixture.users) await unwrap(trusted.auth.admin.deleteUser(id))
  const saved = await readFile(file, "utf8").catch(() => null)
  if (saved && JSON.parse(saved).users[0] === fixture.users[0]) await unlink(file)
}
if (env.CFP_QA_CLEANUP === "true") {
  fixture = JSON.parse(await readFile(file, "utf8"))
  assert.equal(fixture.url, url)
  await cleanup()
  console.log("Generated CFP QA accounts and proposals removed")
} else {
  assert.equal(await readFile(file, "utf8").catch(() => null), null, "Clean retained fixture before replacing it")
  fixture = { url, users: [], emails: [], password: randomUUID() + "!Qa9" }
  try {
    for (let i = 0; i < 3; i++) {
      const email = `cfp-${i}-${randomUUID().slice(0, 8)}@example.test`
      const { user } = await unwrap(trusted.auth.admin.createUser({ email, password: fixture.password, email_confirm: i !== 2 }))
      fixture.users.push(user.id); fixture.emails.push(email)
    }
    const speaker = createClient(url, env.PUBLICATION_TEST_SUPABASE_ANON_KEY, options)
    const other = createClient(url, env.PUBLICATION_TEST_SUPABASE_ANON_KEY, options)
    await assert.rejects(signInAccount(speaker, { email: fixture.emails[0], password: "incorrect" }), e => e.code === "invalid_credentials")
    await assert.rejects(signInAccount(speaker, { email: fixture.emails[2], password: fixture.password }), e => e.code === "email_not_confirmed")
    await signInAccount(speaker, { email: " " + fixture.emails[0] + " ", password: fixture.password })
    await signInAccount(other, { email: fixture.emails[1], password: fixture.password })
    assert.equal((await loadCFPData(speaker)).sessions.length, 0)
    assert.equal((await loadCFPData(anonymous)).user, null)
    console.log("PASS real login success, wrong password, unconfirmed email and empty/signed-out reads")

    const values = { requestId: randomUUID(), expectedUserId: fixture.users[0], title: "  QA PostgreSQL  ", abstract: "  QA Abstract  ", titleZh: "QA 提案", duration: 30, type: "talk" }
    await assert.rejects(submitProposal(anonymous, values), e => e.code === "login_required")
    for (const changed of [{ title: "\t\u3000" }, { abstract: "\u00a0\ufeff" }, { duration: -1 }, { userId: fixture.users[1] }]) await assert.rejects(submitProposal(speaker, { ...values, ...changed }), e => e.code === "invalid_input")
    const attempts = await Promise.all(Array.from({ length: 8 }, () => submitProposal(speaker, values)))
    assert.ok(attempts.every(row => row.id === values.requestId))
    assert.equal((await unwrap(trusted.from("sessions").select("id").eq("id", values.requestId))).length, 1)
    assert.equal((await submitProposal(speaker, values)).title, "QA PostgreSQL")
    await assert.rejects(submitProposal(speaker, { ...values, title: "Changed" }), e => e.code === "request_conflict")
    await assert.rejects(submitProposal(other, values), e => e.code === "account_changed")
    await assert.rejects(submitProposal(other, { ...values, expectedUserId: fixture.users[1] }), e => e.code === "operation_failed")
    assert.equal((await loadCFPData(other)).sessions.length, 0)
    console.log("PASS server input/ownership checks, eight concurrent retries yielding one row and request isolation")

    let dropped = false
    const lossClient = createClient(url, env.PUBLICATION_TEST_SUPABASE_ANON_KEY, { ...options, global: { fetch: async (request, init) => {
      const response = await fetch(request, init)
      if (!dropped && String(request).includes("/rest/v1/sessions") && init?.method === "POST") { dropped = true; throw Error("QA committed response loss") }
      return response
    } } })
    await signInAccount(lossClient, { email: fixture.emails[0], password: fixture.password })
    const recovered = { ...values, requestId: randomUUID(), title: "QA Lost Response" }
    assert.equal((await submitProposal(lossClient, recovered)).id, recovered.requestId)
    assert.equal((await submitProposal(lossClient, recovered)).id, recovered.requestId)
    assert.equal((await loadCFPData(speaker)).sessions.length, 2)
    console.log("PASS real committed write with lost response recovers without creating another proposal")
    if (env.CFP_QA_KEEP_FIXTURES === "true") {
      await writeFile(file, JSON.stringify(fixture), { mode: 0o600 })
      console.log("Private local browser fixture retained; credentials not printed")
    } else await cleanup()
  } catch (error) { await cleanup(); throw error }
}
