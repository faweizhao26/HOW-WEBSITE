import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { inspectPageQuality } from "../tests/e2e/quality-checks.mjs"

const baseURL = process.env.EGO_BASE_URL || "http://127.0.0.1:3023"
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname), "Use a local test preview only")
const space = Number(process.env.EGO_TASK_SPACE_ID)
assert.ok(Number.isInteger(space) && space > 0, "Resume the existing authenticated QA TaskSpace")
const output = process.env.EGO_SCREENSHOT_DIR || "/private/tmp/how-profile-checkin-qa"
const script = `
const task = await taskSpace(${space}), page = task.page("p1");
const fs = await import("node:fs/promises");
await fs.mkdir(${JSON.stringify(output)}, { recursive: true });
const inspect = ${inspectPageQuality.toString()};
const results = [], failures = [];
await page.cdp("Runtime.enable");
for (const [width,height,mobile] of [[1440,1000,false],[390,844,true]]) {
  await page.cdp("Emulation.setDeviceMetricsOverride", {width,height,mobile,deviceScaleFactor:1});
  for (const lang of ["en","zh"]) for (const theme of ["light","dark"]) for (const route of ["/profile","/admin/checkin"]) {
    await page.goto(${JSON.stringify(baseURL)} + route);
    await page.evaluate(({lang,theme}) => {document.cookie="lang="+lang+"; path=/"; document.cookie="theme="+theme+"; path=/";}, {lang,theme});
    await page.reload();
    await page.waitForSelector("loc=css:main h1");
    if(route === "/profile") {
      await page.click("loc=css:[role=tab] >> nth=1");
      await page.waitForFunction(() => document.querySelector("[role=tabpanel] button[title]"));
    } else {
      await page.fill("loc=css:main main input", "QA");
      await page.waitForFunction(() => document.querySelectorAll("main main [data-slot=card]").length === 2);
    }
    await page.waitForFunction(() => [...document.querySelectorAll("main img")].every(image => image.complete));
    const quality = await page.evaluate(inspect);
    const events = await page.events();
    const errors = events.filter(event => event.method === "Runtime.exceptionThrown" || (event.method === "Runtime.consoleAPICalled" && event.params?.type === "error"));
    const result = {route,width,lang,theme,...quality,runtimeErrors:errors.length};
    results.push(result);
    if(!quality.heading || quality.overflow > 1 || quality.contrastProblems.length || quality.brokenImages.length || errors.length) failures.push(result);
    await page.screenshot({path:${JSON.stringify(output)}+"/"+route.slice(1).replaceAll("/","-")+"-"+width+"-"+lang+"-"+theme+".png"});
    console.log(JSON.stringify(result));
  }
}
await fs.writeFile(${JSON.stringify(output)}+"/report.json", JSON.stringify({baseURL:${JSON.stringify(baseURL)},checks:results.length,results,failures},null,2));
console.log(JSON.stringify({checks:results.length,failures:failures.length}));
if(failures.length) process.exitCode=1;
`
const result = spawnSync("ego-browser", ["nodejs", "-e", script], { env: process.env, stdio: "inherit" })
if (result.error) throw result.error
process.exitCode = result.status ?? 1
