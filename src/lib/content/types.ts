import type {
  AgendaReleasePayload,
  PublishedNewsPost,
  PublishedSession,
  PublishedSiteSettings,
  PublishedSpeaker,
  PublishedSponsor,
} from "@/lib/db/schema"

export type PublicContentResult<T> =
  | { status: "ready"; data: T }
  | { status: "empty" }
  | { status: "error"; message: string }

export type {
  AgendaReleasePayload,
  PublishedNewsPost,
  PublishedSession,
  PublishedSiteSettings,
  PublishedSpeaker,
  PublishedSponsor,
}
