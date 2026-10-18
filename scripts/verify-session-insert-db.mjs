import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { spawnSync } from "node:child_process"

assert.equal(process.env.PUBLICATION_TEST_ISOLATED_PROJECT, "true", "Explicit isolated local environment required")
const container = process.env.AUDIT_DB_CONTAINER
const database = process.env.AUDIT_DB_NAME
assert.ok(container && database?.startsWith("how_audit_"), "Use the dedicated audit database, never a shared or production database")
const ordinary = randomUUID(), admin = randomUUID()
const sql = `
BEGIN;
SET LOCAL statement_timeout='15s';
INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data)
VALUES ('${ordinary}','${ordinary}@example.test',now(),'{}','{}'),('${admin}','${admin}@example.test',now(),'{}','{}');
UPDATE public.profiles SET role='admin' WHERE id='${admin}';
UPDATE public.site_settings_releases SET payload=payload||'{"cfp_enabled":"true","cfp_deadline":"","cfp_types":"[\\"talk\\",\\"workshop\\",\\"panel\\"]","cfp_durations":"[15,30,45,60]"}'::jsonb WHERE is_current;
SELECT set_config('request.jwt.claim.sub','${ordinary}',true);
SELECT set_config('request.jwt.claims','{"sub":"${ordinary}","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
INSERT INTO public.sessions(user_id,title,abstract,duration,type) VALUES(auth.uid(),'QA ordinary proposal','Abstract',30,'talk');
DO $$ DECLARE field text; BEGIN
  FOREACH field IN ARRAY ARRAY['admin_feedback','slides_url','video_url'] LOOP
    BEGIN
      EXECUTE format('INSERT INTO public.sessions(user_id,title,abstract,duration,type,%I) VALUES(auth.uid(),%L,%L,30,%L,$1)',field,'QA forged field','Abstract','talk') USING 'https://forged.example.test/admin-content';
      RAISE EXCEPTION 'ordinary user inserted administrator field %',field;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  END LOOP;
  IF (SELECT count(*) FROM public.sessions WHERE user_id=auth.uid()) <> 1 THEN RAISE EXCEPTION 'Unexpected forged session persisted'; END IF;
END $$;
UPDATE public.sessions SET title='QA permitted edit' WHERE user_id=auth.uid();
SELECT 'PASS ordinary pending insert/content edit and all three forged INSERT fields rejected';
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','${admin}',true);
SELECT set_config('request.jwt.claims','{"sub":"${admin}","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
INSERT INTO public.sessions(user_id,title,abstract,duration,type,admin_feedback,slides_url,video_url)
VALUES(auth.uid(),'QA administrator proposal','Abstract',30,'talk','Administrator feedback','https://local.example.test/slides','https://local.example.test/video');
SELECT 'PASS legitimate administrator media and feedback insert retained';
RESET ROLE;
ROLLBACK;
`
const result = spawnSync("docker", ["exec", "-i", container, "psql", "-X", "-U", "postgres", "-d", database, "-v", "ON_ERROR_STOP=1", "-Atq"], { input: sql, encoding: "utf8" })
if (result.error) throw result.error
if (result.status !== 0) console.error(result.stderr)
assert.equal(result.status, 0, "Session INSERT guard failed; test transaction is rolled back on disconnect")
console.log(result.stdout.split("\n").filter(line => line.startsWith("PASS")).join("\n"))
console.log("PASS fixtures and proposals rolled back")
