import assert from "node:assert/strict"
import { test } from "node:test"
import { existsSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

async function load(path) {
  const url = new URL(path, import.meta.url)
  assert.ok(existsSync(url), "The profile/check-in operation must validate its actual result")
  return import(url.href)
}
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", ...headers } })
function client(fetch) {
  return createClient("https://isolated.example.test", "test-key", { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch } })
}

test("profile saves reject denied and zero-row writes", async () => {
  const { saveProfile } = await load("../src/lib/profile/data.ts")
  for (const [data, status] of [[{ message: "denied" }, 403], [null, 200]]) {
    await assert.rejects(saveProfile(client(() => json(data, status)), "user-id", { full_name: "Draft" }))
  }
  const row = { id: "user-id", full_name: "Saved" }
  assert.deepEqual(await saveProfile(client((url, options) => {
    assert.equal(new URL(url).searchParams.get("id"), "eq.user-id")
    assert.match(options.headers.get("Prefer"), /return=representation/)
    return json(row)
  }), "user-id", { full_name: "Saved" }), row)
})

test("profile reads do not replace failed requests with empty activity", async () => {
  const { loadProfileData } = await load("../src/lib/profile/data.ts")
  await assert.rejects(loadProfileData(client(url => new URL(url).pathname.endsWith("sessions") ? json({ message: "denied" }, 403) : json({ id: "user" })), "user"))
})

test("personal cancellation requires an owned row and returned status", async () => {
  const { updateOwnRegistration } = await load("../src/lib/profile/data.ts")
  await assert.rejects(updateOwnRegistration(client(() => json(null)), "user", "reg", "cancelled"))
  const saved = await updateOwnRegistration(client(url => {
    const params = new URL(url).searchParams
    assert.equal(params.get("id"), "eq.reg")
    assert.equal(params.get("user_id"), "eq.user")
    return json({ id: "reg", status: "cancelled" })
  }), "user", "reg", "cancelled")
  assert.equal(saved.status, "cancelled")
})

test("failed avatar profile update rejects and removes the new upload", async () => {
  const { uploadProfileAvatar } = await load("../src/lib/profile/data.ts")
  const requests = []
  const db = client((url, options) => {
    requests.push({ url: String(url), method: options.method, body: options.body })
    if (String(url).includes("/rest/v1/profiles")) return options.method === "GET" ? json({ avatar_url: "old-url" }) : json({ message: "denied" }, 403)
    return json({ Key: "conference-media/avatars/user/photo.png" })
  })
  await assert.rejects(uploadProfileAvatar(db, "user", new File(["image"], "photo.png", { type: "image/png" })))
  assert.equal(requests.filter(r => r.method === "DELETE" && r.url.includes("/storage/v1/object/conference-media")).length, 1)
  assert.equal(requests.filter(r => r.method === "POST" && r.url.includes("/storage/v1/object/")).length, 1)
})

test("avatar cleanup preserves a file when readback confirms a committed save", async () => {
  const { uploadProfileAvatar } = await load("../src/lib/profile/data.ts")
  let savedURL
  let removals = 0
  const db = client((url, options) => {
    if (String(url).includes("/rest/v1/profiles")) {
      if (options.method === "GET") return json({ avatar_url: savedURL })
      savedURL = JSON.parse(options.body).avatar_url
      return json({ message: "Lost write response" }, 400)
    }
    if (options.method === "DELETE") removals++
    return json({ Key: "uploaded" })
  })
  await assert.rejects(uploadProfileAvatar(db, "user", new File(["image"], "photo.png", { type: "image/png" })))
  assert.ok(savedURL.includes("/avatars/user/"))
  assert.equal(removals, 0)
})

test("check-in counts reject failures instead of returning zeros", async () => {
  const { loadCheckinStats } = await load("../src/lib/admin/checkin.ts")
  await assert.rejects(loadCheckinStats(client(() => json({ message: "denied" }, 403))))
  const stats = await loadCheckinStats(client(url => new Response(null, { headers: { "content-range": `*/${new URL(url).searchParams.has("checked_in") ? 2 : 5}` } })))
  assert.deepEqual(stats, { total: 5, checkedIn: 2 })
})

test("check-in search quotes filter syntax and rejects unreadable results", async () => {
  const { searchCheckinRecords } = await load("../src/lib/admin/checkin.ts")
  const query = 'A, (B) "C" %_\\'
  const result = await searchCheckinRecords(client(url => {
    const params = new URL(url).searchParams
    const pattern = JSON.stringify('%A, (B) "C" \\%\\_\\\\%')
    assert.equal(params.get("or"), `(name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern})`)
    assert.equal(params.get("limit"), "20")
    return json([{ id: "match" }])
  }), query)
  assert.equal(result[0].id, "match")
  await assert.rejects(searchCheckinRecords(client(() => json({ message: "denied" }, 403)), "Alice"))
})

test("check-in writes require a returned row and guard concurrent status changes", async () => {
  const { updateCheckin } = await load("../src/lib/admin/checkin.ts")
  await assert.rejects(updateCheckin(client(() => json(null)), { id: "reg", checked_in: false }))
  const result = await updateCheckin(client((url, options) => {
    const params = new URL(url).searchParams
    assert.equal(params.get("checked_in"), "eq.false")
    assert.equal(params.get("status"), "eq.confirmed")
    assert.deepEqual(JSON.parse(options.body).checked_in, true)
    return json({ id: "reg", checked_in: true, checked_in_at: "2026-10-09T00:00:00Z" })
  }), { id: "reg", checked_in: false })
  assert.equal(result.checked_in, true)
})

test("printed badge treats all attendee and ticket content as text", async () => {
  const { buildBadgeHTML } = await load("../src/lib/admin/badge.ts")
  const reg = { name: '<img src=x onerror="alert(1)"> & "Name"', company: "</span><script>alert(1)</script>", ticket_types: { name: "English <Pass>", name_zh: "中文 <票>" } }
  const html = buildBadgeHTML(reg, "en")
  assert.ok(!html.includes("<img"))
  assert.ok(!html.includes("<script"))
  assert.ok(html.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &quot;Name&quot;"))
  assert.ok(html.includes("English &lt;Pass&gt;"))
  assert.ok(!html.includes("中文 &lt;票&gt;"))
  assert.match(html, /size:90mm 55mm/)
  assert.match(html, /Content-Security-Policy/)
  assert.ok(buildBadgeHTML(reg, "zh").includes("中文 &lt;票&gt;"))
})
