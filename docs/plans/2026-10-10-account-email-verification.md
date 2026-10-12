# 账号邮件闭环与正式环境验收

日期：2026-10-10。基线：`fcc2b56`。分支：`codex/account-email-completion`。
本轮功能提交 `7da54c61114b2bf478363d544f9be4d68f73b7b5` 已由 `faweizhao26`
推送到 `main` 和工作分支，Production 已上线。本文另行补充发布验收记录。

## 改动

- 登录页增加找回密码和重发确认邮件入口，保留安全的站内目标地址。
- 新增中英文原生邮件请求、确认和密码重置页面，兼容日夜主题。
- 发送期间防重复提交，成功或限流后等待 60 秒；失败保留输入。
- 首次注册和找回使用 PKCE 服务端回调；重发确认使用默认邮件的 signup
  fragment，并在接收页面立即清除地址中的令牌。支持已配置模板的 token_hash 回调。
- 回调不回退到旧登录状态；过期、缺失、已用及不支持的链接有明确错误。
- 服务端验证当前已确认用户和账号归属，必须收到匹配的更新结果才显示成功。
- 重置前在浏览器刷新临期会话；密码 action 不写 session Cookie，避免旧响应
  覆盖另一标签页的新账号。账号变更时清空密码并停止旧页面操作。

## 已验证

- `npm run build`：34 个路由构建成功；`npm run lint -- --max-warnings=0` 通过。
- 完整测试 106/106 通过，包括实际 SSR Cookie/浏览器刷新测试。
- 隔离 Auth + Inbucket 真实 SMTP：确认邮件、找回邮件、一次性链接、更新密码、
  新密码登录及旧密码失效通过。未使用模拟“邮件发送成功”响应替代真实邮件。
- ego-lite：首次注册 PKCE 返回 `/cfp`、重发确认 fragment 返回 `/cfp`、一次
  重发请求及冷却、找回 PKCE、密码不一致不提交、网络失败保留输入、重复提交
  控制、成功继续、已用链接拒绝、无效确认清除 fragment、跨标签页账号变更保护。
- 浏览器真实临期会话测试：提交前发生 refresh 请求，密码更新成功，Cookie 为新会话。
- 对浏览器实际更新的隔离账号再次调用真实 Auth：新密码登录成功，旧密码被拒绝。
- 新账号页面 32 种组合，加可用重置表单 8 种组合，共 40 项：无溢出、低对比度、
  缺图或运行时报错。检查了桌面日间与手机夜间截图。
- 正式网站登录、注册、个人中心、报名 32 种显示组合通过。首次报名检查因采样
  早于加载而误报，修正等待 h1 后该页 8 项重新通过。后台只读打开成功。
- 正式投稿页另外 8 种显示组合通过，共 40 项生产显示检查；未提交提案。
- 发往 `faweizhao26@gmail.com` 的正式找回邮件请求返回 HTTP 200；未点击链接，
  未更改该账号密码。之前 plus-address 探针未创建任何账号。

## 剩余边界

- 用户提供截图后已确认收到网站重置邮件：主题 `Reset Your Password`，发件人
  `Supabase Auth <noreply@mail.app.supabase.io>`，时间为 2026-10-10 15:22。
  此证据更正此前“未收到”的判断；默认 Supabase 邮件身份曾造成识别混淆。
- 只读复查：网站账号 `recovery_sent_at` 为 `2026-10-10 07:22:26.374987+00`；
  同时段统一 Auth 日志有该地址的 `user_recovery_requested`、`POST /recover` 200
  和 `mail.send`，发件人为 `noreply@mail.app.supabase.io`。这些只证明 Auth 已执行
  发送。Gmail 收件由用户截图另外证明；该窗口未见 SMTP 错误日志。
- 用户点击后最终 URL 的 origin 为 `http://localhost:3000`，path 为 `/`，类型为
  `recovery`，无法访问。只记录域名、路径和流程类型，不保存任何会话令牌。
  这与 Auth 日志中的 `referer` 一致，生产回调未生效已确认。
- 用户登录后在 ego-lite 控制台确认：Site URL 为 `http://localhost:3000`，Redirect
  URLs 为空。已保存 Site URL `https://how-website.vercel.app/`，新增该正式域名的
  `/auth/callback` 和 `/auth/confirm` 两个精确路径；重新加载后确认配置持久保存。
- 密码重置和注册确认模板均为默认 `.ConfirmationURL`，没有硬编码 localhost，未改模板。
- 2026-10-10 08:09 UTC 以固定无效验证码 GET `/auth/v1/verify` 验证实际配置：
  recovery 指定 callback、`next=%2Fcfp` 和 `flow=recovery` 时 HTTP 303 指向正式域名的
  原 callback 并保留参数；不指定 redirect 时 HTTP 303 指向正式首页。
  两个探针均为预期的 `otp_expired`，仅验证域名选择，不代表真实令牌交换成功。
- 本次没有再次发邮件，没有修改密码、现有用户或正式业务数据；只修改上述生产 Auth URL 配置。
- 用户确认发布后，SSH 身份及提交作者均为 `faweizhao26`；远端 `main` 从基线
  快进到功能提交，没有强制推送。Vercel 部署 `dpl_CCw8VSTK3fTEgzMNze67GboEgNuM`
  为 Production、`READY`、相同 SHA，alias 包含 `how-website.vercel.app` 且无 alias 错误。
- 正式新增找回、重发、重置页面共 24 种设备/语言/主题组合通过；人工查看桌面日间
  和手机夜间截图。真实页面失效 callback 返回重置错误状态，保留 `/cfp` 目标，
  即使有旧会话也不显示密码表单。命令行 curl 对正式站点连接超时，改由 ego-lite 实际验证。
- 2026-10-10 08:18:12 UTC（16:18 上海）从正式原生找回表单请求一次新邮件，
  实际 `/auth/v1/recover` HTTP 200；请求使用正式 `/auth/callback?next=%2Fcfp&flow=recovery`，
  页面显示成功和 60 秒冷却。保留发起浏览器的 PKCE 状态；用户随后确认新邮件打开后
  能看到重置密码表单，收信及链接跳转验收通过。此结论依据用户反馈，未读取链接中的令牌。
  没有再次使用旧链接，没有修改该用户密码。HTTP 200 不等于收件和密码更新验收通过。
- 新功能已部署，新邮件收信和打开原生重置表单已验收；实际密码变更、新密码登录及
  新账号邮箱确认的生产验收仍待完成，不把用户看到表单当成密码更新成功。
- 本轮不新增正式报名、提案，不改变后台内容，也不修改现有用户资料。
- 头像真实 Storage 验收及迁移记录核对已在独立后续批次完成，证据见
  `../superpowers/plans/2026-10-10-avatar-storage-and-migrations.md`；不计入本邮件批次。
  正式会议资料补全及延期短信仍在 `../STATUS.md` 单独记录。

## 2026-10-11 正式邮件验收续验（延期，已清理）

基线为问答发布回执 `f050ff2`，本轮没有改运行代码或生产 Auth 配置。
ego-lite TaskSpace 25，`p1` 为生产控制台，`p2` 为正式站点的测试流程；本轮已结束并清理。

- 从正式 `/auth/register?redirect=%2Fcfp` 提交一次独立测试注册，地址为
  `faweizhao26+how-email-qa-20261011@gmail.com`，不是现有主账号。
  2026-10-11 13:22:50 UTC（21:22 上海）实际 `/auth/v1/signup` 返回 HTTP 200，
  页面进入保留 `/cfp` 目标的登录页。
- 生产只读查询确认新测试用户 `ebd08e0f-c340-418c-974e-135a9d34249d` 实际创建，
  `confirmation_sent_at` 为 `2026-10-11 13:22:50.153184+00`，当次读取时
  `email_confirmed_at` 为 null。HTTP 200 和该时间戳不证明 Gmail 已收件。
- 用测试账号实际登录一次，Auth 返回 HTTP 400、`email_not_confirmed`，
  页面显示“请先通过确认邮件激活账号，再登录。”未显示成功，未改变原账号密码或退出原账号。
- 控制台再次确认 Site URL 为正式域名，回调白名单仍为正式 `/auth/callback` 和
  `/auth/confirm` 两条；未保存或修改配置。
- 邮件控制台明确显示正在使用内置邮件服务，SMTP 开关 `aria-checked=false`。
  [当前官方 SMTP 文档](https://supabase.com/docs/guides/auth/auth-smtp)说明该服务
  限制团队成员收件，且不用于生产应用。本次主邮箱别名的注册请求成功，不能据此认为
  普通参会者邮箱可收信；公开注册前仍需接入自定义 SMTP，并另验非团队邮箱投递。
- 用户已明确确认收到本次 `Confirm Your Signup` 邮件，测试别名收件验收通过；
  此结论不扩展为非团队邮箱投递通过，不要求其把包含凭证的链接发到聊天。
  用户随后打开旧邮件并反馈“确认链接无效或已过期”；在同一 TaskSpace 接管确认结果页
  `p3`，实际 fragment 仅包含错误信息，Auth 返回 `otp_expired` / `access_denied`，
  没有会话令牌。14:44 UTC 生产查询确认测试账号仍未激活、未登录；原邮件发出已超过
  80 分钟。该错误来自 Auth 验证阶段，不把它误判为已激活用户的 PKCE 交换失败。
  未重放旧链接、未绕过邮箱确认、未修改 Auth 的有效期设置。
- 14:46:18 UTC（22:46 上海）通过正式重发确认页面提交一次测试邮箱请求，
  `/auth/v1/resend` 返回 HTTP 200，页面显示发送提示与 60 秒冷却，保留 `/cfp` 目标。
  HTTP 200 本身不等于本次新邮件收件或激活成功。
- 用户再次反馈“还是无效”后，只读查询显示 `confirmation_sent_at` 已为
  `2026-10-11 14:48:30.649143+00`，`email_confirmed_at` 为
  `2026-10-11 14:49:34.412823+00`，`last_sign_in_at` 为
  `2026-10-11 14:49:34.420507+00`。同一浏览器 `p4` 实际位于 `/cfp`，
  显示投稿表单、无错误，当前会话归属独立测试账号。邮箱确认及回到投稿页已通过。
  另一个 `p5` 为没有 fragment 或验证凭证的 `/auth/confirm?redirect=%2Fcfp`，
  显示失效提示；不推断用户如何产生该页，也不以它否定已经成功的确认流程。
- 随后从正式登录表单使用测试账号的初始密码实际登录，Auth 返回 HTTP 200，
  页面进入 `/cfp`；密码登录通过，未提交提案。
- 14:59:18 UTC（22:59 上海）从正式找回表单请求一次测试账号重置邮件，
  实际 `/auth/v1/recover` POST 返回 HTTP 429，错误码 `over_email_send_rate_limit`，
  页面显示“请求过于频繁，请稍后重试。”没有显示发送成功，也未重复请求。
  本次邮件未发出，生产真实密码更新及新密码登录仍待验收。
- 已仅针对正式域名恢复验收前保存的原账号会话 Cookie，并重新打开 `/profile`：
  显示个人中心，Cookie 中用户 ID 与原会话一致，当前不是测试账号。
  没有清空浏览器或其他站点 Cookie，没有更改任何现有用户密码。
- 用户明确暂缓正式邮件接入。本轮未新增报名、提案或会议内容，未购买域名、
  创建服务账号、启用 SMTP 或改变生产邮件模板；真实密码更新仍未验收。
- 清理前查询确认仅有测试用户 1、资料 1、Auth 会话 2，报名、投稿及 Storage 对象均为 0。
  以测试 UUID 和测试邮箱共同限定，撤销两个测试会话，再从 Auth 控制台删除该测试账号。
  后续生产查询确认测试用户、资料、Auth 会话、刷新凭据、报名、投稿和 Storage 对象均为 0，
  主账号仍存在。权限 0600 的私有 fixture 已删除，不保留测试密码或原会话备份。
- 最后重新打开 `/profile`，显示个人中心，当前会话仍为原主账号；未改其密码或资料。
  TaskSpace 25 已结束，保留恢复原登录后的个人中心页；用户来源页面释放而非关闭。

## 本地邮件 API 复验（历史记录）

`scripts/verify-account-email-api.mjs` 只接受明确标记为隔离环境的 localhost
Auth URL；需要 `PUBLICATION_TEST_SUPABASE_URL`、`PUBLICATION_TEST_SUPABASE_ANON_KEY`
和 `PUBLICATION_TEST_SUPABASE_SERVICE_ROLE_KEY`。收件箱为本地 Inbucket `55624`。
脚本只创建自己的测试账号，默认结束即清理；`EMAIL_QA_KEEP_FIXTURES=true` 才保留
权限 0600 的私有 fixture，`EMAIL_QA_CLEANUP=true` 只清理该 fixture 列出的账号。
本轮生成的测试账号、收件箱和私有 fixture 已清理。

ego-lite 报告位于 `/private/tmp/how-email-pages-qa/report.json`、
`/private/tmp/how-email-reset-form-qa/report.json` 和
`/private/tmp/how-email-production-register-final/report.json`；这些临时截图不是生产数据备份。
上线后新增 `/private/tmp/how-email-production-release/report.json`：24/24 显示检查通过。
