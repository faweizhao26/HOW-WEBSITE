import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { createHmac } from "node:crypto"
import { readFile, writeFile, unlink } from "node:fs/promises"
import { createClient } from "@supabase/supabase-js"

assert.equal(process.env.PUBLICATION_TEST_ISOLATED_PROJECT, "true", "Explicit local test environment required")
const dbName = "supabase_db_how-publication-stack"
const storageName = "supabase_storage_how-publication-stack"
const inspect = name => JSON.parse(execFileSync("docker", ["inspect", name], { encoding: "utf8" }))[0]
const envOf = container => Object.fromEntries(container.Config.Env.map(value => { const at = value.indexOf("="); return [value.slice(0, at), value.slice(at + 1)] }))
const db = inspect(dbName), auth = inspect("supabase_auth_how-publication-stack")
const password = envOf(db).POSTGRES_PASSWORD
const secret = envOf(auth).GOTRUE_JWT_SECRET
assert.ok(password && secret, "Private local DB credentials required")
const token = role => {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")
  const payload = Buffer.from(JSON.stringify({ iss: "supabase", role, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 * 30 })).toString("base64url")
  return `${header}.${payload}.${createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url")}`
}
const sql = input => {
  const result = spawnSync("docker", ["exec", "-i", dbName, "psql", "-U", "supabase_admin", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At"], { input, encoding: "utf8" })
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.trim()
}
const trusted = createClient("http://127.0.0.1:55421", token("service_role"), { auth: { persistSession: false, autoRefreshToken: false } })
const fixtureFile = "/private/tmp/how-cfp-settings-qa.json"
const fixture = JSON.parse(await readFile(fixtureFile, "utf8"))
assert.equal(fixture.url, "http://127.0.0.1:55421")

if (process.argv.includes("--cleanup")) {
  const paths = fixture.mediaPaths || []
  assert.ok(paths.every(path => path.startsWith(`site-content/${fixture.users[0].id}/`)), "Only own QA objects may be removed")
  if (paths.length) {
    const result = await trusted.storage.from("conference-media").remove(paths)
    assert.ifError(result.error)
  }
  fixture.mediaPaths = []
  await writeFile(fixtureFile, JSON.stringify(fixture), { mode: 0o600 })
  console.log("Removed this QA administrator's recorded media objects only.")
} else {
  let exists = spawnSync("docker", ["inspect", storageName], { encoding: "utf8" }).status === 0
  if (exists && process.argv.includes("--refresh-jwks")) {
    assert.equal(inspect(storageName).Config.Image, "supabase/storage-api:v1.74.0")
    assert.equal(sql("select count(*) from storage.objects;"), "0", "Do not discard any stored test objects")
    execFileSync("docker", ["rm", "-f", storageName], { stdio: "pipe" })
    exists = false
  }
  if (!exists) {
    if (!process.argv.includes("--refresh-jwks")) assert.equal(sql("select count(*) from pg_tables where schemaname='storage';"), "0", "Do not replace an existing Storage installation")
    sql(`ALTER SCHEMA storage OWNER TO supabase_storage_admin; ALTER ROLE supabase_storage_admin PASSWORD '${password.replaceAll("'", "''")}';`)
    const environment = {
      ANON_KEY: token("anon"), SERVICE_KEY: token("service_role"), AUTH_JWT_SECRET: secret,
      JWT_JWKS: JSON.stringify(await (await fetch(`${fixture.url}/auth/v1/.well-known/jwks.json`)).json()),
      POSTGREST_URL: "http://supabase_rest_how-publication-stack:3000",
      DATABASE_URL: `postgresql://supabase_storage_admin:${encodeURIComponent(password)}@${dbName}:5432/postgres`,
      STORAGE_PUBLIC_URL: "http://127.0.0.1:55421", REQUEST_ALLOW_X_FORWARDED_PATH: "true",
      FILE_SIZE_LIMIT: "10485760", STORAGE_BACKEND: "file", GLOBAL_S3_BUCKET: "how-editor-qa",
      FILE_STORAGE_BACKEND_PATH: "/var/lib/storage", TENANT_ID: "how-publication-stack", REGION: "local", ENABLE_IMAGE_TRANSFORMATION: "false",
    }
    const environmentFile = "/private/tmp/how-editor-storage.env"
    await writeFile(environmentFile, Object.entries(environment).map(([key, value]) => `${key}=${value}`).join("\n"), { mode: 0o600 })
    try {
      execFileSync("docker", ["run", "-d", "--name", storageName, "--label", "how.editor.qa=true", "--network", Object.keys(db.NetworkSettings.Networks)[0], "--env-file", environmentFile, "supabase/storage-api:v1.74.0"], { stdio: "pipe" })
    } finally { await unlink(environmentFile) }
  } else execFileSync("docker", ["start", storageName], { stdio: "pipe" })
  let ready = false
  for (let index = 0; index < 60; index++) {
    const response = await fetch("http://127.0.0.1:55421/storage/v1/status").catch(() => null)
    if (response?.ok) { ready = true; break }
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  assert.ok(ready, "Local Storage did not become ready; inspect its container log")
  const bucket = await trusted.storage.getBucket("conference-media")
  if (bucket.error) {
    const created = await trusted.storage.createBucket("conference-media", { public: true })
    assert.ifError(created.error)
    sql(`CREATE POLICY "Admin upload access" ON storage.objects FOR INSERT WITH CHECK (bucket_id='conference-media' AND EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='admin'));
CREATE POLICY "Admin delete access" ON storage.objects FOR DELETE USING (bucket_id='conference-media' AND EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='admin'));`)
    sql(await readFile(new URL("../supabase/migrations/20261010094629_avatar_storage_ownership.sql", import.meta.url), "utf8"))
  }
  console.log("Real isolated Storage ready with production-equivalent admin and avatar RLS policies. No production writes.")
}
