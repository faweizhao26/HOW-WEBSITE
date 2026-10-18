import assert from "node:assert/strict"
import { test } from "node:test"
import { mountAccountScreen, profile, user } from "./helpers/mount-account-screen.mjs"

for(const kind of ["profile","registration"]) {
  test(`${kind} clears private data immediately on account change and reloads the new owner`,async t=>{
    const h=mountAccountScreen(kind);t.after(h.unmount);await h.flush()
    assert.ok(h.hasSubscription(),"The screen must observe account changes")
    assert.ok(h.text().includes("A@example.test")||h.nodes().some(n=>n.props?.value==="A@example.test"))
    h.event("B")
    assert.ok(!h.text().includes("A@example.test"))
    await h.flush()
    assert.ok(h.text().includes("B@example.test")||h.nodes().some(n=>n.props?.value==="B@example.test"))
    const values=h.nodes().map(n=>n.props?.value).filter(v=>typeof v==="string")
    assert.ok(!values.some(v=>v.includes("A-private")))
    h.event(null);await h.flush()
    assert.ok(!h.text().includes("B@example.test"))
    assert.ok(!h.nodes().some(n=>typeof n.props?.value==="string"&&n.props.value.includes("B-private")))
  })
  test(`${kind} rejects a delayed old-owner load after an A-B-A switch`,async t=>{
    let release
    const deferred=new Promise(resolve=>{release=resolve})
    let calls=0
    const h=mountAccountScreen(kind,kind==="profile"?{loadProfile:async(_db,id)=>++calls===1?deferred:{profile:profile(id),sessions:[],registrations:[]}}:{loadRegistration:async()=>++calls===1?deferred:{user:user("A"),profile:profile("A"),tickets:[],registration:null}})
    t.after(h.unmount);await h.flush()
    assert.ok(h.hasSubscription())
    h.event("B");h.event("A");await h.flush()
    release(kind==="profile"?{profile:{...profile("A"),full_name:"stale-private-name"},sessions:[],registrations:[]}:{user:user("A"),profile:{...profile("A"),full_name:"stale-private-name"},tickets:[],registration:null})
    await h.flush()
    assert.ok(!h.text().includes("stale-private-name"))
    assert.ok(!h.nodes().some(n=>n.props?.value==="stale-private-name"))
  })
}

test("a delayed profile save cannot restore the old account after switching",async t=>{
  let release
  const h=mountAccountScreen("profile",{saveProfile:async()=>new Promise(resolve=>{release=resolve})});t.after(h.unmount);await h.flush()
  h.nodes().find(n=>n.type==="Button"&&n.props.children?.some?.(x=>x==="Edit"))?.props.onClick()
  h.render()
  const save=h.nodes().find(n=>n.type==="Button"&&n.props.onClick&&JSON.stringify(n.props.children).includes("Save"))
  assert.ok(save,"Profile save command exists")
  const pending=save.props.onClick();h.event("B");await h.flush()
  release({...profile("A"),full_name:"late-save-private-name"});await pending;h.render()
  assert.ok(!h.text().includes("late-save-private-name"))
  assert.ok(!h.nodes().some(n=>n.props?.value==="late-save-private-name"))
  assert.ok(h.text().includes("B@example.test"))
  assert.equal(h.notifications.length,0)
})

test("a delayed registration response cannot show the old owner's success after switching",async t=>{
  const a="11111111-1111-4111-8111-111111111111", b="22222222-2222-4222-8222-222222222222"
  let release
  const h=mountAccountScreen("registration",{initialUser:user(a),submitRegistration:async()=>new Promise(resolve=>{release=resolve})})
  t.after(h.unmount);await h.flush()
  const form=h.nodes().find(n=>n.type==="form")
  assert.ok(form);form.props.onSubmit({preventDefault(){}});await h.flush()
  assert.equal(typeof release,"function")
  h.event(b);await h.flush()
  release({success:true,data:{ticketName:"Old private ticket",ticketNameZh:""}})
  await Promise.all(h.transitions);await h.flush()
  assert.ok(!h.text().includes("Old private ticket"));assert.equal(h.notifications.length,0)
  assert.ok(h.nodes().some(n=>n.props?.value===`${b}@example.test`))
})
