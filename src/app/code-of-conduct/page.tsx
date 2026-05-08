import { cookies } from "next/headers"
import { getLocale } from "@/lib/i18n/utils"

export default async function CodeOfConductPage() {
  const cookieStore = await cookies()
  const locale = getLocale(cookieStore.get("lang")?.value)

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-4xl font-bold mb-8">
        {locale === "zh" ? "行为准则" : "Code of Conduct"}
      </h1>
      <div className="prose prose-invert max-w-none space-y-6">
        <p className="text-zinc-400 leading-relaxed">
          {locale === "zh"
            ? "HOW 2027 致力于为所有人提供无骚扰的会议体验，无论性别、性别认同与表达、性取向、残疾、外貌、体型、种族或宗教。我们不容忍任何形式的骚扰。"
            : "HOW 2027 is dedicated to providing a harassment-free conference experience for everyone, regardless of gender, gender identity and expression, sexual orientation, disability, physical appearance, body size, race, or religion. We do not tolerate harassment in any form."}
        </p>
        <h2 className="text-2xl font-semibold text-white mt-8 mb-4">
          {locale === "zh" ? "预期行为" : "Expected Behavior"}
        </h2>
        <ul className="text-zinc-400 space-y-2 list-disc list-inside">
          <li>{locale === "zh" ? "尊重他人，友善交流" : "Be respectful and considerate in your communications."}</li>
          <li>{locale === "zh" ? "建设性地表达不同意见" : "Express disagreements constructively."}</li>
          <li>{locale === "zh" ? "遵守会场规则和指示" : "Follow venue rules and instructions."}</li>
        </ul>
        <h2 className="text-2xl font-semibold text-white mt-8 mb-4">
          {locale === "zh" ? "不可接受的行为" : "Unacceptable Behavior"}
        </h2>
        <ul className="text-zinc-400 space-y-2 list-disc list-inside">
          <li>{locale === "zh" ? "任何形式的骚扰、恐吓或歧视" : "Harassment, intimidation, or discrimination in any form."}</li>
          <li>{locale === "zh" ? "未经同意的录像或摄影" : "Recording or photography without consent."}</li>
          <li>{locale === "zh" ? "扰乱演讲或活动" : "Disruption of talks or events."}</li>
        </ul>
        <h2 className="text-2xl font-semibold text-white mt-8 mb-4">
          {locale === "zh" ? "举报" : "Reporting"}
        </h2>
        <p className="text-zinc-400">
          {locale === "zh"
            ? "如果您经历或目睹了任何违规行为，请联系大会工作人员或发送邮件至 conference@how2027.org。"
            : "If you experience or witness any violations, please contact conference staff or email conference@how2027.org."}
        </p>
      </div>
    </div>
  )
}
