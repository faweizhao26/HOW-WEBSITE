import assert from "node:assert/strict"
import { test } from "node:test"
import { spawnSync, spawn } from "node:child_process"
import { randomUUID } from "node:crypto"
assert.equal(process.env.PUBLICATION_TEST_ISOLATED_PROJECT, "true")
const args = ["exec","-i","supabase_db_how-publication-stack","psql","-X","-U","postgres","-d","how_audit_reliability_20261018","-Atq","-v","ON_ERROR_STOP=1"]
const sql = query => { const r = spawnSync("docker",args,{input:query,encoding:"utf8"}); if(r.status)throw Error(r.stderr);return r.stdout.trim() }
const as = (id,q) => `BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub='${id}'; ${q}; COMMIT;`
function execute(query) {
  const p=spawn("docker",args);let out="",error=""
  const done=new Promise(resolve=>{p.stdout.on("data",d=>{out+=d});p.stderr.on("data",d=>{error+=d});p.on("close",status=>resolve({status,out,error}));p.on("error",e=>resolve({status:-1,error:e.message}))})
  p.stdin.end(query);return {p,done}
}
async function holder(query) {
  const run=execute(`BEGIN; ${query}; SELECT 'LOCKED'; SELECT pg_sleep(2); COMMIT;`)
  await new Promise((resolve,reject)=>{let text="";const t=setTimeout(()=>reject(Error("lock not acquired")),10000);run.p.stdout.on("data",d=>{text+=d;if(text.includes("LOCKED")){clearTimeout(t);resolve()}});run.done.then(r=>{if(r.status){clearTimeout(t);reject(Error(r.error))}})})
  return run
}
function fixture() {
  const [admin,user,ticket]=Array.from({length:3},()=>randomUUID())
  sql(`insert into auth.users(id,email,email_confirmed_at) values('${admin}','edge-${admin}@example.test',now()),('${user}','edge-${user}@example.test',now());update public.profiles set role='admin' where id='${admin}';insert into public.ticket_types(id,name,is_active,is_free,requires_code)values('${ticket}','Edge QA',true,true,false)`)
  const run=(id,q)=>sql(as(id,q))
  const configure=()=>run(admin,`select public.group_ticket_config_save('${admin}','${ticket}',true,2,10,100,null)`)
  const create=()=>run(user,`select public.group_order_create('${user}','${randomUUID()}','${ticket}',2,'Edge QA')`)
  const activate=o=>run(admin,`select public.group_order_activate('${admin}','${o}','${o}',200)`)
  const cleanup=()=>sql(`delete from public.group_order_events where order_id in(select id from public.group_orders where ticket_type_id='${ticket}');delete from public.group_orders where ticket_type_id='${ticket}';delete from public.registrations where ticket_type_id='${ticket}';delete from public.group_ticket_configs where ticket_type_id='${ticket}';delete from public.ticket_types where id='${ticket}';delete from auth.users where id in('${admin}','${user}')`)
  return {admin,user,ticket,run,configure,create,activate,cleanup}
}
test("ordinary registration cannot race conversion to a group-only ticket",async()=>{
  const f=fixture()
  try {
    const hold=await holder(`SET LOCAL ROLE authenticated;SET LOCAL request.jwt.claim.sub='${f.admin}';select public.group_ticket_config_save('${f.admin}','${f.ticket}',true,2,10,100,null)`)
    const insert=execute(as(f.user,`insert into public.registrations(user_id,ticket_type_id,name,email,phone,status,checked_in)values('${f.user}','${f.ticket}','Edge','edge-${f.user}@example.test','+8613812345678','confirmed',false)`))
    const [h,r]=await Promise.all([hold.done,insert.done]);assert.equal(h.status,0,h.error)
    assert.notEqual(r.status,0,"Unpaid registration bypassed concurrent group conversion")
  } finally {f.cleanup()}
})
test("activation and claim recheck real time after waiting for the order lock",async()=>{
  const f=fixture()
  try {
    f.configure();const o=f.create()
    sql(`update public.group_orders set expires_at=clock_timestamp()+interval '1 second' where id='${o}'`)
    let hold=await holder(`select id from public.group_orders where id='${o}' for update`)
    let op=execute(as(f.admin,`select public.group_order_activate('${f.admin}','${o}','${o}',200)`))
    let [h,r]=await Promise.all([hold.done,op.done]);assert.equal(h.status,0,h.error);assert.notEqual(r.status,0,"Activation succeeded after expiry while waiting")
    sql(`update public.group_orders set expires_at=clock_timestamp()+interval '1 day' where id='${o}'`);f.activate(o)
    const code=sql(`select code from public.group_seats where order_id='${o}' limit 1`)
    sql(`update public.group_orders set claim_deadline=clock_timestamp()+interval '1 second' where id='${o}'`)
    hold=await holder(`select id from public.group_orders where id='${o}' for update`)
    op=execute(as(f.user,`select public.group_seat_redeem('${f.user}','${code}','Valid','+8613812345678','','')`))
    ;[h,r]=await Promise.all([hold.done,op.done]);assert.equal(h.status,0,h.error);assert.notEqual(r.status,0,"Claim succeeded after deadline while waiting")
  } finally {f.cleanup()}
})
test("direct redemption RPC rejects Unicode whitespace-only badge names",()=>{
  const f=fixture()
  try {
    f.configure();const o=f.create();f.activate(o)
    const code=sql(`select code from public.group_seats where order_id='${o}' limit 1`)
    for(const name of ["\t\n","\u3000","\u00a0\ufeff"])assert.throws(()=>f.run(f.user,`select public.group_seat_redeem('${f.user}','${code}','${name}','+8613812345678','','')`),/invalid_input/)
    assert.equal(sql(`select count(*) from public.registrations where ticket_type_id='${f.ticket}'`),"0")
  } finally {f.cleanup()}
})
