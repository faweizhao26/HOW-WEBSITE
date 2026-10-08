import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { test } from "node:test"

const load = async () => {
  const url = new URL("../src/lib/admin/registration-export.ts", import.meta.url)
  assert.ok(existsSync(url), "Registration CSV must escape fields and export the selected records")
  return import(url.href)
}
const record = {
  id: "one", name: 'Alice "A", Zhang\nTeam', email: "alice@example.test", phone: "+8613812345678",
  company: 'Company, "Ltd"', position: null, channel_code: null, ticket_type_id: "community", status: "confirmed", checked_in: false,
  created_at: "2027-04-16T01:00:00Z", ticket_types: { name: "Community Pass", name_zh: "社区票" },
}

test("CSV escapes quotes, commas, newlines and keeps Chinese text", async () => {
  const { registrationsToCSV } = await load()
  const csv = registrationsToCSV([record], "zh")
  assert.ok(csv.startsWith('\uFEFF"姓名","邮箱","手机号"'))
  assert.ok(csv.includes('"Alice ""A"", Zhang\nTeam"'))
  assert.ok(csv.includes('"Company, ""Ltd"""'))
  assert.ok(csv.includes('"社区票"'))
  assert.ok(csv.includes('"已确认","否"'))
  assert.ok(csv.includes("2027/4/16 09:00:00"))
  assert.ok(!csv.includes("null"))
})

test("exports only provided filtered rows and uses English labels when selected", async () => {
  const { registrationsToCSV } = await load()
  const csv = registrationsToCSV([{ ...record, name: "Only selected", checked_in: true, status: "cancelled" }], "en")
  assert.ok(csv.startsWith('\uFEFF"Name","Email","Phone"'))
  assert.ok(csv.includes('"Only selected"'))
  assert.ok(!csv.includes("Alice"))
  assert.ok(csv.includes('"Community Pass"'))
  assert.ok(csv.includes('"Cancelled","Yes"'))
})

test("spreadsheet formula prefixes are exported as literal text", async () => {
  const { registrationsToCSV } = await load()
  for (const name of ["=1+1", "+cmd", "-1+1", "@SUM(1)", "\t=1+1", "\r=1+1", " =1+1"]) {
    assert.ok(registrationsToCSV([{ ...record, name }], "en").includes(`"'${name}"`))
  }
})
