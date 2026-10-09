import type { SupabaseClient } from "@supabase/supabase-js"
import type { Profile, Session, Registration } from "../db/schema"
import type { RegistrationRecord } from "../admin/data"

type Client = Pick<SupabaseClient, "from">
export type ProfileSession = Pick<Session, "id" | "title" | "duration" | "type" | "status" | "admin_feedback" | "created_at">
export type ProfileFields = Partial<Pick<Profile, "full_name" | "company" | "bio" | "bio_zh" | "phone" | "wechat" | "avatar_url">>

export async function loadProfileData(client: Client, userId: string): Promise<{ profile: Profile; sessions: ProfileSession[]; registrations: RegistrationRecord[] }> {
  const [profile, sessions, registrations] = await Promise.all([
    client.from("profiles").select("*").eq("id", userId).single(),
    client.from("sessions").select("id, title, duration, type, status, admin_feedback, created_at").eq("user_id", userId).order("created_at", { ascending: false }),
    client.from("registrations").select("*, ticket_types(name, name_zh)").eq("user_id", userId).order("created_at", { ascending: false }),
  ])
  for (const result of [profile, sessions, registrations]) {
    if (result.error) throw result.error
    if (!result.data) throw new Error("load_failed")
  }
  return { profile: profile.data!, sessions: sessions.data!, registrations: registrations.data! }
}

export async function saveProfile(client: Client, userId: string, fields: ProfileFields): Promise<Profile> {
  const { data, error } = await client.from("profiles").update(fields).eq("id", userId).select("*").single()
  if (error) throw error
  if (!data?.id) throw new Error("not_saved")
  return data
}

export async function updateOwnRegistration(client: Client, userId: string, registrationId: string, status: Registration["status"]): Promise<Pick<Registration, "id" | "status">> {
  const { data, error } = await client.from("registrations").update({ status }).eq("id", registrationId).eq("user_id", userId).select("id,status").single()
  if (error) throw error
  if (!data?.id || data.status !== status) throw new Error("not_saved")
  return data
}

export async function uploadProfileAvatar(client: SupabaseClient, userId: string, file: File): Promise<Profile> {
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-")
  const path = `avatars/${userId}/${crypto.randomUUID()}-${cleanName}`
  const bucket = client.storage.from("conference-media")
  const { error } = await bucket.upload(path, file)
  if (error) throw error
  const { data } = bucket.getPublicUrl(path)
  try {
    return await saveProfile(client, userId, { avatar_url: data.publicUrl })
  } catch (error) {
    // A lost response may follow a successful write: only remove an unreferenced upload.
    try {
      const current = await client.from("profiles").select("avatar_url").eq("id", userId).single()
      if (!current.error && current.data && current.data.avatar_url !== data.publicUrl) await bucket.remove([path])
    } catch { /* Best-effort cleanup must not hide the save failure. */ }
    throw error
  }
}
