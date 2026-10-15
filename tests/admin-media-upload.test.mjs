import assert from "node:assert/strict"
import { test } from "node:test"
const api = await import("../src/lib/admin/media-upload.ts").catch(() => ({}))
const owner = "11111111-1111-4111-8111-111111111111"
const image = () => new File([Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82])], "logo.png", { type: "image/png" })
function client({ role = "admin", error = null, wrongPath = false, changedOwner = false } = {}) {
  const writes = [], removed = []
  let reads = 0
  return { writes, removed, db: {
    auth: { getUser: async () => ({ data: { user: { id: changedOwner && reads++ > 0 ? "22222222-2222-4222-8222-222222222222" : owner } }, error: null }) },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { role }, error: null }) }) }) }),
    storage: { from: bucket => { assert.equal(bucket, "conference-media"); return {
      upload: async (path, file, options) => { writes.push({ path, file, options }); return { data: error ? null : { path: wrongPath ? "wrong" : path }, error } },
      getPublicUrl: path => ({ data: { publicUrl: `https://isolated.example.test/storage/v1/object/public/conference-media/${path}` } }),
      remove: async paths => { removed.push(...paths); return { error: null } },
    } } },
  } }
}

test("admin media uses a fresh owner-scoped path without replacing existing files", async () => {
  assert.equal(typeof api.uploadSiteMedia, "function")
  const h = client(), result = await api.uploadSiteMedia(h.db, image(), "image")
  assert.match(result.path, new RegExp(`^site-content/${owner}/[a-f0-9-]+\\.png$`))
  assert.equal(h.writes[0].options.upsert, false)
  assert.equal(h.writes[0].options.contentType, "image/png")
  assert.ok(result.url.endsWith(result.path))
  assert.deepEqual(h.removed, [])
})

test("invalid file types, signatures and sizes fail before storage writes", async () => {
  for (const [file, kind] of [[new File(["not an image"], "bad.png", { type: "image/png" }), "image"], [new File(["%PDF-1.7\n%%EOF"], "file.pdf", { type: "application/pdf" }), "image"], [new File([new Uint8Array(5*1024*1024+1)], "big.png", { type: "image/png" }), "image"]]) {
    const h = client()
    await assert.rejects(api.uploadSiteMedia(h.db, file, kind))
    assert.equal(h.writes.length, 0)
  }
  const h = client(), file = new File(["%PDF-1.7\n%%EOF"], "guide.pdf", { type: "application/pdf" })
  assert.ok((await api.uploadSiteMedia(h.db, file, "document")).path.endsWith(".pdf"))
})

test("ordinary users cannot upload managed site media", async () => {
  const h = client({ role: "user" })
  await assert.rejects(api.uploadSiteMedia(h.db, image(), "image"))
  assert.equal(h.writes.length, 0)
})

test("denied uploads and inconsistent returned paths do not claim success", async () => {
  for (const options of [{ error: { message: "denied" } }, { wrongPath: true }, { changedOwner: true }]) {
    const h = client(options)
    await assert.rejects(api.uploadSiteMedia(h.db, image(), "image"))
    assert.equal(h.writes.length, 1)
  }
})
