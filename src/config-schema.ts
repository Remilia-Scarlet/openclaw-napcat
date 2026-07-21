// Direct JSON Schema — bypasses zod to avoid version/instance mismatch at runtime.

export const NapCatChannelConfigSchema = {
  schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      enabled: { type: "boolean" },
      httpApi: { type: "string" },
      accessToken: { type: "string" },
      selfId: { type: "string" },
      dmPolicy: { type: "string", enum: ["open", "pairing", "allowlist", "disabled"] },
      allowFrom: {
        type: "array",
        items: { type: ["string", "number"] },
      },
      groupPolicy: { type: "string", enum: ["open", "allowlist", "disabled"] },
      groupAllowFrom: {
        type: "array",
        items: { type: ["string", "number"] },
      },
      mediaMaxMb: { type: "number" },
      responsePrefix: { type: "string" },
      keywordTriggers: {
        type: "object",
        properties: {
          triggers: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                type: { type: "string", enum: ["exact", "prefix", "suffix", "contains", "regex"] },
                pattern: { type: "string" },
                action: { type: "string", enum: ["passthrough", "block", "command"] },
                command: { type: "string" },
                caseSensitive: { type: "boolean" },
                enabled: { type: "boolean" },
              },
              required: ["pattern"],
              additionalProperties: false,
            },
          },
          defaultAction: { type: "string", enum: ["passthrough", "block"] },
          blocklist: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
      keywordMention: {
        type: "array",
        items: { type: "string" },
      },
      markdownStrip: {
        type: ["object", "boolean"],
        properties: {
          enabled: { type: "boolean" },
        },
        additionalProperties: false,
      },
      groupHistory: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max messages to fetch per trigger (default 20, 0 disables)" },
          maxChars: { type: "number", description: "Hard cap on formatted block length (default 4000)" },
        },
        additionalProperties: false,
      },
      groupSessionScope: {
        type: "string",
        enum: ["per-group", "per-user"],
        description: "Group session routing: per-group (default, all members share one session) or per-user (each member gets isolated context)",
      },
      accounts: {
        type: "object",
        additionalProperties: true,
      },
      defaultAccount: { type: "string" },
    },
    additionalProperties: true,
  },
  uiHints: {
    httpApi: {
      label: "NapCat HTTP API",
      help: "NapCat OneBot 11 HTTP API 地址 (例: http://127.0.0.1:3000)",
      placeholder: "http://127.0.0.1:3000",
    },
    accessToken: {
      label: "Access Token",
      sensitive: true,
      help: "OneBot 11 API 鉴权 token (可选)",
    },
    selfId: {
      label: "机器人 QQ 号",
      help: "机器人的 QQ 号码，用于检测 @机器人",
    },
    dmPolicy: {
      label: "私聊策略",
      help: "allowlist=白名单, pairing=配对, open=开放, disabled=禁用",
    },
    allowFrom: {
      label: "私聊白名单",
      help: "允许私聊的 QQ 号列表",
    },
    groupPolicy: {
      label: "群聊策略",
      help: "allowlist=白名单, open=开放, disabled=禁用",
    },
    groupAllowFrom: {
      label: "群聊白名单",
      help: "允许在群聊中触发的 QQ 号列表",
    },
    mediaMaxMb: {
      label: "最大媒体大小 (MB)",
      advanced: true,
    },
    responsePrefix: {
      label: "回复前缀",
      advanced: true,
    },
    keywordTriggers: {
      label: "关键字触发",
      help: "关键字触发规则：block 拦截、command 映射为命令、passthrough 去除触发词后放行；blocklist 为敏感词黑名单",
      advanced: true,
    },
    keywordMention: {
      label: "群聊唤醒词",
      help: "群聊中，消息含这些关键词之一即视为 @机器人（与 @机器人 并行生效，不区分大小写）",
    },
    markdownStrip: {
      label: "Markdown 剥离",
      help: "QQ 不渲染 Markdown，开启后将 AI 回复中的 **加粗**、## 标题、|表格| 等转为纯文本。默认开启，设为 false 可关闭",
      advanced: true,
    },
    groupHistory: {
      label: "群聊历史上下文",
      help: "AI 被唤起时，附加自上次唤起以来的群聊记录作为上下文。limit=条数(默认20,0禁用), maxChars=最大字符数(默认4000)",
      advanced: true,
    },
    groupSessionScope: {
      label: "群聊会话作用域",
      help: "per-group(默认)=全群共享一个会话上下文; per-user=每个群员独立会话上下文。仅影响会话路由，回复始终发到原群",
      advanced: true,
    },
  },
} as const;
