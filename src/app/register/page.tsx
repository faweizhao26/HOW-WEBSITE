import { cookies } from "next/headers"
import RegistrationForm from "./registration-form"

export default async function RegisterPage() {
  const cookieStore = await cookies()
  const locale = cookieStore.get("lang")?.value === "zh" ? "zh" : "en"
  return <RegistrationForm locale={locale} />
}
