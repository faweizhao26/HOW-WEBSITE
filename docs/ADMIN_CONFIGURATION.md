# 后台票务与征稿配置验收

日期：2026-10-14。工作目录为 `admin-reliability/how-2027`，分支
`codex/admin-cfp-settings`。用户已授权两批合并推送；生产已应用新迁移，
具体代码部署结果见 `STATUS.md`，不将本地验收等同于正式业务写入验收。

## 配置契约

新增运营内容编辑位于“站点设置 → 页面内容”，包括会场与专用联系邮箱、
首页栏目、关于大会、参会指南、赞助招募、问答及条款。使用 `site_content`
JSON 键，沿用同一个整版发布快照。栏目可以添加、删除、排序和隐藏，图片和
附件通过受校验的 HTTP(S) 或站内链接维护，不开放 HTML 或任意布局代码。
主协办单位、往届图文及资料可以作为栏目添加，未确定的资料不预填。
专用邮箱留空沿用一般联系邮箱，隐私条款使用一般联系邮箱，行为准则使用举报邮箱。

问答打开或站内导航时读取 `/api/conference-content` 的无缓存已发布版本。
接口错误显示不可用，不使用草稿或继续回答旧事实；日期、会场、征稿状态直接
来自公开配置。普通规则只匹配字面关键词，不执行管理员输入的正则表达式。

票种和渠道码保存即生效；禁用后的票种或渠道不供新报名使用，原报名保留。
名称、说明、代码和关联票种沿用既有后台字段；本批补齐启停和票种排序，
不增加价格、支付、名额、有效期或任意额外表单字段。

征稿使用 `site_settings` 草稿及 `site_settings_releases` 整版快照。
新字段为 `cfp_enabled`、`cfp_deadline`、`cfp_types`、`cfp_durations`，
`cfp_intro`、`cfp_requirements`、`cfp_review_notes` 及各自的 `_zh`，
以及 `cfp_contact_email`。专用邮箱留空时沿用大会联系邮箱。
缺少新字段的历史版本保留原行为：开放征稿、无截止日期、既有全部类型和时长。
设置读取失败不开放新投稿，也不把草稿当作公开版本。

截止日期按北京时间当天结束计算；类型和时长至少各选一项。
关闭和截止只阻止新提案，不隐藏已提交提案；已写入且参数匹配的原请求
仍可恢复结果。管理员在提案/议程管理中录入内容不受公众征稿开关限制。

## 验证证据

- `npm test`：123/123；`npm run lint -- --max-warnings=0`：通过；
  以隔离 Supabase 公开地址重建 Next.js 生产预览：通过。
- `scripts/verify-cfp-settings-db.mjs` 在本地 Docker 数据库真实执行，
  覆盖未发布草稿、关闭、过期、选项限制、旧提案读取和无效发布，最后回滚事务。
  新迁移前“关闭仍允许直写”失败，迁移后通过。
- 新组件行为测试先复现截止后恢复入口消失，修复后原编号、原内容恢复且只显示一次。
  原有账号切换和异步加载隔离测试仍通过。
- ego-lite TaskSpace 33 连接 `127.0.0.1:3034` 和本地 API `127.0.0.1:55421`，
  真实保存启停/排序票种、包含 `+&` 和中文的渠道码；链接正确识别并选中关联票种。
  没有提交测试报名。
- 保存未发布征稿草稿后公开页保持旧版本；发布后关闭；再次开放只允许工作坊
  45 分钟并显示指定日期。普通测试账号真实提交成功，关闭后仍能查看原提案。
  清空类型时发布被拒绝，公开版本不变。
- 三个页面的中英文、日夜及桌面/手机共 24 个显示组合，无检查器发现的
  横向溢出、对比度或坏图问题。人工查看桌面日间和手机夜间截图。
- 在真实 Server Action 的响应阶段断开请求，数据库已保存提案；随后由独立
  管理员客户端发布关闭，原页面更新征稿信息并用恢复按钮找回结果，记录数仍为一。
  390px 手机恢复入口可见，未发生横向溢出。

## 本地复现与清理

仅用于已准备的 `how-publication-stack` Docker 隔离项目，不适用于生产：

```bash
PUBLICATION_TEST_ISOLATED_PROJECT=true node scripts/verify-cfp-settings-db.mjs
PUBLICATION_TEST_ISOLATED_PROJECT=true node scripts/prepare-cfp-settings-qa.mjs
PUBLICATION_TEST_ISOLATED_PROJECT=true node scripts/prepare-cfp-settings-qa.mjs --restart-preview
PUBLICATION_TEST_ISOLATED_PROJECT=true node scripts/prepare-cfp-settings-qa.mjs --cleanup-business
```

首次准备命令拒绝覆盖已有 fixture。启动器在构建和运行时均使用本地公开
Supabase URL/anon key，服务端或浏览器均不接收 service-role key。
仅清理脚本在 Node 中使用本地受信凭证。私有 fixture 为 0600，不能提交到仓库。

本轮 `--cleanup-business` 已恢复原草稿及公开版本，删除自己的测试发布、
票种、渠道码、提案和普通测试账号，并撤销该账号会话。
保留本轮独立管理员及预览供用户查看；已有其他测试 fixture 和账号未修改。
临时截图和 Supabase CLI 临时版本文件已在验收结束后清理。
预览服务器 PID 和保留账号凭据仅在 `/private/tmp/how-cfp-settings-qa.json`。
预览不再需要时只停止该 PID、撤销并删除该独立管理员，再移除该 fixture 和日志；
不要停止其他预览或删除其他测试账号。
