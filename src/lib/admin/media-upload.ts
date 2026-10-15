import type { SupabaseClient } from "@supabase/supabase-js"

export type MediaKind = "image" | "document"
export type MediaErrorCode = "invalid_file" | "too_large" | "admin_required" | "upload_failed" | "account_changed"
export class MediaUploadError extends Error {
  code: MediaErrorCode
  constructor(code: MediaErrorCode) { super(code); this.code = code; this.name = "MediaUploadError" }
}

export async function inspectMediaFile(file: File, kind: MediaKind) {
  if (!file.size) throw new MediaUploadError("invalid_file")
  if (file.size > (kind === "image" ? 5 : 10) * 1024 * 1024) throw new MediaUploadError("too_large")
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  const text = new TextDecoder().decode(bytes)
  let contentType = "", extension = ""
  if (kind === "document" && text.startsWith("%PDF-")) { contentType = "application/pdf"; extension = "pdf" }
  if (kind === "image") {
    if ([137,80,78,71,13,10,26,10].every((value, index) => bytes[index] === value)) { contentType = "image/png"; extension = "png" }
    else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) { contentType = "image/jpeg"; extension = "jpg" }
    else if (text.startsWith("GIF87a") || text.startsWith("GIF89a")) { contentType = "image/gif"; extension = "gif" }
    else if (text.startsWith("RIFF") && text.slice(8, 12) === "WEBP") { contentType = "image/webp"; extension = "webp" }
  }
  if (!contentType || (file.type && file.type !== contentType)) throw new MediaUploadError("invalid_file")
  return { contentType, extension }
}

async function currentAdmin(client: SupabaseClient): Promise<string> {
  const auth = await client.auth.getUser()
  if (auth.error || !auth.data.user) throw new MediaUploadError("admin_required")
  const profile = await client.from("profiles").select("role").eq("id", auth.data.user.id).single()
  if (profile.error || profile.data?.role !== "admin") throw new MediaUploadError("admin_required")
  return auth.data.user.id
}

export async function uploadSiteMedia(client: SupabaseClient, file: File, kind: MediaKind): Promise<{ path: string; url: string }> {
  const metadata = await inspectMediaFile(file, kind)
  const owner = await currentAdmin(client)
  const path = `site-content/${owner}/${crypto.randomUUID()}.${metadata.extension}`
  const bucket = client.storage.from("conference-media")
  const result = await bucket.upload(path, file, { contentType: metadata.contentType, upsert: false, cacheControl: "3600" })
  if (result.error || result.data?.path !== path) {
    // This new path has never been returned to the editor or saved into a release.
    try { await bucket.remove([path]) } catch { /* Keep the upload failure as the primary error. */ }
    throw new MediaUploadError("upload_failed")
  }
  if (await currentAdmin(client) !== owner) throw new MediaUploadError("account_changed")
  const url = bucket.getPublicUrl(path).data.publicUrl
  if (!url || !url.endsWith(path)) throw new MediaUploadError("upload_failed")
  return { path, url }
}
