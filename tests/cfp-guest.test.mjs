import assert from "node:assert/strict"
import { test } from "node:test"
import { parseGuestProposalInput, submitGuestProposal } from "../src/lib/cfp/service.ts"

const input = {
  requestId: "11111111-1111-4111-8111-111111111111",
  title: "Understanding Postgres",
  abstract: "A practical introduction",
  type: "talk",
  duration: 30,
  email: " Speaker@Example.Test ",
  privacyAccepted: true,
  proposalDetails: {
    language: "en", full_name: "Guest Speaker", company: "Community", position: "Developer",
    bio: "Speaker bio", outline: "Introduction, examples and Q&A", photo_url: null,
  },
}

test("guest intake validates contact, consent, supported durations and required details", () => {
  assert.equal(parseGuestProposalInput(input).email, "speaker@example.test")
  for (const extra of [
    { email: "not a mailbox" }, { privacyAccepted: false }, { user_id: input.requestId }, { status: "approved" },
    { duration: 60 }, { proposalDetails: { ...input.proposalDetails, outline: "" } },
    { proposalDetails: { ...input.proposalDetails, photo_url: "https://example.test/tracker.png" } },
  ]) assert.throws(() => parseGuestProposalInput({ ...input, ...extra }), { code: "invalid_input" })
  assert.doesNotThrow(() => parseGuestProposalInput({ ...input, type: "lightning", duration: 5, proposalDetails: { ...input.proposalDetails, outline: "" } }))
})

test("guest action confirms the exact receipt and preserves actionable rate-limit errors", async () => {
  const id = await submitGuestProposal({ rpc: async (name, args) => {
    assert.equal(name, "submit_guest_cfp")
    assert.equal(args.p_proposal.email, "speaker@example.test")
    return { data: input.requestId, error: null }
  } }, input)
  assert.equal(id, input.requestId)
  await assert.rejects(submitGuestProposal({ rpc: async () => ({ data: null, error: { message: "cfp_guest_rate_limit" } }) }, input), { code: "guest_rate_limit" })
  await assert.rejects(submitGuestProposal({ rpc: async () => ({ data: "different-id", error: null }) }, input), { code: "operation_failed" })
})
