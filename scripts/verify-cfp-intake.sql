-- Use only a disposable database with the base schema and CFP migrations applied.
BEGIN;
SET LOCAL statement_timeout = '15s';
INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data) VALUES
  ('43000000-0000-4000-8000-000000000001','cfp-intake@example.test',now(),'{}','{}'),
  ('43000000-0000-4000-8000-000000000002','cfp-other@example.test',now(),'{}','{}');
UPDATE public.site_settings_releases SET payload = payload || jsonb_build_object(
  'cfp_types','["talk","workshop","panel","lightning"]','cfp_enabled','true','cfp_deadline',''
) WHERE is_current;
INSERT INTO public.sessions(id,user_id,title,abstract,duration,type,status) VALUES
  ('43000000-0000-4000-8000-000000000011','43000000-0000-4000-8000-000000000001','Legacy proposal','Legacy',15,'talk','approved');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '43000000-0000-4000-8000-000000000001';
SET LOCAL request.jwt.claims = '{"sub":"43000000-0000-4000-8000-000000000001","role":"authenticated"}';
DO $$
DECLARE
  d jsonb := '{"language":"zh","full_name":"Test speaker","company":"Independent","position":"Developer","bio":"Backend experience","outline":"First topic, second topic","photo_url":null}';
  invalid_key text;
  variant record;
BEGIN
  FOR variant IN SELECT * FROM (VALUES ('talk',30),('workshop',30),('workshop',45),('workshop',60),('panel',30),('panel',45),('panel',60),('lightning',5)) AS t(kind, duration)
  LOOP
    INSERT INTO public.sessions(user_id,title,abstract,duration,type,proposal_details)
      VALUES(auth.uid(),'QA ' || variant.kind,'Description',variant.duration,variant.kind,
        CASE WHEN variant.kind = 'lightning' THEN jsonb_set(d,'{outline}','""') ELSE d END);
  END LOOP;
  FOR variant IN SELECT * FROM (VALUES ('talk',45),('workshop',5),('panel',15),('lightning',30)) AS t(kind, duration)
  LOOP
    BEGIN
      INSERT INTO public.sessions(user_id,title,abstract,duration,type,proposal_details)
        VALUES(auth.uid(),'QA invalid','Description',variant.duration,variant.kind,d);
      RAISE EXCEPTION 'Disallowed type and duration combination passed: % %',variant.kind,variant.duration;
    EXCEPTION WHEN check_violation THEN NULL;
    END;
  END LOOP;
  FOREACH invalid_key IN ARRAY ARRAY['language','full_name','company','position','bio','outline'] LOOP
    BEGIN
      INSERT INTO public.sessions(user_id,title,abstract,duration,type,proposal_details)
        VALUES(auth.uid(),'QA invalid','Description',30,'talk',d-invalid_key);
      RAISE EXCEPTION 'Missing required submission detail passed: %',invalid_key;
    EXCEPTION WHEN check_violation THEN NULL;
    END;
  END LOOP;
  IF (SELECT count(*) FROM public.sessions WHERE user_id=auth.uid()) <> 9
     OR NOT EXISTS(SELECT 1 FROM public.sessions WHERE title='Legacy proposal' AND duration=15 AND proposal_details IS NULL) THEN
    RAISE EXCEPTION 'Legacy proposal compatibility or intake totals are incorrect';
  END IF;
END;
$$;

SET LOCAL request.jwt.claim.sub = '43000000-0000-4000-8000-000000000002';
SET LOCAL request.jwt.claims = '{"sub":"43000000-0000-4000-8000-000000000002","role":"authenticated"}';
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.sessions WHERE user_id='43000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Another user saw private submission details';
  END IF;
END; $$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS required speaker details, all 8 valid format pairs, legacy records and private ownership';
