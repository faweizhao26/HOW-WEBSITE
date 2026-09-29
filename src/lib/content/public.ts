import "server-only"

import { getContentMode } from "@/lib/content/mode"
import type {
  AgendaReleasePayload,
  PublishedNewsPost,
  PublishedSession,
  PublishedSiteSettings,
  PublishedSpeaker,
  PublishedSponsor,
  PublicContentResult,
} from "@/lib/content/types"
import { getNews, getSponsors, mockSlots } from "@/lib/mock-data"
import { createServerSupabase } from "@/lib/supabase/server"

const CONTENT_UNAVAILABLE = "Published content is temporarily unavailable."
const MOCK_PUBLISHED_AT = "2026-09-29T00:00:00.000Z"

type MockProfile = {
  full_name: string
  company?: string | null
  bio?: string | null
  bio_zh?: string | null
  photo_url?: string | null
}

type MockSession = {
  id: string
  title: string
  title_zh?: string | null
  abstract: string
  abstract_zh?: string | null
  duration: number
  type: string
  profiles: MockProfile
}

function unavailable<T>(): PublicContentResult<T> {
  return { status: "error", message: CONTENT_UNAVAILABLE }
}

function listResult<T>(rows: T[]): PublicContentResult<T[]> {
  return rows.length > 0 ? { status: "ready", data: rows } : { status: "empty" }
}

function mockSpeakerId(name: string) {
  return `mock-speaker-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`
}

function toMockSpeaker(profile: MockProfile, sortOrder = 0): PublishedSpeaker {
  return {
    id: mockSpeakerId(profile.full_name),
    name: profile.full_name,
    name_zh: profile.full_name,
    company: profile.company ?? null,
    company_zh: profile.company ?? null,
    title: null,
    title_zh: null,
    bio: profile.bio ?? null,
    bio_zh: profile.bio_zh ?? null,
    avatar_url: profile.photo_url ?? null,
    sort_order: sortOrder,
    published_at: MOCK_PUBLISHED_AT,
  }
}

function toMockSession(session: MockSession): PublishedSession {
  return {
    id: session.id,
    speaker_id: mockSpeakerId(session.profiles.full_name),
    title: session.title,
    title_zh: session.title_zh ?? null,
    abstract: session.abstract,
    abstract_zh: session.abstract_zh ?? null,
    duration: session.duration,
    type: session.type === "workshop" ? "workshop" : session.type === "panel" ? "panel" : "talk",
    slides_url: null,
    video_url: null,
    published_at: MOCK_PUBLISHED_AT,
  }
}

function getMockSessions() {
  const sessions = new Map<string, MockSession>()
  for (const slot of mockSlots) {
    if (slot.sessions) sessions.set(slot.sessions.id, slot.sessions as MockSession)
  }
  return [...sessions.values()]
}

function getMockSpeakers() {
  const speakers = new Map<string, PublishedSpeaker>()
  getMockSessions().forEach((session, index) => {
    const speaker = toMockSpeaker(session.profiles, index)
    speakers.set(speaker.id, speaker)
  })
  return [...speakers.values()]
}

function getMockAgenda(): AgendaReleasePayload {
  return mockSlots.map((slot) => {
    const session = slot.sessions ? toMockSession(slot.sessions as MockSession) : null
    const speaker = slot.sessions ? toMockSpeaker((slot.sessions as MockSession).profiles) : null

    return {
      id: slot.id,
      date: slot.date,
      start_time: slot.start_time,
      end_time: slot.end_time,
      label: slot.label,
      label_zh: slot.label_zh || null,
      type: slot.type === "workshop" ? "session" : slot.type,
      room: slot.room,
      sort_order: slot.sort_order,
      session: session && speaker
        ? {
            id: session.id,
            title: session.title,
            title_zh: session.title_zh,
            abstract: session.abstract,
            abstract_zh: session.abstract_zh,
            duration: session.duration,
            type: session.type,
            slides_url: session.slides_url,
            video_url: session.video_url,
            speaker,
          }
        : null,
    }
  }) as AgendaReleasePayload
}

function getMockSettings(): PublishedSiteSettings {
  return {
    conference_name: "HOW 2027",
    conference_date: "2027.4.16-4.18",
    conference_location: "Jinan, China",
    conference_location_zh: "中国·济南",
    contact_email: "faweizhao26@gmail.com",
    hero_title: "Linking the World with Open Source",
    hero_title_zh: "开源互联世界",
    hero_subtitle: "HOW2027: PostgreSQL Eco Conference",
    hero_subtitle_zh: "HOW2027：PostgreSQL 生态大会",
  }
}

export async function getPublishedSettings(): Promise<PublicContentResult<PublishedSiteSettings>> {
  if (getContentMode() === "mock") return { status: "ready", data: getMockSettings() }

  try {
    const supabase = await createServerSupabase()
    const { data, error } = await supabase
      .from("site_settings_releases")
      .select("payload")
      .eq("is_current", true)
      .maybeSingle()

    if (error) return unavailable()
    if (!data) return { status: "empty" }
    return { status: "ready", data: data.payload as PublishedSiteSettings }
  } catch {
    return unavailable()
  }
}

export async function getPublishedSpeakers(): Promise<PublicContentResult<PublishedSpeaker[]>> {
  if (getContentMode() === "mock") return listResult(getMockSpeakers())

  try {
    const supabase = await createServerSupabase()
    const { data, error } = await supabase.from("published_speakers").select("*").order("sort_order")
    if (error) return unavailable()
    return listResult((data ?? []) as PublishedSpeaker[])
  } catch {
    return unavailable()
  }
}

export async function getPublishedSessions(): Promise<PublicContentResult<PublishedSession[]>> {
  if (getContentMode() === "mock") return listResult(getMockSessions().map(toMockSession))

  try {
    const supabase = await createServerSupabase()
    const { data, error } = await supabase.from("published_sessions").select("*").order("published_at", { ascending: false })
    if (error) return unavailable()
    return listResult((data ?? []) as PublishedSession[])
  } catch {
    return unavailable()
  }
}

export async function getPublishedSponsors(): Promise<PublicContentResult<PublishedSponsor[]>> {
  if (getContentMode() === "mock") {
    return listResult(getSponsors().map((sponsor): PublishedSponsor => ({
      ...sponsor,
      tier: sponsor.tier as PublishedSponsor["tier"],
      published_at: MOCK_PUBLISHED_AT,
    })))
  }

  try {
    const supabase = await createServerSupabase()
    const { data, error } = await supabase.from("published_sponsors").select("*").order("sort_order")
    if (error) return unavailable()
    return listResult((data ?? []) as PublishedSponsor[])
  } catch {
    return unavailable()
  }
}

export async function getPublishedNews(): Promise<PublicContentResult<PublishedNewsPost[]>> {
  if (getContentMode() === "mock") {
    return listResult(getNews().map((post) => ({ ...post, cover_url: null })))
  }

  try {
    const supabase = await createServerSupabase()
    const { data, error } = await supabase.from("published_news_posts").select("*").order("published_at", { ascending: false })
    if (error) return unavailable()
    return listResult((data ?? []) as PublishedNewsPost[])
  } catch {
    return unavailable()
  }
}

export async function getPublishedAgenda(): Promise<PublicContentResult<AgendaReleasePayload>> {
  if (getContentMode() === "mock") return listResult(getMockAgenda())

  try {
    const supabase = await createServerSupabase()
    const { data, error } = await supabase
      .from("agenda_releases")
      .select("payload")
      .eq("is_current", true)
      .maybeSingle()

    if (error) return unavailable()
    if (!data) return { status: "empty" }
    return listResult(data.payload as AgendaReleasePayload)
  } catch {
    return unavailable()
  }
}
