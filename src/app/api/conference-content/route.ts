import { getPublishedSiteContent } from "@/lib/content/site-public"

export async function GET() {
  const result = await getPublishedSiteContent()
  return Response.json(result, { status: result.status === "ready" ? 200 : 503, headers: { "Cache-Control": "no-store" } })
}
