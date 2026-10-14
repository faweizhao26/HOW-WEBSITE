import assert from "node:assert/strict"
import { execFileSync, spawn, spawnSync } from "node:child_process"
import { createHmac, randomUUID } from "node:crypto"
import { readFile, writeFile, open } from "node:fs/promises"
import { createClient } from "@supabase/supabase-js"

assert.equal(process.env.PUBLICATION_TEST_ISOLATED_PROJECT, "true", "Explicit local test environment required")
const url = "http://127.0.0.1:55421"
const file = "/private/tmp/how-cfp-settings-qa.json"
const auth = JSON.parse(execFileSync("docker", ["inspect", "supabase_auth_how-publication-stack"], { encoding: "utf8" }))[0]
const secret = auth.Config.Env.find(value => value.startsWith("GOTRUE_JWT_SECRET="))?.slice("GOTRUE_JWT_SECRET=".length)
assert.ok(secret, "Local JWT signing secret required")
const token = role => {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")
  const payload = Buffer.from(JSON.stringify({ iss: "supabase", role, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 30 * 86400 })).toString("base64url")
  return `${header}.${payload}.${createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url")}`
}
const anonKey = token("anon"), serviceKey = token("service_role")
assert.ok(anonKey && serviceKey, "Local gateway API keys required")
const trusted = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
const unwrap = async query => { const result = await query; if (result.error) throw result.error; return result.data }

async function startPreview(fixture) {
  const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey }
  const built = spawnSync(process.execPath, ["node_modules/next/dist/bin/next", "build"], { cwd: process.cwd(), env, encoding: "utf8" })
  if (built.status !== 0) { console.error(built.stdout, built.stderr); throw new Error("Isolated preview build failed") }
  const log = await open("/private/tmp/how-cfp-settings-preview.log", "a", 0o600)
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3034"], { cwd: process.cwd(), detached: true, stdio: ["ignore", log.fd, log.fd], env })
  child.unref()
  fixture.serverPid = child.pid
  fixture.anonKey = anonKey
  await writeFile(file, JSON.stringify(fixture), { mode: 0o600 })
  await log.close()
}

if (process.argv.includes("--cleanup-business")) {
  const fixture = JSON.parse(await readFile(file, "utf8"))
  assert.equal(fixture.url, url)
  const current = await unwrap(trusted.from("site_settings_releases").select("id,published_by").eq("is_current", true).single())
  assert.ok(current.id === fixture.originalRelease.id || current.published_by === fixture.users[0].id, "Do not roll back another actor's release")
  const admin = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  await unwrap(admin.auth.signInWithPassword({ email: fixture.users[0].email, password: fixture.users[0].password }))
  await unwrap(admin.rpc("rollback_site_settings_release", { p_release_id: fixture.originalRelease.id }))
  await unwrap(trusted.from("site_settings_releases").delete().eq("published_by", fixture.users[0].id))
  const cfpKeys = ["cfp_enabled", "cfp_deadline", "cfp_types", "cfp_durations", "cfp_intro", "cfp_intro_zh", "cfp_requirements", "cfp_requirements_zh", "cfp_review_notes", "cfp_review_notes_zh", "cfp_contact_email", "site_content"]
  const saved = fixture.originalSettings.filter(row => cfpKeys.includes(row.key))
  if (saved.length) await unwrap(trusted.from("site_settings").upsert(saved))
  const absent = cfpKeys.filter(key => !saved.some(row => row.key === key))
  if (absent.length) await unwrap(trusted.from("site_settings").delete().in("key", absent))
  await unwrap(trusted.from("channel_codes").delete().like("name", fixture.prefix + "%"))
  await unwrap(trusted.from("ticket_types").delete().like("name", fixture.prefix + "%"))
  for (const user of fixture.users.slice(1)) {
    await unwrap(trusted.from("sessions").delete().eq("user_id", user.id))
    const actor = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
    await unwrap(actor.auth.signInWithPassword({ email: user.email, password: user.password }))
    await unwrap(actor.auth.signOut({ scope: "global" }))
    await unwrap(trusted.auth.admin.deleteUser(user.id))
  }
  fixture.users = fixture.users.slice(0, 1)
  fixture.businessFixturesCleaned = true
  await writeFile(file, JSON.stringify(fixture), { mode: 0o600 })
  console.log("Local settings restored; generated business fixtures and speaker removed. Preview administrator retained.")
} else if (process.argv.includes("--restart-preview")) {
  const fixture = JSON.parse(await readFile(file, "utf8"))
  assert.equal(fixture.url, url)
  if (fixture.serverPid) { try { process.kill(fixture.serverPid, "SIGTERM") } catch (error) { if (error.code !== "ESRCH") throw error } }
  await startPreview(fixture)
  console.log("Preview rebuilt with isolated public API configuration and restarted on port 3034.")
} else {
  assert.equal(await readFile(file, "utf8").catch(() => null), null, "Do not overwrite a retained QA fixture")
  const fixture = {
    url, anonKey, baseURL: "http://127.0.0.1:3034", prefix: `CFP QA ${randomUUID().slice(0, 8)}`,
    originalSettings: await unwrap(trusted.from("site_settings").select("key,value")),
    originalRelease: await unwrap(trusted.from("site_settings_releases").select("id").eq("is_current", true).single()),
    users: [],
  }
  try {
    for (const role of ["admin", "user"]) {
      const email = `cfp-settings-${role}-${randomUUID().slice(0, 8)}@example.test`
      const password = randomUUID() + "!Qa9"
      const { user } = await unwrap(trusted.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fixture.prefix + " " + role } }))
      fixture.users.push({ id: user.id, email, password, role })
      if (role === "admin") await unwrap(trusted.from("profiles").update({ role: "admin" }).eq("id", user.id))
    }
    await startPreview(fixture)
    console.log("Local preview started on http://127.0.0.1:3034; private fixture saved with mode 0600. No production writes.")
  } catch (error) {
    for (const user of fixture.users) await trusted.auth.admin.deleteUser(user.id)
    throw error
  }
}
