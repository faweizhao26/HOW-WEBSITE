"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth/require-admin"
import { createServerSupabase } from "@/lib/supabase/server"

export type PublicationActionResult =
  | { ok: true; id: string }
  | { ok: false; message: string }

type RpcName =
  | "publish_speaker"
  | "unpublish_speaker"
  | "publish_session"
  | "unpublish_session"
  | "publish_sponsor"
  | "unpublish_sponsor"
  | "publish_news_post"
  | "unpublish_news_post"
  | "publish_agenda"
  | "rollback_agenda_release"
  | "publish_site_settings"
  | "rollback_site_settings_release"

const SAFE_ACTION_ERROR = "操作失败，请稍后重试。Action failed. Please try again."

async function runPublicationAction(
  rpcName: RpcName,
  args: Record<string, string | null> | undefined,
  paths: string[]
): Promise<PublicationActionResult> {
  try {
    await requireAdmin()
    const supabase = await createServerSupabase()
    const { data, error } = args
      ? await supabase.rpc(rpcName, args)
      : await supabase.rpc(rpcName)

    if (error || typeof data !== "string") return { ok: false, message: SAFE_ACTION_ERROR }

    paths.forEach((path) => revalidatePath(path))
    return { ok: true, id: data }
  } catch {
    return { ok: false, message: SAFE_ACTION_ERROR }
  }
}

export async function publishSpeaker(id: string) {
  return runPublicationAction("publish_speaker", { p_speaker_id: id }, ["/admin/speakers", "/speakers", "/schedule"])
}

export async function unpublishSpeaker(id: string) {
  return runPublicationAction("unpublish_speaker", { p_speaker_id: id }, ["/admin/speakers", "/speakers", "/schedule"])
}

export async function publishSession(id: string) {
  return runPublicationAction("publish_session", { p_session_id: id }, ["/admin/sessions", "/speakers", "/schedule"])
}

export async function unpublishSession(id: string) {
  return runPublicationAction("unpublish_session", { p_session_id: id }, ["/admin/sessions", "/schedule"])
}

export async function publishSponsor(id: string) {
  return runPublicationAction("publish_sponsor", { p_sponsor_id: id }, ["/admin/sponsors", "/sponsors"])
}

export async function unpublishSponsor(id: string) {
  return runPublicationAction("unpublish_sponsor", { p_sponsor_id: id }, ["/admin/sponsors", "/sponsors"])
}

export async function publishNewsPost(id: string, publishedAt?: string) {
  return runPublicationAction(
    "publish_news_post",
    { p_post_id: id, p_published_at: publishedAt ?? null },
    ["/admin/updates", "/updates", "/"]
  )
}

export async function unpublishNewsPost(id: string) {
  return runPublicationAction("unpublish_news_post", { p_post_id: id }, ["/admin/updates", "/updates", "/"])
}

export async function publishAgenda() {
  return runPublicationAction("publish_agenda", undefined, ["/admin/agenda", "/schedule", "/"])
}

export async function rollbackAgenda(releaseId: string) {
  return runPublicationAction("rollback_agenda_release", { p_release_id: releaseId }, ["/admin/agenda", "/schedule", "/"])
}

export async function publishSiteSettings() {
  return runPublicationAction("publish_site_settings", undefined, ["/admin/settings", "/"])
}

export async function rollbackSiteSettings(releaseId: string) {
  return runPublicationAction("rollback_site_settings_release", { p_release_id: releaseId }, ["/admin/settings", "/"])
}
