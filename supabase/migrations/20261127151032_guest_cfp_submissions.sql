BEGIN;

ALTER TABLE public.sessions ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.sessions ADD COLUMN guest_email text;
ALTER TABLE public.sessions ADD CONSTRAINT sessions_submitter_check CHECK (
  (user_id IS NULL) = (guest_email IS NOT NULL)
);
CREATE INDEX sessions_guest_intake_time_idx ON public.sessions(created_at DESC) WHERE guest_email IS NOT NULL;
CREATE INDEX sessions_guest_intake_email_time_idx ON public.sessions(guest_email, created_at DESC) WHERE guest_email IS NOT NULL;

-- Keep the privileged insert in its own non-API schema; no anonymous table access is granted.
CREATE SCHEMA cfp_intake;
REVOKE ALL ON SCHEMA cfp_intake FROM PUBLIC;
GRANT USAGE ON SCHEMA cfp_intake TO anon, authenticated;

CREATE FUNCTION cfp_intake.submit_guest(p_proposal jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_id uuid;
  v_email text := lower(btrim(p_proposal->>'email'));
  v_title text := btrim(p_proposal->>'title');
  v_abstract text := btrim(p_proposal->>'abstract');
  v_type text := p_proposal->>'type';
  v_minutes integer;
  v_details jsonb := p_proposal->'proposalDetails';
  v_release jsonb;
  v_types jsonb;
  v_deadline date;
  v_field text;
  v_time timestamptz;
  v_previous public.sessions%ROWTYPE;
BEGIN
  IF jsonb_typeof(p_proposal) IS DISTINCT FROM 'object'
    OR octet_length(p_proposal::text) > 100000
    OR (p_proposal - ARRAY['requestId','email','privacyAccepted','title','abstract','duration','type','proposalDetails']) <> '{}'::jsonb
    OR p_proposal->'privacyAccepted' IS DISTINCT FROM 'true'::jsonb
    OR jsonb_typeof(p_proposal->'requestId') IS DISTINCT FROM 'string'
    OR jsonb_typeof(p_proposal->'email') IS DISTINCT FROM 'string'
    OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR length(v_email) > 254
    OR jsonb_typeof(p_proposal->'title') IS DISTINCT FROM 'string'
    OR v_title !~ '[^[:space:]]' OR length(v_title) > 200
    OR jsonb_typeof(p_proposal->'abstract') IS DISTINCT FROM 'string'
    OR v_abstract !~ '[^[:space:]]' OR length(v_abstract) > 10000
    OR jsonb_typeof(p_proposal->'duration') IS DISTINCT FROM 'number'
    OR (p_proposal->>'duration') !~ '^(5|30|45|60)$'
    OR v_type IS NULL OR v_type NOT IN ('talk','workshop','panel','lightning')
    OR jsonb_typeof(v_details) IS DISTINCT FROM 'object'
    OR (v_details - ARRAY['language','full_name','company','position','bio','outline','photo_url']) <> '{}'::jsonb
    OR coalesce(v_details->>'language','') NOT IN ('zh','en')
    OR v_details->'photo_url' IS DISTINCT FROM 'null'::jsonb THEN
    RAISE EXCEPTION 'cfp_guest_invalid' USING ERRCODE = '22023';
  END IF;
  v_id := (p_proposal->>'requestId')::uuid;
  v_minutes := (p_proposal->>'duration')::integer;
  FOREACH v_field IN ARRAY ARRAY['full_name','company','position','bio','outline'] LOOP
    IF jsonb_typeof(v_details->v_field) IS DISTINCT FROM 'string'
      OR ((v_field <> 'outline' OR v_type <> 'lightning') AND v_details->>v_field !~ '[^[:space:]]')
      OR length(v_details->>v_field) > (CASE v_field WHEN 'full_name' THEN 128 WHEN 'bio' THEN 4000 WHEN 'outline' THEN 6000 ELSE 200 END) THEN
      RAISE EXCEPTION 'cfp_guest_invalid' USING ERRCODE = '22023';
    END IF;
  END LOOP;

  -- Serialize the quota check and write so simultaneous anonymous requests cannot exceed it.
  PERFORM pg_advisory_xact_lock(hashtextextended('how:cfp:guest-intake', 0));
  SELECT * INTO v_previous FROM public.sessions WHERE id = v_id;
  IF FOUND THEN
    IF v_previous.user_id IS NOT NULL OR v_previous.guest_email IS DISTINCT FROM v_email
      OR ROW(v_previous.title, v_previous.abstract, v_previous.type, v_previous.duration, v_previous.proposal_details)
        IS DISTINCT FROM ROW(v_title, v_abstract, v_type, v_minutes, v_details) THEN
      RAISE EXCEPTION 'cfp_guest_conflict' USING ERRCODE = '22023';
    END IF;
    RETURN v_id;
  END IF;

  SELECT payload INTO v_release FROM public.site_settings_releases WHERE is_current;
  IF NOT private.cfp_settings_valid(v_release) THEN
    RAISE EXCEPTION 'cfp_settings_unavailable' USING ERRCODE = '23514';
  END IF;
  v_time := clock_timestamp();
  v_deadline := nullif(v_release->>'cfp_deadline','')::date;
  IF coalesce(nullif(v_release->>'cfp_enabled',''),'true') = 'false'
    OR (v_deadline IS NOT NULL AND v_time >= ((v_deadline + 1)::timestamp AT TIME ZONE 'Asia/Shanghai')) THEN
    RAISE EXCEPTION 'cfp_closed' USING ERRCODE = '23514';
  END IF;
  v_types := coalesce(nullif(v_release->>'cfp_types','')::jsonb, '["talk","workshop","panel","lightning"]'::jsonb);
  IF NOT (v_types ? v_type) OR NOT (
    (v_type = 'talk' AND v_minutes = 30)
    OR (v_type IN ('workshop','panel') AND v_minutes IN (30,45,60))
    OR (v_type = 'lightning' AND v_minutes = 5)
  ) THEN RAISE EXCEPTION 'cfp_option_not_allowed' USING ERRCODE = '23514'; END IF;

  IF (SELECT count(*) FROM (SELECT 1 FROM public.sessions
      WHERE guest_email = v_email AND created_at > v_time - interval '1 hour' LIMIT 5) recent) >= 5
    OR (SELECT count(*) FROM (SELECT 1 FROM public.sessions
      WHERE guest_email IS NOT NULL AND created_at > v_time - interval '10 minutes' LIMIT 60) recent) >= 60 THEN
    RAISE EXCEPTION 'cfp_guest_rate_limit' USING ERRCODE = 'PT429';
  END IF;

  INSERT INTO public.sessions(id, guest_email, title, abstract, type, duration, proposal_details, status, publication_status, created_at)
    VALUES (v_id, v_email, v_title, v_abstract, v_type, v_minutes, v_details, 'pending', 'draft', v_time);
  RETURN v_id;
END;
$$;

CREATE FUNCTION public.submit_guest_cfp(p_proposal jsonb)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $$ SELECT cfp_intake.submit_guest(p_proposal); $$;

REVOKE ALL ON FUNCTION cfp_intake.submit_guest(jsonb), public.submit_guest_cfp(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION cfp_intake.submit_guest(jsonb), public.submit_guest_cfp(jsonb) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
