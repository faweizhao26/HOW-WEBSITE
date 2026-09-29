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
      speakers: {
        Row: Speaker
        Insert: SpeakerInsert
        Update: SpeakerUpdate
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
      published_speakers: {
        Row: PublishedSpeaker
        Insert: PublishedSpeaker
        Update: Partial<PublishedSpeaker>
      }
      published_sessions: {
        Row: PublishedSession
        Insert: PublishedSession
        Update: Partial<PublishedSession>
      }
      published_sponsors: {
        Row: PublishedSponsor
        Insert: PublishedSponsor
        Update: Partial<PublishedSponsor>
      }
      published_news_posts: {
        Row: PublishedNewsPost
        Insert: PublishedNewsPost
        Update: Partial<PublishedNewsPost>
      }
      agenda_releases: {
        Row: AgendaRelease
        Insert: Omit<AgendaRelease, "id" | "published_at">
        Update: Partial<Pick<AgendaRelease, "is_current">>
      }
      site_settings_releases: {
        Row: SiteSettingsRelease
        Insert: Omit<SiteSettingsRelease, "id" | "published_at">
        Update: Partial<Pick<SiteSettingsRelease, "is_current">>
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

export type PublicationStatus = "draft" | "published"

export type PublicationMetadata = {
  publication_status: PublicationStatus
  published_at: string | null
  published_by: string | null
  updated_at: string
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

export type Session = PublicationMetadata & {
  id: string
  user_id: string
  title: string
  title_zh: string | null
  abstract: string
  abstract_zh: string | null
  duration: number
  type: "talk" | "workshop" | "panel"
  status: "pending" | "approved" | "rejected"
  speaker_id: string | null
  admin_feedback: string | null
  slides_url: string | null
  video_url: string | null
  created_at: string
  updated_at: string
}

export type SessionInsert = Omit<Session, "id" | "created_at" | "updated_at" | "status" | "speaker_id" | "admin_feedback" | "slides_url" | "video_url" | "publication_status" | "published_at" | "published_by">
export type SessionUpdate = Partial<Omit<Session, "id" | "created_at" | "updated_at">>

export type Speaker = PublicationMetadata & {
  id: string
  profile_id: string | null
  name: string
  name_zh: string | null
  company: string | null
  company_zh: string | null
  title: string | null
  title_zh: string | null
  bio: string | null
  bio_zh: string | null
  avatar_url: string | null
  sort_order: number
  created_at: string
}

export type SpeakerInsert = Omit<Speaker, "id" | "created_at" | "updated_at" | "publication_status" | "published_at" | "published_by">
export type SpeakerUpdate = Partial<Omit<Speaker, "id" | "created_at" | "updated_at">>

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
  updated_at: string
}

export type AgendaSlotInsert = Omit<AgendaSlot, "id" | "created_at" | "updated_at">
export type AgendaSlotUpdate = Partial<Omit<AgendaSlot, "id" | "created_at" | "updated_at">>

export type Sponsor = PublicationMetadata & {
  id: string
  name: string
  logo_url: string
  tier: "diamond" | "gold" | "silver" | "bronze"
  website_url: string | null
  sort_order: number
  created_at: string
}

export type SponsorInsert = Omit<Sponsor, "id" | "created_at" | "updated_at" | "publication_status" | "published_at" | "published_by">
export type SponsorUpdate = Partial<Omit<Sponsor, "id" | "created_at" | "updated_at">>

export type NewsPost = PublicationMetadata & {
  id: string
  title: string
  title_zh: string | null
  content: string
  content_zh: string | null
  cover_url: string | null
  created_at: string
}

export type NewsPostInsert = Omit<NewsPost, "id" | "created_at" | "updated_at" | "publication_status" | "published_at" | "published_by">
export type NewsPostUpdate = Partial<Omit<NewsPost, "id" | "created_at" | "updated_at">>

export type SiteSetting = {
  key: string
  value: string
  updated_at: string
}

export type SiteSettingInsert = Omit<SiteSetting, "updated_at">
export type SiteSettingUpdate = Partial<Omit<SiteSetting, "key" | "updated_at">>

export type PublishedSpeaker = {
  id: string
  name: string
  name_zh: string | null
  company: string | null
  company_zh: string | null
  title: string | null
  title_zh: string | null
  bio: string | null
  bio_zh: string | null
  avatar_url: string | null
  sort_order: number
  published_at: string
}

export type PublishedSession = {
  id: string
  speaker_id: string
  title: string
  title_zh: string | null
  abstract: string
  abstract_zh: string | null
  duration: number
  type: "talk" | "workshop" | "panel"
  slides_url: string | null
  video_url: string | null
  published_at: string
}

export type PublishedSponsor = {
  id: string
  name: string
  logo_url: string
  tier: "diamond" | "gold" | "silver" | "bronze"
  website_url: string | null
  sort_order: number
  published_at: string
}

export type PublishedNewsPost = {
  id: string
  title: string
  title_zh: string | null
  content: string
  content_zh: string | null
  cover_url: string | null
  published_at: string
}

export type AgendaReleaseSlot = {
  id: string
  date: string
  start_time: string
  end_time: string
  label: string
  label_zh: string | null
  type: AgendaSlot["type"]
  room: string | null
  sort_order: number
  session: (Omit<PublishedSession, "speaker_id" | "published_at"> & { speaker: PublishedSpeaker }) | null
}

export type AgendaReleasePayload = AgendaReleaseSlot[]

export type PublishedSiteSettings = {
  conference_name: string
  conference_date: string
  conference_location: string
  conference_location_zh: string
  contact_email: string
  hero_title: string
  hero_title_zh: string
  hero_subtitle: string
  hero_subtitle_zh: string
  [key: string]: string
}

export type AgendaRelease = {
  id: string
  version: number
  payload: AgendaReleasePayload
  is_current: boolean
  published_at: string
  published_by: string | null
}

export type SiteSettingsRelease = {
  id: string
  version: number
  payload: PublishedSiteSettings
  is_current: boolean
  published_at: string
  published_by: string | null
}

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
