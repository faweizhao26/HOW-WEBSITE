import { spawnSync } from "node:child_process"
import { inspectPageQuality } from "../tests/e2e/quality-checks.mjs"

const baseURL = process.env.EGO_BASE_URL || "http://127.0.0.1:3018"
const space = process.env.EGO_TASK_SPACE_ID ? Number(process.env.EGO_TASK_SPACE_ID) : "HOW 2027 publication QA"
const output = process.env.EGO_SCREENSHOT_DIR || "/private/tmp/how-publication-qa"
const routes = (process.env.EGO_ROUTES || "/,/schedule,/speakers,/sponsors,/updates").split(",")
const expectedState = process.env.EGO_EXPECT_CONTENT_STATE
const script = `
const task = await taskSpace(${JSON.stringify(space)}), page = task.page("p1");
const fs = await import("node:fs/promises");
await fs.mkdir(${JSON.stringify(output)}, { recursive: true });
const inspect = ${inspectPageQuality.toString()};
const failures = [], results = [];
console.log("TaskSpace", task.spaceId);
await page.cdp("Runtime.enable");
await page.cdp("Log.enable");
for (const [width, height, mobile] of [[1440,1000,false],[390,844,true]]) {
  await page.cdp("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor:1, mobile });
  for (const lang of ["en","zh"]) for (const theme of ["light","dark"]) for (const route of ${JSON.stringify(routes)}) {
    await page.goto(${JSON.stringify(baseURL)} + route);
    await page.evaluate(({lang,theme}) => { document.cookie="lang="+lang+"; path=/"; document.cookie="theme="+theme+"; path=/"; }, {lang,theme});
    await page.reload();
    await page.waitForLoadState();
    if (route.startsWith("/admin")) await page.waitForFunction(() => document.querySelector("main main h1") && !document.querySelector("main [data-slot=skeleton]") && ![...document.querySelectorAll("main main p")].some(node => node.textContent.trim() === "—"));
    if (route === "/profile" || route === "/cfp") await page.waitForSelector("loc=css:main h1");
    await page.waitForFunction(() => [...document.querySelectorAll("main img")].every(image => { const rect=image.getBoundingClientRect(); return image.closest("details:not([open])") || rect.height===0 || rect.top>=innerHeight || rect.bottom<=0 || image.complete; }));
    const quality = await page.evaluate(inspect);
    const events = await page.events();
    const errors = events.filter(e => e.method === "Runtime.exceptionThrown" || (e.method === "Runtime.consoleAPICalled" && e.params?.type === "error"));
    const result = {width,lang,theme,route,...quality,runtimeErrors:errors.length};
    results.push(result);
    if(quality.overflow > 1 || quality.contrastProblems.length || quality.brokenImages.length || !quality.heading || errors.length || (${JSON.stringify(expectedState ?? null)} && quality.contentState !== ${JSON.stringify(expectedState ?? null)})) failures.push(result);
    const name = (route === "/" ? "home" : route.slice(1).replaceAll("/","-"))+"-"+width+"-"+lang+"-"+theme+".png";
    await page.screenshot({path:${JSON.stringify(output)}+"/"+name});
    console.log(JSON.stringify(result));
  }
}
console.log(JSON.stringify({summary:{checks:results.length,failures:failures.length},failures}));
await fs.writeFile(${JSON.stringify(output)}+"/report.json",JSON.stringify({baseURL:${JSON.stringify(baseURL)},checks:results.length,results,failures},null,2));
if(failures.length) process.exitCode=1;
`
const result = spawnSync("ego-browser", ["nodejs", "-e", script], { stdio: "inherit", env: process.env })
if (result.error) throw result.error
process.exitCode = result.status ?? 1
