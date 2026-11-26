import assert from "node:assert/strict"
import { test } from "node:test"
import { parseProposalInput, ownedProposalPhoto } from "../src/lib/cfp/service.ts"
import { cfpDurationOptions, parseCFPSettings } from "../src/lib/cfp/settings.ts"

const owner = "43000000-0000-4000-8000-000000000001"
const details = { language:"zh", full_name:"Speaker", company:"Independent", position:"Engineer", bio:"Database experience", outline:"First, second", photo_url:null }
const input = { requestId:"43000000-0000-4000-8000-000000000002",expectedUserId:owner,title:"Test",abstract:"Overview",proposalDetails:details }

test("single-language proposals enforce the complete format matrix", () => {
  assert.ok(parseCFPSettings({}).sessionTypes.includes("lightning"))
  for (const [type,allowed] of Object.entries(cfpDurationOptions)) {
    for (const duration of [5,15,30,45,60]) {
      const values = { ...input,type,duration }
      if (allowed.includes(duration)) assert.equal(parseProposalInput(values).proposalDetails.language,"zh")
      else assert.throws(() => parseProposalInput(values),e => e.code === "invalid_input")
    }
  }
  assert.equal(parseProposalInput({...input,type:"lightning",duration:5,proposalDetails:{...details,outline:""}}).duration,5)
  assert.throws(() => parseProposalInput({...input,type:"talk",duration:30,titleZh:"Duplicate title"}))
})

test("name, unit, job title, bio and non-lightning outline cannot be blank", () => {
  for (const key of ["full_name","company","position","bio","outline"]) {
    for (const value of [undefined," \t\n",1]) {
      assert.throws(() => parseProposalInput({...input,type:"workshop",duration:45,proposalDetails:{...details,[key]:value}}))
    }
  }
})

test("speaker photos use the configured Supabase origin and the submitter folder", () => {
  const original = process.env.NEXT_PUBLIC_SUPABASE_URL
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://db.example.test"
  try {
    const path = "/storage/v1/object/public/conference-media/avatars/" + owner + "/cfp-photo.png"
    assert.equal(ownedProposalPhoto("https://db.example.test" + path,owner),true)
    assert.equal(ownedProposalPhoto("https://other.example.test" + path,owner),false)
    assert.equal(ownedProposalPhoto("https://db.example.test" + path,"another-user"),false)
  } finally {
    if (original == null) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = original
  }
})
