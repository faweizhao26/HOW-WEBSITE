import { z } from "zod"
import { siteContentSchema } from "../src/lib/content/site-content.ts"

const schema = JSON.stringify(z.toJSONSchema(siteContentSchema, { target: "draft-7", unrepresentable: "any" }))
process.stdout.write(`BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_jsonschema WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION private.validate_managed_content_release()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_raw TEXT := nullif(NEW.payload->>'site_content', '');
  v_content JSONB;
  v_rows JSONB;
BEGIN
  IF v_raw IS NULL THEN RETURN NEW; END IF;
  IF length(v_raw) > 400000 THEN RAISE EXCEPTION 'invalid_site_content' USING ERRCODE = '23514'; END IF;
  BEGIN v_content := v_raw::jsonb;
  EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'invalid_site_content' USING ERRCODE = '23514'; END;
  IF NOT extensions.jsonb_matches_schema($schema$${schema}$schema$::json, v_content) THEN
    RAISE EXCEPTION 'invalid_site_content' USING ERRCODE = '23514';
  END IF;
  FOR v_rows IN
    SELECT v_content->'home'->'sections'
    UNION ALL SELECT p.value->'sections' FROM jsonb_each(v_content->'pages') p
    UNION ALL SELECT v_content->'faq'->'items'
  LOOP
    IF (SELECT count(DISTINCT row->>'id') FROM jsonb_array_elements(v_rows) row) <> jsonb_array_length(v_rows) THEN
      RAISE EXCEPTION 'invalid_site_content' USING ERRCODE = '23514';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.validate_managed_content_release() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE TRIGGER validate_managed_content_release BEFORE INSERT OR UPDATE OF payload ON public.site_settings_releases
  FOR EACH ROW EXECUTE FUNCTION private.validate_managed_content_release();
NOTIFY pgrst, 'reload schema';
COMMIT;
`)
