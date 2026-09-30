import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { createClient } from "@supabase/supabase-js"

const env = process.env
for (const name of ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_EMAIL", "ADMIN_PASSWORD"]) {
  assert.ok(env[`PUBLICATION_TEST_${name}`], `Missing PUBLICATION_TEST_${name}`)
}
assert.equal(env.PUBLICATION_TEST_ISOLATED_PROJECT, "true", "Use an isolated test project only")
const options = { auth: { persistSession: false } }
const url = env.PUBLICATION_TEST_SUPABASE_URL
const admin = createClient(url, env.PUBLICATION_TEST_SUPABASE_ANON_KEY, options)
const anon = createClient(url, env.PUBLICATION_TEST_SUPABASE_ANON_KEY, options)
const cleanup = createClient(url, env.PUBLICATION_TEST_SUPABASE_SERVICE_ROLE_KEY, options)
const unwrap = async (query) => {
  const result = await query
  assert.equal(result.error, null, result.error?.message)
  return result.data
}
const login = await unwrap(admin.auth.signInWithPassword({ email: env.PUBLICATION_TEST_ADMIN_EMAIL, password: env.PUBLICATION_TEST_ADMIN_PASSWORD }))
assert.equal((await unwrap(admin.from("profiles").select("role").eq("id", login.user.id).single())).role, "admin")
for (const table of ["speakers", "sessions", "agenda_slots", "agenda_releases"]) {
  assert.deepEqual(await unwrap(admin.from(table).select("id")), [], `${table} must be empty before this test`)
}
const originalSettings = await unwrap(admin.from("site_settings").select("key,value"))
const originalRelease = await unwrap(admin.from("site_settings_releases").select("id,payload").eq("is_current", true).single())
const speakerId = randomUUID(), sessionId = randomUUID(), slotId = randomUUID()
const sponsorId = randomUUID(), postId = randomUUID()
const label = `Publication QA ${randomUUID()}`
const agendaIds = [], settingsIds = []
const publicSpeaker = () => unwrap(anon.from("published_speakers").select("name").eq("id", speakerId))
const current = (table) => unwrap(admin.from(table).select("id,payload").eq("is_current", true).single())
let checks = 0
const passed = (name) => { checks++; console.log(`PASS ${checks}: ${name}`) }

try {
  assert.ok((await anon.from("speakers").select("id")).error)
  await unwrap(admin.from("speakers").insert({ id: speakerId, name: label, bio: "Initial biography" }))
  assert.deepEqual(await publicSpeaker(), [])
  passed("anonymous draft denial and unpublished speaker isolation")

  assert.ok((await admin.from("published_speakers").insert({ id: speakerId, name: "Bypass" })).error)
  assert.ok((await admin.from("profiles").update({ role: "admin" }).eq("id", login.user.id)).error)
  passed("direct projection writes and API role changes are denied")

  await unwrap(admin.rpc("publish_speaker", { p_speaker_id: speakerId }))
  assert.deepEqual(await publicSpeaker(), [{ name: label }])
  await unwrap(admin.from("speakers").update({ name: `${label} revised` }).eq("id", speakerId))
  assert.deepEqual(await publicSpeaker(), [{ name: label }])
  await unwrap(admin.rpc("publish_speaker", { p_speaker_id: speakerId }))
  assert.deepEqual(await publicSpeaker(), [{ name: `${label} revised` }])
  passed("speaker publish, draft-edit isolation and republish")

  await unwrap(admin.from("sponsors").insert({ id: sponsorId, name: label, tier: "gold", logo_url: "https://example.test/logo.png" }))
  assert.deepEqual(await unwrap(anon.from("published_sponsors").select("name").eq("id", sponsorId)), [])
  await unwrap(admin.rpc("publish_sponsor", { p_sponsor_id: sponsorId }))
  await unwrap(admin.from("sponsors").update({ name: `${label} revised` }).eq("id", sponsorId))
  assert.deepEqual(await unwrap(anon.from("published_sponsors").select("name").eq("id", sponsorId)), [{ name: label }])
  await unwrap(admin.rpc("publish_sponsor", { p_sponsor_id: sponsorId }))
  assert.deepEqual(await unwrap(anon.from("published_sponsors").select("name").eq("id", sponsorId)), [{ name: `${label} revised` }])
  await unwrap(admin.rpc("unpublish_sponsor", { p_sponsor_id: sponsorId }))
  assert.deepEqual(await unwrap(anon.from("published_sponsors").select("id").eq("id", sponsorId)), [])
  passed("sponsor draft isolation, republish and withdrawal")

  await unwrap(admin.from("news_posts").insert({ id: postId, title: label, content: "Test news" }))
  assert.deepEqual(await unwrap(anon.from("published_news_posts").select("title").eq("id", postId)), [])
  await unwrap(admin.rpc("publish_news_post", { p_post_id: postId }))
  await unwrap(admin.from("news_posts").update({ title: `${label} revised` }).eq("id", postId))
  assert.deepEqual(await unwrap(anon.from("published_news_posts").select("title").eq("id", postId)), [{ title: label }])
  await unwrap(admin.rpc("publish_news_post", { p_post_id: postId }))
  assert.deepEqual(await unwrap(anon.from("published_news_posts").select("title").eq("id", postId)), [{ title: `${label} revised` }])
  await unwrap(admin.rpc("unpublish_news_post", { p_post_id: postId }))
  assert.deepEqual(await unwrap(anon.from("published_news_posts").select("id").eq("id", postId)), [])
  passed("news draft isolation, republish and withdrawal")

  await unwrap(admin.from("sessions").insert({ id: sessionId, user_id: login.user.id, title: label, abstract: "Test session", duration: 30, type: "talk", status: "pending" }))
  await unwrap(admin.from("sessions").update({ status: "approved", speaker_id: speakerId }).eq("id", sessionId))
  assert.deepEqual(await unwrap(anon.from("published_sessions").select("id").eq("id", sessionId)), [])
  await unwrap(admin.rpc("publish_session", { p_session_id: sessionId }))
  assert.deepEqual(await unwrap(anon.from("published_sessions").select("id").eq("id", sessionId)), [{ id: sessionId }])
  passed("session approval remains separate from publication")

  await unwrap(admin.from("agenda_slots").insert({ id: slotId, date: "2027-04-16", start_time: "09:00", end_time: "09:30", type: "session", session_id: sessionId, label: "" }))
  await unwrap(admin.rpc("publish_agenda"))
  const firstAgenda = await current("agenda_releases")
  agendaIds.push(firstAgenda.id)
  await unwrap(admin.from("agenda_slots").update({ date: "2027-04-19" }).eq("id", slotId))
  assert.ok((await admin.rpc("publish_agenda")).error)
  assert.deepEqual(await current("agenda_releases"), firstAgenda)
  await unwrap(admin.from("agenda_slots").update({ date: "2027-04-18" }).eq("id", slotId))
  await unwrap(admin.rpc("publish_agenda"))
  const secondAgenda = await current("agenda_releases")
  agendaIds.push(secondAgenda.id)
  assert.notEqual(secondAgenda.id, firstAgenda.id)
  await unwrap(admin.rpc("rollback_agenda_release", { p_release_id: firstAgenda.id }))
  assert.deepEqual(await current("agenda_releases"), firstAgenda)
  passed("agenda validation is atomic; complete release and rollback work")

  await unwrap(admin.from("site_settings").update({ value: label }).eq("key", "hero_title"))
  assert.deepEqual(await current("site_settings_releases"), originalRelease)
  await unwrap(admin.rpc("publish_site_settings"))
  const newSettings = await current("site_settings_releases")
  settingsIds.push(newSettings.id)
  assert.equal(newSettings.payload.hero_title, label)
  await unwrap(admin.rpc("rollback_site_settings_release", { p_release_id: originalRelease.id }))
  assert.deepEqual(await current("site_settings_releases"), originalRelease)
  passed("settings draft isolation, complete publication and rollback")

  assert.deepEqual(await unwrap(anon.from("agenda_releases").select("id")), [{ id: firstAgenda.id }])
  assert.deepEqual(await unwrap(anon.from("site_settings_releases").select("id")), [{ id: originalRelease.id }])
  passed("anonymous readers only see the current release")

  await unwrap(admin.from("sessions").update({ speaker_id: null }).eq("id", sessionId))
  await unwrap(admin.rpc("unpublish_session", { p_session_id: sessionId }))
  assert.deepEqual(await unwrap(anon.from("published_sessions").select("id").eq("id", sessionId)), [])
  assert.deepEqual(await current("agenda_releases"), firstAgenda)
  await unwrap(admin.rpc("unpublish_speaker", { p_speaker_id: speakerId }))
  assert.deepEqual(await publicSpeaker(), [])
  passed("withdrawal works after unbinding; historical agenda snapshot stays intact")
  console.log(`PASS: ${checks} authenticated Auth/Data API lifecycle groups`)
} finally {
  const failures = []
  const clean = async (query) => { const result = await query; if (result.error) failures.push(result.error.message) }
  await clean(cleanup.from("site_settings").upsert(originalSettings))
  await clean(admin.rpc("rollback_site_settings_release", { p_release_id: originalRelease.id }))
  if (settingsIds.length) await clean(cleanup.from("site_settings_releases").delete().in("id", settingsIds))
  if (agendaIds.length) await clean(cleanup.from("agenda_releases").delete().in("id", agendaIds))
  await clean(cleanup.from("agenda_slots").delete().eq("id", slotId))
  await clean(cleanup.from("published_sessions").delete().eq("id", sessionId))
  await clean(cleanup.from("sessions").delete().eq("id", sessionId))
  await clean(cleanup.from("published_speakers").delete().eq("id", speakerId))
  await clean(cleanup.from("speakers").delete().eq("id", speakerId))
  await clean(cleanup.from("published_sponsors").delete().eq("id", sponsorId))
  await clean(cleanup.from("sponsors").delete().eq("id", sponsorId))
  await clean(cleanup.from("published_news_posts").delete().eq("id", postId))
  await clean(cleanup.from("news_posts").delete().eq("id", postId))
  await admin.auth.signOut({ scope: "local" })
  assert.deepEqual(failures, [], "Test cleanup failed")
}
