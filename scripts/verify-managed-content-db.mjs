import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { parseSiteContent } from "../src/lib/content/site-content.ts"

assert.equal(process.env.PUBLICATION_TEST_ISOLATED_PROJECT, "true", "Isolated local database only")
const content = parseSiteContent({})
content.pages.about.intro = { en: "Managed content QA", zh: "后台内容验收" }
const value = raw => `'${raw.replaceAll("'", "''")}'`
const invalid = ["{bad", JSON.stringify({ ...content, contacts: { sponsor: "invalid", report: "" } })]
const url = structuredClone(content)
url.venue.mapUrl = "javascript:alert(1)"
invalid.push(JSON.stringify(url))
url.venue.mapUrl = "https://%"
invalid.push(JSON.stringify(url))
url.venue.mapUrl = "http://host:65536"
invalid.push(JSON.stringify(url))
const duplicate = structuredClone(content)
duplicate.pages.about.sections.push(duplicate.pages.about.sections[0])
invalid.push(JSON.stringify(duplicate))
const emptyFAQ = structuredClone(content)
emptyFAQ.faq.items = [{ id: "qa", keywords: [], answer: { en: "", zh: "" }, enabled: true }]
invalid.push(JSON.stringify(emptyFAQ))
const sql = `BEGIN;
SELECT set_config('request.jwt.claims', jsonb_build_object('sub',(SELECT id FROM public.profiles WHERE role='admin' LIMIT 1),'role','authenticated')::text,true);
SELECT set_config('how.content_original', (SELECT id::text FROM public.site_settings_releases WHERE is_current), true);
INSERT INTO public.site_settings(key,value) VALUES('site_content',${value(JSON.stringify(content))}) ON CONFLICT(key) DO UPDATE SET value=excluded.value;
SET LOCAL ROLE anon;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.site_settings_releases WHERE is_current AND payload->>'site_content' LIKE '%Managed content QA%') THEN RAISE EXCEPTION 'Draft leaked'; END IF; END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT public.publish_site_settings();
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM public.site_settings_releases WHERE is_current AND payload->>'site_content' LIKE '%Managed content QA%') THEN RAISE EXCEPTION 'Published content not public'; END IF; END $$;
RESET ROLE;
SELECT 'PASS draft isolation and actual publication';
${invalid.map(raw => `INSERT INTO public.site_settings(key,value) VALUES('site_content',${value(raw)}) ON CONFLICT(key) DO UPDATE SET value=excluded.value;
SET LOCAL ROLE authenticated;
DO $$ DECLARE original uuid; BEGIN SELECT id INTO original FROM public.site_settings_releases WHERE is_current;
BEGIN PERFORM public.publish_site_settings(); RAISE EXCEPTION 'Invalid managed content published'; EXCEPTION WHEN check_violation THEN IF SQLERRM <> 'invalid_site_content' THEN RAISE; END IF; END;
IF (SELECT id FROM public.site_settings_releases WHERE is_current) <> original THEN RAISE EXCEPTION 'Invalid publication replaced release'; END IF;
END $$; RESET ROLE;`).join("\n")}
SELECT 'PASS malformed data, unsafe URLs, invalid emails, duplicate identifiers and incomplete FAQ rejected';
SET LOCAL ROLE authenticated;
SELECT public.rollback_site_settings_release(current_setting('how.content_original')::uuid);
RESET ROLE;
DO $$ BEGIN IF (SELECT id::text FROM public.site_settings_releases WHERE is_current) <> current_setting('how.content_original') THEN RAISE EXCEPTION 'Rollback failed'; END IF; END $$;
SELECT 'PASS legacy release rollback';
ROLLBACK;`
const result = spawnSync("docker", ["exec", "-i", "supabase_db_how-publication-stack", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-P", "pager=off"], { input: sql, encoding: "utf8" })
if (result.error) throw result.error
for (const line of (result.stdout || "").split("\n").filter(line => line.includes("PASS"))) console.log(line.trim())
if (result.status !== 0) console.error(result.stderr)
assert.equal(result.status, 0, "Managed content database checks failed; transaction rolled back")
console.log("PASS fixture data and settings changes rolled back")
