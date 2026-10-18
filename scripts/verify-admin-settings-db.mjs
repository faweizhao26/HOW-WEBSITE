// Run only after main applies the draft migration to an isolated local database.
// PUBLICATION_TEST_ISOLATED_PROJECT=true ADMIN_SETTINGS_DB_CONTAINER=<local-container>
// ADMIN_SETTINGS_DB_NAME=postgres node scripts/verify-admin-settings-db.mjs
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { spawn, spawnSync } from "node:child_process"

assert.equal(process.env.PUBLICATION_TEST_ISOLATED_PROJECT, "true", "Explicit isolated local environment required")
const container = process.env.ADMIN_SETTINGS_DB_CONTAINER
assert.ok(container, "ADMIN_SETTINGS_DB_CONTAINER must name the isolated local Docker database")
const database = process.env.ADMIN_SETTINGS_DB_NAME || "postgres"
const args = ["exec", "-i", container, "psql", "-X", "-U", "postgres", "-d", database, "-v", "ON_ERROR_STOP=1", "-Atq"]
const run = sql => {
  const result = spawnSync("docker", args, { input: sql, encoding: "utf8", timeout: 30_000 })
  if (result.error) throw result.error
  assert.equal(result.status, 0, result.stderr || result.stdout)
  return result.stdout.trim()
}
const admin = randomUUID(), user = randomUUID(), marker = `audit_settings_${randomUUID()}`
const login = (id = admin) => `SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${id}',true); SELECT set_config('request.jwt.claims','{"sub":"${id}","role":"authenticated"}',true);`
const fixture = `INSERT INTO auth.users(id,email) VALUES ('${admin}','${admin}@example.test'),('${user}','${user}@example.test'); UPDATE public.profiles SET role='admin' WHERE id='${admin}';`
const snapshot = "COALESCE((SELECT jsonb_object_agg(key,value) FROM public.site_settings),'{}'::jsonb)"

const checks = run(`
BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL statement_timeout='15s';
${fixture}
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.proname='save_site_settings_draft' AND n.nspname IN ('public','private') AND (p.prosecdef <> (n.nspname='private') OR NOT ('search_path=""'=ANY(p.proconfig)))) THEN
    RAISE EXCEPTION 'RPC security mode/search_path mismatch';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='public.site_settings'::regclass AND relrowsecurity) THEN RAISE EXCEPTION 'RLS disabled'; END IF;
  IF has_table_privilege('authenticated','public.site_settings','INSERT,UPDATE,DELETE,TRUNCATE')
    OR has_any_column_privilege('authenticated','public.site_settings','INSERT,UPDATE')
    OR has_table_privilege('anon','public.site_settings','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') THEN RAISE EXCEPTION 'Direct table grants bypass RPC'; END IF;
  IF has_function_privilege('anon','public.save_site_settings_draft(jsonb,jsonb)','EXECUTE')
    OR has_function_privilege('anon','private.save_site_settings_draft(jsonb,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous RPC grant'; END IF;
END $$;
SELECT 'PASS security modes, locked paths, RLS and table/column privileges';
INSERT INTO public.site_settings(key,value,updated_at) VALUES ('${marker}','old','2000-01-01');
SELECT set_config('how.settings_baseline', (${snapshot})::text, true);
${login()}
DO $$ DECLARE baseline jsonb := current_setting('how.settings_baseline')::jsonb; saved jsonb; release_id uuid; BEGIN
  saved := public.save_site_settings_draft(baseline, baseline || jsonb_build_object('${marker}','new'));
  IF saved <> ${snapshot} THEN RAISE EXCEPTION 'Returned snapshot is incomplete'; END IF;
  IF (SELECT updated_at FROM public.site_settings WHERE key='${marker}') <= '2000-01-01'::timestamptz THEN RAISE EXCEPTION 'updated_at trigger stopped working'; END IF;
  BEGIN
    PERFORM public.save_site_settings_draft(baseline, baseline || '{"contact_email":"stale@example.test"}');
    RAISE EXCEPTION 'Stale full snapshot accepted';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
  BEGIN
    PERFORM public.save_site_settings_draft(saved - '${marker}', saved);
    RAISE EXCEPTION 'Partial baseline accepted';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
  BEGIN
    PERFORM public.save_site_settings_draft(saved || '{"site_content":"remote content"}', saved);
    RAISE EXCEPTION 'site_content baseline mismatch accepted';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
  IF saved <> ${snapshot} THEN RAISE EXCEPTION 'Conflict partially wrote draft'; END IF;
  BEGIN
    PERFORM public.save_site_settings_draft(saved, '{"bad":null}');
    RAISE EXCEPTION 'Non-string settings accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN
    INSERT INTO public.site_settings(key,value) VALUES ('${marker}','bypass') ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value;
    RAISE EXCEPTION 'Direct admin upsert succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.site_settings SET value='bypass' WHERE key='${marker}';
    RAISE EXCEPTION 'Direct admin update succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    DELETE FROM public.site_settings WHERE key='${marker}';
    RAISE EXCEPTION 'Direct admin delete succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  release_id := public.publish_site_settings();
  IF NOT EXISTS (SELECT 1 FROM public.site_settings_releases WHERE id=release_id AND is_current AND payload=saved) THEN RAISE EXCEPTION 'Publication no longer captures saved draft'; END IF;
  PERFORM public.rollback_site_settings_release(release_id);
  PERFORM private.publish_site_settings();
  PERFORM private.rollback_site_settings_release(release_id);
  IF NOT EXISTS (SELECT 1 FROM public.site_settings_releases WHERE id=release_id AND is_current) THEN RAISE EXCEPTION 'Private publication/rollback compatibility broken'; END IF;
END $$;
SELECT 'PASS full snapshot conflict, atomicity, trigger, no direct writes, public/private publication and rollback';
RESET ROLE;
${login(user)}
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.site_settings) THEN RAISE EXCEPTION 'Non-admin read draft'; END IF;
  BEGIN
    PERFORM public.save_site_settings_draft('{}','{}');
    RAISE EXCEPTION 'Non-admin public RPC succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM private.save_site_settings_draft('{}','{}');
    RAISE EXCEPTION 'Non-admin private RPC succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM public.save_site_settings_draft('{}','{}');
    RAISE EXCEPTION 'Anonymous public RPC succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
-- Remove read grants temporarily: SECURITY DEFINER must still work, not depend on caller DML.
REVOKE SELECT ON public.site_settings FROM authenticated;
${login()}
SELECT public.save_site_settings_draft(current_setting('how.settings_baseline')::jsonb || jsonb_build_object('${marker}','new'), current_setting('how.settings_baseline')::jsonb);
RESET ROLE;
DELETE FROM public.site_settings;
${login()}
DO $$ BEGIN
  IF public.save_site_settings_draft('{}','{"initial":"value"}') <> '{"initial":"value"}'::jsonb THEN RAISE EXCEPTION 'Empty initial save failed'; END IF;
  BEGIN
    PERFORM public.save_site_settings_draft('{}','{"initial":"stale"}');
    RAISE EXCEPTION 'Competing initial save succeeded';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
  IF public.save_site_settings_draft('{"initial":"value"}','{}') <> '{}'::jsonb THEN RAISE EXCEPTION 'Empty draft replacement failed'; END IF;
END $$;
RESET ROLE;
SELECT 'PASS non-admin/anonymous rejection, definer grants and empty initial draft';
ROLLBACK;
`)
console.log(checks.split("\n").filter(line => line.startsWith("PASS")).join("\n"))
for (const isolation of ["REPEATABLE READ", "SERIALIZABLE"]) {
  run(`BEGIN ISOLATION LEVEL ${isolation}; ${fixture} ${login()} DO $$ BEGIN
    BEGIN
      PERFORM public.save_site_settings_draft('{}','{}');
      RAISE EXCEPTION 'Snapshot-isolated save accepted a potentially old snapshot';
    EXCEPTION WHEN SQLSTATE '25001' THEN NULL; END;
  END $$; ROLLBACK;`)
}
console.log("PASS snapshot-isolated calls fail explicitly instead of comparing an old snapshot")

// Two independent connections use the same baseline. Only one committed save may win.
const firstKey = `${marker}_first`, secondKey = `${marker}_second`
let holder
try {
  run(fixture)
  const baseline = run(`SELECT ${snapshot}`)
  const expected = `'${baseline.replaceAll("'", "''")}'::jsonb`
  let complete
  const readyHolder = async (sql, finish) => {
    const child = spawn("docker", args, { stdio: ["pipe", "pipe", "pipe"] })
    holder = child
    let output = "", errors = ""
    complete = new Promise((resolve, reject) => {
      child.on("error", reject)
      child.stderr.on("data", data => { errors += data })
      child.on("close", status => status === 0 ? resolve() : reject(new Error(errors)))
    })
    const ready = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Settings lock was not acquired")), 10_000)
      child.stdout.on("data", data => { output += data; if (output.includes("LOCKED")) { clearTimeout(timeout); resolve() } })
      complete.catch(error => { clearTimeout(timeout); reject(error) })
    })
    child.stdin.end(`BEGIN ISOLATION LEVEL READ COMMITTED; ${login()} ${sql}; SELECT 'LOCKED'; SELECT pg_sleep(3); ${finish};`)
    await ready
  }
  await readyHolder(`SELECT public.save_site_settings_draft(${expected}, ${expected} || jsonb_build_object('${firstKey}','winner'))`, "COMMIT")
  run(`BEGIN ISOLATION LEVEL READ COMMITTED; SET LOCAL statement_timeout='10s'; ${login()} DO $$ BEGIN
    BEGIN
      PERFORM public.save_site_settings_draft(${expected}, ${expected} || jsonb_build_object('${secondKey}','loser'));
      RAISE EXCEPTION 'Concurrent stale save succeeded';
    EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
  END $$; ROLLBACK;`)
  await complete
  assert.equal(run(`SELECT value FROM public.site_settings WHERE key='${firstKey}'`), "winner")
  assert.equal(run(`SELECT count(*) FROM public.site_settings WHERE key='${secondKey}'`), "0")
  console.log("PASS concurrent writers serialize and the stale writer cannot overwrite the winner")
  const blocked = sql => {
    const result = spawnSync("docker", args, { input: `BEGIN ISOLATION LEVEL READ COMMITTED; SET LOCAL statement_timeout='400ms'; ${login()} ${sql}; ROLLBACK;`, encoding: "utf8", timeout: 10_000 })
    assert.notEqual(result.status, 0, "Operation bypassed the settings/publication lock")
    assert.match(result.stderr, /statement timeout/)
  }
  await readyHolder("SELECT public.publish_site_settings()", "ROLLBACK")
  blocked(`SELECT public.save_site_settings_draft(${expected},${expected})`)
  await complete
  await readyHolder(`SELECT public.save_site_settings_draft(${snapshot},${snapshot})`, "ROLLBACK")
  blocked("SELECT public.publish_site_settings()")
  blocked("SELECT public.rollback_site_settings_release((SELECT id FROM public.site_settings_releases WHERE is_current))")
  await complete
  console.log("PASS settings saves serialize with existing publish and rollback functions")
} finally {
  if (holder && holder.exitCode === null) {
    holder.kill("SIGTERM")
    await new Promise(resolve => holder.once("close", resolve))
  }
  run(`BEGIN; DELETE FROM public.site_settings WHERE key IN ('${firstKey}','${secondKey}'); DELETE FROM auth.users WHERE id IN ('${admin}','${user}'); COMMIT;`)
}
console.log("PASS verification fixtures removed; no migration was applied by this script")
