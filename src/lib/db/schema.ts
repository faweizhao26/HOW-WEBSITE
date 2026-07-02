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
      ticket_types: {
        Row: TicketType
        Insert: TicketTypeInsert
        Update: TicketTypeUpdate
      }
      channel_codes: {
        Row: ChannelCode
        Insert: ChannelCodeInsert
        Update: ChannelCodeUpdate
      }
      registrations: {
        Row: Registration
        Insert: RegistrationInsert
        Update: RegistrationUpdate
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
  avatar_url: string | null
  phone: string | null
  wechat: string | null
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

export type TicketType = {
  id: string
  name: string
  name_zh: string | null
  description: string | null
  description_zh: string | null
  is_free: boolean
  requires_code: boolean
  is_active: boolean
  sort_order: number
  created_at: string
}

export type TicketTypeInsert = Omit<TicketType, "id" | "created_at">
export type TicketTypeUpdate = Partial<Omit<TicketType, "id" | "created_at">>

export type ChannelCode = {
  id: string
  code: string
  name: string
  ticket_type_id: string | null
  is_active: boolean
  created_at: string
}

export type ChannelCodeInsert = Omit<ChannelCode, "id" | "created_at">
export type ChannelCodeUpdate = Partial<Omit<ChannelCode, "id" | "created_at">>

export type Registration = {
  id: string
  user_id: string
  ticket_type_id: string | null
  channel_code: string | null
  name: string
  email: string
  phone: string
  company: string | null
  position: string | null
  status: "confirmed" | "cancelled"
  checked_in: boolean
  checked_in_at: string | null
  created_at: string
}

export type RegistrationInsert = Omit<Registration, "id" | "checked_in" | "checked_in_at" | "created_at">
export type RegistrationUpdate = Partial<Omit<Registration, "id" | "user_id" | "created_at">>
