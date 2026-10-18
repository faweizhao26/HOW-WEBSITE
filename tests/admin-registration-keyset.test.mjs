import assert from "node:assert/strict"
import { test } from "node:test"
import { createClient } from "@supabase/supabase-js"
import { loadRegistrationRecords } from "../src/lib/admin/data.ts"

const json = body => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } })
const makeRows = () => Array.from({ length: 1005 }, (_, i) => ({
  id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
  created_at: `2026-10-${i < 1002 ? "17" : "16"}T00:00:00.123456+00:00`,
  checked_in: i % 2 === 0, status: i % 3 ? "confirmed" : "cancelled", ticket_types: { name: "Ticket", name_zh: null },
}))

export function registrationClient(initial, mutate = () => {}, cap = 1000) {
  let rows = [...initial], calls = 0
  return createClient("https://isolated.example.test", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async input => {
      const url = new URL(input)
      if (calls++) rows = mutate(rows, calls) || rows
      let selected = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id))
      const boundary = url.searchParams.get("created_at")
      if (boundary?.startsWith("lte.")) selected = selected.filter(r => r.created_at <= boundary.slice(4))
      const cursor = url.searchParams.get("or")
      if (cursor) {
        const match = cursor.match(/^\(created_at.lt.(.*),and\(created_at.eq.(.*),id.gt.([^)]*)\)\)$/)
        assert.ok(match, `Unexpected cursor: ${cursor}`)
        assert.equal(match[1], match[2])
        selected = selected.filter(r => r.created_at < match[1] || (r.created_at === match[1] && r.id > match[3]))
      }
      const offset = Number(url.searchParams.get("offset") || 0)
      return new Response(JSON.stringify(selected.slice(offset, offset + Math.min(cap, Number(url.searchParams.get("limit") || cap)))), {
        headers: { "content-type": "application/json", "content-range": `*/${rows.length}` },
      })
    } },
  })
}

test("keyset export excludes newer insertions and returns unique rows across equal timestamps", async () => {
  const rows = makeRows()
  const result = await loadRegistrationRecords(registrationClient(rows, (current, call) => call === 2
    ? [{ ...rows[0], id: "new", created_at: "2026-10-18T00:00:00+00:00" }, ...current] : current))
  assert.equal(new Set(result.map(r => r.id)).size, result.length)
  assert.deepEqual(result, rows)
})

test("deleting an earlier row does not skip an unread registration; server caps do not truncate", async () => {
  const rows = makeRows()
  const result = await loadRegistrationRecords(registrationClient(rows, (current, call) => call === 2 ? current.slice(1) : current, 37))
  assert.deepEqual(result, rows)
})

test("non-advancing duplicate page fails instead of looping or exporting duplicates", async () => {
  const row = makeRows()[0]
  const db = createClient("https://isolated.example.test", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async () => json([row]) },
  })
  await assert.rejects(loadRegistrationRecords(db), /pagination/)
})
