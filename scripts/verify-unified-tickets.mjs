import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { randomUUID } from "node:crypto"

assert.equal(process.env.PUBLICATION_TEST_ISOLATED_PROJECT, "true", "Local isolated QA only")
const database = "how_audit_reliability_20261018"
const sql = query => {
  const result = spawnSync("docker", ["exec", "-i", "supabase_db_how-publication-stack", "psql", "-X", "-U", "postgres", "-d", database, "-Atq", "-v", "ON_ERROR_STOP=1"], { input: query, encoding: "utf8" })
  if (result.status !== 0) throw new Error(result.stderr)
  return result.stdout.trim()
}
assert.equal(sql("select current_database()"), database)
assert.equal(sql("select count(*) from pg_proc p join pg_namespace n on p.pronamespace=n.oid where n.nspname='public' and p.proname='admin_ticket_save'"), "1", "Unified save RPC is missing")
const [admin, member, ticket, individual, invalid, linked] = Array.from({ length: 6 }, randomUUID)
const act = (user, query) => sql(`BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub='${user}'; ${query}; COMMIT;`)
const rules = price => JSON.stringify({ enabled: true, minSize: 5, maxSize: 20, unitPriceCents: price, claimDeadline: null })
const save = (id, group, name = "Unified QA", expected = admin) => `select public.admin_ticket_save('${expected}','${id}','${name}','统一票种','','',true,4,true,false,${group === null ? "null" : `'${group}'::jsonb`})`
try {
  sql(`insert into auth.users(id,email,email_confirmed_at) values('${admin}','${admin}@example.test',now()),('${member}','${member}@example.test',now()); update public.profiles set role='admin' where id='${admin}';`)
  assert.throws(() => act(member, save(ticket, rules(20000), "Unauthorized", member)), /forbidden/)
  assert.throws(() => act(admin, save(ticket, rules(20000), "Stale", member)), /account_changed/)
  assert.equal(sql(`select count(*) from public.ticket_types where id='${ticket}'`), "0")
  assert.throws(() => act(admin, save(invalid, rules(-1))), /invalid_input/)
  assert.equal(sql(`select count(*) from public.ticket_types where id='${invalid}'`), "0", "Failed group save must roll back ticket creation")
  assert.equal(act(admin, save(ticket, rules(20000))), ticket)
  assert.equal(act(admin, save(ticket, rules(20000))), ticket)
  assert.equal(sql(`select count(*) from public.ticket_types where id='${ticket}'`), "1")
  assert.equal(sql(`select group_only||','||is_free||','||requires_code from public.ticket_types where id='${ticket}'`), "true,false,true")
  const order = act(member, `select public.group_order_create('${member}','${randomUUID()}','${ticket}',5,'Snapshot team')`)
  act(admin, save(ticket, rules(25000), "Updated QA"))
  assert.equal(sql(`select total_cents from public.group_orders where id='${order}'`), "100000")
  assert.equal(sql(`select unit_price_cents from public.group_ticket_configs where ticket_type_id='${ticket}'`), "25000")
  act(admin, save(ticket, rules(0)))
  assert.equal(sql(`select is_free from public.ticket_types where id='${ticket}'`), "t")
  assert.throws(() => act(admin, save(ticket, null)), /ticket_kind_locked/)
  assert.throws(() => act(admin, save(ticket, rules(-1), "Must roll back")), /invalid_input/)
  assert.equal(sql(`select name from public.ticket_types where id='${ticket}'`), "Unified QA")
  act(admin, save(individual, null))
  assert.equal(sql(`select group_only||','||is_free||','||requires_code from public.ticket_types where id='${individual}'`), "false,true,false")
  sql(`insert into public.registrations(user_id,ticket_type_id,name,email,phone,status,checked_in) values('${member}','${individual}','Member','${member}@example.test','+8613812345678','confirmed',false)`)
  assert.throws(() => act(admin, save(individual, rules(20000), "Must not convert")), /ticket_in_use/)
  assert.equal(sql(`select name||','||group_only from public.ticket_types where id='${individual}'`), "Unified QA,false")
  act(admin, save(linked, null))
  sql(`insert into public.channel_codes(code,name,ticket_type_id,is_active) values('UNIFIED-${linked}','Channel','${linked}',true)`)
  assert.throws(() => act(admin, save(linked, rules(20000))), /ticket_has_channels/)
  assert.equal(sql("select has_function_privilege('anon','public.admin_ticket_save(uuid,uuid,text,text,text,text,boolean,integer,boolean,boolean,jsonb)','EXECUTE')"), "f")
  assert.equal(sql("select prosecdef from pg_proc where oid='public.admin_ticket_save(uuid,uuid,text,text,text,text,boolean,integer,boolean,boolean,jsonb)'::regprocedure"), "f")
  console.log("PASS unified tickets: atomic create/update rollback, role/account checks, stable-ID retry, group price/free consistency, personal registration/channel conversion guard, immutable order snapshots, invoker/anonymous grants")
} finally {
  const ids = [ticket, individual, invalid, linked].map(id => `'${id}'`).join(",")
  sql(`delete from public.group_order_events where order_id in (select id from public.group_orders where ticket_type_id in (${ids})); delete from public.group_orders where ticket_type_id in (${ids}); delete from public.registrations where ticket_type_id in (${ids}); delete from public.channel_codes where ticket_type_id in (${ids}); delete from public.group_ticket_configs where ticket_type_id in (${ids}); delete from public.ticket_types where id in (${ids}); delete from auth.users where id in ('${admin}','${member}');`)
  console.log("PASS unified-ticket fixtures removed; production untouched")
}
