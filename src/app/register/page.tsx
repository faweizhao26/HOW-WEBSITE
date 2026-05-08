import { cookies } from "next/headers"
import { getLocale } from "@/lib/i18n/utils"
import { Button } from "@/components/ui/button"
import { ExternalLink } from "lucide-react"

export default async function RegisterPage() {
  const cookieStore = await cookies()
  const locale = getLocale(cookieStore.get("lang")?.value)

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center py-16">
        <h1 className="text-4xl font-bold mb-4">
          {locale === "zh" ? "报名参加" : "Register"}
        </h1>
        <p className="text-zinc-400 mb-8 max-w-md mx-auto">
          {locale === "zh"
            ? "报名通道将在大会临近时开启，敬请期待！"
            : "Registration will open closer to the event. Stay tuned!"}
        </p>
        <div className="p-8 bg-zinc-900/50 rounded-xl border border-zinc-800 inline-block">
          <p className="text-zinc-300 mb-4">{locale === "zh" ? "如有疑问，请发送邮件至：" : "For inquiries, email us at:"}</p>
          <a
            href="mailto:conference@how2027.org"
            className="text-emerald-400 hover:text-emerald-300 text-lg font-medium"
          >
            conference@how2027.org
          </a>
        </div>
      </div>
    </div>
  )
}
