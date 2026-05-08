export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: ProfileInsert
        Update: ProfileUpdate
      }
      sessions: {
        Row: Session
        Insert: SessionInsert
        Update: SessionUpdate
      }
      agenda_slots: {
        Row: AgendaSlot
        Insert: AgendaSlotInsert
        Update: AgendaSlotUpdate
      }
      sponsors: {
        Row: Sponsor
        Insert: SponsorInsert
        Update: SponsorUpdate
      }
      news_posts: {
        Row: NewsPost
        Insert: NewsPostInsert
        Update: NewsPostUpdate
      }
      site_settings: {
        Row: SiteSetting
        Insert: SiteSettingInsert
        Update: SiteSettingUpdate
      }
    }
  }
}

export type Profile = {
  id: string
  full_name: string
  company: string | null
  bio: string | null
  bio_zh: string | null
  role: "user" | "admin"
  created_at: string
}

export type ProfileInsert = Omit<Profile, "created_at">
export type ProfileUpdate = Partial<Omit<Profile, "id" | "created_at">>

export type Session = {
  id: string
  user_id: string
  title: string
  title_zh: string | null
  abstract: string
  abstract_zh: string | null
  duration: number
  type: "talk" | "workshop" | "panel"
  status: "pending" | "approved" | "rejected"
  admin_feedback: string | null
  slides_url: string | null
  video_url: string | null
  created_at: string
  updated_at: string
}

export type SessionInsert = Omit<Session, "id" | "created_at" | "updated_at" | "status" | "admin_feedback" | "slides_url" | "video_url">
export type SessionUpdate = Partial<Omit<Session, "id" | "created_at" | "updated_at">>

export type AgendaSlot = {
  id: string
  date: string
  start_time: string
  end_time: string
  label: string
  label_zh: string | null
  type: "opening" | "keynote" | "session" | "break" | "panel" | "closing"
  session_id: string | null
  room: string | null
  sort_order: number
  created_at: string
}

export type AgendaSlotInsert = Omit<AgendaSlot, "id" | "created_at">
export type AgendaSlotUpdate = Partial<Omit<AgendaSlot, "id" | "created_at">>

export type Sponsor = {
  id: string
  name: string
  logo_url: string
  tier: "diamond" | "gold" | "silver" | "bronze"
  website_url: string | null
  sort_order: number
  created_at: string
}

export type SponsorInsert = Omit<Sponsor, "id" | "created_at">
export type SponsorUpdate = Partial<Omit<Sponsor, "id">>

export type NewsPost = {
  id: string
  title: string
  title_zh: string | null
  content: string
  content_zh: string | null
  cover_url: string | null
  published_at: string
  created_at: string
}

export type NewsPostInsert = Omit<NewsPost, "id" | "created_at">
export type NewsPostUpdate = Partial<Omit<NewsPost, "id" | "created_at">>

export type SiteSetting = {
  key: string
  value: string
}

export type SiteSettingInsert = SiteSetting
export type SiteSettingUpdate = Partial<SiteSetting>
