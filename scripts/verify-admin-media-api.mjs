import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { randomUUID, createHmac } from "node:crypto"
import { execFileSync } from "node:child_process"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { uploadSiteMedia } from "../src/lib/admin/media-upload.ts"

assert.equal(process.env.PUBLICATION_TEST_ISOLATED_PROJECT, "true", "Explicit local test environment required")
const fixture = JSON.parse(await readFile("/private/tmp/how-cfp-settings-qa.json", "utf8"))
assert.equal(fixture.url, "http://127.0.0.1:55421")
const client = key => createClient(fixture.url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const unwrap = async query => { const result = await query; assert.ifError(result.error); return result.data }
const actor = client(fixture.anonKey)
await unwrap(actor.auth.signInWithPassword({ email: fixture.users[0].email, password: fixture.users[0].password }))
const auth = JSON.parse(execFileSync("docker", ["inspect", "supabase_auth_how-publication-stack"], { encoding: "utf8" }))[0]
const secret = auth.Config.Env.find(value => value.startsWith("GOTRUE_JWT_SECRET=")).slice("GOTRUE_JWT_SECRET=".length)
const head = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")
const body = Buffer.from(JSON.stringify({ role: "service_role", iss: "supabase", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")
const trusted = client(`${head}.${body}.${createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url")}`)
const initial = await unwrap(actor.from("site_settings_releases").select("id,payload").eq("is_current", true).single())
const bytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jxGkAAAAASUVORK5CYII=", "base64")
const paths = []
let ordinary
async function verifyPreview(email, password, admin) {
  const jar = new Map()
  const server = createServerClient(fixture.url, fixture.anonKey, { cookies: {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    setAll: cookies => { for (const cookie of cookies) jar.set(cookie.name, cookie.value) },
  } })
  await unwrap(server.auth.signInWithPassword({ email, password }))
  const response = await fetch(`${fixture.baseURL}/admin/preview`, { headers: { cookie: [...jar].map(([name, value]) => `${name}=${value}`).join("; ") }, redirect: "manual" })
  if (admin) { assert.equal(response.status, 200); assert.match(response.headers.get("cache-control"), /private|no-store/) }
  else assert.ok([307, 404].includes(response.status), "An ordinary user must not receive the preview document")
  await unwrap(server.auth.signOut({ scope: "local" }))
}
try {
  const file = new File([bytes], "editor-qa.png", { type: "image/png" })
  const first = await uploadSiteMedia(actor, file, "image")
  paths.push(first.path)
  const second = await uploadSiteMedia(actor, file, "image")
  paths.push(second.path)
  assert.notEqual(first.path, second.path)
  assert.deepEqual(Buffer.from(await (await fetch(first.url)).arrayBuffer()), bytes)
  assert.deepEqual(Buffer.from(await (await fetch(second.url)).arrayBuffer()), bytes)
  const pdfBytes = Buffer.from("%PDF-1.4\n% isolated API upload fixture\n%%EOF\n")
  const document = await uploadSiteMedia(actor, new File([pdfBytes], "editor-qa.pdf", { type: "application/pdf" }), "document")
  paths.push(document.path)
  assert.deepEqual(Buffer.from(await (await fetch(document.url)).arrayBuffer()), pdfBytes)
  const ordinaryPassword = `${randomUUID()}!Qa9`
  const created = await unwrap(trusted.auth.admin.createUser({ email: `editor-qa-${randomUUID()}@example.test`, password: ordinaryPassword, email_confirm: true }))
  ordinary = created.user.id
  const session = await unwrap(trusted.auth.admin.generateLink({ type: "magiclink", email: created.user.email }))
  const user = client(fixture.anonKey)
  await unwrap(user.auth.verifyOtp({ token_hash: session.properties.hashed_token, type: "magiclink" }))
  await assert.rejects(uploadSiteMedia(user, file, "image"), error => error.code === "admin_required")
  const forgedPath = `site-content/${ordinary}/${randomUUID()}.png`
  const denied = await user.storage.from("conference-media").upload(forgedPath, file)
  assert.ok(denied.error, "Storage must deny ordinary managed-media uploads even without the client guard")
  const anon = client(fixture.anonKey)
  const anonUpload = await anon.storage.from("conference-media").upload(`site-content/${ordinary}/${randomUUID()}.png`, file)
  assert.ok(anonUpload.error)
  await verifyPreview(fixture.users[0].email, fixture.users[0].password, true)
  await verifyPreview(created.user.email, ordinaryPassword, false)
  const anonymousPreview = await fetch(`${fixture.baseURL}/admin/preview`, { redirect: "manual" })
  assert.ok([307, 404].includes(anonymousPreview.status))
  assert.deepEqual(await unwrap(actor.from("site_settings_releases").select("id,payload").eq("is_current", true).single()), initial)
  console.log("PASS real Storage: admin PNG/PDF upload, byte delivery, fresh paths and retained original; ordinary/anonymous RLS denial; authenticated private preview and ordinary/anonymous denial; public settings unchanged.")
} finally {
  if (paths.length) await unwrap(trusted.storage.from("conference-media").remove(paths))
  if (ordinary) await unwrap(trusted.auth.admin.deleteUser(ordinary))
  await unwrap(actor.auth.signOut({ scope: "local" }))
  console.log("Removed the API test media and ordinary account.")
}
