import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
assert.equal(process.env.PUBLICATION_TEST_ISOLATED_PROJECT, "true")
const container = "supabase_db_how-publication-stack"
const source = "how_audit_reliability_20261018", target = "how_group_migration_20261028"
const sql = (database, query) => execFileSync("docker", ["exec", "-i", container, "psql", "-X", "-U", "postgres", "-d", database, "-Atq", "-v", "ON_ERROR_STOP=1"], { input: query, encoding: "utf8" }).trim()
assert.equal(sql(source,"select current_database()"),source)
assert.equal(sql("postgres",`select count(*) from pg_database where datname='${target}'`),"0","Do not overwrite a retained migration test database")
sql("postgres",`create database ${target}`)
try {
  const schema = execFileSync("docker", ["exec",container,"pg_dump","-U","postgres","--schema-only","--no-owner","--no-privileges","-d",source],{encoding:"utf8",maxBuffer:20*1024*1024})
  sql(target,schema)
  sql(target,"drop trigger if exists guard_group_ticket_insert on public.registrations; drop table public.group_order_events,public.group_seats,public.group_orders,public.group_ticket_configs cascade; alter table public.ticket_types drop column group_only")
  sql(target,readFileSync(new URL("../supabase/migrations/20261028092935_group_ticket_orders.sql",import.meta.url),"utf8"))
  assert.equal(sql(target,"select count(*) from pg_class where relname in ('group_orders','group_seats','group_ticket_configs','group_order_events') and relrowsecurity"),"4")
  assert.equal(sql(target,"select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'group_%' and not p.prosecdef"),"9")
  console.log("PASS final migration applied from pre-feature schema; 4 RLS tables and 9 invoker RPCs")
} finally {
  sql("postgres",`drop database ${target}`)
  console.log("PASS disposable migration database removed")
}
