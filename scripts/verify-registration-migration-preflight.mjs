import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { spawnSync } from "node:child_process"

assert.equal(process.env.PUBLICATION_TEST_ISOLATED_PROJECT, "true")
assert.ok(["localhost", "127.0.0.1"].includes(new URL(process.env.PUBLICATION_TEST_SUPABASE_URL).hostname))
const fixture = JSON.parse(await readFile(process.env.REGISTRATION_QA_FIXTURE_PATH || "/private/tmp/how-registration-qa-fixture.json", "utf8"))
assert.equal(fixture.url, process.env.PUBLICATION_TEST_SUPABASE_URL)
const user = fixture.users[1]
assert.match(user, /^[0-9a-f-]{36}$/)
const dockerArgs = ["exec", "-i", "supabase_db_how-publication-stack", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At"]
function query(sql) {
  const result = spawnSync("docker", dockerArgs, { input: sql, encoding: "utf8" })
  if (result.error) throw result.error
  return result
}
const snapshotSQL = `
SELECT json_build_object(
  'count', (SELECT count(*) FROM public.registrations),
  'owner_count', (SELECT count(*) FROM public.registrations WHERE user_id='${user}'::uuid),
  'unique', (SELECT indisunique FROM pg_index WHERE indexrelid='public.registrations_one_per_user'::regclass),
  'identity', md5(pg_get_functiondef('private.registration_identity_valid(text,text)'::regprocedure))
);`
const before = query(snapshotSQL)
assert.equal(before.status, 0, before.stderr)
assert.equal(JSON.parse(before.stdout).owner_count, 1)
const migration = await readFile(new URL("../supabase/migrations/20261009105046_registration_integrity.sql", import.meta.url), "utf8")
const failure = query(`
BEGIN;
DROP INDEX public.registrations_one_per_user;
INSERT INTO public.registrations(user_id,ticket_type_id,name,email,phone,status)
SELECT user_id,ticket_type_id,name,email,phone,status FROM public.registrations WHERE user_id='${user}'::uuid;
` + migration)
assert.notEqual(failure.status, 0)
assert.match(failure.stderr, /Resolve existing duplicate registrations before applying this migration/)
const after = query(snapshotSQL)
assert.equal(after.status, 0, after.stderr)
assert.deepEqual(JSON.parse(after.stdout), JSON.parse(before.stdout))
console.log("PASS full migration rejects existing duplicates; transaction rollback preserves rows, unique index and function definition")
