# @hyl_aa/napcat

[English](./README_EN.md) | 中文

OpenClaw 的 QQ 消息通道插件，基于 [NapCat](https://github.com/NapNeko/NapCatQQ) 的 OneBot 11 反向 WebSocket 协议。

让 AI 助手通过自然语言完全控制 QQ 交互 —— 点赞、戳一戳、禁言、踢人、查看用户资料、管理群组等。

> **v1.3.0 新增**：安全加固（频率限制/管理员权限/审计日志）、长消息处理策略（流式/HTML图片/合并转发）、关键字触发引擎、群事件钩子（入退群自动化响应）。

## 功能特性

- **45 个 AI Agent 工具** —— AI 通过自然语言指令执行 QQ 操作
- **语音转文字 (STT)** —— 自动将语音消息转录为文字后发送给 AI
- **@提及识别** —— 自动识别消息中的 `@QQ号` 并映射到用户 ID
- **群管理** —— 完整的管理工具集：禁言、踢人、设置管理员、改群名、发公告
- **多账号支持** —— 支持配置多个 NapCat 机器人账号
- **🔒 安全加固** —— 频率限制（Token Bucket）、管理员权限分级（L1-L4）、审计日志
- **📝 长消息策略** —— 三种模式：流式分段发送 / HTML 转图片 / 合并转发
- **🎯 关键字触发** —— 支持精确/前缀/后缀/正则/包含多种匹配方式
- **🔔 群事件钩子** —— 入群欢迎、退群通知、群管理等自动化响应
- **✂️ Markdown 剥离** —— QQ 不渲染 Markdown，自动将 AI 回复中的 `**加粗**`、`## 标题`、`|表格|` 等转为纯文本
- **💬 群聊历史上下文** —— AI 被唤起时自动附加自上次唤起以来的群聊记录，让 AI 明白群里说了什么
- **👥 群聊会话作用域** —— 群聊里所有成员默认共享同一会话上下文（`per-group`），也可配置 `per-user` 让每个群员独立

## Agent 工具列表（45 个）

### 查询工具

| 工具 | 功能 | 危险等级 |
|------|------|:--------:|
| `qq_like_user` | 给用户点赞 | L1 |
| `qq_get_user_info` | 获取用户资料（昵称、年龄、签名等） | L1 |
| `qq_get_group_info` | 获取群信息（群名、成员数） | L1 |
| `qq_get_group_member_info` | 获取群内某成员的详细信息 | L1 |
| `qq_get_friend_list` | 获取机器人好友列表 | L1 |
| `qq_get_group_list` | 获取机器人群列表 | L1 |
| `qq_get_group_member_list` | 获取群全部成员列表 | L1 |
| `qq_get_group_honor_info` | 获取群荣誉信息（龙王等） | L1 |

### 消息历史与上下文

| 工具 | 功能 | 危险等级 |
|------|------|:--------:|
| `qq_get_group_msg_history` | 获取群聊历史消息 | L1 |
| `qq_get_friend_msg_history` | 获取私聊历史消息 | L1 |
| `qq_get_essence_msg_list` | 获取群精华消息列表 | L1 |

### 互动工具

| 工具 | 功能 | 危险等级 |
|------|------|:--------:|
| `qq_poke` | 戳一戳 | L1 |
| `qq_recall_message` | 撤回消息 | L2 |
| `qq_set_msg_emoji_like` | 给消息添加表情回应 | L1 |
| `qq_ocr_image` | OCR 图片文字识别 | L1 |
| `qq_translate_en2zh` | 英译中翻译 | L1 |
| `qq_mark_msg_as_read` | 标记消息为已读 | L1 |

### 消息发送

| 工具 | 功能 | 危险等级 |
|------|------|:--------:|
| `qq_send_message` | 发送文本/图片/语音/视频消息 | L1 |
| `qq_upload_file` | 上传文件到群聊或私聊 | L3 |
| `qq_forward_message` | 转发消息 | L2 |
| `qq_send_group_forward_msg` | 发送群合并转发消息 | L3 |
| `qq_send_private_forward_msg` | 发送私聊合并转发消息 | L3 |
| `qq_download_file` | 下载文件到机器人本地 | L3 |

### 精华消息管理

| 工具 | 功能 | 危险等级 |
|------|------|:--------:|
| `qq_set_essence_msg` | 设置精华消息 | L2 |
| `qq_delete_essence_msg` | 移除精华消息 | L2 |

### 好友管理

| 工具 | 功能 | 危险等级 |
|------|------|:--------:|
| `qq_set_friend_remark` | 设置好友备注 | L2 |
| `qq_delete_friend` | 删除好友 | L4 |

### 群管理工具

| 工具 | 功能 | 危险等级 |
|------|------|:--------:|
| `qq_mute_group_member` | 禁言群成员 | L2 |
| `qq_kick_group_member` | 踢出群成员 | L2 |
| `qq_set_group_card` | 设置群名片 | L3 |
| `qq_set_group_admin` | 设置/取消群管理员 | L3 |
| `qq_set_group_name` | 修改群名称 | L3 |
| `qq_set_group_whole_ban` | 全员禁言开关 | L3 |
| `qq_set_group_special_title` | 设置群成员专属头衔 | L3 |
| `qq_set_group_leave` | 退出群聊 | L4 |
| `qq_set_group_portrait` | 设置群头像 | L3 |
| `qq_set_group_sign` | 群签到打卡 | L1 |
| `qq_set_group_remark` | 设置群备注 | L3 |
| `qq_get_group_at_all_remain` | 查询 @全体成员 剩余次数 | L1 |

### 群公告管理

| 工具 | 功能 | 危险等级 |
|------|------|:--------:|
| `qq_send_group_notice` | 发送群公告 | L3 |
| `qq_get_group_notice` | 获取群公告列表 | L1 |
| `qq_delete_group_notice` | 删除群公告 | L3 |

### 群文件管理

| 工具 | 功能 | 危险等级 |
|------|------|:--------:|
| `qq_get_group_root_files` | 获取群文件根目录列表 | L1 |
| `qq_get_group_file_url` | 获取群文件下载链接 | L1 |
| `qq_create_group_file_folder` | 创建群文件夹 | L3 |
| `qq_delete_group_file` | 删除群文件 | L3 |

### 请求处理

| 工具 | 功能 | 危险等级 |
|------|------|:--------:|
| `qq_handle_friend_request` | 处理好友请求 | L3 |
| `qq_handle_group_request` | 处理加群请求 | L3 |

---

## 🔒 危险等级说明

| 等级 | 说明 | 权限要求 |
|------|------|----------|
| **L1** | 普通操作，白名单用户即可执行 | 基础 |
| **L2** | 受限操作，需非黑名单用户（部分需群管理员） | 基础 |
| **L3** | 危险操作，仅机器人管理员可执行 | `admins` 列表 |
| **L4** | 极危操作，管理员 + 二次确认 | `admins` + 确认 |

---

## 📝 长消息处理策略

当 AI 回复超过阈值（默认 300 字符）时，自动选择处理模式：

| 模式 | 适用场景 | 效果 |
|------|----------|------|
| `normal` | ChatML 等流式输出 | 边生成边发送，每 160 字符一分段 |
| `og_image` | 代码、长篇富文本 | HTML 渲染后转图片发送（支持 4 种主题） |
| `forward` | 超长纯文本（>8000字符） | 合并转发消息格式 |

---

## 🎯 关键字触发

支持多种匹配类型：

```json
{
  "keywordTriggers": {
    "triggers": [
      { "name": "激活词", "type": "exact", "pattern": "AI助手", "action": "passthrough" },
      { "name": "命令前缀", "type": "prefix", "pattern": "/cmd:", "action": "command", "command": "/cmd" },
      { "name": "正则示例", "type": "regex", "pattern": "^\\[系统\\].*", "action": "passthrough" },
      { "name": "屏蔽词", "type": "contains", "pattern": "广告", "action": "block" }
    ],
    "defaultAction": "passthrough",
    "blocklist": ["违规词1", "违规词2"]
  }
}
```

> 注意：`keywordTriggers`（关键字触发，负责内容拦截 / 改写 / 映射命令）与下方的 `keywordMention`（群聊唤醒词，负责决定"要不要理这条消息"）是两个独立字段，互不冲突。

---

## 🗣️ 群聊唤醒词

群聊中，消息默认只有 **@机器人** 才会被处理。配置 `keywordMention` 后，只要消息里**包含**其中任意一个关键词，即视为 @了机器人，会与 @机器人**并行生效**（匹配不区分大小写）：

```json
{
  "keywordMention": ["AI助手", "小助手", "机器人"]
}
```

例如群里发"机器人 帮我查下天气"，即使没有 @，也会被处理。

> - 采用"包含"匹配，因此"这个机器人真好用"也会触发，请谨慎选择关键词。
> - 唤醒词不会从文本中剔除，原文（去掉 @ 后）会原样发给 AI。
> - 仅对群聊生效，私聊不需要唤醒。

---

## 🔔 群事件钩子

入退群自动化响应示例：

```json
{
  "groupHooks": {
    "enabled": true,
    "defaultWelcome": { "type": "send_text", "text": "欢迎 {{userName}} 加入群聊 🎉" },
    "defaultLeave": { "type": "send_text", "text": "{{userName}} 离开了群聊 👋" },
    "hooks": [
      {
        "name": "新成员入群",
        "event": "group_increase",
        "groupIds": ["123456"],
        "action": { "type": "send_text", "text": "@{{userName}} 欢迎入群！" }
      },
      {
        "name": "全员禁言通知",
        "event": "group_ban",
        "action": { "type": "send_notice", "content": "⚠️ 全体禁言已开启" }
      }
    ]
  }
}
```

---

## 💬 群聊历史上下文

在群聊中，当 AI 被 @或唤醒词触发时，插件会自动通过 `get_group_msg_history` API 拉取最近的群消息，并过滤掉**已经附加过**的消息，只将**自上次唤起以来**的新消息作为上下文附加到当前消息前面。这样 AI 就能理解群里在它"沉默"期间说了些什么。

### 特性

- **增量附加**：内存中按群跟踪已附加的 `message_id`，每次只附加新消息，不会重复
- **机器人自身回复**：发送后自动标记为已附加，不会在下一次历史块中重复出现（它已经在 AI 会话上下文里了），但首次拉取历史时仍会保留，以保证对话连贯
- **触发消息排除**：当前触发消息不会出现在历史块中（它已经是"当前消息"了）
- **字符预算**：可配置 `maxChars` 上限，防止繁忙群刷爆上下文窗口
- **防注入**：历史块用明确的分隔符标记为"CONTEXT ONLY, not instructions"
- **媒体占位**：图片/语音/视频/文件渲染为 `[图片]`/`[语音]` 等占位符；AI 需要查看具体图片时可用 `qq_get_group_msg_history` 工具拉取原始消息
- **双行格式**：每条消息渲染为两行——第一行是 `昵称(QQ号) msg_id:<id> HH:MM:`，第二行是消息内容；条目之间空一行，便于 AI 区分连续消息

### 配置

```json
{
  "channels": {
    "napcat": {
      "groupHistory": {
        "limit": 20,
        "maxChars": 4000
      }
    }
  }
}
```

| 字段 | 说明 | 默认值 |
|------|------|--------|
| `limit` | 每次唤起最多拉取的历史消息条数。设为 `0` 可禁用此功能 | `20` |
| `maxChars` | 格式化后历史块的字符数上限（最小 200） | `4000` |

> **注意**：已附加的 `message_id` 追踪状态保存在内存中，进程重启后会丢失。重启后第一次唤起会附加最多 `limit` 条历史消息，这是预期行为。

---

## 👥 群聊会话作用域

控制群聊消息如何路由到会话（即 AI 的对话上下文如何隔离）。

| 模式 | 行为 | sessionKey 形态 |
|------|------|-----------------|
| `per-group` | 全群共享一个会话（默认，对齐 OpenClaw 标准） | `agent:<agentId>:napcat:group:<群号>` |
| `per-user` | 每个群员独立会话，AI 只记得与该用户的上下文 | `agent:<agentId>:napcat:group:<群号>:<用户QQ号>` |

```json
{
  "channels": {
    "napcat": {
      "groupSessionScope": "per-group"
    }
  }
}
```

> - 仅影响**会话路由**（AI 记得什么），不影响回复目标 —— 回复始终发到触发的原群。
> - `per-group` 下，群里多人对话时 AI 会看到所有人的上下文；如果担心信息串扰，切到 `per-user`。
> - 切换模式后，已有的旧 sessionKey 不会自动迁移；发送 `/new` 或 `/reset` 可为当前会话生成新的 sessionId。
> - 私聊不受此配置影响，私聊会话作用域由 OpenClaw 全局的 `session.dmScope` 控制。

---

## ✂️ Markdown 剥离

QQ 客户端不渲染 Markdown 语法，AI 回复里的 `**加粗**`、`## 标题`、`` `代码` ``、`|表格|`、`[链接](url)` 等会原样显示为乱码字符。本插件默认在发送前将 Markdown 转为可读的纯文本：

| 语法 | 转换后 | 说明 |
|------|--------|------|
| `**加粗**` `*斜体*` `~~删除~~` | `加粗` `斜体` `删除` | 去标记保留内容 |
| `## 标题` | `【标题】` | 1-6 级标题统一 |
| `- 列表` `* 列表` `+ 列表` | `• 列表` | 无序列表 |
| `1. 列表` | `1. 列表` | 有序列表保留序号 |
| `> 引用` | `『引用』` | 逐行转换 |
| `---` `***` `___` | `————` | 水平分割线 |
| `[文字](url)` | `文字(url)` | 链接保留 URL |
| `![alt](url)` | `alt(url)` | 图片保留 URL（无 alt 显示 `[图片]`） |
| ```` ```代码``` ```` | `代码` | 代码块去围栏保留内容 |
| `` `代码` `` | `代码` | 行内代码去反引号 |

> 代码块和行内代码的内容会被保护，内部的 `*`、`#` 等不会被误处理。
>
> 表格会先经 Markdown 剥离（清理单元格内的强调/链接等），再用 SDK 对齐 `|` 列，保证对齐正确。

默认开启，可在配置中关闭：

```json
{
  "channels": {
    "napcat": {
      "markdownStrip": false
    }
  }
}
```

也支持对象写法：`"markdownStrip": { "enabled": false }`。

---

## 前置要求

- [OpenClaw](https://github.com/openclaw/openclaw) >= 2026.3.14
- [NapCat](https://github.com/NapNeko/NapCatQQ) 已运行并开启 HTTP API 和反向 WebSocket
- Node.js 22+

## 安装

**方式一：从 npm 安装（推荐）**

```bash
openclaw plugins install @hyl_aa/napcat
```

**方式二：手动克隆**

```bash
cd ~/.openclaw/extensions
git clone https://github.com/lynn-521/openclaw-napcat.git napcat
cd napcat && npm install --omit=dev
```

安装后重启 OpenClaw（`openclaw restart`）使插件生效。

## 配置

### NapCat 端配置

在 NapCat 的配置中，需要开启以下功能：

1. **HTTP API** — 用于插件主动发送消息，默认端口 `3000`
2. **反向 WebSocket** — 用于接收消息，需要连接到 OpenClaw 分配的 WS 端口（默认从 `18800` 开始）

NapCat 反向 WS 配置示例：

```json
{
  "reverseWs": {
    "enable": true,
    "urls": ["ws://127.0.0.1:18800"]
  }
}
```

> 如果配置了多个账号，端口会依次递增（18800、18801、18802...）。

### OpenClaw 端配置

在 OpenClaw 配置中添加（`openclaw config edit`）：

```json
{
  "channels": {
    "napcat": {
      "httpApi": "http://127.0.0.1:3000",
      "accessToken": "你的token",
      "selfId": "123456789",
      "dmPolicy": "allowlist",
      "allowFrom": ["好友QQ号"],
      "groupPolicy": "allowlist",
      "groupAllowFrom": ["群号"],
      "security": {
        "admins": ["1838552185"],
        "rateLimiter": { "enabled": true, "maxPerMinute": 20, "maxPerHour": 300 },
        "auditLog": true,
        "auditLogRetentionDays": 7
      },
      "keywordTriggers": {
        "triggers": [
          { "name": "激活词", "type": "exact", "pattern": "AI助手", "action": "passthrough", "enabled": true }
        ],
        "defaultAction": "passthrough",
        "blocklist": []
      },
      "keywordMention": ["AI助手", "小助手", "机器人"],
      "groupHooks": {
        "enabled": true,
        "defaultWelcome": { "type": "send_text", "text": "欢迎加入 🎉" }
      },
      "longMessage": {
        "threshold": 300,
        "mode": "normal",
        "normalFlushChars": 160,
        "normalFlushIntervalMs": 1200
      },
      "groupHistory": {
        "limit": 20,
        "maxChars": 4000
      },
      "groupSessionScope": "per-group",
      "markdownStrip": true
    }
  }
}
```

### 配置字段说明

| 字段 | 说明 | 默认值 |
|------|------|--------|
| `httpApi` | NapCat OneBot 11 HTTP API 地址 | - |
| `accessToken` | API 鉴权 token（可选） | - |
| `selfId` | 机器人自身 QQ 号（用于 @机器人检测） | - |
| `dmPolicy` | 私聊策略：`allowlist` / `pairing` / `open` / `disabled` | `allowlist` |
| `allowFrom` | 允许私聊的 QQ 号列表 | `[]` |
| `groupPolicy` | 群聊策略：`allowlist` / `open` / `disabled` | `open` |
| `groupAllowFrom` | 允许在群聊中触发的 QQ 号列表（空则使用 `allowFrom`） | `[]` |
| `mediaMaxMb` | 接收媒体文件的最大尺寸（MB） | `5` |
| `responsePrefix` | AI 回复消息前缀（可选） | - |
| `security.admins` | 机器人管理员 QQ 列表（L3/L4 操作需要） | `[]` |
| `security.rateLimiter.enabled` | 是否启用频率限制 | `true` |
| `security.rateLimiter.maxPerMinute` | 每分钟最大请求数（per user） | `20` |
| `security.rateLimiter.maxPerHour` | 每小时最大请求数（per user） | `300` |
| `security.auditLog` | 是否启用审计日志 | `true` |
| `keywordTriggers.triggers` | 关键字触发规则列表 | `[]` |
| `keywordTriggers.defaultAction` | 默认动作 | `passthrough` |
| `keywordMention` | 群聊唤醒词列表，消息含其一即视为 @机器人（不区分大小写） | `[]` |
| `groupHooks.enabled` | 是否启用群事件钩子 | `false` |
| `longMessage.threshold` | 长消息阈值（字符数） | `300` |
| `longMessage.mode` | 长消息处理模式 | `normal` |
| `longMessage.normalFlushChars` | normal模式每次发送字符数 | `160` |
| `longMessage.normalFlushIntervalMs` | normal模式发送间隔（毫秒） | `1200` |
| `longMessage.ogImageTheme` | og_image模式主题 | `default` |
| `markdownStrip` | 是否剥离 AI 回复中的 Markdown 语法（QQ 不渲染） | `true` |
| `groupHistory.limit` | 群聊历史上下文：每次拉取的最大条数（0 禁用） | `20` |
| `groupHistory.maxChars` | 群聊历史上下文：格式化后字符数上限 | `4000` |
| `groupSessionScope` | 群聊会话作用域：`per-group`(默认,全群共享) / `per-user`(每群员独立) | `per-group` |

**重要：** 需要在 OpenClaw 配置中将 `tools.profile` 设置为 `"full"`，否则 `qq_*` 工具会被默认的 `"coding"` profile 过滤掉。

## 语音消息

启用语音 STT 后（`tools.media.audio.enabled: true`），语音消息会自动转录为文字再发送给 AI 模型。

## 项目结构

```
.
├── index.ts                 # 插件入口
├── package.json
├── openclaw.plugin.json     # 插件元数据
└── src/
    ├── accounts.ts          # 多账号解析
    ├── api.ts               # OneBot 11 HTTP API 客户端
    ├── channel.ts           # Channel 插件与 Dock 定义
    ├── config-schema.ts     # 配置 JSON Schema + UI 提示
    ├── monitor.ts           # WebSocket 消息监听 + STT
    ├── probe.ts             # 连接探测 / 健康检查
    ├── runtime.ts           # 运行时上下文
    ├── send.ts              # 消息发送
    ├── tools.ts             # 45 个 AI Agent 工具
    ├── types.ts             # TypeScript 类型定义
    ├── security/
    │   ├── rate-limiter.ts  # Token Bucket 频率限制器
    │   ├── admin-guard.ts   # 管理员权限守卫（L1-L4 分级）
    │   └── audit-log.ts     # 审计日志
    └── features/
        ├── longmsg.ts       # 长消息处理（3种模式）
        ├── keyword-trigger.ts # 关键字触发引擎
        ├── group-hooks.ts   # 群事件钩子
        ├── group-history.ts # 群聊历史上下文（自上次唤起以来的消息）
        └── markdown-strip.ts # Markdown 语法剥离（QQ 适配）
```

## 许可证

MIT
