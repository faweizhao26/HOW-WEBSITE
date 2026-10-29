BEGIN;

CREATE OR REPLACE FUNCTION private.group_ticket_config_save(p_expected_user uuid,p_ticket_id uuid,p_enabled boolean,p_min_size integer,p_max_size integer,p_unit_price_cents integer,p_claim_deadline timestamptz)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  PERFORM private.group_actor(p_expected_user,true,true);
  IF p_enabled IS NULL OR p_min_size IS NULL OR p_max_size IS NULL OR p_unit_price_cents IS NULL OR p_min_size NOT BETWEEN 2 AND 100 OR p_max_size NOT BETWEEN p_min_size AND 100 OR p_unit_price_cents NOT BETWEEN 0 AND 100000000 OR (p_enabled AND p_claim_deadline<=clock_timestamp()) THEN RAISE EXCEPTION 'invalid_input'; END IF;
  PERFORM 1 FROM public.ticket_types WHERE id=p_ticket_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_input'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.group_ticket_configs WHERE ticket_type_id=p_ticket_id) THEN
    IF EXISTS(SELECT 1 FROM public.registrations WHERE ticket_type_id=p_ticket_id) THEN RAISE EXCEPTION 'ticket_in_use'; END IF;
    IF EXISTS(SELECT 1 FROM public.channel_codes WHERE ticket_type_id=p_ticket_id) THEN RAISE EXCEPTION 'ticket_has_channels'; END IF;
  END IF;
  UPDATE public.ticket_types SET group_only=true,requires_code=true,is_free=(p_unit_price_cents=0) WHERE id=p_ticket_id;
  INSERT INTO public.group_ticket_configs(ticket_type_id,enabled,min_size,max_size,unit_price_cents,claim_deadline)
    VALUES(p_ticket_id,p_enabled,p_min_size,p_max_size,p_unit_price_cents,p_claim_deadline)
    ON CONFLICT(ticket_type_id) DO UPDATE SET enabled=excluded.enabled,min_size=excluded.min_size,max_size=excluded.max_size,unit_price_cents=excluded.unit_price_cents,claim_deadline=excluded.claim_deadline,updated_at=clock_timestamp();
  RETURN true;
END; $$;

CREATE FUNCTION private.admin_ticket_save(p_expected_user uuid,p_ticket_id uuid,p_name text,p_name_zh text,p_description text,p_description_zh text,p_active boolean,p_sort_order integer,p_is_free boolean,p_requires_code boolean,p_group jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t public.ticket_types;
BEGIN
  PERFORM private.group_actor(p_expected_user,true,true);
  IF p_ticket_id IS NULL OR p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 200 OR p_name_zh IS NULL OR length(p_name_zh)>200 OR p_description IS NULL OR length(p_description)>5000 OR p_description_zh IS NULL OR length(p_description_zh)>5000 OR p_active IS NULL OR p_sort_order IS NULL OR p_sort_order NOT BETWEEN 0 AND 9999 OR p_is_free IS NULL OR p_requires_code IS NULL THEN RAISE EXCEPTION 'invalid_input'; END IF;
  IF p_group IS NOT NULL AND (jsonb_typeof(p_group)<>'object' OR NOT (p_group ?& ARRAY['enabled','minSize','maxSize','unitPriceCents','claimDeadline'])) THEN RAISE EXCEPTION 'invalid_input'; END IF;
  -- Serialize retries of a new client-generated ID before its row exists.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_ticket_id::text,20261029));
  SELECT * INTO t FROM public.ticket_types WHERE id=p_ticket_id FOR UPDATE;
  IF p_group IS NULL AND (coalesce(t.group_only,false) OR EXISTS(SELECT 1 FROM public.group_ticket_configs WHERE ticket_type_id=p_ticket_id)) THEN RAISE EXCEPTION 'ticket_kind_locked'; END IF;
  INSERT INTO public.ticket_types(id,name,name_zh,description,description_zh,is_active,sort_order,is_free,requires_code)
    VALUES(p_ticket_id,btrim(p_name),btrim(p_name_zh),p_description,p_description_zh,p_active,p_sort_order,p_is_free,p_requires_code)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,name_zh=excluded.name_zh,description=excluded.description,description_zh=excluded.description_zh,is_active=excluded.is_active,sort_order=excluded.sort_order,is_free=excluded.is_free,requires_code=excluded.requires_code;
  IF p_group IS NOT NULL THEN
    PERFORM private.group_ticket_config_save(p_expected_user,p_ticket_id,(p_group->>'enabled')::boolean,(p_group->>'minSize')::integer,(p_group->>'maxSize')::integer,(p_group->>'unitPriceCents')::integer,(p_group->>'claimDeadline')::timestamptz);
  END IF;
  RETURN p_ticket_id;
END; $$;
REVOKE ALL ON FUNCTION private.admin_ticket_save(uuid,uuid,text,text,text,text,boolean,integer,boolean,boolean,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.admin_ticket_save(uuid,uuid,text,text,text,text,boolean,integer,boolean,boolean,jsonb) TO authenticated;

CREATE FUNCTION public.admin_ticket_save(p_expected_user uuid,p_ticket_id uuid,p_name text,p_name_zh text,p_description text,p_description_zh text,p_active boolean,p_sort_order integer,p_is_free boolean,p_requires_code boolean,p_group jsonb)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT private.admin_ticket_save(p_expected_user,p_ticket_id,p_name,p_name_zh,p_description,p_description_zh,p_active,p_sort_order,p_is_free,p_requires_code,p_group);
$$;
REVOKE ALL ON FUNCTION public.admin_ticket_save(uuid,uuid,text,text,text,text,boolean,integer,boolean,boolean,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_ticket_save(uuid,uuid,text,text,text,text,boolean,integer,boolean,boolean,jsonb) TO authenticated;

NOTIFY pgrst,'reload schema';
COMMIT;
