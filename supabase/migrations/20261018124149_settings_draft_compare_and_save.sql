-- Whole-draft compare-and-save, including unknown keys and the initially empty table.
BEGIN;

CREATE OR REPLACE FUNCTION private.save_site_settings_draft(p_expected JSONB, p_draft JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_current JSONB;
BEGIN
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'administrator access required' USING ERRCODE = '42501';
  END IF;
  -- A waiting writer must get a fresh statement snapshot after acquiring the table lock.
  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'settings_draft_requires_read_committed' USING ERRCODE = '25001';
  END IF;
  IF p_expected IS NULL OR p_draft IS NULL
    OR pg_catalog.jsonb_typeof(p_expected) <> 'object'
    OR pg_catalog.jsonb_typeof(p_draft) <> 'object' THEN
    RAISE EXCEPTION 'settings snapshots must be objects' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_each(p_expected) WHERE pg_catalog.jsonb_typeof(value) <> 'string')
    OR EXISTS (SELECT 1 FROM pg_catalog.jsonb_each(p_draft) WHERE pg_catalog.jsonb_typeof(value) <> 'string') THEN
    RAISE EXCEPTION 'settings values must be strings' USING ERRCODE = '22023';
  END IF;

  -- Same conflicting lock mode as publication/rollback. Works even when there are no rows.
  LOCK TABLE public.site_settings IN SHARE ROW EXCLUSIVE MODE;
  SELECT COALESCE(pg_catalog.jsonb_object_agg(key, value), '{}'::jsonb)
    INTO v_current FROM public.site_settings;
  IF v_current IS DISTINCT FROM p_expected THEN
    RAISE EXCEPTION 'settings_draft_conflict' USING ERRCODE = 'PT409';
  END IF;

  DELETE FROM public.site_settings WHERE NOT (p_draft ? key);
  INSERT INTO public.site_settings (key, value)
    SELECT key, value FROM pg_catalog.jsonb_each_text(p_draft) WHERE true
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    WHERE public.site_settings.value IS DISTINCT FROM EXCLUDED.value;
  RETURN p_draft;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_site_settings_draft(p_expected JSONB, p_draft JSONB)
RETURNS JSONB
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.save_site_settings_draft(p_expected, p_draft);
$$;

REVOKE ALL ON FUNCTION private.save_site_settings_draft(JSONB, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_site_settings_draft(JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.save_site_settings_draft(JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_site_settings_draft(JSONB, JSONB) TO authenticated;

-- Keep reads behind admin RLS; all authenticated draft writes must go through the RPC.
-- Publication functions remain SECURITY DEFINER and retain their existing owners/grants.
REVOKE ALL ON public.site_settings FROM PUBLIC, anon, authenticated;
REVOKE INSERT (key, value, updated_at), UPDATE (key, value, updated_at),
  REFERENCES (key, value, updated_at), SELECT (key, value, updated_at)
  ON public.site_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.site_settings TO authenticated;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage settings" ON public.site_settings;
CREATE POLICY "Admins can read settings drafts" ON public.site_settings
  FOR SELECT TO authenticated USING ((SELECT private.is_admin()));

NOTIFY pgrst, 'reload schema';
COMMIT;
