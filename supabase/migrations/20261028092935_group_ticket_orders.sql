BEGIN;

ALTER TABLE public.ticket_types ADD COLUMN group_only boolean NOT NULL DEFAULT false;
CREATE TABLE public.group_ticket_configs (
  ticket_type_id uuid PRIMARY KEY REFERENCES public.ticket_types(id),
  enabled boolean NOT NULL DEFAULT false,
  min_size integer NOT NULL CHECK (min_size BETWEEN 2 AND 100),
  max_size integer NOT NULL CHECK (max_size BETWEEN min_size AND 100),
  unit_price_cents integer NOT NULL CHECK (unit_price_cents BETWEEN 0 AND 100000000),
  claim_deadline timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.group_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  request_id uuid NOT NULL,
  ticket_type_id uuid NOT NULL REFERENCES public.ticket_types(id),
  ticket_name text NOT NULL, ticket_name_zh text,
  team_name text NOT NULL CHECK (length(btrim(team_name)) BETWEEN 1 AND 200),
  quantity integer NOT NULL CHECK (quantity BETWEEN 2 AND 100),
  unit_price_cents integer NOT NULL CHECK (unit_price_cents BETWEEN 0 AND 100000000),
  total_cents bigint GENERATED ALWAYS AS (quantity::bigint * unit_price_cents) STORED,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','closed','cancelled')),
  claim_deadline timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours',
  activated_at timestamptz, payment_reference text, verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(owner_id,request_id),
  CHECK ((status IN ('active','closed')) = (activated_at IS NOT NULL AND payment_reference IS NOT NULL))
);
CREATE UNIQUE INDEX group_payment_reference_unique ON public.group_orders(lower(payment_reference)) WHERE payment_reference IS NOT NULL;
CREATE INDEX group_orders_owner_created ON public.group_orders(owner_id,created_at DESC,id);
CREATE INDEX group_orders_created ON public.group_orders(created_at DESC,id);
CREATE TABLE public.group_seats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.group_orders(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE DEFAULT 'HOWG-'||upper(encode(extensions.gen_random_bytes(24),'hex')),
  claimed_by uuid REFERENCES auth.users(id),
  registration_id uuid UNIQUE REFERENCES public.registrations(id),
  claimed_at timestamptz,
  CHECK ((claimed_by IS NULL AND registration_id IS NULL AND claimed_at IS NULL) OR
    (claimed_by IS NOT NULL AND registration_id IS NOT NULL AND claimed_at IS NOT NULL))
);
CREATE INDEX group_seats_order ON public.group_seats(order_id);
CREATE INDEX group_seats_claimed_by ON public.group_seats(claimed_by) WHERE claimed_by IS NOT NULL;
CREATE TABLE public.group_order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES public.group_orders(id),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL, detail text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX group_order_events_order ON public.group_order_events(order_id,created_at);

ALTER TABLE public.group_ticket_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_order_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.group_ticket_configs, public.group_orders, public.group_seats, public.group_order_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.group_ticket_configs, public.group_orders, public.group_seats, public.group_order_events TO authenticated;
GRANT ALL ON public.group_ticket_configs, public.group_orders, public.group_seats, public.group_order_events TO service_role;
CREATE POLICY group_configs_read ON public.group_ticket_configs FOR SELECT TO authenticated USING (enabled OR private.is_admin());
CREATE POLICY group_orders_read ON public.group_orders FOR SELECT TO authenticated USING (owner_id=(SELECT auth.uid()) OR private.is_admin());
CREATE POLICY group_seats_read ON public.group_seats FOR SELECT TO authenticated USING (
  EXISTS(SELECT 1 FROM public.group_orders o WHERE o.id=order_id AND (o.owner_id=(SELECT auth.uid()) OR private.is_admin()))
);
CREATE POLICY group_events_read ON public.group_order_events FOR SELECT TO authenticated USING (private.is_admin());

CREATE OR REPLACE FUNCTION private.group_actor(p_expected_user uuid, p_admin boolean DEFAULT false, p_verified boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid := auth.uid();
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'login_required'; END IF;
  IF p_expected_user IS DISTINCT FROM u THEN RAISE EXCEPTION 'account_changed'; END IF;
  IF p_admin AND NOT private.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_verified AND NOT EXISTS(SELECT 1 FROM auth.users WHERE id=u AND email_confirmed_at IS NOT NULL AND NOT is_anonymous) THEN RAISE EXCEPTION 'email_not_verified'; END IF;
  RETURN u;
END; $$;

CREATE OR REPLACE FUNCTION private.group_order_json(p_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT to_jsonb(o) - 'request_id' - 'verified_by' || jsonb_build_object(
    'status',CASE WHEN o.status='pending' AND o.expires_at<=now() THEN 'expired' ELSE o.status END,
    'claimed_count',(SELECT count(*) FROM public.group_seats s WHERE s.order_id=o.id AND s.claimed_by IS NOT NULL))
  FROM public.group_orders o WHERE o.id=p_id;
$$;

CREATE OR REPLACE FUNCTION private.group_ticket_workspace(p_admin boolean,p_page integer,p_search text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid := private.group_actor(auth.uid(),p_admin,false); result jsonb;
BEGIN
  IF p_page IS NULL OR p_page NOT BETWEEN 0 AND 10000 OR p_search IS NULL OR length(p_search)>200 THEN RAISE EXCEPTION 'invalid_input'; END IF;
  SELECT jsonb_build_object('userId',u,
    'configs',coalesce((SELECT jsonb_agg(to_jsonb(c)||jsonb_build_object('ticket_name',t.name,'ticket_name_zh',t.name_zh) ORDER BY t.sort_order,t.id) FROM public.group_ticket_configs c JOIN public.ticket_types t ON t.id=c.ticket_type_id WHERE p_admin OR (c.enabled AND t.is_active)), '[]'::jsonb),
    'tickets',coalesce((SELECT jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'name_zh',t.name_zh) ORDER BY t.sort_order,t.id) FROM public.ticket_types t WHERE p_admin),'[]'::jsonb),
    'orders',coalesce((SELECT jsonb_agg(private.group_order_json(o.id) ORDER BY o.created_at DESC,o.id) FROM
      (SELECT * FROM public.group_orders WHERE (p_admin OR owner_id=u) AND (p_search='' OR position(lower(p_search) in lower(team_name||id::text))>0) ORDER BY created_at DESC,id LIMIT 20 OFFSET p_page*20) o),'[]'::jsonb),
    'total',(SELECT count(*) FROM public.group_orders WHERE (p_admin OR owner_id=u) AND (p_search='' OR position(lower(p_search) in lower(team_name||id::text))>0))) INTO result;
  RETURN result;
END; $$;

CREATE OR REPLACE FUNCTION private.group_order_detail(p_order_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid := private.group_actor(auth.uid()); o public.group_orders;
BEGIN
  SELECT * INTO o FROM public.group_orders WHERE id=p_order_id;
  IF o.id IS NULL OR (o.owner_id<>u AND NOT private.is_admin()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN jsonb_build_object('order',private.group_order_json(o.id),'seats',coalesce((SELECT jsonb_agg(jsonb_build_object(
    'id',s.id,'code',CASE WHEN s.claimed_by IS NULL AND o.status='active' AND (o.claim_deadline IS NULL OR o.claim_deadline>now()) THEN s.code ELSE NULL END,
    'claimed',s.claimed_by IS NOT NULL,'member_name',r.name) ORDER BY s.id)
    FROM public.group_seats s LEFT JOIN public.registrations r ON r.id=s.registration_id WHERE s.order_id=o.id),'[]'::jsonb));
END; $$;

CREATE OR REPLACE FUNCTION private.group_ticket_config_save(p_expected_user uuid,p_ticket_id uuid,p_enabled boolean,p_min_size integer,p_max_size integer,p_unit_price_cents integer,p_claim_deadline timestamptz)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  PERFORM private.group_actor(p_expected_user,true,true);
  IF p_enabled IS NULL OR p_min_size IS NULL OR p_max_size IS NULL OR p_unit_price_cents IS NULL OR p_min_size NOT BETWEEN 2 AND 100 OR p_max_size NOT BETWEEN p_min_size AND 100 OR p_unit_price_cents NOT BETWEEN 0 AND 100000000 OR (p_enabled AND p_claim_deadline<=now()) THEN RAISE EXCEPTION 'invalid_input'; END IF;
  PERFORM 1 FROM public.ticket_types WHERE id=p_ticket_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_input'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.group_ticket_configs WHERE ticket_type_id=p_ticket_id) AND EXISTS(SELECT 1 FROM public.registrations WHERE ticket_type_id=p_ticket_id) THEN RAISE EXCEPTION 'ticket_in_use'; END IF;
  UPDATE public.ticket_types SET group_only=true,requires_code=true WHERE id=p_ticket_id;
  INSERT INTO public.group_ticket_configs(ticket_type_id,enabled,min_size,max_size,unit_price_cents,claim_deadline)
    VALUES(p_ticket_id,p_enabled,p_min_size,p_max_size,p_unit_price_cents,p_claim_deadline)
    ON CONFLICT(ticket_type_id) DO UPDATE SET enabled=excluded.enabled,min_size=excluded.min_size,max_size=excluded.max_size,unit_price_cents=excluded.unit_price_cents,claim_deadline=excluded.claim_deadline,updated_at=now();
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION private.group_order_create(p_expected_user uuid,p_request_id uuid,p_ticket_id uuid,p_quantity integer,p_team_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid := private.group_actor(p_expected_user,false,true); c public.group_ticket_configs; t public.ticket_types; o public.group_orders; v_id uuid;
BEGIN
  IF p_request_id IS NULL OR p_quantity IS NULL OR p_quantity NOT BETWEEN 2 AND 100 OR p_team_name IS NULL OR length(btrim(p_team_name)) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'invalid_input'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(u::text,28083727));
  SELECT * INTO o FROM public.group_orders WHERE owner_id=u AND request_id=p_request_id;
  IF FOUND THEN
    IF o.ticket_type_id IS DISTINCT FROM p_ticket_id OR o.quantity<>p_quantity OR o.team_name<>btrim(p_team_name) THEN RAISE EXCEPTION 'invalid_input'; END IF;
    RETURN o.id;
  END IF;
  SELECT * INTO t FROM public.ticket_types WHERE id=p_ticket_id AND is_active AND group_only FOR SHARE;
  SELECT * INTO c FROM public.group_ticket_configs WHERE ticket_type_id=p_ticket_id FOR SHARE;
  IF t.id IS NULL OR c.ticket_type_id IS NULL OR NOT c.enabled OR (c.claim_deadline IS NOT NULL AND c.claim_deadline<=now()) THEN RAISE EXCEPTION 'group_unavailable'; END IF;
  IF p_quantity NOT BETWEEN c.min_size AND c.max_size THEN RAISE EXCEPTION 'invalid_input'; END IF;
  IF (SELECT count(*) FROM public.group_orders WHERE owner_id=u AND status='pending' AND expires_at>now())>=3 THEN RAISE EXCEPTION 'too_many_orders'; END IF;
  INSERT INTO public.group_orders(owner_id,request_id,ticket_type_id,ticket_name,ticket_name_zh,team_name,quantity,unit_price_cents,claim_deadline)
    VALUES(u,p_request_id,p_ticket_id,t.name,t.name_zh,btrim(p_team_name),p_quantity,c.unit_price_cents,c.claim_deadline) RETURNING id INTO v_id;
  INSERT INTO public.group_order_events(order_id,actor_id,action) VALUES(v_id,u,'created');
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION private.group_order_activate(p_expected_user uuid,p_order_id uuid,p_payment_reference text,p_received_cents bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid := private.group_actor(p_expected_user,true,true); o public.group_orders;
BEGIN
  SELECT * INTO o FROM public.group_orders WHERE id=p_order_id FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_payment_reference IS NULL OR length(btrim(p_payment_reference)) NOT BETWEEN 1 AND 200 OR p_received_cents IS DISTINCT FROM o.total_cents THEN RAISE EXCEPTION 'payment_mismatch'; END IF;
  IF o.status='active' AND o.payment_reference=btrim(p_payment_reference) THEN RETURN true; END IF;
  IF o.status<>'pending' OR o.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'invalid_state'; END IF;
  IF o.claim_deadline IS NOT NULL AND o.claim_deadline<=clock_timestamp() THEN RAISE EXCEPTION 'group_unavailable'; END IF;
  UPDATE public.group_orders SET status='active',activated_at=now(),payment_reference=btrim(p_payment_reference),verified_by=u WHERE id=o.id;
  INSERT INTO public.group_seats(order_id) SELECT o.id FROM generate_series(1,o.quantity);
  INSERT INTO public.group_order_events(order_id,actor_id,action,detail) VALUES(o.id,u,'external_payment_verified',btrim(p_payment_reference));
  RETURN true;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'payment_mismatch';
END; $$;

CREATE OR REPLACE FUNCTION private.group_order_cancel(p_expected_user uuid,p_order_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid := private.group_actor(p_expected_user); o public.group_orders;
BEGIN
  SELECT * INTO o FROM public.group_orders WHERE id=p_order_id FOR UPDATE;
  IF o.id IS NULL OR (o.owner_id<>u AND NOT private.is_admin()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF o.status='cancelled' THEN RETURN true; END IF;
  IF o.status<>'pending' THEN RAISE EXCEPTION 'invalid_state'; END IF;
  UPDATE public.group_orders SET status='cancelled' WHERE id=o.id;
  INSERT INTO public.group_order_events(order_id,actor_id,action) VALUES(o.id,u,'cancelled');
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION private.group_order_close(p_expected_user uuid,p_order_id uuid,p_reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid := private.group_actor(p_expected_user,true,true); o public.group_orders;
BEGIN
  IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'invalid_input'; END IF;
  SELECT * INTO o FROM public.group_orders WHERE id=p_order_id FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF o.status='closed' THEN RETURN true; END IF;
  IF o.status<>'active' THEN RAISE EXCEPTION 'invalid_state'; END IF;
  UPDATE public.group_orders SET status='closed' WHERE id=o.id;
  INSERT INTO public.group_order_events(order_id,actor_id,action,detail) VALUES(o.id,u,'claims_closed',btrim(p_reason));
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION private.group_seat_rotate(p_expected_user uuid,p_seat_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid := private.group_actor(p_expected_user); oid uuid; o public.group_orders; s public.group_seats;
BEGIN
  SELECT order_id INTO oid FROM public.group_seats WHERE id=p_seat_id;
  SELECT * INTO o FROM public.group_orders WHERE id=oid FOR UPDATE;
  IF o.id IS NULL OR (o.owner_id<>u AND NOT private.is_admin()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO s FROM public.group_seats WHERE id=p_seat_id FOR UPDATE;
  IF o.status<>'active' OR s.claimed_by IS NOT NULL OR (o.claim_deadline IS NOT NULL AND o.claim_deadline<=clock_timestamp()) THEN RAISE EXCEPTION 'invalid_state'; END IF;
  UPDATE public.group_seats SET code='HOWG-'||upper(encode(extensions.gen_random_bytes(24),'hex')) WHERE id=s.id;
  INSERT INTO public.group_order_events(order_id,actor_id,action,detail) VALUES(o.id,u,'code_rotated',s.id::text);
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION private.group_seat_redeem(p_expected_user uuid,p_code text,p_name text,p_phone text,p_company text,p_position text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid := private.group_actor(p_expected_user,false,true); oid uuid; o public.group_orders; s public.group_seats; reg uuid; mail text;
BEGIN
  IF p_code IS NULL OR p_code !~* '^HOWG-[a-f0-9]{48}$' THEN RAISE EXCEPTION 'code_unavailable'; END IF;
  SELECT order_id INTO oid FROM public.group_seats WHERE code=upper(p_code);
  SELECT * INTO o FROM public.group_orders WHERE id=oid FOR UPDATE;
  SELECT * INTO s FROM public.group_seats WHERE code=upper(p_code) FOR UPDATE;
  IF o.id IS NULL OR s.id IS NULL THEN RAISE EXCEPTION 'code_unavailable'; END IF;
  -- A retry after a committed claim returns the original registration, even if later closed.
  IF s.claimed_by=u THEN RETURN s.registration_id; END IF;
  IF s.claimed_by IS NOT NULL OR o.status<>'active' OR (o.claim_deadline IS NOT NULL AND o.claim_deadline<=clock_timestamp()) OR NOT EXISTS(SELECT 1 FROM public.ticket_types WHERE id=o.ticket_type_id AND is_active) THEN RAISE EXCEPTION 'code_unavailable'; END IF;
  p_name := btrim(p_name,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
  IF p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 128 OR p_phone IS NULL OR p_phone !~ '^\+[1-9][0-9]{1,14}$' OR p_company IS NULL OR length(p_company)>200 OR p_position IS NULL OR length(p_position)>200 THEN RAISE EXCEPTION 'invalid_input'; END IF;
  SELECT email INTO mail FROM auth.users WHERE id=u;
  INSERT INTO public.registrations(user_id,ticket_type_id,name,email,phone,company,position,status,checked_in)
    VALUES(u,o.ticket_type_id,btrim(p_name),mail,p_phone,nullif(btrim(p_company),''),nullif(btrim(p_position),''),'confirmed',false) RETURNING id INTO reg;
  UPDATE public.group_seats SET claimed_by=u,registration_id=reg,claimed_at=now() WHERE id=s.id;
  INSERT INTO public.group_order_events(order_id,actor_id,action,detail) VALUES(o.id,u,'seat_claimed',s.id::text);
  RETURN reg;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'already_registered';
END; $$;

-- Normal registration paths cannot mint a group entitlement. Existing claims can cancel/restore their own registration.
CREATE OR REPLACE FUNCTION private.registration_ticket_valid(p_ticket_id uuid,p_code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM public.ticket_types t WHERE t.id=p_ticket_id AND t.is_active AND (
    (NOT t.group_only AND NOT EXISTS(SELECT 1 FROM public.group_ticket_configs WHERE ticket_type_id=t.id) AND
      ((NOT t.requires_code AND p_code IS NULL) OR EXISTS(SELECT 1 FROM public.channel_codes c WHERE c.code=p_code AND c.is_active AND (c.ticket_type_id IS NULL OR c.ticket_type_id=t.id))))
    OR EXISTS(SELECT 1 FROM public.group_seats s JOIN public.group_orders o ON o.id=s.order_id
      WHERE s.claimed_by=(SELECT auth.uid()) AND o.ticket_type_id=t.id AND s.registration_id IS NOT NULL)
  ));
$$;

-- Lock before checking group mode so first-time conversion and normal inserts serialize.
CREATE OR REPLACE FUNCTION private.group_ticket_insert_lock(p_ticket_id uuid)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE grouped boolean;
BEGIN
  SELECT group_only INTO grouped FROM public.ticket_types WHERE id=p_ticket_id FOR SHARE;
  RETURN coalesce(grouped,false) OR EXISTS(SELECT 1 FROM public.group_ticket_configs WHERE ticket_type_id=p_ticket_id);
END; $$;
REVOKE ALL ON FUNCTION private.group_ticket_insert_lock(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.group_ticket_insert_lock(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION private.guard_group_ticket_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE grouped boolean;
BEGIN
  grouped := private.group_ticket_insert_lock(NEW.ticket_type_id);
  IF grouped AND current_user NOT IN ('postgres','supabase_admin','service_role') AND NOT private.is_admin() THEN
    RAISE EXCEPTION 'group seat required' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.guard_group_ticket_insert() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS guard_group_ticket_insert ON public.registrations;
CREATE TRIGGER guard_group_ticket_insert BEFORE INSERT ON public.registrations FOR EACH ROW EXECUTE FUNCTION private.guard_group_ticket_insert();

-- Public wrappers are invoker-only. Privileged implementations have explicit identity/ownership checks.
DO $$
DECLARE f record; args text; callargs text; argnames text[];
BEGIN
  FOR f IN SELECT p.oid,p.proname,pg_get_function_identity_arguments(p.oid) identity_args,
      pg_get_function_arguments(p.oid) full_args,pg_get_function_result(p.oid) result_type,p.proargnames
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='private' AND p.proname IN ('group_ticket_workspace','group_order_detail','group_ticket_config_save','group_order_create','group_order_activate','group_order_cancel','group_order_close','group_seat_rotate','group_seat_redeem')
  LOOP
    args:=f.identity_args; argnames:=f.proargnames;
    SELECT string_agg(quote_ident(name),',') INTO callargs FROM unnest(argnames) name;
    EXECUTE format('REVOKE ALL ON FUNCTION private.%I(%s) FROM PUBLIC,anon,authenticated',f.proname,args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION private.%I(%s) TO authenticated',f.proname,args);
    EXECUTE format('CREATE OR REPLACE FUNCTION public.%I(%s) RETURNS %s LANGUAGE sql SECURITY INVOKER SET search_path='''' AS %L',f.proname,f.full_args,f.result_type,'SELECT private.'||quote_ident(f.proname)||'('||callargs||');');
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC,anon,authenticated',f.proname,args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated',f.proname,args);
  END LOOP;
END; $$;
REVOKE ALL ON FUNCTION private.group_actor(uuid,boolean,boolean),private.group_order_json(uuid) FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
