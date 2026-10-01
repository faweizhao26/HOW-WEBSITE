import type { RegistrationErrorCode } from "./service"

const errors: Record<RegistrationErrorCode, { en: string; zh: string }> = {
  login_required: { en: "Sign in before registering.", zh: "请先登录后报名。" },
  invalid_phone: { en: "Enter a valid phone number with its country code.", zh: "请输入有效手机号，国际号码需包含国家区号。" },
  phone_not_verified: { en: "Verify this phone number before registering.", zh: "请先验证当前手机号。" },
  email_not_verified: { en: "Confirm your account email before registering.", zh: "请先确认账号邮箱。" },
  invalid_code: { en: "The code is incorrect or expired.", zh: "验证码不正确或已过期。" },
  rate_limited: { en: "Too many requests. Please try again later.", zh: "请求过于频繁，请稍后重试。" },
  sms_unavailable: { en: "SMS verification is unavailable. Please contact the organizer.", zh: "短信验证暂不可用，请联系主办方。" },
  phone_in_use: { en: "This phone number is linked to another account.", zh: "该手机号已关联其他账号。" },
  invalid_input: { en: "Check the required fields and ticket selection.", zh: "请检查必填信息和票种选择。" },
  invalid_channel: { en: "The invitation code is invalid or unavailable.", zh: "渠道码无效或已停用。" },
  already_registered: { en: "You already have a registration. Manage it in your profile.", zh: "你已有报名记录，请在个人中心管理。" },
  not_found: { en: "This registration was not found.", zh: "未找到可操作的报名记录。" },
  operation_failed: { en: "The operation failed. Please try again later.", zh: "操作失败，请稍后重试。" },
}

export function registrationErrorMessage(error: RegistrationErrorCode, locale: "en" | "zh") {
  return errors[error][locale]
}
