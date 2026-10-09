import type { RegistrationErrorCode } from "./service"

export const registrationMessages: Record<RegistrationErrorCode, { en: string; zh: string }> = {
  login_required: { en: "Please log in again before registering.", zh: "请重新登录后报名。" },
  email_not_verified: { en: "Please confirm your account email before registering.", zh: "请先确认账号邮箱，再提交报名。" },
  invalid_input: { en: "Check the required fields and their lengths.", zh: "请检查必填信息和输入长度。" },
  invalid_phone: { en: "Enter a valid phone number with its country code.", zh: "请输入有效手机号，国际号码请带国家区号。" },
  invalid_ticket: { en: "This ticket is unavailable. Refresh the ticket list.", zh: "该票种不可用，请刷新票种列表。" },
  invalid_channel: { en: "This invitation code is unavailable or does not match the ticket.", zh: "渠道码不可用，或与所选票种不匹配。" },
  already_registered: { en: "You already have a registration. Manage it in your profile.", zh: "你已有报名记录，请前往个人中心管理。" },
  load_failed: { en: "Registration information could not be loaded. Please retry.", zh: "报名信息加载失败，请重试。" },
  operation_failed: { en: "The request could not be completed. Please retry.", zh: "请求未能完成，请重试。" },
}
