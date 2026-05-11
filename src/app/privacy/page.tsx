"use client"

import { useState } from "react"

function getLocaleFromCookie(): "en" | "zh" {
  if (typeof document === "undefined") return "en"
  const match = document.cookie.match(/(?:^|;\s*)lang=([^;]*)/)
  return match?.[1] === "zh" ? "zh" : "en"
}

const content = {
  title: { en: "Privacy Policy", zh: "隐私条款" },
  effective: { en: "Effective Date: May 2026", zh: "生效日期：2026 年 5 月" },
  sections: [
    {
      title: { en: "1. Information We Collect", zh: "1. 我们收集的信息" },
      body: {
        en: "When you register for HOW 2027, we collect your name, email address, phone number, company, and position. When you submit a proposal, we collect the session title, abstract, and speaker information.",
        zh: "当您注册 HOW 2027 时，我们收集您的姓名、邮箱地址、手机号码、公司和职位。当您提交演讲提案时，我们收集演讲标题、摘要和讲者信息。",
      },
    },
    {
      title: { en: "2. How We Use Your Information", zh: "2. 我们如何使用您的信息" },
      body: {
        en: "Your information is used solely for conference-related purposes: registration confirmation, agenda management, check-in, and communication about the event. We do not sell or share your personal data with third parties.",
        zh: "您的信息仅用于会议相关目的：报名确认、议程管理、签到以及与活动的沟通。我们不出售或与第三方共享您的个人数据。",
      },
    },
    {
      title: { en: "3. Data Storage and Security", zh: "3. 数据存储和安全" },
      body: {
        en: "Your data is stored on Supabase cloud infrastructure with encryption at rest and in transit. We implement reasonable security measures to protect your personal information.",
        zh: "您的数据存储在 Supabase 云基础设施上，采用静态加密和传输加密。我们采取合理的安全措施来保护您的个人信息。",
      },
    },
    {
      title: { en: "4. Cookies", zh: "4. Cookie 使用" },
      body: {
        en: "We use essential cookies for authentication and language preferences. No tracking or advertising cookies are used.",
        zh: "我们使用必要的 Cookie 用于身份验证和语言偏好设置。不使用追踪或广告 Cookie。",
      },
    },
    {
      title: { en: "5. Your Rights", zh: "5. 您的权利" },
      body: {
        en: "You have the right to access, correct, or delete your personal data. You can manage your profile information at any time through the Profile page. To request data deletion, contact us at the email below.",
        zh: "您有权访问、更正或删除您的个人数据。您可以随时通过个人中心页面管理您的资料信息。如需删除数据，请通过下方邮箱联系我们。",
      },
    },
    {
      title: { en: "6. Contact", zh: "6. 联系方式" },
      body: {
        en: "If you have questions about this privacy policy, please contact us at conference@how2027.org.",
        zh: "如对本隐私条款有疑问，请联系 conference@how2027.org。",
      },
    },
  ],
}

export default function PrivacyPage() {
  const [locale] = useState<"en" | "zh">(getLocaleFromCookie())

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-4xl font-bold mb-4">{content.title[locale]}</h1>
      <p className="text-zinc-500 mb-10">{content.effective[locale]}</p>

      <div className="space-y-8">
        {content.sections.map((section, i) => (
          <div key={i}>
            <h2 className="text-xl font-semibold text-white mb-3">{section.title[locale]}</h2>
            <p className="text-zinc-400 leading-relaxed">{section.body[locale]}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
