import { contentText, parseSiteContent } from "./site-content.ts"
import type { SiteContent } from "./site-content.ts"
import { formatConferenceDateRange } from "../conference.ts"
import { getCFPState, parseCFPSettings } from "../cfp/settings.ts"
import { getRegistrationOptions } from "../registration/settings.ts"

export type FAQPublishedContent = { settings: Record<string, string>; content: SiteContent }

export function getBrowsableFAQ(locale: "en" | "zh", published: FAQPublishedContent) {
  const topics = [
    { id: "dates", query: "date", en: "When and where is HOW 2027?", zh: "大会何时、在哪座城市举办？" },
    { id: "venue", query: "venue", en: "Where is the venue?", zh: "具体会场和地址在哪里？" },
    { id: "registration", query: "register", en: "How do I register and choose a ticket?", zh: "如何报名，票种和费用在哪里查看？" },
    { id: "cfp", query: "cfp", en: "How can I submit a proposal?", zh: "如何投稿，征稿是否开放？" },
    { id: "sponsorship", query: "sponsor", en: "How can I sponsor the conference?", zh: "如何联系赞助合作？" },
    { id: "contact", query: "contact", en: "How can I contact the organizers?", zh: "如何联系大会主办方？" },
  ]
  const labels: Record<string, { en: string; zh: string }> = {
    food: { en: "What are the meal and coffee-break arrangements?", zh: "餐饮和茶歇如何安排？" },
    transport: { en: "How can I travel to the venue?", zh: "如何到达会场？" },
    hotel: { en: "Are there recommended hotels?", zh: "有推荐酒店或住宿信息吗？" },
    stream: { en: "Will there be an online livestream?", zh: "是否提供线上直播？" },
    community: { en: "How can I follow the community and conference updates?", zh: "如何关注社区及大会动态？" },
    conduct: { en: "What is the conference code of conduct?", zh: "参会需要遵守哪些行为规范？" },
  }
  const facts = topics.map(topic => ({ id: `builtin:${topic.id}`, question: topic[locale], answer: getConferenceAnswer(topic.query, locale, published) }))
  const custom = published.content.faq.items.filter(item => item.enabled && contentText(item.answer, locale).trim()).map(item => ({
    id: `custom:${item.id}`,
    question: labels[item.id]?.[locale] || item.keywords.find(keyword => locale === "zh" ? /\p{Script=Han}/u.test(keyword) : !/\p{Script=Han}/u.test(keyword)) || item.keywords[0],
    answer: contentText(item.answer, locale),
  }))
  return [...facts, ...custom]
}

export async function loadConferenceFAQ(fetcher: typeof fetch = fetch, signal?: AbortSignal): Promise<FAQPublishedContent> {
  const response = await fetcher("/api/conference-content", { cache: "no-store", signal })
  if (!response.ok) throw new Error("faq_unavailable")
  const result = await response.json()
  if (result.status !== "ready" || !result.settings || typeof result.settings.contact_email !== "string") throw new Error("faq_unavailable")
  return { settings: result.settings, content: parseSiteContent({ site_content: JSON.stringify(result.content) }) }
}

export function getConferenceAnswer(question: string, locale: "en" | "zh", published: FAQPublishedContent | null): string {
  const zh = locale === "zh"
  if (!published) return zh ? "大会信息暂时无法加载，请稍后查看对应页面。" : "Conference information is temporarily unavailable. Please check the relevant page later."
  const { content, settings } = published
  const contact = settings.contact_email || ""
  const q = question.toLowerCase()
  if (/time|date|schedule|when|举办时间|时间|日期|什么时候|agenda|议程/.test(q)) {
    const date = formatConferenceDateRange(settings.conference_date, locale)
    const city = zh ? settings.conference_location_zh : settings.conference_location
    return zh ? `大会日期：${date}。地点：${city || "待公布"}。最新议程请查看议程页面。` : `Conference dates: ${date}. Location: ${city || "TBA"}. See the Schedule page for the latest published program.`
  }
  if (/venue|location|where|place|address|地点|哪里|在哪|地址|会场/.test(q)) {
    if (!content.venue.confirmed) return zh ? "会场待公布。具体地址和现场指引将在确认后更新到会场页面。" : "Venue to be announced. The address and directions will appear on the Venue page once confirmed."
    return [contentText(content.venue.name, locale), contentText(content.venue.address, locale), contentText(content.venue.directions, locale)].filter(Boolean).join("\n")
  }
  if (/cfp|submit|proposal|speak|talk|session|议题|投递|演讲|提交|投稿/.test(q) && !/speaker|讲者|讲师|嘉宾/.test(q)) {
    try {
      const policy = parseCFPSettings(settings)
      if (getCFPState(policy) !== "open") return zh ? "征稿已关闭或已截止，已提交提案仍可在投稿页查看。" : "CFP is closed or the deadline has passed. Existing proposals remain available on the CFP page."
      const deadline = policy.deadline ? `${policy.deadline} 23:59 (UTC+8)` : zh ? "待公布" : "TBA"
      return zh ? `征稿开放中。截止日期：${deadline}。允许时长：${policy.durations.join("、")} 分钟。投稿类型及要求请查看投稿页。` : `CFP is open. Deadline: ${deadline}. Allowed durations: ${policy.durations.join(", ")} minutes. See the CFP page for types and requirements.`
    } catch { return zh ? "征稿信息暂时无法加载，请查看投稿页。" : "CFP information is temporarily unavailable. Please check the CFP page." }
  }
  if (/speaker|讲者|讲师|嘉宾|谁.*来|who.*speak/.test(q)) return zh ? "已公布的讲者请查看讲者页面，演讲内容和时间以议程页面的最新发布版本为准。" : "The Speakers page lists announced speakers. Check the Schedule page for their published sessions and times."
  if (/sponsor|赞助/.test(q)) return zh ? `赞助咨询请联系 ${content.contacts.sponsor || contact}，合作安排以赞助商页面为准。` : `For sponsorship, contact ${content.contacts.sponsor || contact}. See the Sponsors page for current details.`
  if (/contact|email|联系|邮件|help|support/.test(q)) return zh ? `大会咨询请联系 ${contact}。` : `For conference questions, contact ${contact}.`
  if (/register|sign.?up|ticket|price|cost|free|paid|报名|注册|票|费用|价格|多少钱|收费|免费/.test(q)) {
    const { onsite, externalUrl } = getRegistrationOptions(settings)
    if (externalUrl && onsite) return zh ? "点击报名入口，可选择站内或站外报名。票种和费用以所选平台为准。" : "Select Register to choose between this site and the external platform. Ticket terms depend on the option you choose."
    if (externalUrl) return zh ? "点击报名入口前往指定平台，票种和费用以该平台为准。" : "Select Register to continue to the external platform for tickets and pricing."
    if (onsite) return zh ? "登录后可在报名页面完成报名。票种、费用及渠道码要求以报名页面当前说明为准。" : "Sign in and use the Register page. Current ticket terms, costs and channel-code requirements are shown there."
    return zh ? "大会报名暂未开放。" : "Conference registration is not currently open."
  }
  if (/cancel|refund|取消|退款/.test(q)) return zh ? `您可以在个人中心取消报名。退款问题请联系 ${contact}。` : `You can cancel registration on your Profile page. Contact ${contact} for refund questions.`
  for (const item of content.faq.items) {
    if (item.enabled && item.keywords.some(keyword => q.includes(keyword.toLowerCase()))) return contentText(item.answer, locale)
  }
  return zh ? `暂未找到相关信息，请查看对应页面或联系 ${contact}。` : `No matching information was found. Check the relevant page or contact ${contact}.`
}
