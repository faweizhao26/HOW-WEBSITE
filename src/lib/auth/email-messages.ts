import type { EmailErrorCode } from "./email"

export const emailErrors: Record<EmailErrorCode, { en: string; zh: string }> = {
  invalid_email: { en: "Enter a valid email address.", zh: "请填写有效邮箱。" },
  invalid_password: { en: "Use 8-72 characters for your new password.", zh: "新密码须为 8 至 72 个字符，不能全为空白。" },
  password_mismatch: { en: "The passwords do not match.", zh: "两次输入的密码不一致。" },
  same_password: { en: "Choose a password different from your current password.", zh: "新密码不能与原密码相同。" },
  weak_password: { en: "This password does not meet the account security requirements. Choose a stronger password.", zh: "这个密码不符合账号要求，请换一个更强的密码。" },
  rate_limited: { en: "Too many requests. Please wait before trying again.", zh: "请求过于频繁，请稍后重试。" },
  session_expired: { en: "Your session has expired. Request a new reset link or sign in again.", zh: "登录状态已失效，请重新获取重置链接或登录。" },
  account_changed: { en: "The signed-in account has changed. Open the reset link again for the intended account.", zh: "登录账号已变更，请重新打开需要重置的账号邮件链接。" },
  operation_failed: { en: "Could not complete the request. Your input has been kept; please retry.", zh: "暂时无法完成操作，已保留输入，请重试。" },
  auth_failed: { en: "This link is invalid or expired. Request a new email and open it in the browser where you requested it.", zh: "链接无效或已过期，请重新获取邮件，并在发起请求的浏览器中打开。" },
}
