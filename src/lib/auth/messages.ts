import type { AuthErrorCode } from "./login"

export const authErrors: Record<AuthErrorCode, { en: string; zh: string }> = {
  invalid_input: { en: "Enter a valid email address and password.", zh: "请填写有效邮箱和密码。" },
  invalid_credentials: { en: "The email or password is incorrect.", zh: "邮箱或密码不正确。" },
  email_not_confirmed: { en: "Confirm your account using the email sent to you before signing in.", zh: "请先通过确认邮件激活账号，再登录。" },
  rate_limited: { en: "Too many attempts. Please wait and try again.", zh: "操作过于频繁，请稍后重试。" },
  auth_failed: { en: "The confirmation link is invalid or expired. Please sign in or open the latest confirmation email.", zh: "确认链接无效或已过期，请登录或打开最新的确认邮件。" },
  operation_failed: { en: "Could not complete the request. Please try again.", zh: "暂时无法完成操作，请重试。" },
}
