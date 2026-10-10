import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { inspectPageQuality } from "../tests/e2e/quality-checks.mjs"

const baseURL = process.env.EGO_BASE_URL || "http://localhost:3025"
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname), "Local preview only")
const space = Number(process.env.EGO_TASK_SPACE_ID)
assert.ok(Number.isInteger(space) && space > 0, "Use the current authorized ego-lite space")
const output = process.env.EGO_SCREENSHOT_DIR || "/private/tmp/how-cfp-auth-qa"
const fixture = process.env.CFP_QA_FIXTURE_PATH || "/private/tmp/how-cfp-auth-qa-fixture.json"
const script = `
const task=await taskSpace(${space}), page=task.page("p1");
const fs=await import("node:fs/promises"), assert=(await import("node:assert/strict")).default;
const fixture=JSON.parse(await fs.readFile(${JSON.stringify(fixture)},"utf8"));
assert.ok(["localhost","127.0.0.1"].includes(new URL(fixture.url).hostname));
const base=${JSON.stringify(baseURL)}, out=${JSON.stringify(output)}, passed=[];
await fs.mkdir(out,{recursive:true});
const pass=name=>{passed.push(name);console.log("PASS "+name)};
const inspect=${inspectPageQuality.toString()};
await page.cdp("Network.enable");
await page.goto(base+"/auth/login?redirect=/cfp&error=auth_failed");
await page.evaluate(()=>{document.cookie="lang=zh; path=/";document.cookie="theme=light; path=/"});
await page.reload();
await page.waitForSelector("loc=css:main [role=alert]");
assert.match(await page.evaluate(()=>document.querySelector("main [role=alert]").textContent),/确认链接/);
pass("localized callback error is visible");
await page.click("loc=css:main a[href^=\\"/auth/register\\"]");
await page.waitForSelector("loc=css:#fullName");
assert.match(await page.evaluate(()=>document.querySelector("main a[href^=\\"/auth/login\\"]").getAttribute("href")),/redirect=%2Fcfp/);
await page.click("loc=css:main a[href^=\\"/auth/login\\"]");
await page.waitForSelector("loc=css:#email");
pass("login and signup links preserve the proposal destination");
await page.fill("loc=css:#email",fixture.emails[0]);
await page.fill("loc=css:#password","WrongPassword");
await page.events();
await page.evaluate(()=>{const f=document.querySelector("main form");f.requestSubmit();f.requestSubmit()});
await page.waitForFunction(()=>/邮箱或密码不正确/.test(document.querySelector("main [role=alert]")?.textContent||"")&&!document.querySelector("main button[type=submit]")?.disabled,undefined,{timeout:20000});
let events=await page.events();
assert.equal(events.filter(e=>e.method==="Network.requestWillBeSent"&&e.params?.request?.url.includes("/auth/v1/token")&&e.params?.request?.method==="POST").length,1);
pass("wrong password is localized, double login is locked and retry is enabled");
await page.cdp("Network.setBlockedURLs",{urls:["*127.0.0.1:55421/auth/v1/token*"]});
try {
  await page.fill("loc=css:#password",fixture.password);
  await page.click("loc=css:main button[type=submit]");
  await page.waitForFunction(()=>/暂时无法完成/.test(document.querySelector("main [role=alert]")?.textContent||"")&&!document.querySelector("main button[type=submit]")?.disabled,undefined,{timeout:25000});
} finally {await page.cdp("Network.setBlockedURLs",{urls:[]})}
pass("network login failure retains inputs and unlocks retry");
await page.click("loc=css:main button[type=submit]");
await page.waitForURL(base+"/cfp",{timeout:20000});
await page.waitForSelector("loc=css:#title");
pass("successful real login reaches CFP despite protected-route prefetch");

await page.cdp("Network.setBlockedURLs",{urls:["*127.0.0.1:55421/rest/v1/sessions*"]});
try {
  await page.reload();
  await page.waitForFunction(()=>/提案加载失败/.test(document.querySelector("main [role=alert]")?.textContent||""),undefined,{timeout:25000});
  assert.equal(await page.evaluate(()=>document.querySelector("main")?.innerText.includes("还没有提交")),false);
} finally {await page.cdp("Network.setBlockedURLs",{urls:[]})}
await page.click("loc=role:button[name=重试]");
await page.waitForSelector("loc=css:#title");
pass("proposal read failure is not empty and explicit retry recovers");

await page.fill("loc=css:#title"," \\u3000 ");
await page.fill("loc=css:#abstract","QA Browser Abstract");
await page.events();
await page.click("loc=css:main button[type=submit]");
await page.waitForSelector("loc=css:main [role=alert]");
assert.match(await page.evaluate(()=>document.querySelector("main [role=alert]").textContent),/有效标题/);
events=await page.events();
assert.equal(events.filter(e=>e.method==="Network.requestWillBeSent"&&e.params?.request?.headers?.["Next-Action"]).length,0);
pass("blank title rejects before a server mutation");
const title="QA Browser Proposal "+Date.now();
await page.fill("loc=css:#title",title);
await page.cdp("Network.setBlockedURLs",{urls:[base+"/cfp*"]});
try {
  await page.click("loc=css:main button[type=submit]");
  await page.waitForFunction(()=>/无法确认提交结果/.test(document.querySelector("main [role=alert]")?.textContent||"")&&!document.querySelector("main button[type=submit]")?.disabled,undefined,{timeout:25000});
  assert.equal(await page.evaluate(()=>document.querySelector("#title").value),title);
} finally {await page.cdp("Network.setBlockedURLs",{urls:[]})}
pass("failed submission retains the draft and releases pending state");
await page.evaluate(()=>{
  const original=window.fetch.bind(window);
  window.__cfpQa={posts:0};
  window.fetch=async(...args)=>{
    const options=args[1];
    if(options?.method==="POST"&&new Headers(options.headers).has("Next-Action")) window.__cfpQa.posts++;
    return original(...args);
  };
});
await page.evaluate(()=>{const f=document.querySelector("main form");f.requestSubmit();f.requestSubmit()});
await page.waitForFunction(title=>document.querySelector("main")?.innerText.includes(title)&&!document.querySelector("#title"),title,{timeout:25000});
assert.equal(await page.evaluate(()=>window.__cfpQa.posts),1);
pass("two synchronous proposal submits issue one action and show the returned proposal");
await page.screenshot({path:out+"/submission-success.png"});
await page.reload();await page.waitForSelector("loc=css:#title");
await page.click("loc=role:tab[name*=我的提案]");
await page.waitForFunction(title=>document.querySelector("main")?.innerText.includes(title),title);
pass("saved proposal remains visible after reload");

await page.click("loc=role:tab[name*=提交您的演讲提案]");
await page.fill("loc=css:#title","QA Old Account Draft");
const second=await task.newPage();
try {
  await second.goto(base+"/auth/login?redirect=/cfp");
  await second.waitForSelector("loc=css:#email");
  await second.fill("loc=css:#email",fixture.emails[1]);
  await second.fill("loc=css:#password",fixture.password);
  await second.click("loc=css:main button[type=submit]");
  await second.waitForURL(base+"/cfp",{timeout:20000});
  await page.waitForFunction(()=>/登录账号已变更/.test(document.querySelector("main [role=alert]")?.textContent||""),undefined,{timeout:20000});
  assert.equal(await page.evaluate(()=>!!document.querySelector("#title")),false);
  await page.click("loc=role:button[name=重试]");
  await page.waitForSelector("loc=css:#title");
  assert.equal(await page.evaluate(()=>document.querySelector("#title").value),"");
  pass("another tab changing account isolates the old draft and reloads the new account");
} finally {await second.close()}

const switcher=await task.newPage();
let paused;
try {
  await switcher.goto(base+"/auth/login?redirect=/cfp");
  await switcher.waitForSelector("loc=css:#email");
  await switcher.fill("loc=css:#email",fixture.emails[0]);
  await switcher.fill("loc=css:#password",fixture.password);
  await switcher.click("loc=css:main button[type=submit]");
  await switcher.waitForURL(base+"/cfp",{timeout:20000});
  await page.goto(base+"/auth/login");
  await page.waitForSelector("loc=css:#email");
  await page.cdp("Fetch.enable",{patterns:[{urlPattern:"*127.0.0.1:55421/rest/v1/sessions*",requestStage:"Response"}]});
  await page.goto(base+"/cfp");
  for(let i=0;i<100&&!paused;i++){
    paused=(await page.events()).find(e=>e.method==="Fetch.requestPaused"&&e.params.responseStatusCode);
    if(!paused)await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.ok(paused,"The old-account initial read must be held before switching");
  await switcher.goto(base+"/auth/login?redirect=/cfp");
  await switcher.waitForSelector("loc=css:#email");
  await switcher.fill("loc=css:#email",fixture.emails[1]);
  await switcher.fill("loc=css:#password",fixture.password);
  await switcher.click("loc=css:main button[type=submit]");
  await switcher.waitForURL(base+"/cfp",{timeout:20000});
  await page.waitForFunction(()=>/登录账号已变更/.test(document.querySelector("main [role=alert]")?.textContent||""),undefined,{timeout:20000});
  await page.cdp("Fetch.continueResponse",{requestId:paused.params.requestId});paused=null;
  await page.cdp("Fetch.disable");
  assert.equal(await page.evaluate(()=>!!document.querySelector("#title")),false);
  await page.click("loc=role:button[name=重试]");
  await page.waitForSelector("loc=css:#title");
  await page.click("loc=role:tab[name*=我的提案]");
  await page.waitForFunction(()=>document.querySelector("main")?.innerText.includes("还没有提交"),undefined,{timeout:10000});
  pass("delayed initial read from the old account cannot return after a cross-tab identity change");
} finally {
  if(paused)await page.cdp("Fetch.continueResponse",{requestId:paused.params.requestId});
  await page.cdp("Fetch.disable");
  await switcher.close();
}

const results=[];
await page.cdp("Runtime.enable");await page.events();
for(const [width,height,mobile] of [[1440,1000,false],[390,844,true]]){
  await page.cdp("Emulation.setDeviceMetricsOverride",{width,height,mobile,deviceScaleFactor:1});
  for(const lang of ["en","zh"])for(const theme of ["light","dark"])for(const route of ["/auth/login?error=auth_failed&redirect=/cfp","/auth/register?redirect=/cfp","/cfp"]){
    await page.evaluate(({lang,theme})=>{document.cookie="lang="+lang+"; path=/";document.cookie="theme="+theme+"; path=/"},{lang,theme});
    await page.goto(base+route);await page.waitForSelector("loc=css:main h1");
    if(route==="/cfp")await page.waitForSelector("loc=css:#title");
    const quality=await page.evaluate(inspect),ev=await page.events();
    const errors=ev.filter(e=>e.method==="Runtime.exceptionThrown"||(e.method==="Runtime.consoleAPICalled"&&e.params?.type==="error"));
    const result={route,width,lang,theme,...quality,runtimeErrors:errors.length};results.push(result);
    await page.screenshot({path:out+"/"+route.split("?")[0].replaceAll("/","-").slice(1)+"-"+width+"-"+lang+"-"+theme+".png"});
    console.log(JSON.stringify(result));
  }
}
const failures=results.filter(r=>!r.heading||r.overflow>1||r.contrastProblems.length||r.brokenImages.length||r.runtimeErrors);
await fs.writeFile(out+"/report.json",JSON.stringify({baseURL:base,interactions:passed,checks:results.length,results,failures},null,2));
await page.cdp("Emulation.clearDeviceMetricsOverride");
await page.evaluate(()=>{document.cookie="lang=zh; path=/";document.cookie="theme=light; path=/"});
await page.goto(base+"/cfp");await page.waitForSelector("loc=css:#title");
await page.screenshot({path:out+"/result.png"});
console.log({interactions:passed.length,checks:results.length,failures:failures.length});
if(failures.length)process.exitCode=1;
`
const result = spawnSync("ego-browser", ["nodejs", "-e", script], { env: process.env, stdio: "inherit" })
if (result.error) throw result.error
process.exitCode = result.status ?? 1
