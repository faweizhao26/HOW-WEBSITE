import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { createHmac, randomUUID } from "node:crypto"
import { readFile, writeFile, unlink } from "node:fs/promises"
import { createClient } from "@supabase/supabase-js"

assert.equal(process.env.PUBLICATION_TEST_ISOLATED_PROJECT, "true", "Local isolated QA only")
const file = "/private/tmp/how-group-orders-20261028.json"
const database = "how_audit_reliability_20261018"
const sql = text => execFileSync("docker", ["exec", "-i", "supabase_db_how-publication-stack", "psql", "-X", "-U", "postgres", "-d", database, "-Atq", "-v", "ON_ERROR_STOP=1"], { input: text, encoding: "utf8" }).trim()
assert.equal(sql("select current_database()"), database)
if (process.argv.includes("--cleanup")) {
  const f = JSON.parse(await readFile(file, "utf8"))
  assert.equal(f.database, database)
  for (const u of f.users) {
    const client = createClient(f.url, f.anon, { auth: { persistSession: false, autoRefreshToken: false } })
    assert.ifError((await client.auth.signInWithPassword(u)).error)
    assert.ifError((await client.auth.signOut({ scope: "global" })).error)
  }
  sql(`delete from public.group_order_events where order_id in (select id from public.group_orders where ticket_type_id='${f.ticketId}'); delete from public.group_orders where ticket_type_id='${f.ticketId}'; delete from public.registrations where ticket_type_id='${f.ticketId}'; delete from public.group_ticket_configs where ticket_type_id='${f.ticketId}'; delete from public.ticket_types where id='${f.ticketId}'; delete from auth.users where id in (${f.users.map(u => `'${u.id}'`).join(",")});`)
  await unlink(file)
  console.log("Removed this batch of isolated group-ticket fixtures and private credentials")
} else {
  await assert.rejects(readFile(file), e => e.code === "ENOENT", "Do not overwrite retained fixtures")
  const info = JSON.parse(execFileSync("docker", ["inspect", "how-audit-reliability-20261018-auth"], { encoding: "utf8" }))[0]
  const secret = info.Config.Env.find(v => v.startsWith("GOTRUE_JWT_SECRET=")).slice("GOTRUE_JWT_SECRET=".length)
  const sign = role => {
    const encode = v => Buffer.from(JSON.stringify(v)).toString("base64url")
    const value = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ role, iss: "supabase", exp: Math.floor(Date.now() / 1000) + 86400 })}`
    return `${value}.${createHmac("sha256", secret).update(value).digest("base64url")}`
  }
  const f = { database, url: "http://127.0.0.1:55540", anon: sign("anon"), appURL: "http://127.0.0.1:3040", ticketId: randomUUID(), users: [] }
  const trusted = createClient(f.url, sign("service_role"), { auth: { persistSession: false, autoRefreshToken: false } })
  await writeFile(file, JSON.stringify(f), { mode: 0o600 })
  for (const role of ["admin", "leader", "member", "other"]) {
    const email = `group-${role}-${randomUUID().slice(0,8)}@example.test`, password = randomUUID() + "!Qa9"
    const { data, error } = await trusted.auth.admin.createUser({ email, password, role: "authenticated", email_confirm: true, user_metadata: { full_name: `Group ${role}` } })
    assert.ifError(error)
    f.users.push({ id: data.user.id, email, password, role })
    await writeFile(file, JSON.stringify(f), { mode: 0o600 })
    if (role === "admin") sql(`update public.profiles set role='admin' where id='${data.user.id}'`)
  }
  sql(`insert into public.ticket_types(id,name,name_zh,is_free,requires_code,is_active) values('${f.ticketId}','Group QA ticket','团体票验收',false,true,true)`)
  console.log(JSON.stringify({ privateFixture: file, users: f.users.length, localOnly: true }))
}
