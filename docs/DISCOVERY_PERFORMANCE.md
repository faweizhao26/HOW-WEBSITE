# 搜索分享与首页动效优化

日期：2026-10-19。分支：`codex/site-discovery-performance`，基线：`59b717d`。
状态：已用 `faweizhao26` 推送到工作分支及 `main`，Production 已上线；没有数据库迁移或正式业务写入。
本地预览：<http://127.0.0.1:3040/>，使用专用隔离数据库，不是正式会议资料。

## 变化

- 11 个公开页面分别设置中英文标题、描述、canonical、Open Graph 和 Twitter 分享字段。
  元数据与现有语言 Cookie 一致，不增加读取数据库的请求。
- 增加 `/opengraph-image`：1200×630 PNG，沿用 HOW 2027 绿色品牌，约 50KB；
  不写死会场、日期、人数或尚未确认的参会权益，也不需要请求外部字体服务。
- 增加 `/sitemap.xml`：只列出公开 URL，不含后台、账号、个人中心、投稿及 API。
  不伪造修改时间；现有语言仅由 Cookie 切换，没有独立语言 URL，因此不生成虚假的 hreflang。
- 根布局默认 noindex，公开页面明确启用索引。账号等 HTML 页面允许抓取，以便爬虫读取 noindex
  或登录跳转；`robots.txt` 仅禁止 API 抓取，不把 robots 当成权限控制。
- Preview 环境及 mock 演示环境禁用索引，robots 禁止全部抓取、sitemap 为空。
- 首页画布离屏或标签页隐藏时取消 RAF 并忽略鼠标移动；同时可见才恢复单一循环。
  保留鼠标响应、日夜主题、尺寸变化和运行时减少动态效果设置。
  Observer 按 isIntersecting 判断，避免阈值 0 的边缘相交导致无法恢复。

## 配置

`SITE_URL` 为可选的正式 HTTPS origin，默认 `https://how-website.vercel.app`。
配置时使用正式域名，不要填 localhost 或 Preview 地址；代码会拒绝非 HTTPS、带账号密码、路径或查询参数的值。
以后换自有域名时同步修改并重新部署。
canonical 不依赖请求 Host，不把跟踪参数或账号回调参数带入搜索和分享链接。
描述是页面主题概述，不替代后台发布的会议详情；本批不新增后台 SEO 编辑表单。

## 验收

- `npm test`：206/206；`npm run lint -- --max-warnings=0`：通过。
- 最终生产构建通过，40 个路由，未再出现 metadataBase 回退 localhost 的警告。
- 定向用例先复现离屏仍绘制、隐身/离屏恢复、相交边界及 robots/noindex 冲突，再修复通过。
- Twitterbot User-Agent 实际请求 11 页 × 两种语言共 22 个响应，解析 HTML head：
  标题各页不同、描述存在、canonical/OG URL 正确、语言正确、分享卡片及图片存在，查询参数不进入 canonical。
- 登录和失效重置页实际返回 noindex，未继承首页 canonical 或 localhost 分享图地址。
- sitemap 与 robots 均 HTTP 200；XML 解析确认只有 11 个公开规范 URL。
- PNG HTTP 200、image/png，文件实际宽高 1200×630、50,205 字节，已人工查看。
- ego-lite TaskSpace 15：真实滚动离屏后 300ms 采样绘制次数不变、待执行 RAF 为 0，返回恢复；
  真实后台标签页采样 document.hidden=true、绘制次数不变、待执行 RAF 为 0，返回后为单一循环。
  采用页面内预先采样，避免浏览器检查操作把目标标签页激活而破坏测试条件。
- 鼠标输入验证光晕响应；手机减少动态效果下，300ms 像素不变，日夜切换后像素改变，
  390→430px 调整尺寸仍非空；桌面及手机截图已人工查看。
- 一次独立只读复查发现的相交阈值和 robots/noindex 两项问题均已修复并补回归用例，没有派发重复复查。

浏览器验收使用原有本地隔离服务，先恢复了未启动的 Docker；没有修改正式服务或正式资料。
未重复上一批的账号、报名、附件和数据库并发写入验收，也不声称搜索引擎已实际收录或社交平台缓存已刷新。

## 后续边界

本批仅完成推荐的搜索分享展示与首页动效性能。后台内容准备清单、未引用附件整理、
邮件服务和短信不在本批。本批按用户授权发布；不需要数据库迁移。

## 发布回执

- 功能提交：`8524de9d48c0042f01e0de3849f888d16b311528`，提交及 SSH 推送使用 `faweizhao26`。
- Vercel Production：`dpl_42tPmwshMSNs31gsH3Y8gsAjDDnW`，状态 `READY`，SHA 与功能提交一致，
  正式别名 `how-website.vercel.app` 已分配，aliasError 为空；不是仅 Preview。
- 正式站点实际请求 11 个公开页面 × 中英文共 22 个响应，全部 HTTP 200：
  标题各页不同、描述存在、canonical/OG URL 与正式域名一致且不含查询参数，语言、索引与分享字段正确。
  登录页返回 `noindex, nofollow`，不继承首页 canonical。
- 正式 robots/sitemap 均 HTTP 200，XML 解析为 11 个公开 URL；正式 PNG 为 1200×630、50,205 字节，
  SHA-256 与本地已人工查看的封面一致。
- ego-lite TaskSpace 18 只读检查正式首页真实内容；鼠标光晕响应正常，真实滚动离屏后 300ms
  绘制次数保持 17，返回可见区域后恢复至 32。标签隐藏、减少动态效果和手机矩阵沿用上述本地验收，未冒充生产重测。
  自动化等待最初因装饰元素的可见性判断超时；检查 DOM 确认已就绪后改为等待就绪属性，检查通过。
  TaskSpace 已结束，没有修改正式业务资料。
- 2026-10-19 06:04–06:14 UTC，该功能部署的短时 error/fatal 日志查询未见记录；不是长期监控结论。

本回执随后以文档提交同步，不改变运行代码；后续文档部署不覆盖上述功能部署的验收身份。
