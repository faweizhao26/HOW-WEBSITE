-- Business roles remain in profiles; Auth is used only for identity/email lookup.
CREATE TABLE public.account_role_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL,
  target_name TEXT NOT NULL,
  target_email TEXT,
  old_role TEXT NOT NULL CHECK (old_role IN ('user', 'admin')),
  new_role TEXT NOT NULL CHECK (new_role IN ('user', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (old_role <> new_role)
);
CREATE INDEX account_role_changes_created_idx ON public.account_role_changes(created_at DESC, id DESC);
CREATE INDEX account_role_changes_actor_idx ON public.account_role_changes(actor_id);
CREATE INDEX account_role_changes_target_idx ON public.account_role_changes(target_id);
ALTER TABLE public.account_role_changes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_role_changes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.account_role_changes TO authenticated;
CREATE POLICY "Admins can view role changes" ON public.account_role_changes
  FOR SELECT TO authenticated USING ((SELECT private.is_admin()));

CREATE FUNCTION private.list_managed_accounts(p_query TEXT, p_role TEXT, p_page INT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_query TEXT := btrim(coalesce(p_query, ''));
  v_total INT;
  v_page INT;
  v_accounts JSONB;
  v_history JSONB;
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_admin() THEN RAISE EXCEPTION 'ACCOUNT_FORBIDDEN'; END IF;
  IF length(v_query) > 200 OR p_role IS NULL OR p_role NOT IN ('all', 'user', 'admin')
     OR p_page IS NULL OR p_page < 1 OR p_page > 100000 THEN RAISE EXCEPTION 'ACCOUNT_INVALID'; END IF;

  SELECT count(*) INTO v_total FROM public.profiles p JOIN auth.users u ON u.id = p.id
    WHERE (p_role = 'all' OR p.role = p_role)
      AND (v_query = '' OR strpos(lower(coalesce(u.email, '')), lower(v_query)) > 0 OR strpos(lower(p.full_name), lower(v_query)) > 0);
  v_page := least(p_page, greatest(1, (v_total + 19) / 20));
  SELECT coalesce(jsonb_agg(row.payload ORDER BY row.created_at DESC, row.id DESC), '[]'::jsonb) INTO v_accounts FROM (
    SELECT p.id, p.created_at, jsonb_build_object('id', p.id, 'fullName', p.full_name, 'email', u.email,
      'role', p.role, 'createdAt', p.created_at) AS payload
    FROM public.profiles p JOIN auth.users u ON u.id = p.id
    WHERE (p_role = 'all' OR p.role = p_role)
      AND (v_query = '' OR strpos(lower(coalesce(u.email, '')), lower(v_query)) > 0 OR strpos(lower(p.full_name), lower(v_query)) > 0)
    ORDER BY p.created_at DESC, p.id DESC LIMIT 20 OFFSET (v_page - 1) * 20
  ) row;
  SELECT coalesce(jsonb_agg(row.payload ORDER BY row.created_at DESC, row.id DESC), '[]'::jsonb) INTO v_history FROM (
    SELECT c.id, c.created_at, jsonb_build_object('id', c.id, 'actorName', c.actor_name,
      'targetName', c.target_name, 'targetEmail', c.target_email,
      'oldRole', c.old_role, 'newRole', c.new_role, 'createdAt', c.created_at) AS payload
    FROM public.account_role_changes c ORDER BY c.created_at DESC, c.id DESC LIMIT 20
  ) row;
  RETURN jsonb_build_object('accounts', v_accounts, 'total', v_total, 'page', v_page, 'pageSize', 20,
    'adminCount', (SELECT count(*) FROM public.profiles WHERE role = 'admin'),
    'currentUserId', auth.uid(), 'history', v_history);
END;
$$;

CREATE FUNCTION private.change_managed_account_role(p_account_id UUID, p_role TEXT, p_expected_role TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_old_role TEXT;
BEGIN
  IF v_actor IS NULL OR NOT private.is_admin() THEN RAISE EXCEPTION 'ACCOUNT_FORBIDDEN'; END IF;
  IF p_account_id IS NULL OR p_role IS NULL OR p_role NOT IN ('user', 'admin')
     OR p_expected_role IS NULL OR p_expected_role NOT IN ('user', 'admin') THEN RAISE EXCEPTION 'ACCOUNT_INVALID'; END IF;
  -- Serialize grants/revocations, then recheck the caller after waiting for another administrator.
  PERFORM pg_advisory_xact_lock(hashtextextended('how.account-role-change', 0));
  IF NOT private.is_admin() THEN RAISE EXCEPTION 'ACCOUNT_FORBIDDEN'; END IF;
  SELECT role INTO v_old_role FROM public.profiles WHERE id = p_account_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCOUNT_NOT_FOUND'; END IF;
  IF v_old_role <> p_expected_role THEN RAISE EXCEPTION 'ACCOUNT_ROLE_CONFLICT'; END IF;
  IF v_old_role = p_role THEN RETURN jsonb_build_object('id', p_account_id, 'role', p_role, 'changed', false); END IF;
  IF v_old_role = 'admin' AND p_role = 'user' THEN
    IF (SELECT count(*) FROM public.profiles WHERE role = 'admin') <= 1 THEN RAISE EXCEPTION 'ACCOUNT_LAST_ADMIN'; END IF;
    IF v_actor = p_account_id THEN RAISE EXCEPTION 'ACCOUNT_SELF_REVOKE'; END IF;
  END IF;

  UPDATE public.profiles SET role = p_role WHERE id = p_account_id;
  INSERT INTO public.account_role_changes(actor_id, target_id, actor_name, target_name, target_email, old_role, new_role)
    SELECT v_actor, p.id, a.full_name, p.full_name, u.email, v_old_role, p_role
    FROM public.profiles p JOIN auth.users u ON u.id = p.id
      JOIN public.profiles a ON a.id = v_actor WHERE p.id = p_account_id;
  RETURN jsonb_build_object('id', p_account_id, 'role', p_role, 'changed', true);
END;
$$;

CREATE FUNCTION public.list_managed_accounts(p_query TEXT DEFAULT '', p_role TEXT DEFAULT 'all', p_page INT DEFAULT 1)
RETURNS JSONB LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.list_managed_accounts(p_query, p_role, p_page);
$$;
CREATE FUNCTION public.change_managed_account_role(p_account_id UUID, p_role TEXT, p_expected_role TEXT)
RETURNS JSONB LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.change_managed_account_role(p_account_id, p_role, p_expected_role);
$$;
REVOKE ALL ON FUNCTION private.list_managed_accounts(TEXT, TEXT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.change_managed_account_role(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_managed_accounts(TEXT, TEXT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.change_managed_account_role(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.list_managed_accounts(TEXT, TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION private.change_managed_account_role(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_managed_accounts(TEXT, TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_managed_account_role(UUID, TEXT, TEXT) TO authenticated;
NOTIFY pgrst, 'reload schema';
