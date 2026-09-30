import assert from "node:assert/strict"
import { test } from "node:test"
import { hasNewsChanges } from "../src/lib/content/publication-state.ts"

const published = { title: "Announcement", title_zh: null, content: "Original", content_zh: null, cover_url: null }
const draft = { ...published, publication_status: "published", published_at: "2026-01-01", updated_at: "2026-09-30" }

test("republished news with an old display date has no pending changes", () => {
  assert.equal(hasNewsChanges(draft, published), false)
})

test("news changes remain pending until the public snapshot matches", () => {
  for (const field of ["title", "title_zh", "content", "content_zh", "cover_url"]) {
    assert.equal(hasNewsChanges({ ...draft, [field]: "Edited" }, published), true)
  }
  assert.equal(hasNewsChanges(draft, undefined), true)
  assert.equal(hasNewsChanges({ ...draft, publication_status: "draft" }, undefined), false)
})
