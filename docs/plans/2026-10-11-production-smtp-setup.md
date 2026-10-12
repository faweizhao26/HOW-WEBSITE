# 正式账号邮件服务接入

日期：2026-10-11。状态：用户明确暂缓正式邮件接入；尚未接入，不购买域名或创建服务账号。

## 已核实

- Vercel 项目 `prj_2h1D6HkgwlIX8LcEE3xJtmAlnVh1` 的 Production 域名查询
  只返回 `how-website.vercel.app`，没有绑定自有域名。这不表示主办方没有其他域名。
- Supabase 项目 `uhhgcecvxzqvwpwiardu` 的 SMTP 设置页实际开关为 false，
  本次只读查看，未启用、填写或保存。
- 独立测试账号已完成邮箱确认及密码登录；找回邮件请求实际返回 HTTP 429、
  `over_email_send_rate_limit`。详细证据见 `2026-10-10-account-email-verification.md`。
- 未创建邮件服务账号、购买域名、修改 DNS、改邮件模板或启用付费套餐。

## 用户选择与剩余条件

使用 Resend SMTP，先用免费额度完成接入与验收。2026-10-11 核对的官方价格为
每月 3,000 封、每日 100 封；活动集中报名是否需要升级取决于实际峰值，免费额度
不是不限量承诺。域名注册费另计，已有可授权域名时无需为邮件另买域名。

用户已回复没有可修改 DNS 的自有域名、没有邮件服务账号，选择先用 Resend 免费额度。
随后明确选择“暂缓正式邮件接入”。下述参数仅作为恢复工作时的参考，不继续执行。
下一步需决定获取主办方已有域名的授权子域名，或购买自有域名；没有授权购买或产生费用。
域名明确后创建免费服务账号并验证 DNS，网站可以继续使用当前 Vercel 地址。
Resend 要求验证自有域名，不能把 Gmail 或 Vercel 的共享域名当成自有发信域名。
其 `resend.dev` 测试域名仅允许发往服务账号邮箱，不能作为公开注册的生产发信方案。
不把生产 SMTP 切到该测试域名；用户重新决定接入并确定域名方案后，才能继续正式接入。

本轮独立邮件测试账号、资料、会话及私有 fixture 已清理，原账号登录已恢复。
恢复验收时重新创建独立测试账号，不重复使用已删除账号或旧邮件链接。

## 接入参数

| 参数 | 值或来源 |
| --- | --- |
| Sender name | 建议 `HOW 2027` |
| Sender email | 待确定；必须属于已验证发信域名 |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | Resend API key，直接填入 Supabase 控制台，不保存到本文件或前端环境变量 |
| DNS | 以服务商为选定域名生成的记录为准；不提前编造 DKIM/SPF 记录，不覆盖原有邮箱 MX |
| Link tracking | 认证邮件关闭链接跟踪，保留 Supabase 原始确认链接 |

已有其他可用 SMTP 服务时，采用其真实参数，不要求重复购买或迁移。
Supabase SMTP 配置接管 Auth 邮件投递，不需要另写前端发送接口或部署新的邮件代理。
生产 Site URL、回调白名单及默认 `.ConfirmationURL` 模板保持不变。

## 完成标准

1. 发信域名验证通过，再保存 SMTP；重新加载确认配置已持久保存。
2. 核对 Supabase 与服务商各自的发送限额，按确认的报名峰值设置；不直接改为不限量。
3. 使用独立测试账号完成真实找回收件、打开重置表单、更新密码、新密码登录、旧密码拒绝。
4. 使用经授权的非 Supabase 团队邮箱完成注册收件及确认；服务商发送日志不能替代实际收件。
5. 恢复原账号会话，撤销测试会话，删除测试用户与资料，并删除私有 fixture。

## 官方依据

- [Supabase 自定义 SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Resend 与 Supabase SMTP 接入](https://resend.com/docs/send-with-supabase-smtp)
- [Resend 域名验证](https://resend.com/docs/dashboard/domains/introduction)
- [Resend 测试域名收件限制](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain)
- [Resend 价格及额度](https://resend.com/pricing)
