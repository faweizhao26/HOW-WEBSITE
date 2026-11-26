import assert from "node:assert/strict"
import { test } from "node:test"
import { notificationCsv } from "../src/lib/notifications.ts"
import { registrationEmailsToCSV } from "../src/lib/admin/registration-export.ts"

test("review export preserves each exact decision instead of dropping a second proposal", () => {
  const row = { account_id:"owner", name:"Speaker", email:"fixture@example.test", proposal_status:"rejected", proposal_type:"lightning", proposal_duration:5 }
  const { csv,count } = notificationCsv([{ ...row,id:"one",proposal_title:'="One"' },{ ...row,id:"two",proposal_title:"Second" }],"result",false)
  assert.equal(count,2)
  assert.ok(csv.includes("Declined"))
  assert.ok(csv.includes("Lightning talk"))
  assert.ok(csv.includes(`"'=""One"""`))
  assert.ok(csv.includes("Second"))
})

test("a waitlisted proposal exports the waitlist decision, not a rejection", () => {
  const row = { account_id:"owner", id:"third", name:"Speaker", email:"fixture@example.test", proposal_title:"Third proposal", proposal_status:"waitlisted", proposal_type:"talk", proposal_duration:30 }
  assert.match(notificationCsv([row],"result",true).csv, /Third proposal.*候补/)
  assert.match(notificationCsv([row],"result",false).csv, /Third proposal.*Waitlisted/)
  assert.doesNotMatch(notificationCsv([row],"result",false).csv, /Declined|Rejected/)
})

test("email-only exports omit unrelated personal details and skip missing addresses", () => {
  const row = { name:"Speaker", email:" fixture@example.test ", phone:"not exported", company:"also private" }
  const data = registrationEmailsToCSV([row,{...row,email:"FIXTURE@example.test"},{...row,email:""}],"en")
  assert.equal(data.count,1)
  assert.doesNotMatch(data.csv,/not exported|also private/)
  const general = notificationCsv([row,{...row,email:null}],"general",true)
  assert.equal(general.count,1)
  assert.doesNotMatch(general.csv,/议题标题|also private/)
})
