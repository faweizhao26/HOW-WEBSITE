DROP POLICY IF EXISTS "Active channel codes are checkable by everyone" ON public.channel_codes;
CREATE POLICY "Active channel codes are checkable by everyone" ON public.channel_codes
FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Users can update own registrations" ON public.registrations;
CREATE POLICY "Users can update own registrations" ON public.registrations
FOR UPDATE USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
