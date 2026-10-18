import type { SupabaseClient } from "@supabase/supabase-js"

export async function uploadSessionMedia(
  client: Pick<SupabaseClient, "from" | "storage">,
  id: string,
  file: File,
  type: "slides" | "video",
): Promise<string> {
  const extension = file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "bin"
  const path = `sessions/${id}/${type}-${crypto.randomUUID()}.${extension}`
  const bucket = client.storage.from("conference-media")
  const upload = await bucket.upload(path, file, { upsert: false })
  if (upload.error) throw upload.error
  if (upload.data?.path !== path) throw new Error("session_media_upload_failed")
  const url = bucket.getPublicUrl(path).data.publicUrl
  if (!url || !url.endsWith(path)) throw new Error("session_media_upload_failed")
  const field = type === "slides" ? "slides_url" : "video_url"
  let writeSettled = false
  try {
    const { data, error } = await client.from("sessions").update({ [field]: url }).eq("id", id).select("id,slides_url,video_url").maybeSingle()
    // A SQL rejection or completed success is settled. Transport/gateway failures may still commit later.
    writeSettled = !error || /^[0-9A-Z]{5}$/.test(error.code)
    if (error) throw error
    if (data?.id !== id || data[field] !== url) throw new Error("session_media_not_saved")
    return url
  } catch (error) {
    if (!writeSettled) throw error
    // A failed response can follow a committed update. Unknown references must keep the file.
    try {
      const current = await client.from("sessions").select("id,slides_url,video_url").eq("id", id).maybeSingle()
      if (!current.error && current.data?.id === id && (current.data[field] === null || typeof current.data[field] === "string") && current.data[field] !== url) {
        const published = await client.from("published_sessions").select("id,slides_url,video_url").eq("id", id).maybeSingle()
        const referenced = [current.data, published.data].some(row => row?.slides_url === url || row?.video_url === url)
        if (!published.error && !referenced) await bucket.remove([path])
      }
    } catch { /* Preserve the original save error; an unverified upload stays intact. */ }
    throw error
  }
}
