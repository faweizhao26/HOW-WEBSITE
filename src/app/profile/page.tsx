import { cookies } from "next/headers"
import ProfileContent from "./profile-content"

export default async function ProfilePage() {
  const cookieStore = await cookies()
  const locale = cookieStore.get("lang")?.value === "zh" ? "zh" : "en"
  return <ProfileContent locale={locale} />
}
