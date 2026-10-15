import { z } from "zod"
import { requiredSettingsKeys } from "./settings.ts"
import { parseCFPSettings } from "../cfp/settings.ts"
import { parseSiteContent } from "./site-content.ts"
import type { Bilingual } from "./site-content.ts"

export type SettingsIssue = { path: string; label: Bilingual; message: Bilingual }
const names: Record<string, Bilingual> = {
  conference_name: { en: "Conference name", zh: "大会名称" }, conference_date: { en: "Conference dates", zh: "大会日期" },
  conference_location: { en: "Location (English)", zh: "地点（英文）" }, conference_location_zh: { en: "Location (Chinese)", zh: "地点（中文）" },
  contact_email: { en: "Contact email", zh: "联系邮箱" }, hero_title: { en: "Hero title (English)", zh: "首页标题（英文）" }, hero_title_zh: { en: "Hero title (Chinese)", zh: "首页标题（中文）" }, hero_subtitle: { en: "Hero subtitle (English)", zh: "首页副标题（英文）" }, hero_subtitle_zh: { en: "Hero subtitle (Chinese)", zh: "首页副标题（中文）" },
  cfp_enabled: { en: "CFP switch", zh: "征稿开关" }, cfp_deadline: { en: "CFP deadline", zh: "征稿截止日期" }, cfp_types: { en: "Allowed session types", zh: "允许的演讲类型" }, cfp_durations: { en: "Allowed durations", zh: "允许的演讲时长" }, cfp_contact_email: { en: "CFP contact email", zh: "投稿咨询邮箱" },
  cfp_intro: { en: "CFP introduction", zh: "征稿说明" }, cfp_requirements: { en: "Submission requirements", zh: "提交要求" }, cfp_review_notes: { en: "Review notes", zh: "审核说明" },
  site_content: { en: "Page content", zh: "页面内容" }, venue: { en: "Venue", zh: "会场" }, contacts: { en: "Contacts", zh: "联系方式" }, sponsor: { en: "Sponsor email", zh: "赞助邮箱" }, report: { en: "Reporting email", zh: "举报邮箱" },
  home: { en: "Home", zh: "首页" }, about: { en: "About", zh: "关于大会" }, attend: { en: "Attendee guide", zh: "参会指南" }, privacy: { en: "Privacy policy", zh: "隐私条款" }, conduct: { en: "Code of conduct", zh: "行为准则" }, sponsorRecruitment: { en: "Sponsor recruitment", zh: "赞助招募" }, faq: { en: "FAQ", zh: "大会问答" },
  title: { en: "Title", zh: "标题" }, body: { en: "Body", zh: "正文" }, intro: { en: "Introduction", zh: "导语" }, subtitle: { en: "Subtitle", zh: "副标题" }, name: { en: "Name", zh: "名称" }, address: { en: "Address", zh: "地址" }, directions: { en: "Directions", zh: "现场指引" }, imageUrl: { en: "Image URL", zh: "图片链接" }, mapUrl: { en: "Map URL", zh: "地图链接" }, linkUrl: { en: "Document/page URL", zh: "资料或页面链接" }, imageAlt: { en: "Image description", zh: "图片说明" }, linkLabel: { en: "Link label", zh: "链接文字" }, keywords: { en: "Keywords", zh: "关键词" }, answer: { en: "Answer", zh: "答案" }, greeting: { en: "Greeting", zh: "欢迎语" }, enabled: { en: "Visibility", zh: "显示开关" }, confirmed: { en: "Venue confirmation", zh: "会场确认状态" }, en: { en: "English", zh: "英文" }, zh: { en: "Chinese", zh: "中文" },
}
const incomplete = { en: "The content format is incomplete.", zh: "内容格式不完整。" }

function labelFor(path: string[], raw: unknown): Bilingual {
  const words: Bilingual[] = []
  let cursor: unknown = raw
  for (const part of path) {
    if (part !== "pages" && part !== "sections" && part !== "items") {
      if (/^\d+$/.test(part)) {
        const item = Array.isArray(cursor) ? cursor[Number(part)] as { title?: Bilingual } : null
        words.push({ en: `Item ${Number(part) + 1}${item?.title?.en ? ` (${item.title.en})` : ""}`, zh: `第 ${Number(part) + 1} 项${item?.title?.zh ? `（${item.title.zh}）` : ""}` })
      } else words.push(names[part] || { en: part, zh: part })
    }
    cursor = cursor && typeof cursor === "object" ? (cursor as Record<string, unknown>)[part] : null
  }
  return { en: words.map(word => word.en).join(" / "), zh: words.map(word => word.zh).join(" / ") }
}

function issueMessage(issue: z.core.$ZodIssue, path: string): Bilingual {
  if (path.includes("email") || path.startsWith("contacts.")) return { en: "Enter a valid email address.", zh: "请填写有效邮箱。" }
  if (path.endsWith("Url")) return { en: "Use an HTTP(S) URL or a site-relative path.", zh: "请使用有效的 HTTP(S) 链接或站内路径。" }
  if (path === "cfp_deadline") return { en: "Enter a valid calendar date.", zh: "请填写有效的日历日期。" }
  if (issue.code === "too_big") return { en: `Maximum ${issue.maximum} ${issue.origin === "array" ? "items" : "characters"}.`, zh: `最多 ${issue.maximum} ${issue.origin === "array" ? "项" : "字"}。` }
  if (issue.code === "too_small") return { en: "At least one value is required.", zh: "至少填写或选择一项。" }
  if (issue.code === "custom") return { en: "Values or identifiers must not be duplicated.", zh: "选项或编号不能重复。" }
  return incomplete
}

export function getSettingsIssues(settings: Record<string, string>): SettingsIssue[] {
  const issues: SettingsIssue[] = []
  const add = (path: string, message: Bilingual, label = names[path] || { en: path, zh: path }) => { if (!issues.some(issue => issue.path === path)) issues.push({ path, label, message }) }
  for (const key of requiredSettingsKeys) if (!settings[key]?.trim()) add(key, { en: "This field is required.", zh: "此项必填。" })
  if (settings.conference_date && !/^2027([.-])4([.-])16-4([.-])18$/.test(settings.conference_date)) add("conference_date", { en: "Use 2027.4.16-4.18.", zh: "日期须为 2027.4.16-4.18。" })
  if (settings.contact_email && !z.email().safeParse(settings.contact_email).success) add("contact_email", { en: "Enter a valid email address.", zh: "请填写有效邮箱。" })
  const badJSON = new Set<string>()
  for (const key of ["cfp_types", "cfp_durations"]) if (settings[key]) { try { JSON.parse(settings[key]) } catch { badJSON.add(key); add(key, incomplete) } }
  if (!badJSON.size) {
    try { parseCFPSettings(settings) } catch (error) {
      if (error instanceof z.ZodError) for (const issue of error.issues) {
        const mapping: Record<string, string> = { enabled: "cfp_enabled", deadline: "cfp_deadline", sessionTypes: "cfp_types", durations: "cfp_durations", contactEmail: settings.cfp_contact_email ? "cfp_contact_email" : "contact_email", intro: "cfp_intro", requirements: "cfp_requirements", reviewNotes: "cfp_review_notes" }
        let key = mapping[String(issue.path[0])] || "cfp_enabled"
        if (issue.path[1] === "zh") key += "_zh"
        add(key, issueMessage(issue, key), names[key] || { en: `${names[key.replace(/_zh$/, "")]?.en || key} (Chinese)`, zh: `${names[key.replace(/_zh$/, "")]?.zh || key}（中文）` })
      } else add("cfp_enabled", incomplete)
    }
  }
  let raw: unknown = null
  try { raw = settings.site_content ? JSON.parse(settings.site_content) : null; parseSiteContent(settings) } catch (error) {
    if (error instanceof z.ZodError) for (const issue of error.issues) {
      const path = issue.path.map(String)
      add(path.join(".") || "site_content", issueMessage(issue, path.join(".")), path.length ? labelFor(path, raw) : names.site_content)
    } else add("site_content", incomplete)
  }
  return issues
}
