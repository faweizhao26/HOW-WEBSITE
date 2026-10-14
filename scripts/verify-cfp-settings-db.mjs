import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"

assert.equal(process.env.PUBLICATION_TEST_ISOLATED_PROJECT, "true", "Explicit isolated local environment required")
const container = "supabase_db_how-publication-stack"
const sql = `
BEGIN;
SELECT set_config('how.cfp_test_user', gen_random_uuid()::text, true);
SELECT set_config('how.cfp_test_admin', (SELECT id::text FROM public.profiles WHERE role='admin' LIMIT 1), true);
INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data, raw_app_meta_data)
VALUES (current_setting('how.cfp_test_user')::uuid, 'cfp-db-' || current_setting('how.cfp_test_user') || '@example.test', now(), '{}', '{}');
UPDATE public.site_settings_releases SET payload = payload || '{"cfp_enabled":"true","cfp_deadline":"","cfp_types":"[\\"talk\\",\\"workshop\\"]","cfp_durations":"[15,30]"}'::jsonb WHERE is_current;
INSERT INTO public.site_settings (key,value) VALUES ('cfp_enabled','false') ON CONFLICT (key) DO UPDATE SET value=excluded.value;
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('how.cfp_test_user'), 'role','authenticated')::text, true);
SET LOCAL ROLE authenticated;
INSERT INTO public.sessions (user_id,title,abstract,duration,type,status) VALUES (auth.uid(),'QA draft isolation','Abstract',30,'talk','pending');
SELECT 'PASS unpublished CFP draft does not close the released policy';
RESET ROLE;
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('how.cfp_test_admin'), 'role','authenticated')::text, true);
SET LOCAL ROLE authenticated;
SELECT public.publish_site_settings();
RESET ROLE;
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('how.cfp_test_user'), 'role','authenticated')::text, true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    INSERT INTO public.sessions (user_id,title,abstract,duration,type,status) VALUES (auth.uid(),'QA closed','Abstract',30,'talk','pending');
    RAISE EXCEPTION 'Closed CFP accepted a direct insert';
  EXCEPTION WHEN check_violation THEN IF SQLERRM <> 'cfp_closed' THEN RAISE; END IF; END;
  IF NOT EXISTS (SELECT 1 FROM public.sessions WHERE user_id=auth.uid() AND title='QA draft isolation') THEN RAISE EXCEPTION 'Existing proposals became unreadable'; END IF;
END $$;
SELECT 'PASS published closed policy blocks direct inserts and preserves existing proposals';
RESET ROLE;
UPDATE public.site_settings_releases SET payload = payload || '{"cfp_enabled":"true","cfp_deadline":"2020-01-01"}'::jsonb WHERE is_current;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    INSERT INTO public.sessions (user_id,title,abstract,duration,type,status) VALUES (auth.uid(),'QA expired','Abstract',30,'talk','pending');
    RAISE EXCEPTION 'Expired CFP accepted a direct insert';
  EXCEPTION WHEN check_violation THEN IF SQLERRM <> 'cfp_closed' THEN RAISE; END IF; END;
END $$;
SELECT 'PASS expired Beijing deadline blocks direct inserts';
RESET ROLE;
UPDATE public.site_settings_releases SET payload = payload || '{"cfp_deadline":"","cfp_types":"[\\"workshop\\"]","cfp_durations":"[15]"}'::jsonb WHERE is_current;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    INSERT INTO public.sessions (user_id,title,abstract,duration,type,status) VALUES (auth.uid(),'QA disabled type','Abstract',15,'talk','pending');
    RAISE EXCEPTION 'Disallowed session type accepted';
  EXCEPTION WHEN check_violation THEN IF SQLERRM <> 'cfp_option_not_allowed' THEN RAISE; END IF; END;
  BEGIN
    INSERT INTO public.sessions (user_id,title,abstract,duration,type,status) VALUES (auth.uid(),'QA disabled duration','Abstract',30,'workshop','pending');
    RAISE EXCEPTION 'Disallowed duration accepted';
  EXCEPTION WHEN check_violation THEN IF SQLERRM <> 'cfp_option_not_allowed' THEN RAISE; END IF; END;
END $$;
INSERT INTO public.sessions (user_id,title,abstract,duration,type,status) VALUES (auth.uid(),'QA permitted options','Abstract',15,'workshop','pending');
SELECT 'PASS configured option restrictions and permitted inserts';
RESET ROLE;
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('how.cfp_test_admin'), 'role','authenticated')::text, true);
SET LOCAL ROLE authenticated;
INSERT INTO public.site_settings (key,value) VALUES ('cfp_types','[]') ON CONFLICT (key) DO UPDATE SET value=excluded.value;
DO $$ DECLARE v_current uuid; BEGIN
  SELECT id INTO v_current FROM public.site_settings_releases WHERE is_current;
  BEGIN
    PERFORM public.publish_site_settings();
    RAISE EXCEPTION 'Invalid CFP policy published';
  EXCEPTION WHEN check_violation THEN NULL; END;
  IF (SELECT id FROM public.site_settings_releases WHERE is_current) <> v_current THEN RAISE EXCEPTION 'Failed publication changed current release'; END IF;
END $$;
SELECT 'PASS invalid CFP publication leaves the current release unchanged';
RESET ROLE;
ROLLBACK;
`
const result = spawnSync("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-P", "pager=off"], { input: sql, encoding: "utf8" })
if (result.error) throw result.error
for (const line of (result.stdout || "").split("\n").filter(line => line.includes("PASS"))) console.log(line.trim())
if (result.status !== 0) console.error(result.stderr)
assert.equal(result.status, 0, "CFP database validation failed; connection close rolls back all fixtures")
console.log("PASS all local test users, proposals and setting changes rolled back")
