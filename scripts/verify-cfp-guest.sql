\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout = '15s';

INSERT INTO auth.users(id, email, email_confirmed_at, raw_user_meta_data) VALUES
  ('7b98746e-6119-4a8c-8c59-b1827ce26303','admin@cfp-check.example.test',now(),'{}'),
  ('7b98746e-6119-4a8c-8c59-b1827ce26304','member@cfp-check.example.test',now(),'{}');
UPDATE public.profiles SET role = 'admin' WHERE id = '7b98746e-6119-4a8c-8c59-b1827ce26303';

UPDATE public.site_settings_releases
  SET payload = payload || '{"cfp_enabled":"true","cfp_deadline":"","cfp_types":"[\"talk\",\"workshop\",\"panel\",\"lightning\"]"}'::jsonb
  WHERE is_current;

SET LOCAL ROLE anon;
DO $$
DECLARE
  proposal jsonb := '{
    "requestId":"7b98746e-6119-4a8c-8c59-b1827ce26302",
    "email":"guest@cfp-check.example.test","privacyAccepted":true,
    "title":"Guest intake SQL verification","abstract":"This proposal never leaves the test transaction.",
    "type":"talk","duration":30,"proposalDetails":{"language":"en","full_name":"Guest Speaker",
      "company":"Community","position":"Developer","bio":"Speaker bio","outline":"Outline","photo_url":null}
  }';
  ref uuid;
BEGIN
  ref := public.submit_guest_cfp(proposal);
  IF ref <> (proposal->>'requestId')::uuid OR public.submit_guest_cfp(proposal) <> ref THEN
    RAISE EXCEPTION 'guest receipt should be idempotent';
  END IF;

  BEGIN
    PERFORM public.submit_guest_cfp(proposal || '{"title":"Changed title"}');
    RAISE EXCEPTION 'reuse of receipt with changed fields must fail';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM <> 'cfp_guest_conflict' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.submit_guest_cfp(proposal || '{"status":"approved"}');
    RAISE EXCEPTION 'a visitor must not set review status';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM <> 'cfp_guest_invalid' THEN RAISE; END IF;
  END;

  BEGIN
    IF EXISTS (SELECT 1 FROM public.sessions WHERE id = ref) THEN
      RAISE EXCEPTION 'a visitor must not read a private proposal';
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  FOR n IN 1..4 LOOP
    PERFORM public.submit_guest_cfp(proposal || jsonb_build_object('requestId', gen_random_uuid()));
  END LOOP;
  BEGIN
    PERFORM public.submit_guest_cfp(proposal || jsonb_build_object('requestId', gen_random_uuid()));
    RAISE EXCEPTION 'an email must not exceed its intake quota';
  EXCEPTION WHEN SQLSTATE 'PT429' THEN NULL;
  END;
END $$;
RESET ROLE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.sessions WHERE id = '7b98746e-6119-4a8c-8c59-b1827ce26302'
      AND guest_email = 'guest@cfp-check.example.test' AND user_id IS NULL
      AND status = 'pending' AND publication_status = 'draft'
  ) THEN RAISE EXCEPTION 'guest proposal was not stored as a private draft'; END IF;
  IF EXISTS (SELECT 1 FROM public.published_sessions WHERE id = '7b98746e-6119-4a8c-8c59-b1827ce26302') THEN
    RAISE EXCEPTION 'guest proposal was unexpectedly published';
  END IF;
END $$;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '7b98746e-6119-4a8c-8c59-b1827ce26304';
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.sessions WHERE guest_email = 'guest@cfp-check.example.test') THEN
    RAISE EXCEPTION 'an ordinary account can read guest contact details';
  END IF;
END $$;

SET LOCAL request.jwt.claim.sub = '7b98746e-6119-4a8c-8c59-b1827ce26303';
DO $$
DECLARE
  v_id uuid := '7b98746e-6119-4a8c-8c59-b1827ce26302';
  v_status text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.sessions WHERE id = v_id
      AND title = 'Guest intake SQL verification' AND guest_email = 'guest@cfp-check.example.test'
  ) THEN RAISE EXCEPTION 'admin cannot retrieve the title and guest contact'; END IF;
  FOREACH v_status IN ARRAY ARRAY['waitlisted','approved','rejected'] LOOP
    UPDATE public.sessions SET status = v_status WHERE id = v_id;
    IF NOT EXISTS (
      SELECT 1 FROM public.sessions WHERE id = v_id AND status = v_status AND publication_status = 'draft'
    ) THEN RAISE EXCEPTION 'admin could not update the guest review or it published automatically'; END IF;
  END LOOP;
END $$;
RESET ROLE;
ROLLBACK;
