import type { SecretInput } from "openclaw/plugin-sdk/secret-input";

/** OneBot 11 message segment (array format). */
export type OneBotSegment = {
  type: string;
  data: Record<string, string | undefined>;
};

/** OneBot 11 message event (private or group). */
export type OneBotMessageEvent = {
  time: number;
  self_id: number;
  post_type: "message";
  message_type: "private" | "group";
  sub_type: string;
  message_id: number;
  user_id: number;
  group_id?: number;
  message: OneBotSegment[];
  raw_message: string;
  font: number;
  sender: {
    user_id: number;
    nickname: string;
    card?: string;
    sex?: string;
    age?: number;
    role?: "owner" | "admin" | "member";
  };
};

/** OneBot 11 meta event (lifecycle, heartbeat). */
export type OneBotMetaEvent = {
  time: number;
  self_id: number;
  post_type: "meta_event";
  meta_event_type: "lifecycle" | "heartbeat";
  sub_type?: string;
};

/** Any OneBot 11 event. */
export type OneBotEvent = OneBotMessageEvent | OneBotMetaEvent | Record<string, unknown>;

/** OneBot 11 API response via WebSocket. */
export type OneBotApiResponse<T = unknown> = {
  status: "ok" | "failed";
  retcode: number;
  data: T;
  echo?: string;
};

/** get_login_info result. */
export type OneBotLoginInfo = {
  user_id: number;
  nickname: string;
};

/** send_msg result. */
export type OneBotSendMsgResult = {
  message_id: number;
};

/** Keyword trigger rule as provided in config (fields optional; normalized at runtime). */
export type KeywordTriggerInput = {
  /** Rule name (unique identifier). */
  name?: string;
  /** Match type. Defaults to "contains". */
  type?: "exact" | "prefix" | "suffix" | "contains" | "regex";
  /** Keyword / pattern to match. */
  pattern: string;
  /** Action on match. Defaults to "passthrough". */
  action?: "passthrough" | "block" | "command";
  /** Command string to substitute when action="command". */
  command?: string;
  /** Case-sensitive match. Defaults to false. */
  caseSensitive?: boolean;
  /** Enable this rule. Defaults to true. */
  enabled?: boolean;
};

/** Keyword trigger configuration block for a NapCat account. */
export type KeywordTriggerConfigInput = {
  /** Ordered list of keyword rules. */
  triggers?: KeywordTriggerInput[];
  /** Action when no rule matches. Defaults to "passthrough". */
  defaultAction?: "passthrough" | "block";
  /** Blocklist words; any match blocks the message. */
  blocklist?: string[];
};

/** Markdown strip configuration for QQ output. */
export type MarkdownStripConfig = {
  /** Whether to strip Markdown formatting from AI replies. Defaults to true. */
  enabled?: boolean;
};

/**
 * Group chat history context config.
 * When the bot is triggered in a group, recent unseen messages are
 * fetched and prepended to the current message so the AI has context
 * about what was said since its last activation.
 */
export type GroupHistoryConfig = {
  /** Max messages to fetch per trigger. 0 disables. Defaults to 20. */
  limit?: number;
  /** Hard cap on the formatted block length (chars). Defaults to 4000. */
  maxChars?: number;
};

/** NapCat account configuration in openclaw.json. */
export type NapCatAccountConfig = {
  /** Display name for this account. */
  name?: string;
  /** Disable this account without removing config. */
  enabled?: boolean;
  /** NapCat OneBot 11 HTTP API base URL for sending messages (e.g. http://127.0.0.1:3000). */
  httpApi?: string;
  /** Access token for OneBot 11 API authentication. */
  accessToken?: SecretInput;
  /** The bot's QQ number (self_id). Used to detect @bot mentions. */
  selfId?: string | number;
  /** DM access policy. */
  dmPolicy?: "pairing" | "allowlist" | "open" | "disabled";
  /** Allowlist for DM senders (QQ numbers). */
  allowFrom?: Array<string | number>;
  /** Group message policy. */
  groupPolicy?: "open" | "allowlist" | "disabled";
  /** Allowlist for group senders (falls back to allowFrom). */
  groupAllowFrom?: Array<string | number>;
  /** Max inbound media size in MB. */
  mediaMaxMb?: number;
  /** Outbound response prefix. */
  responsePrefix?: string;
  /** Keyword trigger rules (block / command / passthrough-strip). */
  keywordTriggers?: KeywordTriggerConfigInput;
  /**
   * Group-chat activation keywords. In group chats a message is normally only
   * handled when it @mentions the bot; if the message contains any of these
   * keywords it is treated as if the bot was mentioned (case-insensitive).
   */
  keywordMention?: string[];
  /**
   * Strip Markdown formatting from AI replies (QQ doesn't render Markdown).
   * Defaults to true. Set to false or { enabled: false } to disable.
   */
  markdownStrip?: MarkdownStripConfig | boolean;
  /**
   * Group chat history context. When the bot is triggered in a group,
   * recent unseen messages are prepended to the current message so the
   * AI understands what was said since its last activation.
   * Defaults to { limit: 20, maxChars: 4000 }. Set limit: 0 to disable.
   */
  groupHistory?: GroupHistoryConfig;
  /**
   * Group chat session scope. Controls how group messages are routed to
   * sessions (and thus how the AI's conversation context is shared).
   *
   * - `per-group` (default, aligns with OpenClaw standard): all members
   *   of a group share one session keyed by the group id
   *   (`agent:<agentId>:napcat:group:<groupId>`). Everyone sees the same
   *   ongoing conversation.
   * - `per-user`: each member of a group gets an isolated session keyed
   *   by `<groupId>:<senderId>`. Use this when you want the AI to keep
   *   per-user context (e.g. personal assistant inside a group).
   *
   * Note: this only affects session routing; outbound replies always go
   * to the originating group chat.
   */
  groupSessionScope?: "per-group" | "per-user";
};

export type NapCatConfig = {
  /** Multi-account support. */
  accounts?: Record<string, NapCatAccountConfig>;
  /** Default account ID. */
  defaultAccount?: string;
} & NapCatAccountConfig;

export type ResolvedNapCatAccount = {
  accountId: string;
  name?: string;
  enabled: boolean;
  httpApi: string;
  accessToken: string;
  selfId: string;
  config: NapCatAccountConfig;
};
