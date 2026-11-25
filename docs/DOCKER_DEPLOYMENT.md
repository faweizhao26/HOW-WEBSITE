# HOW 2027 Docker 部署

`Dockerfile` 使用 Node.js 22 和 Next.js standalone 输出，只在 Docker 构建时启用
standalone。容器以非 root 用户运行，监听 3000 端口，包含服务端路由及静态资源。
普通 `npm run build` 和现有 Vercel 构建不变。

## 正式镜像

在 2026 服务器或同架构的 Linux 构建环境拉取源码，检出
`codex/docker-deployment` 或要部署的提交。
在 shell 中设置以下三个变量，不要将部署配置提交到 Git：

- `NEXT_PUBLIC_SUPABASE_URL`：现有 HOW 2027 Supabase 项目的 HTTPS 地址。
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`：同一项目的公开 anon key，绝不是 service-role key。
- `SITE_URL`：2027 站的完整 HTTPS 源地址，如 `https://how2027.example.org`，不能带路径。

构建时传入配置，默认使用正式数据模式：

```sh
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY \
  --build-arg SITE_URL \
  -t how-2027:release .
docker run -d --name how-2027 --restart unless-stopped \
  -p 127.0.0.1:3027:3000 how-2027:release
```

以上变量须用 `export` 导出后执行构建。`NEXT_PUBLIC_*` 会在编译时写入客户端，
更换 Supabase 项目须重建镜像；更换对外域名也重建，确保静态 sitemap/robots
与页面元数据一致。本次继续使用原 Supabase，不需要把数据库、Auth 或媒体存储装进容器。
如在另一台机器构建，镜像平台必须匹配部署服务器：`x86_64` 对应
`linux/amd64`，`aarch64` 对应 `linux/arm64`。也可直接在服务器原生构建。

## 并行使用现有服务器

1. 先确认 `3027` 未占用，或选择另一个空闲端口；保留 2026 站原端口和配置。
2. 为 2027 站单独配置 HTTPS 域名，将请求反代到 `127.0.0.1:3027`。
   反代保留公网主机名和协议。以下是放入 2027 站 HTTPS 配置的 Nginx 示例：

```nginx
location / {
    proxy_pass http://127.0.0.1:3027;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Port $server_port;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_buffering off;
}
```

3. 在 Supabase Auth 的 Redirect URLs 追加新域名的 `/auth/callback` 和
   `/auth/confirm`，保留 Vercel 的旧地址直到完成切换。确认注册、找回密码
   不跳回旧域名，后台复制的渠道码链接使用当前域名。
4. 用新域名检查首页、`/privacy`、`/api/conference-content`、登录、报名与后台。
   使用测试账号验证真实邮件及报名；同一个正式 Supabase 的注册、报名和管理写入
   会影响同一份数据。暂不切流时保留原 Vercel 站。

## 无正式数据的镜像检查

```sh
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://backend.example.test \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=local-build-check \
  --build-arg NEXT_PUBLIC_CONTENT_MODE=mock \
  --build-arg SITE_URL=https://how2027.example.test \
  -t how-2027:docker-qa .
docker run --rm -p 127.0.0.1:3027:3000 how-2027:docker-qa
```

打开 `http://127.0.0.1:3027/`、`/privacy` 和 `/auth/register` 检查页面。
mock 镜像只用于检查容器和 UI，不支持真实邮件或报名，不用于正式部署。

2026-11-25 已在本机实测 `linux/arm64` 镜像构建和运行，页面、公开 API、
CSS、分享图、反代回调及隐私拦截通过，确认容器使用非 root 用户。
未在 2026 服务器运行，未验收正式域名、实际邮件或报名数据。
