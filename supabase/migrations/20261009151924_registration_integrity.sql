BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.registrations GROUP BY user_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Resolve existing duplicate registrations before applying this migration';
  END IF;
END;
$$;
CREATE UNIQUE INDEX IF NOT EXISTS registrations_one_per_user ON public.registrations (user_id);

-- Only identity comes from Auth. Phone ownership verification remains deferred.
CREATE OR REPLACE FUNCTION private.registration_identity_valid(p_email TEXT, p_phone TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = (SELECT auth.uid()) AND u.email_confirmed_at IS NOT NULL
      AND lower(u.email) = lower(p_email)
      AND p_phone ~ '^\+[1-9][0-9]{1,14}$'
  );
$$;
REVOKE ALL ON FUNCTION private.registration_identity_valid(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.registration_identity_valid(TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION private.registration_ticket_valid(p_ticket_id UUID, p_code TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ticket_types t
    WHERE t.id = p_ticket_id AND t.is_active
      AND ((NOT t.requires_code AND p_code IS NULL) OR EXISTS (
        SELECT 1 FROM public.channel_codes c
        WHERE c.code = p_code AND c.is_active
          AND (c.ticket_type_id IS NULL OR c.ticket_type_id = t.id)
      ))
  );
$$;
REVOKE ALL ON FUNCTION private.registration_ticket_valid(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.registration_ticket_valid(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION private.protect_registration_fields()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN RETURN NEW; END IF;
  IF private.is_admin() THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL OR NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'registration ownership required' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'INSERT' THEN
    -- Match JavaScript trim, including non-breaking and full-width spaces.
    NEW.name := btrim(NEW.name, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
    IF NEW.status IS DISTINCT FROM 'confirmed' OR NEW.checked_in IS DISTINCT FROM false
      OR NEW.checked_in_at IS NOT NULL OR NEW.name IS NULL
      OR length(NEW.name) NOT BETWEEN 1 AND 128
      OR coalesce(length(NEW.company), 0) > 200 OR coalesce(length(NEW.position), 0) > 200
      OR NOT private.registration_identity_valid(NEW.email, NEW.phone)
      OR NOT private.registration_ticket_valid(NEW.ticket_type_id, NEW.channel_code) THEN
      RAISE EXCEPTION 'valid identity, contact and ticket required' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF (to_jsonb(NEW) - 'status') IS DISTINCT FROM (to_jsonb(OLD) - 'status') THEN
      RAISE EXCEPTION 'registration fields are managed by administrators' USING ERRCODE = '42501';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF OLD.checked_in THEN
        RAISE EXCEPTION 'checked-in registrations are managed by administrators' USING ERRCODE = '42501';
      END IF;
      IF NEW.status = 'confirmed'
        AND NOT private.registration_ticket_valid(OLD.ticket_type_id, OLD.channel_code) THEN
        RAISE EXCEPTION 'ticket or invitation is no longer available' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.protect_registration_fields() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS protect_registration_fields ON public.registrations;
CREATE TRIGGER protect_registration_fields BEFORE INSERT OR UPDATE ON public.registrations
  FOR EACH ROW EXECUTE FUNCTION private.protect_registration_fields();

DROP POLICY IF EXISTS "Users can create own valid registrations" ON public.registrations;
CREATE POLICY "Users can create own valid registrations" ON public.registrations
  FOR INSERT TO authenticated WITH CHECK (
    (SELECT auth.uid()) = user_id AND status = 'confirmed'
    AND NOT checked_in AND checked_in_at IS NULL
    AND private.registration_identity_valid(email, phone)
    AND private.registration_ticket_valid(ticket_type_id, channel_code)
  );
DROP POLICY IF EXISTS "Users can update own registrations" ON public.registrations;
CREATE POLICY "Users can update own registrations" ON public.registrations
  FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Active channel codes are checkable by everyone" ON public.channel_codes;
CREATE OR REPLACE FUNCTION private.registration_channel_ticket(p_code TEXT)
RETURNS UUID LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_ticket UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501'; END IF;
  IF p_code IS NULL OR length(p_code) NOT BETWEEN 1 AND 128 THEN RETURN NULL; END IF;
  SELECT t.id INTO v_ticket FROM public.channel_codes c
  JOIN public.ticket_types t ON t.id = c.ticket_type_id
  WHERE c.code = btrim(p_code) AND c.is_active AND t.is_active;
  IF v_ticket IS NULL AND EXISTS (
    SELECT 1 FROM public.channel_codes WHERE code = btrim(p_code) AND is_active AND ticket_type_id IS NULL
  ) THEN
    SELECT id INTO v_ticket FROM public.ticket_types
    WHERE is_active ORDER BY requires_code, sort_order, id LIMIT 1;
  END IF;
  RETURN v_ticket;
END;
$$;
REVOKE ALL ON FUNCTION private.registration_channel_ticket(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.registration_channel_ticket(TEXT) TO authenticated;
CREATE OR REPLACE FUNCTION public.registration_channel_ticket(p_code TEXT)
RETURNS UUID LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$ SELECT private.registration_channel_ticket(p_code); $$;
REVOKE ALL ON FUNCTION public.registration_channel_ticket(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registration_channel_ticket(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.registration_ticket_available(p_ticket_id UUID, p_code TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$ SELECT (SELECT auth.uid()) IS NOT NULL AND private.registration_ticket_valid(p_ticket_id, nullif(btrim(p_code), '')); $$;
REVOKE ALL ON FUNCTION public.registration_ticket_available(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registration_ticket_available(UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
