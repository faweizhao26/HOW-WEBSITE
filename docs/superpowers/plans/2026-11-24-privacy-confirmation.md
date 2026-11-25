# Privacy Confirmation Implementation Plan

**Goal:** 普通浏览不拦截；创建账号、个人报名和团票领取前主动确认隐私条款，默认不勾选。

**Architecture:** 共用原生 checkbox，隐私链接新窗口打开，保留表单内容。注册仍使用浏览器 Supabase SDK 的 PKCE、会话与广播，仅通过网站代理校验 signup 请求；报名和团票领取由网站服务端校验。无新增广告/追踪 Cookie、全站弹窗或数据库迁移。

**Boundary:** 校验作用于网站提交入口，不改变 Supabase 原始公开 signup / RPC 权限，不宣称不可篡改的同意审计。注册 metadata、个人报名 custom_fields 保存确认时间；已有账号及报名不回填。团票领取仍沿用原有原子 RPC 及重试语义。

- [x] 1. 共享确认控件，三个表单默认 false，提交和账号切换保护。
- [x] 2. 网站 signup 代理校验，保留 SDK PKCE、错误与会话处理；个人报名与团票服务端拒绝未确认。
- [x] 3. 定向和完整测试、lint/build、ego-lite 中英文/主题/手机检查，不发送正式邮件或写正式报名。

本地验收和实现边界见 [隐私确认](../../PRIVACY_CONFIRMATION.md)。

本轮不推送、部署或修改正式 Auth 配置。不添加首次访问提示，普通访问不要求同意或新增存储记录。
