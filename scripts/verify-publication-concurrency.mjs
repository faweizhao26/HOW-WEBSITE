import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { spawn, spawnSync } from "node:child_process"

const container = process.env.PUBLICATION_DB_CONTAINER || "how-content-db"
const database = process.env.PUBLICATION_DB_NAME || "how_publication_hardened"
const args = ["exec", container, "psql", "-U", "postgres", "-d", database, "-v", "ON_ERROR_STOP=1", "-A", "-t", "-c"]
const adminId = randomUUID()
const run = (sql) => spawnSync("docker", [...args, sql], { encoding: "utf8" })
const setup = run(`INSERT INTO auth.users(id,email) VALUES('${adminId}','concurrency-${adminId}@example.test'); UPDATE public.profiles SET role='admin' WHERE id='${adminId}';`)
assert.equal(setup.status, 0, setup.stderr)
let holder
try {
  holder = spawn("docker", [...args.slice(0, -1), "-c", `BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub='${adminId}'; SELECT public.publish_site_settings();`, "-c", "SELECT 'LOCKED';", "-c", "SELECT pg_sleep(3); ROLLBACK;"])
  let output = "", errors = ""
  const complete = new Promise((resolve, reject) => {
    holder.on("error", reject)
    holder.stderr.on("data", (data) => { errors += data })
    holder.on("close", (status) => status === 0 ? resolve() : reject(new Error(errors || `Holder failed: ${status}`)))
  })
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Publication lock was not acquired")), 10_000)
    holder.stdout.on("data", (data) => {
      output += data
      if (output.includes("LOCKED")) { clearTimeout(timeout); resolve() }
    })
    complete.catch((error) => { clearTimeout(timeout); reject(error) })
  })
  const edit = run("BEGIN; SET LOCAL statement_timeout='600ms'; UPDATE public.site_settings SET value='Concurrent edit' WHERE key='hero_title'; ROLLBACK;")
  assert.notEqual(edit.status, 0, "Concurrent draft edit unexpectedly bypassed the publication lock")
  assert.match(edit.stderr, /canceling statement due to statement timeout/)
  const publish = run(`BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub='${adminId}'; SET LOCAL statement_timeout='600ms'; SELECT public.publish_site_settings(); ROLLBACK;`)
  assert.notEqual(publish.status, 0, "Concurrent publisher unexpectedly bypassed the publication lock")
  assert.match(publish.stderr, /canceling statement due to statement timeout/)
  await complete
  console.log("PASS: publication blocks concurrent draft edits and serialises publishers; all changes rolled back")
} finally {
  if (holder && holder.exitCode === null) {
    holder.kill("SIGTERM")
    await new Promise((resolve) => holder.once("close", resolve))
  }
  const cleanup = run(`DELETE FROM auth.users WHERE id='${adminId}';`)
  assert.equal(cleanup.status, 0, cleanup.stderr)
}
