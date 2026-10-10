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
  页面显示成功和 60 秒冷却。保留发起浏览器的 PKCE 状态，待用户收信并在同一 ego-lite 打开。
  没有再次使用旧链接，没有修改该用户密码。HTTP 200 不等于收件和密码更新验收通过。
- 新功能已部署，但完整密码重置和新账号邮箱确认的生产验收仍待完成。
- 本轮不新增正式报名、提案，不改变后台内容，也不修改现有用户资料。
- 真实头像 Storage 上传、生产迁移记录核对、正式会议资料补全、延期短信继续
  保留在 `../STATUS.md`，不当成此次邮件功能已经完成的项目。

## 本地邮件 API 复验

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
