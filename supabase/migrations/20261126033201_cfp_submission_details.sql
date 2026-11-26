BEGIN;

ALTER TABLE public.sessions ADD COLUMN proposal_details jsonb;
ALTER TABLE public.sessions DROP CONSTRAINT sessions_type_check;
ALTER TABLE public.sessions ADD CONSTRAINT sessions_type_check CHECK (type IN ('talk','workshop','panel','lightning'));
ALTER TABLE public.sessions DROP CONSTRAINT sessions_status_check;
ALTER TABLE public.sessions ADD CONSTRAINT sessions_status_check CHECK (status IN ('pending','approved','waitlisted','rejected'));
ALTER TABLE public.sessions ADD CONSTRAINT sessions_waitlist_is_private CHECK (
  status <> 'waitlisted' OR (publication_status = 'draft' AND speaker_id IS NULL)
);
ALTER TABLE public.published_sessions DROP CONSTRAINT published_sessions_type_check;
ALTER TABLE public.published_sessions ADD CONSTRAINT published_sessions_type_check CHECK (type IN ('talk','workshop','panel','lightning'));

CREATE OR REPLACE FUNCTION private.cfp_settings_valid(p_payload JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_types JSONB;
  v_durations JSONB;
  v_deadline TEXT;
  v_key TEXT;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN RETURN false; END IF;
  IF coalesce(nullif(p_payload->>'cfp_enabled', ''), 'true') NOT IN ('true', 'false') THEN RETURN false; END IF;
  v_deadline := nullif(p_payload->>'cfp_deadline', '');
  IF v_deadline IS NOT NULL THEN
    IF v_deadline !~ '^\d{4}-\d{2}-\d{2}$' THEN RETURN false; END IF;
    IF to_char(v_deadline::date, 'YYYY-MM-DD') <> v_deadline THEN RETURN false; END IF;
  END IF;
  v_types := coalesce(nullif(p_payload->>'cfp_types', '')::jsonb, '["talk","workshop","panel","lightning"]'::jsonb);
  v_durations := coalesce(nullif(p_payload->>'cfp_durations', '')::jsonb, '[15,30,45,60]'::jsonb);
  IF jsonb_typeof(v_types) <> 'array' OR jsonb_typeof(v_durations) <> 'array' THEN RETURN false; END IF;
  IF jsonb_array_length(v_types) = 0 OR jsonb_array_length(v_durations) = 0 THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_types) v WHERE jsonb_typeof(v) <> 'string' OR v #>> '{}' NOT IN ('talk', 'workshop', 'panel', 'lightning')) THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_durations) v WHERE jsonb_typeof(v) <> 'number') THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_durations) v WHERE v::numeric NOT IN (15,30,45,60)) THEN RETURN false; END IF;
  IF (SELECT count(DISTINCT v) FROM jsonb_array_elements(v_types) v) <> jsonb_array_length(v_types)
    OR (SELECT count(DISTINCT v) FROM jsonb_array_elements(v_durations) v) <> jsonb_array_length(v_durations) THEN RETURN false; END IF;
  FOREACH v_key IN ARRAY ARRAY['cfp_intro','cfp_intro_zh','cfp_requirements','cfp_requirements_zh','cfp_review_notes','cfp_review_notes_zh'] LOOP
    IF coalesce(length(p_payload->>v_key), 0) > 10000 THEN RETURN false; END IF;
  END LOOP;
  IF nullif(p_payload->>'cfp_contact_email', '') IS NOT NULL
    AND (length(p_payload->>'cfp_contact_email') > 320 OR p_payload->>'cfp_contact_email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') THEN RETURN false; END IF;
  RETURN true;
EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN
  RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION private.cfp_settings_valid(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.cfp_settings_valid(JSONB) TO authenticated;

CREATE FUNCTION private.cfp_verified_submitter()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = (SELECT auth.uid()) AND u.email_confirmed_at IS NOT NULL);
$$;
REVOKE ALL ON FUNCTION private.cfp_verified_submitter() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.cfp_verified_submitter() TO authenticated;

CREATE OR REPLACE FUNCTION private.enforce_cfp_submission()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_payload jsonb;
  v_deadline text;
  v_types jsonb;
  v_field text;
  v_details jsonb := NEW.proposal_details;
BEGIN
  IF current_user IN ('postgres','supabase_admin','service_role') OR private.is_admin() THEN RETURN NEW; END IF;
  IF NOT private.cfp_verified_submitter() THEN RAISE EXCEPTION 'cfp_email_not_verified' USING ERRCODE = '42501'; END IF;
  SELECT payload INTO v_payload FROM public.site_settings_releases WHERE is_current;
  IF NOT private.cfp_settings_valid(v_payload) THEN RAISE EXCEPTION 'cfp_settings_unavailable' USING ERRCODE = '23514'; END IF;
  v_deadline := nullif(v_payload->>'cfp_deadline', '');
  IF coalesce(nullif(v_payload->>'cfp_enabled', ''), 'true') = 'false' OR
    (v_deadline IS NOT NULL AND clock_timestamp() >= ((v_deadline::date + 1)::timestamp AT TIME ZONE 'Asia/Shanghai')) THEN
    RAISE EXCEPTION 'cfp_closed' USING ERRCODE = '23514';
  END IF;
  v_types := coalesce(nullif(v_payload->>'cfp_types', '')::jsonb, '["talk","workshop","panel","lightning"]'::jsonb);
  IF NOT (v_types ? NEW.type) OR NOT (
    (NEW.type = 'talk' AND NEW.duration = 30)
    OR (NEW.type IN ('workshop','panel') AND NEW.duration IN (30,45,60))
    OR (NEW.type = 'lightning' AND NEW.duration = 5)
  ) THEN RAISE EXCEPTION 'cfp_option_not_allowed' USING ERRCODE = '23514'; END IF;

  IF jsonb_typeof(v_details) IS DISTINCT FROM 'object'
     OR (v_details - ARRAY['language','full_name','company','position','bio','outline','photo_url']) <> '{}'::jsonb
     OR coalesce(v_details->>'language','') NOT IN ('en','zh')
     OR NEW.title IS NULL OR NEW.title !~ '[^[:space:]]' OR length(NEW.title) > 200
     OR NEW.abstract IS NULL OR NEW.abstract !~ '[^[:space:]]' OR length(NEW.abstract) > 10000
     OR NEW.title_zh IS NOT NULL OR NEW.abstract_zh IS NOT NULL THEN
    RAISE EXCEPTION 'cfp_invalid_details' USING ERRCODE = '23514';
  END IF;
  FOREACH v_field IN ARRAY ARRAY['full_name','company','position','bio'] LOOP
    IF jsonb_typeof(v_details->v_field) IS DISTINCT FROM 'string'
       OR v_details->>v_field !~ '[^[:space:]]'
       OR length(v_details->>v_field) > (CASE v_field WHEN 'full_name' THEN 128 WHEN 'bio' THEN 4000 ELSE 200 END) THEN
      RAISE EXCEPTION 'cfp_invalid_details' USING ERRCODE = '23514';
    END IF;
  END LOOP;
  IF jsonb_typeof(v_details->'outline') IS DISTINCT FROM 'string'
    OR length(v_details->>'outline') > 6000
    OR (NEW.type <> 'lightning' AND v_details->>'outline' !~ '[^[:space:]]') THEN
    RAISE EXCEPTION 'cfp_invalid_details' USING ERRCODE = '23514';
  END IF;
  IF v_details->>'photo_url' IS NOT NULL AND (
    jsonb_typeof(v_details->'photo_url') <> 'string' OR length(v_details->>'photo_url') > 2048
    OR v_details->>'photo_url' !~ ('^https?://[^/@?#[:space:]]+/storage/v1/object/public/conference-media/avatars/' || NEW.user_id::text || '/[a-zA-Z0-9._-]+$')
  ) THEN RAISE EXCEPTION 'cfp_invalid_details' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION private.guard_cfp_details_update()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('postgres','supabase_admin','service_role') OR private.is_admin() THEN RETURN NEW; END IF;
  IF NEW.proposal_details IS DISTINCT FROM OLD.proposal_details OR
    (OLD.proposal_details IS NOT NULL AND ROW(NEW.title,NEW.title_zh,NEW.abstract,NEW.abstract_zh,NEW.duration,NEW.type)
     IS DISTINCT FROM ROW(OLD.title,OLD.title_zh,OLD.abstract,OLD.abstract_zh,OLD.duration,OLD.type)) THEN
    RAISE EXCEPTION 'cfp_submission_is_final' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_cfp_details_update() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_cfp_details_update BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION private.guard_cfp_details_update();

NOTIFY pgrst, 'reload schema';
COMMIT;
