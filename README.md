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

### Seamless two-way task processing with WorkBuddy / Hermes / any external agent

The same machine often runs several agent platforms (e.g. DeepSeek Harness, WorkBuddy, Hermes). Because the injector binds to `127.0.0.1`, **any local agent can call it directly** — no shared task queue, no central broker, no manual message ferrying:

```
DSH agent ──(feishu/API)──▶ External agent (WorkBuddy/Hermes)
External agent ──(curl 127.0.0.1:8799/inject)──▶ DSH session dialog   ← 全自动双向
```

**Full-duplex example** (DSH requests an image; external agent delivers and notifies back — fully automatic):

```bash
# External agent's delivery call (one line, runs anywhere on the same host):
curl -s -X POST http://127.0.0.1:8799/inject \
  -H 'Content-Type: application/json' \
  -d '{"sessionId":"<dsh-requester-session>","text":"【delivered】8/8 images at /path/to/output"}'
```

Key properties:

- **Bidirectional**: external agents can *start* conversations in DSH dialogs, not just reply — full automatic task processing both ways.
- **Platform-agnostic**: works with anything that can run `curl` on the same host — WorkBuddy, Hermes, LangChain runners, plain cron scripts.
- **Human-visible**: every injection is a real message in the dialog, visible and replayable.

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

### 与 WorkBuddy / Hermes / 任意外部 agent 的全自动双向任务处理

同一台机器上往往跑着多个 agent 平台（DeepSeek Harness、WorkBuddy、Hermes…）。注入器只绑定 `127.0.0.1`，**本机所有 agent 都能直接调用**——无需共享任务队列、无需中央消息总线、无需人工搬运消息：

```
DSH agent ──(飞书/API)──▶ 外部 agent（WorkBuddy/Hermes）
外部 agent ──(curl 127.0.0.1:8799/inject)──▶ DSH 会话对话框   ← 全自动双向
```

**全自动双向示例**（DSH 委托出图；外部 agent 完成后主动唤醒 DSH 对话框交付——全自动闭环）：

```bash
# 外部 agent 的交付调用（一行，本机任意位置可执行）：
curl -s -X POST http://127.0.0.1:8799/inject \
  -H 'Content-Type: application/json' \
  -d '{"sessionId":"<DSH请求方会话>","text":"【交付】8/8 参考图已生成，路径 /path/to/output"}'
```

关键特性：

- **双向**：外部 agent 不只能"回复"，还能主动**发起** DSH 对话框中的对话——两边都是全自动任务处理。
- **平台无关**：只要能在同一台主机上执行 `curl` 就能接入——WorkBuddy、Hermes、LangChain runner、纯 cron 脚本，都行。
- **人类可见**：每次注入都是对话框里的一条真实消息，可见、可回溯。

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
