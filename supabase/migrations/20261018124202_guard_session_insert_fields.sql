BEGIN;

CREATE OR REPLACE FUNCTION private.guard_session_insert_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') OR private.is_admin() THEN
    RETURN NEW;
  END IF;
  IF NEW.admin_feedback IS NOT NULL OR NEW.slides_url IS NOT NULL OR NEW.video_url IS NOT NULL
    OR NEW.status IS DISTINCT FROM 'pending'
    OR NEW.publication_status IS DISTINCT FROM 'draft'
    OR NEW.speaker_id IS NOT NULL OR NEW.published_at IS NOT NULL OR NEW.published_by IS NOT NULL THEN
    RAISE EXCEPTION 'session workflow fields are managed by administrators' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_session_insert_fields() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER protect_session_insert_fields BEFORE INSERT ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION private.guard_session_insert_fields();

NOTIFY pgrst, 'reload schema';
COMMIT;
