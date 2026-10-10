import type { CFPErrorCode } from "./service"

export const cfpErrors: Record<CFPErrorCode, { en: string; zh: string }> = {
  account_changed: { en: "Your signed-in account has changed. Reload your proposals before continuing.", zh: "登录账号已变更，请重新加载提案后继续。" },
  login_required: { en: "Please sign in again before submitting.", zh: "请重新登录后提交。" },
  email_not_verified: { en: "Confirm your account email before submitting.", zh: "请先确认账号邮箱，再提交提案。" },
  invalid_input: { en: "Enter a title (up to 200 characters), an abstract (up to 10000 characters) and a supported duration.", zh: "请填写有效标题（最多 200 字）、摘要（最多 10000 字）并选择支持的时长。" },
  load_failed: { en: "Could not load your proposals. Please try again.", zh: "提案加载失败，请重试。" },
  operation_failed: { en: "Could not confirm your submission. Your draft is preserved; please retry.", zh: "暂时无法确认提交结果，草稿已保留，请重试。" },
  request_conflict: { en: "This request no longer matches the saved proposal. Check My Proposals before submitting again.", zh: "本次请求与已保存的提案不一致，请先查看“我的提案”。" },
}
