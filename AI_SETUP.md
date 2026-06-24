# AI 接入说明

当前「牌面解析」通过本地服务 `/api/analyze` 调用 TokenHub 的 OpenAI 兼容接口。

页面如果直接打开 `index.html`，浏览器地址是 `file://`，不会调用接口，会使用本地兜底解析。

要调用真实 AI，需要用本地服务启动页面。

## 配置位置

本地密钥配置在：

```text
.env.local
```

可配置项：

```bash
TOKENHUB_API_KEY="你的 API Key"
TOKENHUB_MODEL="deepseek-v4-pro-202606"
TOKENHUB_ENDPOINT="https://tokenhub.tencentmaas.com/v1/chat/completions"
```

`.env.local` 已加入 `.gitignore`，不要把它发给别人。

## 启动服务

在项目目录执行：

```bash
node server.js
```

如果当前系统没有 `node` 命令，可以使用 Codex 环境里的 Node：

```bash
/Users/booboo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node server.js
```

然后打开：

```text
http://localhost:5173
```

## 前端发送内容

```json
{
  "question": "用户输入的问题",
  "lyric": "抽到的歌词",
  "cardName": "卡片名字",
  "songInfo": "歌曲名称加作者"
}
```

后端返回：

```json
{
  "analysis": "AI 生成的解析"
}
```
