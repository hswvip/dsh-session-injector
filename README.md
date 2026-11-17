# dsh-session-injector

[English](#english) | [中文](#中文)

<a id="english"></a>
## English

A minimal [DeepSeek Harness](https://github.com/deepseek-ai) Host plugin that exposes a **local HTTP endpoint for injecting external messages into any DSH session's dialog** — with full conversation records, queue-mode safety, and no session write-lock conflicts.

### Why

Multi-agent orchestrators (task queues, IM bridges, cron jobs, other agents) often need to deliver a message *into* a running DSH session so it appears in the session's dialog and is processed by the session's agent. Stock DSH exposes this only through IM-channel plugins (Feishu/WeChat/Telegram...) or the interactive GUI. This plugin opens a plain **HTTP door** to the same official `session.prompt` queue channel the GUI itself uses — so any local process can wake any session.

### What it gives you

```
POST http://127.0.0.1:8799/inject
  {"sessionId": "<session-id>", "text": "<message>"}
→ message appears in that session's dialog
→ session agent processes it (full conversation record kept)
→ returns { ok, requestId, sessionId, mode: "queue" }

GET http://127.0.0.1:8799/models   → LLM catalog probe
GET http://127.0.0.1:8799/health   → liveness
```

- **Queue mode**: safe against session write-locks; messages wait for the current turn, then process.
- **No auth / localhost-only** by default (binds `127.0.0.1`). Add a reverse proxy with auth if you need remote access.
- Also exposes `llm.models` catalog probe at `/models` for debugging.

### Verified use cases

- IM bridge → session dialog (Feishu p2p chat wake)
- Orchestrator → agent task delivery (producer → reviewer handoffs)
- Scheduled reminders into a session
- Cross-agent notifications (agent A finishes → notifies agent B's dialog)

### Install

```bash
# 1. Copy or git clone this directory anywhere
# 2. Install into your DSH profile
plugin_manager install_bundle /path/to/dsh-session-injector
# 3. Restart DSH web — the plugin listens on 127.0.0.1:8799
```

Requirements: DSH with the `typertGateway` + `connection` Host context (declare `inject: ['typertGateway', 'connection']` — already done in this plugin's `index.js`).

### Multi-agent relay pattern (what this was built for)

A coordinator injects task notices into each agent workspace's dialog; agents process in their own dialogs and inject completion notices back. No central task queue needed — the dialog IS the task board.

```bash
# Deliver a notice into the reviewer's dialog
curl -s -X POST http://127.0.0.1:8799/inject \
  -H 'Content-Type: application/json' \
  -d '{"sessionId":"<reviewer-session>","text":"【交付】产物已落盘 /path/to/output，请审查"}'
```

### Files

| File | Purpose |
|---|---|
| `index.js` | Host plugin: HTTP server + gateway bridge |
| `cordis.patch.yml` | Composition row (inserts the plugin entry) |
| `locale/*.json` | Inventory display metadata (zh/en) |
| `icon.svg` | Plugin icon |

### Notes

- The injected prompt uses `mode: "queue"`: it persists durably and is processed on the session's next available turn.
- `inject: ['typertGateway', 'connection']` is required — the plugin bridges the Host's Typert gateway with an owner-scoped peer so injected messages are attributed to the workspace owner.
- If port 8799 is taken, edit `PORT` in `index.js`.

## License

MIT

<a id="中文"></a>
## 中文

一个极简的 DeepSeek Harness Host 插件：暴露一个**本地 HTTP 端点，把外部消息注入任意 DSH 会话的对话框**——完整对话留痕、队列模式防写锁冲突。

### 解决什么问题

多智能体编排（任务队列、IM 桥、定时任务、其他 agent）经常需要把一条消息**送进正在运行的 DSH 会话**，让它出现在会话对话框里并由该会话的 agent 处理。DSH 原生只支持 IM 渠道插件（飞书/微信/Telegram…）或 GUI 手动输入。本插件打开了与 GUI 同源的官方 `session.prompt` 队列通道——本机任何进程都能唤醒任意会话。

### 多智能体中继模式（本插件的原始用途）

协调者把任务通知注入各 agent 工作区的对话框；agent 在各自对话框里处理，完成后把交付通知注入回协调者/下游的对话框。不需要中央任务队列——**对话框就是任务板**。

```bash
curl -s -X POST http://127.0.0.1:8799/inject \
  -H 'Content-Type: application/json' \
  -d '{"sessionId":"<审核方会话>","text":"【交付】产物已落盘 /path/to/output，请审查"}'
```

### 安装

```bash
plugin_manager install_bundle /path/to/dsh-session-injector
# 重启 DSH web，插件监听 127.0.0.1:8799
```

### 注意

- 注入使用 `mode: "queue"`：持久化入队，会话下一个空闲 turn 处理。
- 默认 **无鉴权、仅绑定 127.0.0.1**；需要远程访问请自行加反向代理鉴权。
- 端口占用时修改 `index.js` 中的 `PORT`。

## License

MIT
