BEGIN;

CREATE TABLE private.site_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  request_id uuid NOT NULL,
  audience_filter jsonb NOT NULL,
  preview_token text NOT NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  recipient_count int NOT NULL CHECK (recipient_count > 0),
  account_count int NOT NULL CHECK (account_count BETWEEN 1 AND recipient_count),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (created_by, request_id)
);

CREATE TABLE private.site_notification_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES private.site_notifications(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  proposal_title text,
  proposal_status text CHECK (proposal_status IN ('approved','waitlisted','rejected')),
  read_at timestamptz
);

CREATE INDEX notification_history_idx ON private.site_notifications(created_at DESC, id DESC);
CREATE INDEX notification_receipts_message_idx ON private.site_notification_receipts(notification_id);
CREATE INDEX notification_inbox_idx ON private.site_notification_receipts(account_id, created_at DESC, id DESC);
CREATE INDEX notification_unread_idx ON private.site_notification_receipts(account_id) WHERE read_at IS NULL;

ALTER TABLE private.site_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.site_notification_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.site_notifications, private.site_notification_receipts FROM PUBLIC, anon, authenticated;

CREATE FUNCTION private.notification_recipients(p_filter jsonb)
RETURNS TABLE (
  id uuid, account_id uuid, name text, email text, proposal_title text, proposal_status text,
  proposal_type text, proposal_duration int, proposal_language text
)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_audience text := p_filter->>'audience';
  v_mode text := p_filter->>'mode';
  v_query text := lower(btrim(coalesce(p_filter->>'query','')));
  v_language text := p_filter->>'language';
  v_type text := p_filter->>'type';
  v_ids uuid[];
BEGIN
  IF jsonb_typeof(p_filter) IS DISTINCT FROM 'object'
     OR (p_filter - ARRAY['audience','mode','query','language','type','ids']) <> '{}'::jsonb
     OR v_audience IS NULL OR v_audience NOT IN ('all','not_registered','registered','approved','waitlisted','rejected','manual')
     OR v_mode IS NULL OR v_mode NOT IN ('general','result')
     OR (v_mode = 'result' AND v_audience NOT IN ('approved','waitlisted','rejected'))
     OR char_length(v_query) > 200
     OR (v_language IS NOT NULL AND v_language NOT IN ('en','zh'))
     OR (v_type IS NOT NULL AND v_type NOT IN ('talk','workshop','panel','lightning'))
     OR ((v_language IS NOT NULL OR v_type IS NOT NULL) AND v_audience NOT IN ('approved','waitlisted','rejected')) THEN
    RAISE EXCEPTION 'NOTIFICATION_INVALID_FILTER' USING ERRCODE = '22023';
  END IF;
  IF p_filter ? 'ids' THEN
    IF jsonb_typeof(p_filter->'ids') IS DISTINCT FROM 'array'
       OR jsonb_array_length(p_filter->'ids') > 10000 THEN
      RAISE EXCEPTION 'NOTIFICATION_INVALID_SELECTION' USING ERRCODE = '22023';
    END IF;
    v_ids := ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(p_filter->'ids'));
  END IF;

  IF v_audience IN ('approved','waitlisted','rejected') THEN
    RETURN QUERY
      WITH matching AS (
        SELECT s.id AS proposal_id, u.id AS owner_id, coalesce(p.full_name,'') AS account_name,
          coalesce(nullif(s.proposal_details->>'full_name',''), p.full_name,'') AS speaker_name, u.email::text AS address,
          s.title AS talk_title, s.status AS decision, s.type AS talk_type, s.duration AS minutes,
          s.proposal_details->>'language' AS language
        FROM public.sessions s
        JOIN auth.users u ON u.id = s.user_id AND NOT coalesce(u.is_anonymous,false)
        LEFT JOIN public.profiles p ON p.id = u.id
        WHERE s.status = v_audience
          AND (v_ids IS NULL OR CASE WHEN v_mode = 'result' THEN s.id ELSE u.id END = ANY(v_ids))
          AND (v_language IS NULL OR s.proposal_details->>'language' = v_language)
          AND (v_type IS NULL OR s.type = v_type)
          AND (v_query = '' OR strpos(lower(coalesce(u.email,'')), v_query) > 0
            OR strpos(lower(coalesce(p.full_name,'')), v_query) > 0
            OR strpos(lower(coalesce(s.proposal_details->>'full_name','')), v_query) > 0
            OR strpos(lower(s.title), v_query) > 0
            OR strpos(lower(coalesce(s.title_zh,'')), v_query) > 0)
      )
      SELECT m.proposal_id, m.owner_id, m.speaker_name, m.address, m.talk_title, m.decision, m.talk_type, m.minutes, m.language
      FROM matching m WHERE v_mode = 'result'
      UNION ALL
      SELECT DISTINCT m.owner_id, m.owner_id, m.account_name, m.address, NULL::text, NULL::text, NULL::text, NULL::int, NULL::text
      FROM matching m WHERE v_mode = 'general';
  ELSE
    RETURN QUERY
      SELECT u.id, u.id, coalesce(p.full_name,''), u.email::text, NULL::text, NULL::text, NULL::text, NULL::int, NULL::text
      FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id
      WHERE NOT coalesce(u.is_anonymous,false)
        AND (v_ids IS NULL OR u.id = ANY(v_ids))
        AND (v_query = '' OR strpos(lower(coalesce(u.email,'')), v_query) > 0
          OR strpos(lower(coalesce(p.full_name,'')), v_query) > 0)
        AND (v_audience NOT IN ('registered','not_registered') OR
          (v_audience = 'registered') = EXISTS (
            SELECT 1 FROM public.registrations r WHERE r.user_id = u.id AND r.status = 'confirmed'
          ));
  END IF;
END;
$$;

CREATE FUNCTION private.notification_recipient_snapshot(p_filter jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_rows jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY lower(r.name), r.id), '[]'::jsonb)
    INTO v_rows FROM (SELECT * FROM private.notification_recipients(p_filter) LIMIT 10001) r;
  IF jsonb_array_length(v_rows) > 10000 THEN
    RAISE EXCEPTION 'NOTIFICATION_TOO_MANY_RECIPIENTS' USING ERRCODE = '22023';
  END IF;
  RETURN v_rows;
END;
$$;

CREATE FUNCTION private.notification_token(p_filter jsonb, p_rows jsonb)
RETURNS text LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT encode(sha256(convert_to(jsonb_build_array(p_filter,p_rows)::text, 'UTF8')), 'hex');
$$;

CREATE FUNCTION private.notification_check_admin()
RETURNS void LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_admin() THEN
    RAISE EXCEPTION 'NOTIFICATION_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE FUNCTION private.notification_preview(p_filter jsonb, p_offset int)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_rows jsonb;
  v_page jsonb;
  v_accounts int;
BEGIN
  PERFORM private.notification_check_admin();
  IF p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 10000 THEN
    RAISE EXCEPTION 'NOTIFICATION_INVALID_PAGE' USING ERRCODE = '22023';
  END IF;
  v_rows := private.notification_recipient_snapshot(p_filter);
  SELECT count(DISTINCT value->>'account_id') INTO v_accounts FROM jsonb_array_elements(v_rows);
  SELECT coalesce(jsonb_agg(value ORDER BY ord), '[]'::jsonb) INTO v_page
    FROM jsonb_array_elements(v_rows) WITH ORDINALITY AS rows(value,ord)
    WHERE ord > p_offset AND ord <= p_offset + 30;
  RETURN jsonb_build_object('count', jsonb_array_length(v_rows), 'accounts', v_accounts,
    'token', private.notification_token(p_filter,v_rows), 'rows', v_page, 'offset', p_offset);
END;
$$;

CREATE FUNCTION private.notification_export(p_filter jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  PERFORM private.notification_check_admin();
  IF p_filter->>'audience' = 'manual' AND NOT (p_filter ? 'ids') THEN
    RAISE EXCEPTION 'NOTIFICATION_SELECTION_REQUIRED' USING ERRCODE = '22023';
  END IF;
  RETURN private.notification_recipient_snapshot(p_filter);
END;
$$;

CREATE FUNCTION private.notification_send(p_filter jsonb, p_token text, p_request_id uuid, p_title text, p_body text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_rows jsonb;
  v_id uuid;
  v_count int;
  v_accounts int;
  v_existing private.site_notifications%ROWTYPE;
BEGIN
  PERFORM private.notification_check_admin();
  p_title := btrim(p_title);
  p_body := btrim(p_body);
  IF p_request_id IS NULL OR p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$'
     OR p_title IS NULL OR char_length(p_title) NOT BETWEEN 1 AND 160
     OR p_body IS NULL OR char_length(p_body) NOT BETWEEN 1 AND 5000
     OR (p_filter->>'audience' = 'manual' AND NOT (p_filter ? 'ids')) THEN
    RAISE EXCEPTION 'NOTIFICATION_INVALID_SEND' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_actor::text || ':' || p_request_id::text, 0));
  PERFORM private.notification_check_admin();
  SELECT * INTO v_existing FROM private.site_notifications n WHERE n.created_by = v_actor AND n.request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.audience_filter IS DISTINCT FROM p_filter OR v_existing.preview_token <> p_token
      OR v_existing.title <> p_title OR v_existing.body <> p_body THEN
      RAISE EXCEPTION 'NOTIFICATION_REQUEST_CONFLICT' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('id', v_existing.id, 'count', v_existing.recipient_count, 'accounts', v_existing.account_count);
  END IF;
  v_rows := private.notification_recipient_snapshot(p_filter);
  IF p_token <> private.notification_token(p_filter,v_rows) THEN
    RAISE EXCEPTION 'NOTIFICATION_PREVIEW_CHANGED' USING ERRCODE = '40001';
  END IF;
  v_count := jsonb_array_length(v_rows);
  IF v_count = 0 THEN RAISE EXCEPTION 'NOTIFICATION_NO_RECIPIENTS' USING ERRCODE = '22023'; END IF;
  SELECT count(DISTINCT value->>'account_id') INTO v_accounts FROM jsonb_array_elements(v_rows);
  INSERT INTO private.site_notifications(created_by,request_id,audience_filter,preview_token,title,body,recipient_count,account_count)
    VALUES(v_actor,p_request_id,p_filter,p_token,p_title,p_body,v_count,v_accounts) RETURNING id INTO v_id;
  INSERT INTO private.site_notification_receipts(notification_id,account_id,proposal_title,proposal_status)
    SELECT v_id,(r.value->>'account_id')::uuid,r.value->>'proposal_title',r.value->>'proposal_status'
    FROM jsonb_array_elements(v_rows) r;
  RETURN jsonb_build_object('id', v_id, 'count', v_count, 'accounts', v_accounts);
END;
$$;

CREATE FUNCTION private.notification_history()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  PERFORM private.notification_check_admin();
  RETURN (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC,r.id DESC), '[]'::jsonb)
    FROM (SELECT n.id,n.title,n.created_at,n.recipient_count AS count,
      n.audience_filter->>'mode' AS mode,n.audience_filter->>'audience' AS audience
      FROM private.site_notifications n ORDER BY n.created_at DESC,n.id DESC LIMIT 30) r);
END;
$$;

CREATE FUNCTION private.notification_unread()
RETURNS int LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOTIFICATION_FORBIDDEN' USING ERRCODE = '42501'; END IF;
  RETURN (SELECT count(*)::int FROM private.site_notification_receipts r WHERE r.account_id = auth.uid() AND r.read_at IS NULL);
END;
$$;

CREATE FUNCTION private.notification_inbox(p_offset int)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'NOTIFICATION_FORBIDDEN' USING ERRCODE = '42501'; END IF;
  IF p_offset IS NULL OR p_offset < 0 THEN RAISE EXCEPTION 'NOTIFICATION_INVALID_PAGE' USING ERRCODE = '22023'; END IF;
  RETURN jsonb_build_object('unread', private.notification_unread(),
    'total', (SELECT count(*) FROM private.site_notification_receipts r WHERE r.account_id = v_actor),
    'rows', (SELECT coalesce(jsonb_agg(to_jsonb(item) ORDER BY item.created_at DESC,item.id DESC), '[]'::jsonb)
      FROM (SELECT r.id, n.title,n.body,r.created_at,r.read_at,r.proposal_title,r.proposal_status
        FROM private.site_notification_receipts r JOIN private.site_notifications n ON n.id = r.notification_id
        WHERE r.account_id = v_actor ORDER BY r.created_at DESC,r.id DESC LIMIT 30 OFFSET p_offset) item));
END;
$$;

CREATE FUNCTION private.notification_read(p_id uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'NOTIFICATION_FORBIDDEN' USING ERRCODE = '42501'; END IF;
  UPDATE private.site_notification_receipts r SET read_at = now()
    WHERE r.account_id = v_actor AND r.read_at IS NULL AND (p_id IS NULL OR r.id = p_id);
  RETURN private.notification_unread();
END;
$$;

CREATE FUNCTION public.notification_preview(p_filter jsonb, p_offset int DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$ SELECT private.notification_preview(p_filter,p_offset); $$;
CREATE FUNCTION public.notification_export(p_filter jsonb)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$ SELECT private.notification_export(p_filter); $$;
CREATE FUNCTION public.notification_send(p_filter jsonb, p_token text, p_request_id uuid, p_title text, p_body text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $$ SELECT private.notification_send(p_filter,p_token,p_request_id,p_title,p_body); $$;
CREATE FUNCTION public.notification_history()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$ SELECT private.notification_history(); $$;
CREATE FUNCTION public.notification_unread()
RETURNS int LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$ SELECT private.notification_unread(); $$;
CREATE FUNCTION public.notification_inbox(p_offset int DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$ SELECT private.notification_inbox(p_offset); $$;
CREATE FUNCTION public.notification_read(p_id uuid DEFAULT NULL)
RETURNS int LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $$ SELECT private.notification_read(p_id); $$;

REVOKE ALL ON FUNCTION private.notification_recipients(jsonb), private.notification_recipient_snapshot(jsonb),
  private.notification_token(jsonb,jsonb), private.notification_check_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION
  private.notification_preview(jsonb,int), private.notification_export(jsonb), private.notification_send(jsonb,text,uuid,text,text),
  private.notification_history(), private.notification_unread(), private.notification_inbox(int), private.notification_read(uuid),
  public.notification_preview(jsonb,int), public.notification_export(jsonb), public.notification_send(jsonb,text,uuid,text,text),
  public.notification_history(), public.notification_unread(), public.notification_inbox(int), public.notification_read(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  private.notification_preview(jsonb,int), private.notification_export(jsonb), private.notification_send(jsonb,text,uuid,text,text),
  private.notification_history(), private.notification_unread(), private.notification_inbox(int), private.notification_read(uuid),
  public.notification_preview(jsonb,int), public.notification_export(jsonb), public.notification_send(jsonb,text,uuid,text,text),
  public.notification_history(), public.notification_unread(), public.notification_inbox(int), public.notification_read(uuid)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
