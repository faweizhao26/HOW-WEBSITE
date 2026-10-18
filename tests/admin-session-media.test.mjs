import assert from "node:assert/strict"
import { test } from "node:test"
import { createClient } from "@supabase/supabase-js"

const api = await import("../src/lib/admin/session-media.ts").catch(() => ({}))
const id = "11111111-1111-4111-8111-111111111111"
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

function harness({ write = "ok", reference = "old", readFails = false, publishedReference = false, publishedReadFails = false, removeFails = false, uploadFails = false, type = "slides" } = {}) {
  let uploadedUrl, uploadedPath, fileExists = false, lateCommitted = false
  const events = []
  const field = `${type}_url`
  const db = createClient("https://isolated.example.test", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, options) => {
      const url = new URL(input)
      if (url.pathname.includes("/storage/v1/object/") && options.method === "POST") {
        events.push("upload")
        fileExists = true
        uploadedPath = decodeURIComponent(url.pathname.split("/conference-media/")[1])
        uploadedUrl = `https://isolated.example.test/storage/v1/object/public/conference-media/${uploadedPath}`
        return uploadFails ? json({ message: "upload denied" }, 403) : json({ Key: `conference-media/${uploadedPath}`, Id: "object-id" })
      }
      if (options.method === "DELETE") {
        events.push("remove")
        fileExists = false
        assert.deepEqual(JSON.parse(options.body).prefixes, [uploadedPath])
        return removeFails ? json({ message: "remove denied" }, 403) : json([])
      }
      if (url.pathname === "/rest/v1/published_sessions") {
        events.push("published-read")
        assert.equal(url.searchParams.get("id"), `eq.${id}`)
        return publishedReadFails ? json({ message: "denied" }, 403) : json(publishedReference ? { id, [field]: uploadedUrl } : null)
      }
      assert.equal(url.pathname, "/rest/v1/sessions")
      assert.equal(url.searchParams.get("id"), `eq.${id}`)
      if (options.method === "PATCH") {
        assert.equal(url.searchParams.get("select"), "id,slides_url,video_url")
        events.push("write")
        assert.deepEqual(JSON.parse(options.body), { [field]: uploadedUrl })
        if (write === "throw" || write === "delayed") throw new Error("connection lost")
        if (write === "gateway") return json({ message: "upstream timeout" }, 504)
        if (write === "error") return json({ code: "42501", message: "denied" }, 403)
        if (write === "zero") return json(null)
        if (write === "wrong-id") return json({ id: "wrong", [field]: uploadedUrl })
        if (write === "wrong-link") return json({ id, [field]: "old" })
        return json({ id, [field]: uploadedUrl })
      }
      events.push("read")
      if (readFails) return json({ message: "offline" }, 503)
      return json(reference === "missing" ? null : { id, [field]: reference === "new" || lateCommitted ? uploadedUrl : "old" })
    } },
  })
  return { db, events, url: () => uploadedUrl, commit: () => { lateCommitted = true }, fileExists: () => fileExists }
}

test("session media confirms target id and stored link for slides and video", async () => {
  assert.equal(typeof api.uploadSessionMedia, "function")
  for (const type of ["slides", "video"]) {
    const h = harness({ type })
    assert.equal(await api.uploadSessionMedia(h.db, id, new File(["content"], "talk.pdf"), type), h.url())
    assert.deepEqual(h.events, ["upload", "write"])
  }
})

test("DB errors, zero rows and mismatched confirmations fail; cleanup follows reference read", async () => {
  assert.equal(typeof api.uploadSessionMedia, "function")
  for (const write of ["error", "zero", "wrong-id", "wrong-link"]) {
    const h = harness({ write })
    await assert.rejects(api.uploadSessionMedia(h.db, id, new File(["content"], "talk.pdf"), "slides"))
    assert.deepEqual(h.events, ["upload", "write", "read", "published-read", "remove"])
  }
})

test("ambiguous DB failure never deletes the upload if referenced or reference cannot be verified", async () => {
  assert.equal(typeof api.uploadSessionMedia, "function")
  for (const options of [{ write: "error", reference: "new" }, { write: "error", readFails: true }, { write: "zero", reference: "missing" }]) {
    const h = harness(options)
    await assert.rejects(api.uploadSessionMedia(h.db, id, new File(["content"], "talk.pdf"), "slides"))
    assert.deepEqual(h.events.slice(0, 3), ["upload", "write", "read"])
    assert.ok(h.events.slice(3).every(event => event === "read"), "Read retries must never remove the upload")
  }
})

test("transport failures retain an upload while the original write can still commit later", async () => {
  for (const write of ["delayed", "gateway"]) {
    const h = harness({ write })
    await assert.rejects(api.uploadSessionMedia(h.db, id, new File(["content"], "talk.pdf"), "slides"))
    h.commit()
    assert.ok(h.fileExists(), "A late committed media URL must still have its file")
    assert.ok(!h.events.includes("remove"))
  }
})

test("a published session reference or unverifiable published row prevents cleanup", async () => {
  assert.equal(typeof api.uploadSessionMedia, "function")
  for (const options of [{ write: "error", publishedReference: true }, { write: "error", publishedReadFails: true }]) {
    const h = harness(options)
    await assert.rejects(api.uploadSessionMedia(h.db, id, new File(["content"], "talk.pdf"), "slides"))
    assert.ok(!h.events.includes("remove"), "Published or unknown references must retain the upload")
  }
})

test("cleanup errors cannot turn a failed save into success and upload failures do not write DB", async () => {
  assert.equal(typeof api.uploadSessionMedia, "function")
  const h = harness({ write: "error", removeFails: true })
  await assert.rejects(api.uploadSessionMedia(h.db, id, new File(["content"], "talk.pdf"), "slides"))
  const denied = harness({ uploadFails: true })
  await assert.rejects(api.uploadSessionMedia(denied.db, id, new File(["content"], "talk.pdf"), "slides"))
  assert.deepEqual(denied.events, ["upload"])
})
