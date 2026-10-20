import assert from "node:assert/strict"
import { readFile, writeFile } from "node:fs/promises"
import { spawnSync } from "node:child_process"
import { randomUUID, createHmac } from "node:crypto"
import { cpus, totalmem, platform } from "node:os"
import { fileURLToPath } from "node:url"
import autocannon from "autocannon"
import { localLoadOrigin, loadLevels } from "./lib/load-target.mjs"

assert.equal(process.env.PUBLICATION_TEST_ISOLATED_PROJECT, "true", "Explicit local isolated environment required")
const app = localLoadOrigin(process.env.HOW_LOAD_APP_URL || "http://127.0.0.1:3040")
const fixturePath = process.env.HOW_LOAD_FIXTURE
assert.ok(fixturePath, "HOW_LOAD_FIXTURE must point to an existing private local-stack fixture")
const fixture = JSON.parse(await readFile(fixturePath, "utf8"))
const api = localLoadOrigin(fixture.url)
assert.equal(app, localLoadOrigin(fixture.appURL), "Only the preview paired with this isolated fixture may be tested")
assert.equal(fixture.database, "how_audit_reliability_20261018", "Use the dedicated disposable QA database, never a normal database")
assert.equal(fixture.db, "supabase_db_how-publication-stack")
const levels = loadLevels(process.env.HOW_LOAD_LEVELS)
const duration = Number(process.env.HOW_LOAD_DURATION || 10)
assert.ok(Number.isInteger(duration) && duration >= 2 && duration <= 30)
const mode = process.env.HOW_LOAD_MODE || "all"
assert.ok(["all", "browse", "writes"].includes(mode))
const readWorkers = Number(process.env.HOW_LOAD_WORKERS || 1)
assert.ok(Number.isInteger(readWorkers) && readWorkers >= 1 && readWorkers <= 4)
if (readWorkers > 1) assert.ok(levels.every(level => level % readWorkers === 0), "Connection levels must divide evenly across workers")
const reportPath = process.env.HOW_LOAD_REPORT
assert.ok(reportPath, "HOW_LOAD_REPORT must name the output JSON file")
const sql = statement => {
  const result = spawnSync("docker", ["exec", "-i", fixture.db, "psql", "-X", "-U", "postgres", "-d", fixture.database, "-Atq", "-v", "ON_ERROR_STOP=1"], { input: statement, encoding: "utf8", timeout: 30000 })
  if (result.error) throw result.error
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.trim()
}
assert.equal(sql("SELECT current_database()"), fixture.database)
assert.equal(sql("SELECT count(*) FROM pg_extension WHERE extname='pg_stat_statements'"), "1", "Enable pg_stat_statements in the disposable QA database first")
const publicStats = () => JSON.parse(sql(`SELECT json_build_object('calls',coalesce(sum(calls),0),'executionMs',coalesce(sum(total_exec_time),0)) FROM extensions.pg_stat_statements
  WHERE dbid=(SELECT oid FROM pg_database WHERE datname=current_database()) AND query LIKE 'WITH pgrst_source AS%'
  AND (query LIKE '%"site_settings_releases"%' OR query LIKE '%"published_sessions"%' OR query LIKE '%"published_sponsors"%' OR query LIKE '%"published_speakers"%' OR query LIKE '%"published_news_posts"%' OR query LIKE '%"agenda_releases"%')`))
const counts = () => JSON.parse(sql("SELECT json_build_object('users',(SELECT count(*) FROM auth.users),'registrations',(SELECT count(*) FROM public.registrations),'tickets',(SELECT count(*) FROM public.ticket_types))"))
const initial = counts()
const report = {
  date: new Date().toISOString(), label: process.env.HOW_LOAD_LABEL || "local", app, api, database: fixture.database,
  environment: { platform: platform(), cpu: cpus()[0].model, logicalCpus: cpus().length, hostMemoryGB: Math.round(totalmem() / 1024 ** 3), databaseMaxConnections: Number(sql("SHOW max_connections")), openFileLimit: process.report.getReport().userLimits?.open_files ?? null },
  scope: "Local single-machine HTTP/1.1 closed-loop tests; no browser assets, login/email, WAN, Vercel scaling or physical printing. Connections are not online visitors.",
  cases: [],
}
const save = () => writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", { mode: 0o600 })
const percentile = (values, rank) => values.length ? values[Math.ceil(values.length * rank) - 1] : null
async function measure(name, connections, options, validate) {
  const latencies = []
  const transportErrors = {}
  const before = publicStats()
  const instance = autocannon({ url: app, connections, pipelining: 1, duration, timeout: 15, bailout: 25, ...options })
  const watchdog = setTimeout(() => instance.stop(), Math.max(45000, (options.amount ? 45 : duration + 20) * 1000))
  instance.on("response", (_client, _status, _bytes, elapsed) => { if (Number.isFinite(elapsed)) latencies.push(elapsed) })
  instance.on("reqError", error => { const code = error?.code || error?.message || "unknown"; transportErrors[code] = (transportErrors[code] || 0) + 1 })
  let result
  try { result = await instance } finally { clearTimeout(watchdog) }
  latencies.sort((a, b) => a - b)
  const after = publicStats()
  const entry = {
    name, connections, workers: options.workers || 1, seconds: result.duration, completed: result.requests.total, requestsPerSecond: result.requests.average,
    p50Ms: percentile(latencies, .5), p95Ms: percentile(latencies, .95), p99Ms: percentile(latencies, .99),
    p97_5Ms: result.latency.p97_5,
    errors: result.errors, timeouts: result.timeouts, non2xx: result.non2xx, mismatches: result.mismatches,
    statuses: result.statusCodeStats, transportErrors, publicDatabaseReads: after.calls - before.calls, publicDatabaseExecutionMs: after.executionMs - before.executionMs,
  }
  entry.passed = !entry.errors && !entry.timeouts && !entry.non2xx && !entry.mismatches && (!options.amount || entry.completed === options.amount) && (validate?.() ?? true)
  report.cases.push(entry)
  await save()
  console.log(JSON.stringify(entry))
  assert.ok(entry.passed, `${name} at ${connections} connections failed; stopped before higher load`)
  return entry
}

const header = { apikey: fixture.anon, "content-type": "application/json", prefer: "return=representation" }
const runId = randomUUID()
const adminId = randomUUID(), ticketId = randomUUID()
const people = Array.from({ length: Math.max(...levels) }, (_, index) => ({ id: randomUUID(), email: `load-${runId}-${index}@example.test`, name: `Load ${index + 1}` }))
let seeded = false
// Local fixture tokens exercise real PostgREST JWT verification and RLS, not signup or password authentication.
const token = person => {
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url")
  const value = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: person.id, email: person.email, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}`
  return `${value}.${createHmac("sha256", fixture.secret).update(value).digest("base64url")}`
}
try {
  for (const path of ["/", "/api/conference-content"]) {
    const response = await fetch(app + path, { signal: AbortSignal.timeout(15000), redirect: "error" })
    assert.equal(response.status, 200)
    const body = await response.text()
    assert.ok(path === "/" ? body.includes('data-content-state="ready"') : JSON.parse(body).status === "ready", "A content error page is not a passing response")
  }
  if (mode !== "writes") for (const connections of levels) {
    const workers = readWorkers > 1 ? readWorkers : undefined
    await measure("home", connections, { workers, verifyBody: workers ? fileURLToPath(new URL("./lib/load-home-body.cjs", import.meta.url)) : body => body.includes('data-content-state="ready"') })
    await measure("public-content-api", connections, { url: app + "/api/conference-content", workers, verifyBody: workers ? fileURLToPath(new URL("./lib/load-api-body.cjs", import.meta.url)) : body => { try { return JSON.parse(body).status === "ready" } catch { return false } } })
  }
  if (mode !== "browse") {
    const admin = { id: adminId, email: `load-${runId}-admin@example.test` }
    const users = [...people, admin]
    sql(`BEGIN; INSERT INTO auth.users(id,email,email_confirmed_at) VALUES ${users.map(p => `('${p.id}','${p.email}',now())`).join(",")}; UPDATE public.profiles SET role='admin' WHERE id='${adminId}'; INSERT INTO public.ticket_types(id,name,is_active,is_free,requires_code) VALUES ('${ticketId}','Load ${runId}',true,true,false); COMMIT;`)
    seeded = true
    const adminHeaders = { ...header, authorization: `Bearer ${token(admin)}` }
    const person = people[0]
    const record = { user_id: person.id, email: person.email, name: person.name, phone: "+12025550123", ticket_type_id: ticketId, status: "confirmed", checked_in: false }
    const burst = async (path, options) => Promise.all(Array.from({ length: 20 }, async () => {
      const response = await fetch(api + path, { ...options, redirect: "error", signal: AbortSignal.timeout(15000) })
      const data = await response.json()
      return { status: response.status, data }
    }))
    const duplicates = await burst("/rest/v1/registrations?select=id", { method: "POST", headers: { ...header, authorization: `Bearer ${token(person)}` }, body: JSON.stringify(record) })
    assert.equal(duplicates.filter(r => r.status === 201).length, 1)
    assert.equal(duplicates.filter(r => r.status === 409 && r.data.code === "23505").length, 19)
    const registrationId = duplicates.find(r => r.status === 201).data[0].id
    const checkins = await burst(`/rest/v1/registrations?id=eq.${registrationId}&checked_in=eq.false&status=eq.confirmed&select=id,checked_in`, {
      method: "PATCH", headers: { ...adminHeaders, accept: "application/vnd.pgrst.object+json" }, body: JSON.stringify({ checked_in: true, checked_in_at: new Date().toISOString() }),
    })
    assert.equal(checkins.filter(r => r.status === 200 && r.data.checked_in === true).length, 1)
    assert.equal(checkins.filter(r => r.status === 406).length, 19)
    assert.equal(Number(sql(`SELECT count(*) FROM public.registrations WHERE ticket_type_id='${ticketId}' AND checked_in`)), 1)
    report.races = [{ name: "same-account-registration", attempts: 20, saved: 1, conflicts: 19 }, { name: "same-record-checkin", attempts: 20, saved: 1, conflicts: 19 }]
    await save()
    console.log(JSON.stringify({ races: report.races }))
    for (const connections of levels) {
      sql(`DELETE FROM public.registrations WHERE ticket_type_id='${ticketId}'`)
      let index = 0
      await measure("registration-insert-api", connections, {
        url: api, amount: connections,
        requests: [{ method: "POST", path: "/rest/v1/registrations?select=id,user_id,status", setupRequest(request, context) {
          const person = people[index++]
          assert.ok(person, "Fixture count exhausted")
          context.userId = person.id
          return { ...request, headers: { ...header, authorization: `Bearer ${token(person)}` }, body: JSON.stringify({ user_id: person.id, email: person.email, name: person.name, phone: "+12025550123", ticket_type_id: ticketId, status: "confirmed", checked_in: false }) }
        } }], verifyBody: body => { try { const rows = JSON.parse(body); return rows.length === 1 && rows[0].status === "confirmed" && !!rows[0].id } catch { return false } },
      }, () => Number(sql(`SELECT count(*) FROM public.registrations WHERE ticket_type_id='${ticketId}'`)) === connections)
      const registrations = JSON.parse(sql(`SELECT json_agg(id ORDER BY id) FROM public.registrations WHERE ticket_type_id='${ticketId}'`))
      index = 0
      await measure("checkin-update-api", connections, {
        url: api, amount: connections,
        requests: [{ method: "PATCH", setupRequest(request) {
          const id = registrations[index++]
          assert.ok(id)
          return { ...request, path: `/rest/v1/registrations?id=eq.${id}&checked_in=eq.false&status=eq.confirmed&select=id,checked_in`, headers: adminHeaders, body: JSON.stringify({ checked_in: true, checked_in_at: new Date().toISOString() }) }
        } }], verifyBody: body => { try { const rows = JSON.parse(body); return rows.length === 1 && rows[0].checked_in === true } catch { return false } },
      }, () => Number(sql(`SELECT count(*) FROM public.registrations WHERE ticket_type_id='${ticketId}' AND checked_in`)) === connections)
    }
  }
} finally {
  if (seeded) sql(`BEGIN; DELETE FROM public.registrations WHERE ticket_type_id='${ticketId}'; DELETE FROM public.ticket_types WHERE id='${ticketId}'; DELETE FROM auth.users WHERE id IN (${[...people.map(p => p.id), adminId].map(id => `'${id}'`).join(",")}); COMMIT;`)
  report.fixtureCleanup = { expected: initial, actual: counts() }
  report.fixtureCleanup.passed = JSON.stringify(initial) === JSON.stringify(report.fixtureCleanup.actual)
  await save()
  assert.ok(report.fixtureCleanup.passed, "Local fixture cleanup changed baseline row counts")
}
console.log(JSON.stringify({ report: reportPath, cases: report.cases.length, cleanup: true, productionRequests: 0 }))
