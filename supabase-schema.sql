-- Run this SQL in your Supabase SQL Editor to set up the database schema.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  company TEXT,
  bio TEXT,
  bio_zh TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sessions / CFP proposals
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  title_zh TEXT,
  abstract TEXT NOT NULL,
  abstract_zh TEXT,
  duration INT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('talk', 'workshop', 'panel')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_feedback TEXT,
  slides_url TEXT,
  video_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Agenda time slots
CREATE TABLE public.agenda_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  label TEXT NOT NULL,
  label_zh TEXT,
  type TEXT NOT NULL CHECK (type IN ('opening', 'keynote', 'session', 'break', 'panel', 'closing')),
  session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  room TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sponsors
CREATE TABLE public.sponsors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  logo_url TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('diamond', 'gold', 'silver', 'bronze')),
  website_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- News posts
CREATE TABLE public.news_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  title_zh TEXT,
  content TEXT NOT NULL,
  content_zh TEXT,
  cover_url TEXT,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Site settings
CREATE TABLE public.site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- --- Row Level Security ---

-- Profiles: users can read all, update only own
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Sessions: anyone can read approved, users can CRUD own
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved sessions are viewable by everyone" ON public.sessions FOR SELECT USING (status = 'approved');
CREATE POLICY "Users can view own sessions" ON public.sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all sessions" ON public.sessions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Users can create own sessions" ON public.sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions" ON public.sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can update any session" ON public.sessions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can delete any session" ON public.sessions FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Agenda slots: readable by all, manageable by admin
ALTER TABLE public.agenda_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agenda slots are viewable by everyone" ON public.agenda_slots FOR SELECT USING (true);
CREATE POLICY "Admins can manage agenda slots" ON public.agenda_slots FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Sponsors: readable by all, manageable by admin
ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sponsors are viewable by everyone" ON public.sponsors FOR SELECT USING (true);
CREATE POLICY "Admins can manage sponsors" ON public.sponsors FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- News posts: readable by all, manageable by admin
ALTER TABLE public.news_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "News posts are viewable by everyone" ON public.news_posts FOR SELECT USING (true);
CREATE POLICY "Admins can manage news" ON public.news_posts FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Site settings: readable by all, writable by admin
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Settings are viewable by everyone" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "Admins can manage settings" ON public.site_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- --- Trigger: auto-create profile on signup ---
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email), 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- --- Storage bucket for media ---
-- Run these separately in Supabase SQL Editor:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('conference-media', 'conference-media', true);

-- Storage RLS
-- CREATE POLICY "Public read access" ON storage.objects FOR SELECT USING (bucket_id = 'conference-media');
-- CREATE POLICY "Admin upload access" ON storage.objects FOR INSERT WITH CHECK (
--   bucket_id = 'conference-media' AND
--   EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
-- );
-- CREATE POLICY "Admin delete access" ON storage.objects FOR DELETE USING (
--   bucket_id = 'conference-media' AND
--   EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
-- );

-- --- Updated_at trigger ---
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sessions_updated_at ON public.sessions;
CREATE TRIGGER sessions_updated_at
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
