BEGIN;

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
  v_types := coalesce(nullif(p_payload->>'cfp_types', '')::jsonb, '["talk","workshop","panel"]'::jsonb);
  v_durations := coalesce(nullif(p_payload->>'cfp_durations', '')::jsonb, '[15,30,45,60]'::jsonb);
  IF jsonb_typeof(v_types) <> 'array' OR jsonb_typeof(v_durations) <> 'array' THEN RETURN false; END IF;
  IF jsonb_array_length(v_types) = 0 OR jsonb_array_length(v_durations) = 0 THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_types) v WHERE jsonb_typeof(v) <> 'string' OR v #>> '{}' NOT IN ('talk', 'workshop', 'panel')) THEN RETURN false; END IF;
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

CREATE OR REPLACE FUNCTION private.validate_cfp_release()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  IF NOT private.cfp_settings_valid(NEW.payload) THEN
    RAISE EXCEPTION 'invalid_cfp_settings' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.validate_cfp_release() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER validate_cfp_release BEFORE INSERT OR UPDATE OF payload ON public.site_settings_releases
  FOR EACH ROW EXECUTE FUNCTION private.validate_cfp_release();

CREATE OR REPLACE FUNCTION private.enforce_cfp_submission()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_payload JSONB;
  v_deadline TEXT;
  v_types JSONB;
  v_durations JSONB;
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') OR private.is_admin() THEN RETURN NEW; END IF;
  SELECT payload INTO v_payload FROM public.site_settings_releases WHERE is_current;
  IF NOT private.cfp_settings_valid(v_payload) THEN
    RAISE EXCEPTION 'cfp_settings_unavailable' USING ERRCODE = '23514';
  END IF;
  IF coalesce(nullif(v_payload->>'cfp_enabled', ''), 'true') = 'false' THEN
    RAISE EXCEPTION 'cfp_closed' USING ERRCODE = '23514';
  END IF;
  v_deadline := nullif(v_payload->>'cfp_deadline', '');
  IF v_deadline IS NOT NULL AND clock_timestamp() >= ((v_deadline::date + 1)::timestamp AT TIME ZONE 'Asia/Shanghai') THEN
    RAISE EXCEPTION 'cfp_closed' USING ERRCODE = '23514';
  END IF;
  v_types := coalesce(nullif(v_payload->>'cfp_types', '')::jsonb, '["talk","workshop","panel"]'::jsonb);
  v_durations := coalesce(nullif(v_payload->>'cfp_durations', '')::jsonb, '[15,30,45,60]'::jsonb);
  IF NOT (v_types ? NEW.type) OR NOT (v_durations @> jsonb_build_array(NEW.duration)) THEN
    RAISE EXCEPTION 'cfp_option_not_allowed' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.enforce_cfp_submission() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER enforce_cfp_submission BEFORE INSERT ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION private.enforce_cfp_submission();

NOTIFY pgrst, 'reload schema';
COMMIT;
