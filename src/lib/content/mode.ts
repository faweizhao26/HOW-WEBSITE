export type ContentMode = "mock" | "supabase"

function hasUsableSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  return Boolean(
    url &&
    key &&
    !url.includes("placeholder") &&
    !key.includes("placeholder")
  )
}

export function getContentMode(): ContentMode {
  const configuredMode = process.env.NEXT_PUBLIC_CONTENT_MODE

  if (configuredMode === "mock") return "mock"
  if (configuredMode === "supabase") return "supabase"
  if (process.env.NODE_ENV === "production") return "supabase"

  return hasUsableSupabaseConfig() ? "supabase" : "mock"
}
