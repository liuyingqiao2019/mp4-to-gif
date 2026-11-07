# 搜索引擎收录与 AI 搜索

生产地址：https://tools-mp4togif.tangmenjue.top/

## 本次改动

- 首页增加明确的标题、描述、canonical、Open Graph 与 WebApplication JSON-LD。
- 首页原始 HTML 包含 H1、使用步骤及常见问题，爬虫无需运行 JavaScript 即可读取说明。
- robots.txt 允许公开页面抓取（包括未被其他规则单独限制的 OAI-SearchBot），排除转换 API；sitemap.xml 仅包含首页。
- 服务端显式提供 TXT/XML 路由及正确的 MIME 类型，并支持静态资源 HEAD 请求。
- API 与转换结果返回 X-Robots-Tag: noindex, nofollow。robots.txt 不是访问控制；本次未增加登录或文件权限机制。
- 文案说明服务端上传、文件清理与大小目标可能无法达到，不宣称无损或纯本地处理。

域名改变时，请同步更新 public/index.html 中 canonical、Open Graph、JSON-LD 的 URL，以及 public/robots.txt 和 public/sitemap.xml。

## 部署

先审查并合并这次修改，再在现有服务器项目目录执行：

```bash
cd /home/tangjue/mp4-to-gif
git status --short
git diff -- Dockerfile compose.yaml public/index.html server.mjs
```

如果服务器有本地修改（例如软件源、Dockerfile 或 Compose 设置），先保留并整合这些修改，不要直接 reset --hard 或覆盖整个项目。只有工作区干净且处于 main 时，才使用：

```bash
git pull --ff-only origin main
docker compose up -d --build gif
```

保持已有 .env、PUBLIC_ORIGIN、web-proxy 网络和 Caddy 反向代理配置。此次新路由由应用提供，现有整站反代通常不需要改 Caddy。构建和重建容器请安排在没有正在转换的任务时进行；服务启动会清理遗留任务文件。

检查部署：

```bash
curl -I https://tools-mp4togif.tangmenjue.top/
curl -i https://tools-mp4togif.tangmenjue.top/robots.txt
curl -i https://tools-mp4togif.tangmenjue.top/sitemap.xml
```

确认首页、robots.txt、sitemap.xml 均返回 200；后两者分别返回文本和 XML，而不是首页 HTML。检查页面源代码是否包含新标题与 canonical。

## 需要站长本人完成的验证与提交

1. 百度搜索资源平台：https://ziyuan.baidu.com/ 。添加本网站，按实际提供的方法验证归属。如果使用 HTML 标签验证，将平台给出的完整 meta 标签加入首页 head；如果使用验证文件，当前服务器采用路由白名单，仅把文件放进 public 还不够，必须同时为该文件添加精确路由。验证通过后保留标签或文件，避免定期复验失败。
2. 百度“普通收录”：按账号实际开放的功能与配额提交首页 URL 或 sitemap.xml。没有 Sitemap 权限时，使用后台可用的手动提交或 API 推送。提交不保证收录。
3. Bing Webmaster Tools：https://www.bing.com/webmasters/ 。添加并验证网站，提交 https://tools-mp4togif.tangmenjue.top/sitemap.xml ，通过 URL 检查查看首页抓取情况。
4. Google Search Console：https://search.google.com/search-console/ 。添加该 HTTPS URL 前缀资源或通过 DNS 验证根域资源。提交 sitemap.xml，然后对首页执行网址检查并请求编入索引。
5. 通过站长后台查看抓取、索引、展现与点击；不要仅凭 site: 查询是否返回结果判断是否收录。检查服务器日志中的爬虫访问和失败状态。

无需提供账号密码。需要协助添加验证时，提供平台公开的验证标签或验证文件即可；API 推送 token 仅保存在服务器环境中，不提交到 Git。

## AI 搜索与后续内容

OAI-SearchBot 用于 ChatGPT 搜索，GPTBot 用于可能的模型训练，两者独立。当前通用抓取规则没有单独禁止任何训练爬虫；是否允许训练可另行配置，不是被搜索发现的前提。除 robots.txt 外，还要确保实际 CDN、防火墙没有拦截搜索爬虫。

不把 llms.txt 当作收录门票。Google 的 AI 搜索说明强调可抓取、可索引、有价值的可见内容，并不要求专用 AI 文本文件。没有设置能够保证 ChatGPT、百度或其他 AI 必然推荐网站。

后续适合制作经过实际测试的教程：如何在原始尺寸下缩小 GIF、不同帧率的文件体积与流畅度对比、为什么 GIF 比 MP4 大。使用真实样例和数据，并在相关社区或自己的项目介绍中自然链接本网站；不要批量堆砌关键词或虚构评价。

## 官方参考

- 百度普通收录：https://ziyuan.baidu.com/linksubmit/index
- 百度网站验证：https://ziyuan.baidu.com/college/courseinfo?id=267
- Bing Sitemap：https://www.bing.com/webmasters/help/sitemaps-3b5cf6ed
- Google AI 搜索：https://developers.google.com/search/docs/appearance/ai-features
- OpenAI 爬虫：https://developers.openai.com/api/docs/bots
