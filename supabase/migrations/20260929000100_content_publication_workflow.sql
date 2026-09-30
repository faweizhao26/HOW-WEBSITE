-- Draft/public content separation for HOW 2027.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION private.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated;

CREATE TABLE public.speakers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  name_zh TEXT,
  company TEXT,
  company_zh TEXT,
  title TEXT,
  title_zh TEXT,
  bio TEXT,
  bio_zh TEXT,
  avatar_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  publication_status TEXT NOT NULL DEFAULT 'draft' CHECK (publication_status IN ('draft', 'published')),
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sessions
  ADD COLUMN speaker_id UUID REFERENCES public.speakers(id) ON DELETE SET NULL,
  ADD COLUMN publication_status TEXT NOT NULL DEFAULT 'draft' CHECK (publication_status IN ('draft', 'published')),
  ADD COLUMN published_at TIMESTAMPTZ,
  ADD COLUMN published_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.sponsors
  ADD COLUMN publication_status TEXT NOT NULL DEFAULT 'draft' CHECK (publication_status IN ('draft', 'published')),
  ADD COLUMN published_at TIMESTAMPTZ,
  ADD COLUMN published_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.news_posts
  ALTER COLUMN published_at DROP NOT NULL,
  ALTER COLUMN published_at DROP DEFAULT,
  ADD COLUMN publication_status TEXT NOT NULL DEFAULT 'draft' CHECK (publication_status IN ('draft', 'published')),
  ADD COLUMN published_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.agenda_slots
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.site_settings
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE public.published_speakers (
  id UUID PRIMARY KEY REFERENCES public.speakers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_zh TEXT,
  company TEXT,
  company_zh TEXT,
  title TEXT,
  title_zh TEXT,
  bio TEXT,
  bio_zh TEXT,
  avatar_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE public.published_sessions (
  id UUID PRIMARY KEY REFERENCES public.sessions(id) ON DELETE CASCADE,
  speaker_id UUID NOT NULL REFERENCES public.published_speakers(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  title_zh TEXT,
  abstract TEXT NOT NULL,
  abstract_zh TEXT,
  duration INT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('talk', 'workshop', 'panel')),
  slides_url TEXT,
  video_url TEXT,
  published_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE public.published_sponsors (
  id UUID PRIMARY KEY REFERENCES public.sponsors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logo_url TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('diamond', 'gold', 'silver', 'bronze')),
  website_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE public.published_news_posts (
  id UUID PRIMARY KEY REFERENCES public.news_posts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  title_zh TEXT,
  content TEXT NOT NULL,
  content_zh TEXT,
  cover_url TEXT,
  published_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE public.agenda_releases (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  version BIGINT NOT NULL UNIQUE,
  payload JSONB NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX agenda_releases_one_current
  ON public.agenda_releases (is_current)
  WHERE is_current;

CREATE TABLE public.site_settings_releases (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  version BIGINT NOT NULL UNIQUE,
  payload JSONB NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX site_settings_releases_one_current
  ON public.site_settings_releases (is_current)
  WHERE is_current;

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS speakers_updated_at ON public.speakers;
CREATE TRIGGER speakers_updated_at BEFORE UPDATE ON public.speakers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS sponsors_updated_at ON public.sponsors;
CREATE TRIGGER sponsors_updated_at BEFORE UPDATE ON public.sponsors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS news_posts_updated_at ON public.news_posts;
CREATE TRIGGER news_posts_updated_at BEFORE UPDATE ON public.news_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS agenda_slots_updated_at ON public.agenda_slots;
CREATE TRIGGER agenda_slots_updated_at BEFORE UPDATE ON public.agenda_slots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS site_settings_updated_at ON public.site_settings;
CREATE TRIGGER site_settings_updated_at BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.protect_session_workflow_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, private
AS $$
BEGIN
  IF NOT private.is_admin() AND (
    NEW.status IS DISTINCT FROM OLD.status
    OR NEW.admin_feedback IS DISTINCT FROM OLD.admin_feedback
    OR NEW.speaker_id IS DISTINCT FROM OLD.speaker_id
    OR NEW.publication_status IS DISTINCT FROM OLD.publication_status
    OR NEW.published_at IS DISTINCT FROM OLD.published_at
    OR NEW.published_by IS DISTINCT FROM OLD.published_by
    OR NEW.slides_url IS DISTINCT FROM OLD.slides_url
    OR NEW.video_url IS DISTINCT FROM OLD.video_url
  ) THEN
    RAISE EXCEPTION 'session workflow fields are managed by administrators' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.protect_session_workflow_fields() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS protect_session_workflow_fields ON public.sessions;
CREATE TRIGGER protect_session_workflow_fields
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.protect_session_workflow_fields();

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Approved sessions are viewable by everyone" ON public.sessions;
DROP POLICY IF EXISTS "Agenda slots are viewable by everyone" ON public.agenda_slots;
DROP POLICY IF EXISTS "Admins can manage agenda slots" ON public.agenda_slots;
DROP POLICY IF EXISTS "Sponsors are viewable by everyone" ON public.sponsors;
DROP POLICY IF EXISTS "Admins can manage sponsors" ON public.sponsors;
DROP POLICY IF EXISTS "News posts are viewable by everyone" ON public.news_posts;
DROP POLICY IF EXISTS "Admins can manage news" ON public.news_posts;
DROP POLICY IF EXISTS "Settings are viewable by everyone" ON public.site_settings;
DROP POLICY IF EXISTS "Admins can manage settings" ON public.site_settings;
DROP POLICY IF EXISTS "Users can create own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON public.sessions;

CREATE POLICY "Users can create own pending sessions" ON public.sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND status = 'pending'
    AND publication_status = 'draft'
    AND speaker_id IS NULL
    AND published_at IS NULL
    AND published_by IS NULL
  );
CREATE POLICY "Users can update own session content" ON public.sessions
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING ((SELECT private.is_admin()));

-- Account roles are managed by trusted database operators, never profile edits.
REVOKE UPDATE ON public.profiles FROM PUBLIC, anon, authenticated;
REVOKE UPDATE (role) ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT UPDATE (full_name, company, bio, bio_zh, avatar_url, phone, wechat) ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "Admins can manage ticket types" ON public.ticket_types;
CREATE POLICY "Admins can manage ticket types" ON public.ticket_types
  FOR ALL TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));
DROP POLICY IF EXISTS "Admins can manage channel codes" ON public.channel_codes;
CREATE POLICY "Admins can manage channel codes" ON public.channel_codes
  FOR ALL TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));

CREATE POLICY "Admins can manage agenda slots" ON public.agenda_slots
  FOR ALL TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY "Admins can manage sponsors" ON public.sponsors
  FOR ALL TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY "Admins can manage news" ON public.news_posts
  FOR ALL TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY "Admins can manage settings" ON public.site_settings
  FOR ALL TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));

ALTER TABLE public.speakers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage speakers" ON public.speakers
  FOR ALL TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));

ALTER TABLE public.published_speakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.published_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.published_sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.published_news_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings_releases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published speakers are public" ON public.published_speakers
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Published sessions are public" ON public.published_sessions
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Published sponsors are public" ON public.published_sponsors
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Published news posts are public" ON public.published_news_posts
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Current agenda release is public" ON public.agenda_releases
  FOR SELECT TO anon, authenticated USING (is_current);
CREATE POLICY "Admins can view agenda release history" ON public.agenda_releases
  FOR SELECT TO authenticated
  USING ((SELECT private.is_admin()));

CREATE POLICY "Current settings release is public" ON public.site_settings_releases
  FOR SELECT TO anon, authenticated USING (is_current);
CREATE POLICY "Admins can view settings release history" ON public.site_settings_releases
  FOR SELECT TO authenticated
  USING ((SELECT private.is_admin()));

REVOKE SELECT ON public.profiles FROM anon;
REVOKE ALL ON public.sessions, public.agenda_slots, public.speakers, public.sponsors, public.news_posts, public.site_settings FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.speakers TO authenticated;
REVOKE ALL ON public.published_speakers FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.published_sessions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.published_sponsors FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.published_news_posts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.agenda_releases FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.site_settings_releases FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.published_speakers TO anon, authenticated;
GRANT SELECT ON public.published_sessions TO anon, authenticated;
GRANT SELECT ON public.published_sponsors TO anon, authenticated;
GRANT SELECT ON public.published_news_posts TO anon, authenticated;
GRANT SELECT ON public.agenda_releases TO anon, authenticated;
GRANT SELECT ON public.site_settings_releases TO anon, authenticated;

-- One dependency-ordered lock set for every publication and rollback.
-- SHARE ROW EXCLUSIVE blocks draft DML and serialises publishers without blocking readers.
CREATE OR REPLACE FUNCTION private.lock_publication_tables()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'administrator access required' USING ERRCODE = '42501';
  END IF;
  LOCK TABLE
    public.profiles, public.speakers, public.sessions, public.agenda_slots,
    public.sponsors, public.news_posts, public.site_settings,
    public.published_speakers, public.published_sessions,
    public.published_sponsors, public.published_news_posts,
    public.agenda_releases, public.site_settings_releases
  IN SHARE ROW EXCLUSIVE MODE;
END;
$$;

REVOKE ALL ON FUNCTION private.lock_publication_tables() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.validated_site_settings_payload()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_required_count INT;
  v_payload JSONB;
BEGIN
  SELECT COUNT(DISTINCT key) INTO v_required_count
  FROM public.site_settings
  WHERE key IN (
    'conference_name', 'conference_date', 'conference_location',
    'conference_location_zh', 'contact_email', 'hero_title',
    'hero_title_zh', 'hero_subtitle', 'hero_subtitle_zh'
  ) AND btrim(value) <> '';
  IF v_required_count <> 9 THEN
    RAISE EXCEPTION 'required site settings are missing' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.site_settings
    WHERE key = 'conference_date' AND value ~ '^2027([.-])4([.-])16-4([.-])18$'
  ) THEN
    RAISE EXCEPTION 'conference_date must describe 2027-04-16 through 2027-04-18' USING ERRCODE = '23514';
  END IF;
  SELECT jsonb_object_agg(key, value ORDER BY key) INTO v_payload FROM public.site_settings;
  RETURN v_payload;
END;
$$;

REVOKE ALL ON FUNCTION private.validated_site_settings_payload() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.publish_speaker(p_speaker_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_speaker public.speakers%ROWTYPE;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'administrator access required' USING ERRCODE = '42501';
  END IF;
  PERFORM private.lock_publication_tables();

  SELECT * INTO STRICT v_speaker FROM public.speakers WHERE id = p_speaker_id;
  INSERT INTO public.published_speakers (
    id, name, name_zh, company, company_zh, title, title_zh,
    bio, bio_zh, avatar_url, sort_order, published_at
  ) VALUES (
    v_speaker.id, v_speaker.name, v_speaker.name_zh, v_speaker.company,
    v_speaker.company_zh, v_speaker.title, v_speaker.title_zh,
    v_speaker.bio, v_speaker.bio_zh, v_speaker.avatar_url,
    v_speaker.sort_order, v_now
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    name_zh = EXCLUDED.name_zh,
    company = EXCLUDED.company,
    company_zh = EXCLUDED.company_zh,
    title = EXCLUDED.title,
    title_zh = EXCLUDED.title_zh,
    bio = EXCLUDED.bio,
    bio_zh = EXCLUDED.bio_zh,
    avatar_url = EXCLUDED.avatar_url,
    sort_order = EXCLUDED.sort_order,
    published_at = EXCLUDED.published_at;

  UPDATE public.speakers
  SET publication_status = 'published', published_at = v_now, published_by = auth.uid()
  WHERE id = p_speaker_id;
  RETURN p_speaker_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.unpublish_speaker(p_speaker_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'administrator access required' USING ERRCODE = '42501';
  END IF;
  PERFORM private.lock_publication_tables();
  IF EXISTS (SELECT 1 FROM public.published_sessions WHERE speaker_id = p_speaker_id) THEN
    RAISE EXCEPTION 'unpublish dependent sessions first' USING ERRCODE = '23503';
  END IF;
  DELETE FROM public.published_speakers WHERE id = p_speaker_id;
  UPDATE public.speakers
  SET publication_status = 'draft', published_at = NULL, published_by = NULL
  WHERE id = p_speaker_id;
  RETURN p_speaker_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.publish_session(p_session_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_session public.sessions%ROWTYPE;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'administrator access required' USING ERRCODE = '42501';
  END IF;
  PERFORM private.lock_publication_tables();
  SELECT * INTO STRICT v_session FROM public.sessions WHERE id = p_session_id;
  IF v_session.status <> 'approved' THEN
    RAISE EXCEPTION 'session must be approved before publication' USING ERRCODE = '23514';
  END IF;
  IF v_session.speaker_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.published_speakers WHERE id = v_session.speaker_id
  ) THEN
    RAISE EXCEPTION 'session requires a published speaker' USING ERRCODE = '23503';
  END IF;

  INSERT INTO public.published_sessions (
    id, speaker_id, title, title_zh, abstract, abstract_zh,
    duration, type, slides_url, video_url, published_at
  ) VALUES (
    v_session.id, v_session.speaker_id, v_session.title, v_session.title_zh,
    v_session.abstract, v_session.abstract_zh, v_session.duration,
    v_session.type, v_session.slides_url, v_session.video_url, v_now
  )
  ON CONFLICT (id) DO UPDATE SET
    speaker_id = EXCLUDED.speaker_id,
    title = EXCLUDED.title,
    title_zh = EXCLUDED.title_zh,
    abstract = EXCLUDED.abstract,
    abstract_zh = EXCLUDED.abstract_zh,
    duration = EXCLUDED.duration,
    type = EXCLUDED.type,
    slides_url = EXCLUDED.slides_url,
    video_url = EXCLUDED.video_url,
    published_at = EXCLUDED.published_at;

  UPDATE public.sessions
  SET publication_status = 'published', published_at = v_now, published_by = auth.uid()
  WHERE id = p_session_id;
  RETURN p_session_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.unpublish_session(p_session_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'administrator access required' USING ERRCODE = '42501';
  END IF;
  PERFORM private.lock_publication_tables();
  DELETE FROM public.published_sessions WHERE id = p_session_id;
  UPDATE public.sessions
  SET publication_status = 'draft', published_at = NULL, published_by = NULL
  WHERE id = p_session_id;
  RETURN p_session_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.publish_sponsor(p_sponsor_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sponsor public.sponsors%ROWTYPE;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'administrator access required' USING ERRCODE = '42501';
  END IF;
  PERFORM private.lock_publication_tables();
  SELECT * INTO STRICT v_sponsor FROM public.sponsors WHERE id = p_sponsor_id;
  INSERT INTO public.published_sponsors (
    id, name, logo_url, tier, website_url, sort_order, published_at
  ) VALUES (
    v_sponsor.id, v_sponsor.name, v_sponsor.logo_url, v_sponsor.tier,
    v_sponsor.website_url, v_sponsor.sort_order, v_now
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    logo_url = EXCLUDED.logo_url,
    tier = EXCLUDED.tier,
    website_url = EXCLUDED.website_url,
    sort_order = EXCLUDED.sort_order,
    published_at = EXCLUDED.published_at;
  UPDATE public.sponsors
  SET publication_status = 'published', published_at = v_now, published_by = auth.uid()
  WHERE id = p_sponsor_id;
  RETURN p_sponsor_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.unpublish_sponsor(p_sponsor_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'administrator access required' USING ERRCODE = '42501';
  END IF;
  PERFORM private.lock_publication_tables();
  DELETE FROM public.published_sponsors WHERE id = p_sponsor_id;
  UPDATE public.sponsors
  SET publication_status = 'draft', published_at = NULL, published_by = NULL
  WHERE id = p_sponsor_id;
  RETURN p_sponsor_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.publish_news_post(
  p_post_id UUID,
  p_published_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_post public.news_posts%ROWTYPE;
  v_time TIMESTAMPTZ;
BEGIN
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'administrator access required' USING ERRCODE = '42501';
  END IF;
  PERFORM private.lock_publication_tables();
  SELECT * INTO STRICT v_post FROM public.news_posts WHERE id = p_post_id;
  v_time := COALESCE(p_published_at, v_post.published_at, now());
  INSERT INTO public.published_news_posts (
    id, title, title_zh, content, content_zh, cover_url, published_at
  ) VALUES (
    v_post.id, v_post.title, v_post.title_zh, v_post.content,
    v_post.content_zh, v_post.cover_url, v_time
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    title_zh = EXCLUDED.title_zh,
    content = EXCLUDED.content,
    content_zh = EXCLUDED.content_zh,
    cover_url = EXCLUDED.cover_url,
    published_at = EXCLUDED.published_at;
  UPDATE public.news_posts
  SET publication_status = 'published', published_at = v_time, published_by = auth.uid()
  WHERE id = p_post_id;
  RETURN p_post_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.unpublish_news_post(p_post_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'administrator access required' USING ERRCODE = '42501';
  END IF;
  PERFORM private.lock_publication_tables();
  DELETE FROM public.published_news_posts WHERE id = p_post_id;
  UPDATE public.news_posts
  SET publication_status = 'draft', published_at = NULL, published_by = NULL
  WHERE id = p_post_id;
  RETURN p_post_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.publish_agenda()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_release_id UUID := pg_catalog.gen_random_uuid();
  v_version BIGINT;
  v_payload JSONB;
BEGIN
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'administrator access required' USING ERRCODE = '42501';
  END IF;
  PERFORM private.lock_publication_tables();
  IF NOT EXISTS (SELECT 1 FROM public.agenda_slots) THEN
    RAISE EXCEPTION 'agenda has no slots' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.agenda_slots
    WHERE date < DATE '2027-04-16' OR date > DATE '2027-04-18'
  ) THEN
    RAISE EXCEPTION 'agenda date is outside the conference range' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public.agenda_slots WHERE start_time >= end_time) THEN
    RAISE EXCEPTION 'agenda slot start time must precede end time' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.agenda_slots
    WHERE type = 'session' AND session_id IS NULL
  ) THEN
    RAISE EXCEPTION 'session slots require a published session' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.agenda_slots a
    LEFT JOIN public.published_sessions s ON s.id = a.session_id
    WHERE a.session_id IS NOT NULL AND s.id IS NULL
  ) THEN
    RAISE EXCEPTION 'agenda references an unpublished session' USING ERRCODE = '23503';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.agenda_slots
    WHERE session_id IS NULL AND btrim(COALESCE(label, '')) = ''
  ) THEN
    RAISE EXCEPTION 'non-session slots require a label' USING ERRCODE = '23514';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'date', a.date,
        'start_time', a.start_time,
        'end_time', a.end_time,
        'label', a.label,
        'label_zh', a.label_zh,
        'type', a.type,
        'room', a.room,
        'sort_order', a.sort_order,
        'session', CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object(
          'id', s.id,
          'title', s.title,
          'title_zh', s.title_zh,
          'abstract', s.abstract,
          'abstract_zh', s.abstract_zh,
          'duration', s.duration,
          'type', s.type,
          'slides_url', s.slides_url,
          'video_url', s.video_url,
          'speaker', jsonb_build_object(
            'id', sp.id,
            'name', sp.name,
            'name_zh', sp.name_zh,
            'company', sp.company,
            'company_zh', sp.company_zh,
            'title', sp.title,
            'title_zh', sp.title_zh,
            'bio', sp.bio,
            'bio_zh', sp.bio_zh,
            'avatar_url', sp.avatar_url
          )
        ) END
      ) ORDER BY a.date, a.start_time, a.sort_order, a.id
    ),
    '[]'::jsonb
  ) INTO v_payload
  FROM public.agenda_slots a
  LEFT JOIN public.published_sessions s ON s.id = a.session_id
  LEFT JOIN public.published_speakers sp ON sp.id = s.speaker_id;

  SELECT COALESCE(MAX(version), 0) + 1 INTO v_version FROM public.agenda_releases;
  UPDATE public.agenda_releases SET is_current = false WHERE is_current;
  INSERT INTO public.agenda_releases (id, version, payload, is_current, published_by)
  VALUES (v_release_id, v_version, v_payload, true, auth.uid());
  RETURN v_release_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.rollback_agenda_release(p_release_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'administrator access required' USING ERRCODE = '42501';
  END IF;
  PERFORM private.lock_publication_tables();
  IF NOT EXISTS (SELECT 1 FROM public.agenda_releases WHERE id = p_release_id) THEN
    RAISE EXCEPTION 'agenda release not found' USING ERRCODE = 'P0002';
  END IF;
  UPDATE public.agenda_releases SET is_current = false WHERE is_current;
  UPDATE public.agenda_releases SET is_current = true WHERE id = p_release_id;
  RETURN p_release_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.publish_site_settings()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_release_id UUID := pg_catalog.gen_random_uuid();
  v_version BIGINT;
  v_payload JSONB;
BEGIN
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'administrator access required' USING ERRCODE = '42501';
  END IF;
  PERFORM private.lock_publication_tables();
  v_payload := private.validated_site_settings_payload();
  SELECT COALESCE(MAX(version), 0) + 1 INTO v_version FROM public.site_settings_releases;
  UPDATE public.site_settings_releases SET is_current = false WHERE is_current;
  INSERT INTO public.site_settings_releases (id, version, payload, is_current, published_by)
  VALUES (v_release_id, v_version, v_payload, true, auth.uid());
  RETURN v_release_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.rollback_site_settings_release(p_release_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'administrator access required' USING ERRCODE = '42501';
  END IF;
  PERFORM private.lock_publication_tables();
  IF NOT EXISTS (SELECT 1 FROM public.site_settings_releases WHERE id = p_release_id) THEN
    RAISE EXCEPTION 'settings release not found' USING ERRCODE = 'P0002';
  END IF;
  UPDATE public.site_settings_releases SET is_current = false WHERE is_current;
  UPDATE public.site_settings_releases SET is_current = true WHERE id = p_release_id;
  RETURN p_release_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_speaker(p_speaker_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.publish_speaker(p_speaker_id);
$$;

CREATE OR REPLACE FUNCTION public.unpublish_speaker(p_speaker_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.unpublish_speaker(p_speaker_id);
$$;

CREATE OR REPLACE FUNCTION public.publish_session(p_session_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.publish_session(p_session_id);
$$;

CREATE OR REPLACE FUNCTION public.unpublish_session(p_session_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.unpublish_session(p_session_id);
$$;

CREATE OR REPLACE FUNCTION public.publish_sponsor(p_sponsor_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.publish_sponsor(p_sponsor_id);
$$;

CREATE OR REPLACE FUNCTION public.unpublish_sponsor(p_sponsor_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.unpublish_sponsor(p_sponsor_id);
$$;

CREATE OR REPLACE FUNCTION public.publish_news_post(
  p_post_id UUID,
  p_published_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.publish_news_post(p_post_id, p_published_at);
$$;

CREATE OR REPLACE FUNCTION public.unpublish_news_post(p_post_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.unpublish_news_post(p_post_id);
$$;

CREATE OR REPLACE FUNCTION public.publish_agenda()
RETURNS UUID
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.publish_agenda();
$$;

CREATE OR REPLACE FUNCTION public.rollback_agenda_release(p_release_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.rollback_agenda_release(p_release_id);
$$;

CREATE OR REPLACE FUNCTION public.publish_site_settings()
RETURNS UUID
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.publish_site_settings();
$$;

CREATE OR REPLACE FUNCTION public.rollback_site_settings_release(p_release_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.rollback_site_settings_release(p_release_id);
$$;

REVOKE ALL ON FUNCTION private.publish_speaker(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.publish_speaker(UUID) TO authenticated;
REVOKE ALL ON FUNCTION private.unpublish_speaker(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.unpublish_speaker(UUID) TO authenticated;
REVOKE ALL ON FUNCTION private.publish_session(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.publish_session(UUID) TO authenticated;
REVOKE ALL ON FUNCTION private.unpublish_session(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.unpublish_session(UUID) TO authenticated;
REVOKE ALL ON FUNCTION private.publish_sponsor(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.publish_sponsor(UUID) TO authenticated;
REVOKE ALL ON FUNCTION private.unpublish_sponsor(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.unpublish_sponsor(UUID) TO authenticated;
REVOKE ALL ON FUNCTION private.publish_news_post(UUID, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.publish_news_post(UUID, TIMESTAMPTZ) TO authenticated;
REVOKE ALL ON FUNCTION private.unpublish_news_post(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.unpublish_news_post(UUID) TO authenticated;
REVOKE ALL ON FUNCTION private.publish_agenda() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.publish_agenda() TO authenticated;
REVOKE ALL ON FUNCTION private.rollback_agenda_release(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.rollback_agenda_release(UUID) TO authenticated;
REVOKE ALL ON FUNCTION private.publish_site_settings() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.publish_site_settings() TO authenticated;
REVOKE ALL ON FUNCTION private.rollback_site_settings_release(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.rollback_site_settings_release(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.publish_speaker(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unpublish_speaker(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.publish_session(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unpublish_session(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.publish_sponsor(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unpublish_sponsor(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.publish_news_post(UUID, TIMESTAMPTZ) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unpublish_news_post(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.publish_agenda() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rollback_agenda_release(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.publish_site_settings() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rollback_site_settings_release(UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.publish_speaker(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unpublish_speaker(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_session(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unpublish_session(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_sponsor(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unpublish_sponsor(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_news_post(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unpublish_news_post(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_agenda() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rollback_agenda_release(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_site_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rollback_site_settings_release(UUID) TO authenticated;

INSERT INTO public.published_sponsors (
  id, name, logo_url, tier, website_url, sort_order, published_at
)
SELECT id, name, logo_url, tier, website_url, sort_order, now()
FROM public.sponsors;
UPDATE public.sponsors
SET publication_status = 'published', published_at = now()
WHERE EXISTS (SELECT 1 FROM public.published_sponsors p WHERE p.id = sponsors.id);

INSERT INTO public.published_news_posts (
  id, title, title_zh, content, content_zh, cover_url, published_at
)
SELECT id, title, title_zh, content, content_zh, cover_url, COALESCE(published_at, created_at)
FROM public.news_posts;
UPDATE public.news_posts
SET publication_status = 'published'
WHERE EXISTS (SELECT 1 FROM public.published_news_posts p WHERE p.id = news_posts.id);

INSERT INTO public.site_settings (key, value) VALUES
  ('conference_name', 'HOW 2027'),
  ('conference_date', '2027.4.16-4.18'),
  ('conference_location', 'Jinan, China'),
  ('conference_location_zh', '中国·济南'),
  ('contact_email', 'faweizhao26@gmail.com'),
  ('hero_title', 'Linking the World with Open Source'),
  ('hero_title_zh', '开源互联世界'),
  ('hero_subtitle', 'HOW2027: PostgreSQL Eco Conference'),
  ('hero_subtitle_zh', 'HOW2027：PostgreSQL 生态大会')
ON CONFLICT (key) DO UPDATE SET
  value = CASE
    WHEN EXCLUDED.key = 'conference_date' THEN EXCLUDED.value
    ELSE COALESCE(NULLIF(btrim(public.site_settings.value), ''), EXCLUDED.value)
  END
WHERE btrim(public.site_settings.value) = ''
   OR (EXCLUDED.key = 'conference_date' AND public.site_settings.value IS DISTINCT FROM EXCLUDED.value);

INSERT INTO public.site_settings_releases (version, payload, is_current)
SELECT 1, private.validated_site_settings_payload(), true;
