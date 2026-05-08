import { cookies } from "next/headers"
import { getLocale } from "@/lib/i18n/utils"

export default async function AboutPage() {
  const cookieStore = await cookies()
  const locale = getLocale(cookieStore.get("lang")?.value)

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-4xl font-bold mb-8">
        {locale === "zh" ? "关于 HOW 2027" : "About HOW 2027"}
      </h1>
      <div className="prose prose-invert max-w-none space-y-6">
        <p className="text-lg text-zinc-300 leading-relaxed">
          {locale === "zh"
            ? "HOW 2027 是一场聚焦开源创新与数据库技术的社区驱动盛会。大会将汇聚来自全球的 PostgreSQL 专家、IvorySQL 贡献者、开发者以及社区成员。"
            : "HOW 2027 is a community-driven event focused on open-source innovations and database technology. The conference brings together PostgreSQL experts, IvorySQL contributors, developers, and community members from around the world."}
        </p>
        <h2 className="text-2xl font-semibold text-white mt-10 mb-4">
          {locale === "zh" ? "大会使命" : "Our Mission"}
        </h2>
        <p className="text-zinc-400 leading-relaxed">
          {locale === "zh"
            ? "推动 PostgreSQL 及开源数据库技术在中国的发展，搭建全球社区交流的桥梁，促进技术分享与协作。"
            : "To advance PostgreSQL and open-source database technology in China, build bridges for global community exchange, and foster technical sharing and collaboration."}
        </p>
        <h2 className="text-2xl font-semibold text-white mt-10 mb-4">
          {locale === "zh" ? "往届回顾" : "Past Conferences"}
        </h2>
        <p className="text-zinc-400">
          HOW 2025 · HOW 2026
        </p>
      </div>
    </div>
  )
}
