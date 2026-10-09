import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { createClient } from "@supabase/supabase-js"
import { loadProfileData, saveProfile, updateOwnRegistration } from "../src/lib/profile/data.ts"
import { loadCheckinStats, searchCheckinRecords, updateCheckin } from "../src/lib/admin/checkin.ts"

const env = process.env
assert.equal(env.PUBLICATION_TEST_ISOLATED_PROJECT, "true", "Use an isolated project only")
const url = env.PUBLICATION_TEST_SUPABASE_URL
assert.ok(url && ["localhost", "127.0.0.1"].includes(new URL(url).hostname), "Use the local stack only")
const fixture = JSON.parse(await readFile(env.ADMIN_QA_FIXTURE_PATH || "/private/tmp/how-admin-qa-fixture.json", "utf8"))
assert.equal(fixture.url, url)
const options = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(url, env.PUBLICATION_TEST_SUPABASE_ANON_KEY, options)
const attendee = createClient(url, env.PUBLICATION_TEST_SUPABASE_ANON_KEY, options)
const trusted = createClient(url, env.PUBLICATION_TEST_SUPABASE_SERVICE_ROLE_KEY, options)
const unwrap = async promise => { const result = await promise; if (result.error) throw result.error; return result.data }
const [adminId, attendeeId] = fixture.users
const [aliceId, bobId] = fixture.registrations
await unwrap(admin.auth.signInWithPassword({ email: fixture.email, password: fixture.password }))
await unwrap(attendee.auth.signInWithPassword({ email: fixture.email.replace("admin-", "attendee-"), password: fixture.password }))
const original = await loadProfileData(attendee, attendeeId)
const bob = await unwrap(trusted.from("registrations").select("*").eq("id", bobId).single())
try {
  const saved = await saveProfile(attendee, attendeeId, { full_name: "QA Profile Saved", company: "QA Company" })
  assert.equal(saved.full_name, "QA Profile Saved")
  assert.equal((await loadProfileData(attendee, attendeeId)).profile.company, "QA Company")
  await assert.rejects(saveProfile(attendee, adminId, { full_name: "Must not save" }))
  console.log("PASS real profile save/readback and denied other-user write")

  assert.equal((await updateOwnRegistration(attendee, attendeeId, bobId, "confirmed")).status, "confirmed")
  assert.equal((await updateOwnRegistration(attendee, attendeeId, bobId, "cancelled")).status, "cancelled")
  await assert.rejects(updateOwnRegistration(attendee, attendeeId, aliceId, "cancelled"))
  console.log("PASS real cancellation/restore and ownership protection")

  assert.equal((await searchCheckinRecords(admin, '"A", Zhang')).some(row => row.id === aliceId), true)
  const specialName = 'QA A, (B) "C" %_\\ end'
  await unwrap(trusted.from("registrations").update({ name: specialName }).eq("id", bobId))
  const records = await searchCheckinRecords(admin, 'A, (B) "C" %_\\')
  assert.deepEqual(records.map(row => row.id), [bobId])
  assert.deepEqual(await searchCheckinRecords(admin, "%_"), records)
  assert.ok(Object.values(await loadCheckinStats(admin)).every(Number.isInteger))
  console.log("PASS real punctuation/quoted/literal wildcard search and exact counts")

  const alice = { id: aliceId, checked_in: false }
  assert.equal((await updateCheckin(admin, alice)).checked_in, true)
  await assert.rejects(updateCheckin(admin, alice))
  assert.equal((await updateCheckin(admin, { id: aliceId, checked_in: true })).checked_in, false)
  await assert.rejects(updateCheckin(admin, { id: bobId, checked_in: false }))
  console.log("PASS real check-in/undo, stale-state rejection and cancelled-registration rejection")
} finally {
  await unwrap(trusted.from("profiles").update({ full_name: original.profile.full_name, company: original.profile.company }).eq("id", attendeeId))
  await unwrap(trusted.from("registrations").update({ name: bob.name, status: bob.status, checked_in: bob.checked_in, checked_in_at: bob.checked_in_at }).eq("id", bobId))
  await unwrap(trusted.from("registrations").update({ checked_in: false, checked_in_at: null }).eq("id", aliceId))
  await admin.auth.signOut({ scope: "local" })
  await attendee.auth.signOut({ scope: "local" })
}
