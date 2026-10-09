import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"

const space = Number(process.env.EGO_TASK_SPACE_ID)
assert.ok(Number.isInteger(space) && space > 0)
const baseURL = process.env.EGO_BASE_URL || "http://localhost:3024"
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname))
const file = process.env.REGISTRATION_QA_FIXTURE_PATH || "/private/tmp/how-registration-qa-fixture.json"
const phase = process.env.EGO_INTERACTION_PHASE || "all"
const script = `
const task=await taskSpace(${space}),page=task.page("p1"),fs=await import("node:fs/promises"),assert=(await import("node:assert/strict")).default;
const fixture=JSON.parse(await fs.readFile(${JSON.stringify(file)},"utf8"));
assert.ok(["localhost","127.0.0.1"].includes(new URL(fixture.url).hostname));
const base=${JSON.stringify(baseURL)},results=[];
const pass=name=>{results.push(name);console.log("PASS "+name)};
async function countActions(){
  await page.evaluate(()=>{
    const original=window.fetch;
    window.__registrationQa={posts:0,pending:0};
    window.fetch=async(...args)=>{
      const headers=new Headers(args[1]?.headers || (args[0] instanceof Request?args[0].headers:undefined));
      if(!headers.has("Next-Action")) return original(...args);
      window.__registrationQa.posts++;window.__registrationQa.pending++;
      try{return await original(...args)}finally{window.__registrationQa.pending--}
    };
  });
}
await page.cdp("Emulation.setDeviceMetricsOverride",{width:1440,height:1000,mobile:false,deviceScaleFactor:1});
await page.goto(base+"/register");
await page.waitForSelector("loc=css:#registration-phone");
if(${JSON.stringify(phase)} !== "submit"){
await countActions();
assert.equal(await page.evaluate(()=>document.querySelector("#registration-email").readOnly),true);
assert.equal(await page.evaluate(()=>/888888|123456|Demo/.test(document.querySelector("main").textContent)),false);
await page.fill("loc=css:#registration-phone","+12025550123");
await page.fill("loc=css:#registration-name","   ");
await page.click("loc=css:main form button[type=submit]");
await page.waitForSelector("loc=css:main form [role=alert]");
assert.equal(await page.evaluate(()=>window.__registrationQa.posts),0);
await page.fill("loc=css:#registration-name","QA Browser Registration");
await page.fill("loc=css:#registration-phone","888888");
await page.click("loc=css:main form button[type=submit]");
await page.waitForFunction(()=>/国家区号|country code/.test(document.querySelector("main form [role=alert]")?.textContent||""));
assert.equal(await page.evaluate(()=>window.__registrationQa.posts),0);
pass("readonly account email, no demo verification, whitespace name and invalid phone blocked locally");
await page.fill("loc=css:#registration-phone","+12025550123");
await page.fill("loc=css:#channel-code",fixture.codes[0]);
await page.waitForFunction(()=>/有效|Valid/.test(document.querySelector("#channel-status").textContent));
assert.equal(await page.evaluate(()=>document.querySelector("input[name=ticket]:checked").value),fixture.tickets[1]);
await page.click("loc=css:label:has(input[value='"+fixture.tickets[0]+"'])");
await page.click("loc=css:main form button[type=submit]");
await page.waitForFunction(()=>/匹配|match/.test(document.querySelector("main form [role=alert]")?.textContent||""));
assert.equal(await page.evaluate(()=>document.querySelector("#registration-name").value),"QA Browser Registration");
pass("valid invitation selects matching ticket; mismatched submission rejected with draft retained");
await page.fill("loc=css:#channel-code","");

await page.cdp("Fetch.enable",{patterns:[{urlPattern:base+"/register",requestStage:"Response"}]});
let paused;
try {
  await page.fill("loc=css:#channel-code",fixture.codes[0]);
  const deadline=Date.now()+15000;
  while(!paused && Date.now()<deadline){
    const events=await page.events();
    paused=events.find(event=>event.method==="Fetch.requestPaused" && event.params?.request?.method==="POST");
    if(!paused)await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.ok(paused,"The real channel action must reach the response boundary");
  await page.fill("loc=css:#channel-code","");
  await page.cdp("Fetch.continueRequest",{requestId:paused.params.requestId});
  await page.waitForFunction(()=>window.__registrationQa.pending===0);
  assert.equal(await page.evaluate(()=>document.querySelector("#channel-status").textContent.trim()),"");
  assert.equal(await page.evaluate(()=>document.querySelector("input[name=ticket]:checked").value),fixture.tickets[0]);
  pass("delayed channel response cannot restore cleared code or overwrite selected ticket");
} finally {await page.cdp("Fetch.disable")}

await page.cdp("Network.enable");
try{
  await page.cdp("Network.setBlockedURLs",{urls:["*127.0.0.1:55421/rest/v1/ticket_types*"]});
  await page.reload();
  await page.waitForSelector("loc=css:main [role=alert]",{timeout:45000});
  assert.equal(await page.evaluate(()=>Boolean(document.querySelector("#registration-phone"))),false);
  await page.cdp("Network.setBlockedURLs",{urls:[]});
  await page.click("loc=css:main button");
  await page.waitForSelector("loc=css:#registration-phone");
  pass("failed initial ticket read shows retry rather than empty form, retry loads complete data");
}finally{await page.cdp("Network.setBlockedURLs",{urls:[]})}

await page.fill("loc=css:#registration-name","QA Browser Registration");
await page.fill("loc=css:#registration-phone","+12025550123");
await page.fill("loc=css:#registration-company","QA Company");
try{
  await page.cdp("Network.setBlockedURLs",{urls:[base+"/register"]});
  await page.click("loc=css:main form button[type=submit]");
  await page.waitForFunction(()=>Boolean(document.querySelector("main form [role=alert]")) && !document.querySelector("main form button[type=submit]").disabled);
  assert.equal(await page.evaluate(()=>document.querySelector("#registration-name").value),"QA Browser Registration");
  assert.equal(await page.evaluate(()=>document.querySelector("#registration-company").value),"QA Company");
  pass("failed server action preserves draft and releases pending lock for retry");
}finally{await page.cdp("Network.setBlockedURLs",{urls:[]})}

}
await page.fill("loc=css:#registration-name","QA Browser Registration");
await page.fill("loc=css:#registration-phone","+12025550123");
await countActions();
// Two synchronous native form submissions exercise the ref guard before React renders.
await page.evaluate(()=>{const form=document.querySelector("main form");form.requestSubmit();form.requestSubmit()});
await page.waitForFunction(()=>/报名成功|Registration Confirmed/.test(document.querySelector("main h1")?.textContent||""));
assert.equal(await page.evaluate(()=>window.__registrationQa.posts),1);
await page.screenshot({path:"/private/tmp/how-registration-integrity-qa/success-desktop.png"});
await page.reload();
await page.waitForFunction(()=>/已有报名|Already Have/.test(document.querySelector("main h1")?.textContent||""));
assert.equal(await page.evaluate(()=>Boolean(document.querySelector("main form"))),false);
pass("two native form submissions send one action, successful database write renders confirmation, reload prevents new registration");
await fs.writeFile("/private/tmp/how-registration-integrity-qa/"+${JSON.stringify(phase)}+"-interactions-report.json",JSON.stringify({results,checks:results.length},null,2));
console.log(await page.snapshot());
`
const result = spawnSync("ego-browser", ["nodejs", "-e", script], { env: process.env, stdio: "inherit" })
if (result.error) throw result.error
process.exitCode = result.status ?? 1
