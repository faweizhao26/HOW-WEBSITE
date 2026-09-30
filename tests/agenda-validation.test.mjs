import assert from "node:assert/strict"
import { test } from "node:test"
import { validateAgendaDraft } from "../src/lib/content/agenda-validation.ts"

const dates = ["2027-04-16", "2027-04-17", "2027-04-18"]
const slot = { date: dates[0], start_time: "09:00", end_time: "09:30", type: "opening", session_id: null, label: "Opening" }
const validate = (slots) => validateAgendaDraft(slots, dates, ["public-session"])

test("agenda validation rejects dates, times, labels and private sessions", () => {
  assert.deepEqual(validate([]), ["empty"])
  for (const date of ["2027-04-15", "2027-04-19"]) assert.deepEqual(validate([{ ...slot, date }]), ["date"])
  for (const end_time of ["09:00", "08:30"]) assert.deepEqual(validate([{ ...slot, end_time }]), ["time"])
  assert.deepEqual(validate([{ ...slot, label: "  " }]), ["label"])
  assert.deepEqual(validate([{ ...slot, type: "session" }]), ["session"])
  assert.deepEqual(validate([{ ...slot, session_id: "private-session" }]), ["session"])
})

test("agenda validation accepts each conference day and published session", () => {
  for (const date of dates) assert.deepEqual(validate([{ ...slot, date }]), [])
  assert.deepEqual(validate([{ ...slot, type: "session", label: "", session_id: "public-session" }]), [])
})
