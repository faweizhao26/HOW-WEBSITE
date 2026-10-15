import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { spawn, spawnSync } from "node:child_process"

assert.equal(process.env.PUBLICATION_TEST_ISOLATED_PROJECT, "true", "Explicit isolated local test environment required")
const ids = Array.from({ length: 3 }, () => randomUUID())
const [admin, user, other] = ids
const run = sql => spawnSync("docker", ["exec", "-i", "supabase_db_how-publication-stack", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"], { input: sql, encoding: "utf8" })
const as = (id, sql) => `SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${id}',true); ${sql} RESET ROLE;`
const sql = `BEGIN;
INSERT INTO auth.users(id,email) VALUES ${ids.map((id, i) => `('${id}','account-db-${i}-${admin}@example.test')`).join(",")};
UPDATE public.profiles SET role='admin' WHERE id='${admin}';
${as(admin, `DO $$ DECLARE result jsonb; BEGIN
  result := public.list_managed_accounts('account-db-', 'all', 1);
  ASSERT (result->>'total')::int = 3, 'Search must include all matching registered accounts';
  ASSERT result->>'currentUserId' = '${admin}';
  result := public.list_managed_accounts('%account-db-', 'all', 1);
  ASSERT (result->>'total')::int = 0, 'Search wildcards must be literal';
  BEGIN PERFORM public.change_managed_account_role('${user}', 'owner', 'user'); RAISE EXCEPTION 'Invalid role accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'ACCOUNT_INVALID' THEN RAISE; END IF; END;
  BEGIN INSERT INTO public.account_role_changes(actor_name,target_name,old_role,new_role) VALUES('forged','forged','user','admin'); RAISE EXCEPTION 'Forged audit accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM public.change_managed_account_role('${user}', 'admin', 'user');
  ASSERT (SELECT role FROM public.profiles WHERE id='${user}') = 'admin';
  ASSERT (SELECT count(*) FROM public.account_role_changes WHERE target_id='${user}' AND actor_id='${admin}' AND new_role='admin') = 1;
  PERFORM public.change_managed_account_role('${user}', 'admin', 'admin');
  ASSERT (SELECT count(*) FROM public.account_role_changes WHERE target_id='${user}') = 1, 'No-op edits must not duplicate history';
  BEGIN PERFORM public.change_managed_account_role('${user}', 'user', 'user'); RAISE EXCEPTION 'Conflict accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'ACCOUNT_ROLE_CONFLICT' THEN RAISE; END IF; END;
  BEGIN PERFORM public.change_managed_account_role('${admin}', 'user', 'admin'); RAISE EXCEPTION 'Self removal accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'ACCOUNT_SELF_REVOKE' THEN RAISE; END IF; END;
END $$;`)}
${as(user, `SELECT public.change_managed_account_role('${other}', 'admin', 'user');`)}
${as(admin, `SELECT public.change_managed_account_role('${user}', 'user', 'admin'); SELECT public.change_managed_account_role('${other}', 'user', 'admin');`)}
${as(user, `DO $$ BEGIN
  BEGIN PERFORM public.list_managed_accounts('', 'all', 1); RAISE EXCEPTION 'Non-admin read accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'ACCOUNT_FORBIDDEN' THEN RAISE; END IF; END;
  BEGIN PERFORM public.change_managed_account_role('${user}', 'admin', 'user'); RAISE EXCEPTION 'Self escalation accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'ACCOUNT_FORBIDDEN' THEN RAISE; END IF; END;
  BEGIN UPDATE public.profiles SET role='admin' WHERE id='${user}'; RAISE EXCEPTION 'Direct role update accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  ASSERT (SELECT count(*) FROM public.account_role_changes) = 0, 'Ordinary users must not read role history';
END $$;`)}
SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN PERFORM public.list_managed_accounts('', 'all', 1); RAISE EXCEPTION 'Anonymous read accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.change_managed_account_role('${user}', 'admin', 'user'); RAISE EXCEPTION 'Anonymous edit accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
UPDATE public.profiles SET role='user' WHERE role='admin' AND id <> '${admin}';
${as(admin, `DO $$ BEGIN
  BEGIN PERFORM public.change_managed_account_role('${admin}', 'user', 'admin'); RAISE EXCEPTION 'Last admin removed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'ACCOUNT_LAST_ADMIN' THEN RAISE; END IF; END;
END $$;`)}
INSERT INTO auth.users(id,email) SELECT gen_random_uuid(), 'account-pages-${admin}-' || i || '@example.test' FROM generate_series(1,25) i;
${as(admin, `DO $$ DECLARE result jsonb; BEGIN
  result := public.list_managed_accounts('account-pages-${admin}', 'all', 2);
  ASSERT (result->>'total')::int = 25 AND jsonb_array_length(result->'accounts') = 5;
  ASSERT (result->>'page')::int = 2;
  result := public.list_managed_accounts('account-pages-${admin}', 'all', 99);
  ASSERT (result->>'page')::int = 2, 'Out-of-range pages must clamp';
  result := public.list_managed_accounts('account-pages-${admin}', 'admin', 1);
  ASSERT (result->>'total')::int = 0;
END $$;`)}
ROLLBACK;`
const result = run(sql)
assert.equal(result.status, 0, result.stderr)
console.log("PASS: real database search, grants, revocations, audit, stale-role conflicts, last-admin protection and RLS; all fixtures rolled back")

// A request already waiting for the role lock must lose authority after revocation.
const setup = run(`INSERT INTO auth.users(id,email) VALUES ${ids.map((id, i) => `('${id}','account-race-${i}-${admin}@example.test')`).join(",")}; UPDATE public.profiles SET role='admin' WHERE id IN ('${admin}','${user}');`)
assert.equal(setup.status, 0, setup.stderr)
let holder
try {
  holder = spawn("docker", ["exec", "-i", "supabase_db_how-publication-stack", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At"], { stdio: ["pipe", "pipe", "pipe"] })
  let errors = "", output = ""
  holder.stderr.on("data", chunk => { errors += chunk })
  const complete = new Promise((resolve, reject) => {
    holder.on("error", reject)
    holder.on("close", code => code === 0 ? resolve() : reject(new Error(errors)))
  })
  const locked = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out acquiring the role lock")), 10000)
    holder.stdout.on("data", chunk => { output += chunk; if (output.includes("LOCKED")) { clearTimeout(timeout); resolve() } })
    complete.catch(error => { clearTimeout(timeout); reject(error) })
  })
  holder.stdin.end(`BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${admin}',true); SELECT public.change_managed_account_role('${user}','user','admin'); SELECT 'LOCKED'; SELECT pg_sleep(2); COMMIT;`)
  await locked
  const pending = run(`BEGIN; ${as(user, `SELECT public.change_managed_account_role('${other}','admin','user');`)} COMMIT;`)
  await complete
  assert.notEqual(pending.status, 0, "Revoked administrator was able to grant while queued")
  assert.match(pending.stderr, /ACCOUNT_FORBIDDEN/)
  const checked = run(`DO $$ BEGIN ASSERT (SELECT role FROM public.profiles WHERE id='${other}')='user'; ASSERT (SELECT count(*) FROM public.account_role_changes WHERE target_id='${user}')=1; END $$;`)
  assert.equal(checked.status, 0, checked.stderr)
  console.log("PASS: a queued request rechecks the caller after concurrent revocation")
} finally {
  if (holder && holder.exitCode === null) { holder.kill("SIGTERM"); await new Promise(resolve => holder.once("close", resolve)) }
  const cleanup = run(`DELETE FROM public.account_role_changes WHERE actor_id IN (${ids.map(id => `'${id}'`).join(",")}) OR target_id IN (${ids.map(id => `'${id}'`).join(",")}); DELETE FROM auth.users WHERE id IN (${ids.map(id => `'${id}'`).join(",")});`)
  assert.equal(cleanup.status, 0, cleanup.stderr)
}
