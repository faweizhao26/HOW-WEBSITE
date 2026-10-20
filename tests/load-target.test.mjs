import assert from "node:assert/strict"
import { test } from "node:test"
import { localLoadOrigin, loadLevels } from "../scripts/lib/load-target.mjs"

test("load testing refuses public, credentialed and ambiguous targets", () => {
  for (const url of ["https://how-website.vercel.app", "http://127.0.0.1.evil.test:3040", "http://user:pass@127.0.0.1:3040", "http://127.0.0.1:3040/path", "http://127.0.0.1:3040/?target=production", "http://localhost"]) assert.throws(() => localLoadOrigin(url))
  assert.equal(localLoadOrigin("http://127.0.0.1:3040"), "http://127.0.0.1:3040")
  assert.equal(localLoadOrigin("http://[::1]:3040/"), "http://[::1]:3040")
})

test("load stages are explicitly bounded and ordered", () => {
  assert.deepEqual(loadLevels(), [50, 100, 300, 500])
  assert.deepEqual(loadLevels("100,50,100"), [50, 100])
  for (const invalid of ["", "0", "501", "Infinity", "10.5", "1,2,3,4,5"]) assert.throws(() => loadLevels(invalid))
})
