-- Restrict Data API table privileges to the minimum used by the app.
REVOKE ALL PRIVILEGES ON public.ticket_types FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON public.channel_codes FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON public.registrations FROM anon, authenticated;

GRANT SELECT ON public.ticket_types TO anon, authenticated;
GRANT SELECT ON public.channel_codes TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.registrations TO authenticated;

-- Keep registration inserts constrained to valid public ticket/code combinations.
DROP POLICY IF EXISTS "Users can insert registrations" ON public.registrations;
DROP POLICY IF EXISTS "Users can create own valid registrations" ON public.registrations;
CREATE POLICY "Users can create own valid registrations" ON public.registrations
FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND status = 'confirmed'
  AND checked_in = false
  AND (
    ticket_type_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.ticket_types t
      WHERE t.id = ticket_type_id
        AND t.is_active = true
        AND (
          (
            t.requires_code = false
            AND (
              channel_code IS NULL
              OR EXISTS (
                SELECT 1
                FROM public.channel_codes c
                WHERE c.code = channel_code
                  AND c.is_active = true
                  AND (c.ticket_type_id IS NULL OR c.ticket_type_id = t.id)
              )
            )
          )
          OR (
            t.requires_code = true
            AND channel_code IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.channel_codes c
              WHERE c.code = channel_code
                AND c.is_active = true
                AND (c.ticket_type_id IS NULL OR c.ticket_type_id = t.id)
            )
          )
        )
    )
  )
);

-- Fix mutable search_path warnings on trigger functions.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email), 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger functions should not be directly executable through exposed API roles.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM PUBLIC, anon, authenticated;

-- Public file URLs remain usable without allowing users to list every object.
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
