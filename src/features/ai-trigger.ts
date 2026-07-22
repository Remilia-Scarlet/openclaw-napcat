/**
 * src/features/ai-trigger.ts
 *
 * AI-powered group chat trigger — when a group message doesn't @bot or
 * hit keywordMention, a cheap small model decides whether the bot should
 * reply. The model sees the last N messages (including bot's own replies)
 * and judges whether the current message is worth engaging with.
 *
 * Active conversation detection:
 *   When the bot has replied within `activeWindowMs`, the conversation is
 *   considered "active". In this mode, cooldown and rate-limit are bypassed
 *   so the bot can participate in high-frequency back-and-forth without
 *   interruption. The LLM prompt also instructs the model to continue
 *   ongoing conversations.
 *
 * State (per-group, in-memory via globalThis):
 *   - lastBotReplyAt: timestamp of bot's last reply (drives active detection)
 *   - lastJudgeAt: timestamp of last AI judgment (drives cooldown)
 *   - judgeTimestamps: sliding window for per-minute rate limiting
 *
 * Error handling: on any failure (API error, timeout, parse error), the
 * trigger returns `false` (skip) — the bot stays silent rather than
 * replying to every message on errors.
 */

import { callOneBotApi } from "../api.js";
import type { OneBotSegment } from "../types.js";
import type { AiTriggerConfig } from "../types.js";

// ──────────────────────────── Config ────────────────────────────

export interface ResolvedAiTriggerConfig {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  model: string;
  recentMessages: number;
  persona: string;
  cooldownMs: number;
  activeWindowMs: number;
  maxJudgesPerMinute: number;
  timeoutMs: number;
}

const DEFAULTS = {
  enabled: false,
  recentMessages: 20,
  persona: "一个友善的AI助手",
  cooldownMs: 30_000,
  activeWindowMs: 180_000,
  maxJudgesPerMinute: 60,
  timeoutMs: 3_000,
} as const;

/** Resolve SecretInput (string | { value } | ref) to plain string. */
function resolveSecret(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && "value" in value) {
    return String((value as { value: unknown }).value ?? "");
  }
  return String(value);
}

/**
 * Resolve the raw AiTriggerConfig into a fully-populated object.
 * Returns `null` when the feature is disabled or missing required fields
 * (baseUrl, apiKey, model).
 */
export function resolveAiTriggerConfig(
  raw?: AiTriggerConfig,
): ResolvedAiTriggerConfig | null {
  if (!raw || !raw.enabled) return null;

  const baseUrl = (raw.baseUrl ?? "").trim();
  const apiKey = resolveSecret(raw.apiKey);
  const model = (raw.model ?? "").trim();

  if (!baseUrl || !apiKey || !model) return null;

  return {
    enabled: true,
    baseUrl,
    apiKey,
    model,
    recentMessages: clampInt(raw.recentMessages, DEFAULTS.recentMessages, 1, 100),
    persona: raw.persona?.trim() || DEFAULTS.persona,
    cooldownMs: clampInt(raw.cooldownMs, DEFAULTS.cooldownMs, 0, 3_600_000),
    activeWindowMs: clampInt(raw.activeWindowMs, DEFAULTS.activeWindowMs, 0, 3_600_000),
    maxJudgesPerMinute: clampInt(raw.maxJudgesPerMinute, DEFAULTS.maxJudgesPerMinute, 1, 600),
    timeoutMs: clampInt(raw.timeoutMs, DEFAULTS.timeoutMs, 500, 30_000),
  };
}

function clampInt(v: unknown, def: number, min: number, max: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : def;
  return Math.max(min, Math.min(max, n));
}

// ──────────────────────────── State ────────────────────────────

const STATE_KEY = "__openclaw_napcat_ai_trigger_state_v1__";
const MAX_TRACKED_GROUPS = 500;

interface GroupAiTriggerState {
  lastBotReplyAt: number;
  lastJudgeAt: number;
  judgeTimestamps: number[];
}

interface AiTriggerState {
  groups: Map<string, GroupAiTriggerState>;
}

function getState(): AiTriggerState {
  const g = globalThis as typeof globalThis & { [STATE_KEY]?: AiTriggerState };
  if (!g[STATE_KEY]) {
    g[STATE_KEY] = { groups: new Map<string, GroupAiTriggerState>() };
  }
  return g[STATE_KEY]!;
}

function getGroupState(groupKey: string): GroupAiTriggerState {
  const state = getState();
  let s = state.groups.get(groupKey);
  if (!s) {
    s = { lastBotReplyAt: 0, lastJudgeAt: 0, judgeTimestamps: [] };
    state.groups.set(groupKey, s);
  }
  return s;
}

function evictOldestKeys(map: Map<string, unknown>, max: number): void {
  if (map.size <= max) return;
  const drop = map.size - max;
  const it = map.keys();
  for (let i = 0; i < drop; i++) {
    const k = it.next().value;
    if (k !== undefined) map.delete(k);
  }
}

// ──────────────────────────── Public API ────────────────────────────

/**
 * Mark that the bot just replied in a group.
 * Call this after a successful group message send to keep the
 * active-conversation window fresh.
 */
export function markBotReply(groupId: string | number): void {
  const key = String(groupId);
  const s = getGroupState(key);
  s.lastBotReplyAt = Date.now();
  // Refresh key in insertion-ordered map for LRU semantics.
  const state = getState();
  state.groups.delete(key);
  state.groups.set(key, s);
  evictOldestKeys(state.groups, MAX_TRACKED_GROUPS);
}

// ──────────────────────────── Internals ────────────────────────────

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** Check if the bot is in an active conversation (replied within activeWindowMs). */
function isActiveConversation(s: GroupAiTriggerState, activeWindowMs: number): boolean {
  return s.lastBotReplyAt > 0 && Date.now() - s.lastBotReplyAt < activeWindowMs;
}

/**
 * Check cooldown and rate-limit.
 * Returns `true` if the judgment should be skipped (rate-limited).
 * Always returns `false` when in active conversation (bypass all limits).
 */
function shouldSkipJudge(s: GroupAiTriggerState, config: ResolvedAiTriggerConfig): boolean {
  if (isActiveConversation(s, config.activeWindowMs)) return false;

  // Cooldown: must wait at least cooldownMs since last judgment
  if (config.cooldownMs > 0 && Date.now() - s.lastJudgeAt < config.cooldownMs) {
    return true;
  }

  // Rate limit: maxJudgesPerMinute sliding window
  const now = Date.now();
  s.judgeTimestamps = s.judgeTimestamps.filter((t) => now - t < 60_000);
  if (s.judgeTimestamps.length >= config.maxJudgesPerMinute) {
    return true;
  }

  return false;
}

/** Record that a judgment was made (for rate-limiting). */
function recordJudge(s: GroupAiTriggerState): void {
  const now = Date.now();
  s.lastJudgeAt = now;
  s.judgeTimestamps.push(now);
  s.judgeTimestamps = s.judgeTimestamps.filter((t) => now - t < 60_000);
}

// ──────────────────────────── History Fetch & Format ────────────────────────────

interface HistoryMessage {
  userId: number;
  senderName: string;
  text: string;
  timestamp: number;
  isBot: boolean;
}

/**
 * Fetch recent group history via `get_group_msg_history` and format
 * into a list of messages. The current message (excludeMessageId) is
 * excluded — it will be shown separately in the prompt.
 *
 * Unlike group-history.ts, this does NOT track seen messages — every
 * call fetches a fresh snapshot of the last N messages.
 */
async function fetchRecentHistory(params: {
  httpApi: string;
  accessToken?: string;
  groupId: number;
  count: number;
  selfId: string;
  excludeMessageId?: number;
}): Promise<HistoryMessage[]> {
  const { httpApi, accessToken, groupId, count, selfId, excludeMessageId } = params;

  const resp = await callOneBotApi<{ messages: Array<Record<string, unknown>> }>(
    httpApi,
    "get_group_msg_history",
    { group_id: groupId, count },
    { accessToken, timeoutMs: 5_000 },
  );

  const rawMessages = Array.isArray(resp.data?.messages) ? resp.data.messages : [];
  const result: HistoryMessage[] = [];

  for (const m of rawMessages) {
    if (!m || typeof m !== "object") continue;

    const messageId = toNumber(m.message_id);
    const userId = toNumber(m.user_id);
    if (!messageId || !userId) continue;

    // Exclude the current message (it's shown separately in the prompt)
    if (excludeMessageId && messageId === excludeMessageId) continue;

    const sender = m.sender as { nickname?: string; card?: string } | undefined;
    const senderName = (sender?.card as string) || (sender?.nickname as string) || String(userId);

    const segments = Array.isArray(m.message) ? (m.message as OneBotSegment[]) : undefined;
    const text = segments
      ? extractTextFromSegments(segments)
      : typeof m.raw_message === "string"
        ? m.raw_message.trim()
        : "";

    if (!text) continue;

    result.push({
      userId,
      senderName,
      text,
      timestamp: toNumber(m.time) || 0,
      isBot: String(userId) === selfId,
    });
  }

  return result;
}

/** Render OneBot segments as readable text (simplified from group-history.ts). */
function extractTextFromSegments(segments: OneBotSegment[]): string {
  const parts: string[] = [];
  for (const seg of segments) {
    switch (seg.type) {
      case "text":
        parts.push(seg.data.text ?? "");
        break;
      case "at":
        parts.push(`@${seg.data.qq ?? "?"}`);
        break;
      case "image":
        parts.push("[图片]");
        break;
      case "face":
        parts.push("[表情]");
        break;
      case "record":
        parts.push("[语音]");
        break;
      case "video":
        parts.push("[视频]");
        break;
      case "file":
        parts.push("[文件]");
        break;
    }
  }
  return parts.join("").trim();
}

function formatTime(timestamp: number): string {
  if (!timestamp) return "??:??";
  const d = new Date(timestamp * 1000);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Format history messages for the LLM prompt.
 * Bot's own messages are prefixed with [你] so the model can track
 * the ongoing conversation.
 *
 * Output example:
 *   [14:30] 张三: 为什么上海这么热
 *   [14:30] [你]: 因为上海处于副热带高压控制下
 *   [14:31] 李四: 那广州为什么不热呢
 */
function formatHistoryForPrompt(messages: HistoryMessage[]): string {
  return messages
    .map((m) => {
      const time = formatTime(m.timestamp);
      const name = m.isBot ? "[你]" : m.senderName;
      return `[${time}] ${name}: ${m.text}`;
    })
    .join("\n");
}

// ──────────────────────────── LLM Judgment ────────────────────────────

const SYSTEM_PROMPT_TEMPLATE = `你是「{botName}」，{persona}。

你会看到QQ群里最近的对话记录。标注 [你] 的是你自己之前发的消息。
你需要判断最后一条消息（在【当前消息】下方）是否值得你回复。

核心判断逻辑（按顺序判断，优先级从高到低）：
1. 先判断这条消息是否在与你互动。如果本消息不是在与你互动（例如群友自言自语表达感慨、群友之间互相聊天、与你无关的话题），则倾向于不回复。
2. 如果本消息在与你互动，同时你自己又能提供实质性帮助，则回复。
   注意：仅仅"在与你互动"但你自己提供不了实质性帮助时（例如群友只是感慨"这ai这么强"），仍不回复。

辅助参考标准（在核心逻辑之外辅助判断）：
- 这条消息是否在问你问题、或在对你说话
- 这条消息是否是对你之前发言的回应（例如你刚解释了上海天气，有人接着问广州天气）
- 如果你正在参与一个持续性对话（你最近发过言，且群友在继续相关话题），应该回复以保持对话连贯
- 话题是否是你感兴趣或了解的
- 发消息的人是否是你想互动的人

参考示例（假设群聊记录为）：
群友A：@[你]，今天上海多少度
[你]：xx度

若需对以下消息分别判断是否回复：
- 群友A：难怪这么热（群友A在自言自语表达感慨，无需回复）
- 群友B：我们广东今天也热，你开空调没（群友B在与群友A互动，无需回复）
- 群友C：下班了朋友们（无关话题，也没与你互动，无需回复）
- 群友D：xx度？还要持续多久啊？（群友D在延续天气热的话题，"持续多久"是在问你，你作为ai又能帮上忙，本条需要回复）
- 群友E：这ai这么强？（虽然在与你互动，但你不能提供实质性帮助，无需回复）
- 群友F：用的什么模型？（在问你是什么模型，视为与你互动，并且你又能提供实质性帮助：解答他的问题，所以本条需要回复）

只返回JSON：{"reply": true/false, "reason": "一句话理由"}`;

function buildSystemPrompt(persona: string, botName: string): string {
  return SYSTEM_PROMPT_TEMPLATE.replace("{persona}", persona).replace("{botName}", botName);
}

function buildUserPrompt(historyText: string, currentMessage: {
  senderName: string;
  senderId: string;
  text: string;
  timestamp: number;
}): string {
  const time = formatTime(currentMessage.timestamp);
  const historySection = historyText
    ? `【最近群聊记录】\n${historyText}`
    : "【最近群聊记录】\n（无）";

  return `${historySection}

【当前消息】
${currentMessage.senderName}(${currentMessage.senderId}) ${time}: ${currentMessage.text}

这条消息值得你回复吗？`;
}

interface LlmJudgeResult {
  reply: boolean;
  reason?: string;
}

/**
 * Call the LLM to judge whether the bot should reply.
 * Uses OpenAI-compatible chat completions API.
 * Returns null on any error (timeout, HTTP error, parse failure).
 */
async function callLlmJudge(params: {
  config: ResolvedAiTriggerConfig;
  systemPrompt: string;
  userPrompt: string;
  currentMessage: { senderName: string; text: string };
}): Promise<LlmJudgeResult | null> {
  const { config, systemPrompt, userPrompt, currentMessage } = params;

  console.log(`[ai-trigger] 判断消息: ${currentMessage.senderName}: ${currentMessage.text}`);

  const url = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const body = JSON.stringify({
    model: config.model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 300,
  });

  // Try up to 2 times (retry once on empty content)
  for (let attempt = 1; attempt <= 2; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body,
        signal: controller.signal,
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        console.log(`[ai-trigger] HTTP ${res.status} ${res.statusText}: ${errBody}`);
        return null;
      }

      const data = (await res.json()) as {
        choices?: Array<{
          message?: {
            content?: string;
            reasoning_content?: string;
          };
          finish_reason?: string;
        }>;
      };

      const msg = data.choices?.[0]?.message;
      // Some providers (e.g. DeepSeek reasoner) put text in reasoning_content
      const content = msg?.content ?? msg?.reasoning_content ?? "";

      if (!content.trim()) {
        if (attempt < 2) {
          console.log(`[ai-trigger] 响应为空,重试一次...`);
          clearTimeout(timeout);
          continue;
        }
        console.log(`[ai-trigger] 重试后仍为空,放弃`);
        return null;
      }

      const parsed = parseJudgeResult(content);
      if (parsed) {
        console.log(`[ai-trigger] 判断结果: reply=${parsed.reply} reason=${parsed.reason ?? "(无)"}`);
      } else {
        console.log(`[ai-trigger] 判断结果: 解析失败 raw=${content}`);
      }
      return parsed;
    } catch (err) {
      console.log(`[ai-trigger] 调用失败 (attempt ${attempt}): ${err instanceof Error ? err.message : String(err)}`);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  return null;
}

/** Parse the LLM response content into a JudgeResult. */
function parseJudgeResult(content: string): LlmJudgeResult | null {
  // Try direct JSON parse first
  try {
    const parsed = JSON.parse(content) as { reply?: unknown; reason?: unknown };
    if (typeof parsed.reply === "boolean") {
      return { reply: parsed.reply, reason: typeof parsed.reason === "string" ? parsed.reason : undefined };
    }
  } catch {
    // Not valid JSON — try regex extraction
  }

  // Fallback: look for {"reply": true/false} pattern
  const match = content.match(/"reply"\s*:\s*(true|false)/i);
  if (match) {
    return { reply: match[1].toLowerCase() === "true" };
  }

  return null;
}

// ──────────────────────────── Main Entry ────────────────────────────

/**
 * Decide whether the bot should reply to a group message that didn't
 * @bot or hit keywordMention.
 *
 * Flow:
 *  1. Resolve config — return false if disabled/misconfigured
 *  2. Check active conversation / cooldown / rate-limit
 *  3. Fetch recent history (excluding the current message)
 *  4. Call LLM with formatted context
 *  5. Return true if the LLM says reply, false otherwise
 *
 * On any error, returns false (skip — don't reply).
 */
export async function shouldTriggerAiReply(params: {
  groupKey: string;
  groupId: number;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  selfId: string;
  botName: string;
  httpApi: string;
  accessToken?: string;
  config: ResolvedAiTriggerConfig;
  messageId?: number;
}): Promise<boolean> {
  const {
    groupKey,
    groupId,
    senderId,
    senderName,
    text,
    timestamp,
    selfId,
    botName,
    httpApi,
    accessToken,
    config,
    messageId,
  } = params;

  if (!text.trim()) return false;

  const s = getGroupState(groupKey);

  // 1. Cooldown / rate-limit check
  if (shouldSkipJudge(s, config)) return false;

  // Record this judgment attempt for rate-limiting
  recordJudge(s);

  // 2. Fetch recent history (excluding the current message)
  let historyMessages: HistoryMessage[] = [];
  try {
    historyMessages = await fetchRecentHistory({
      httpApi,
      accessToken,
      groupId,
      count: config.recentMessages,
      selfId,
      excludeMessageId: messageId,
    });
  } catch {
    // If history fetch fails, we can still try with no context
    historyMessages = [];
  }

  // 3. Format and call LLM
  const historyText = formatHistoryForPrompt(historyMessages);
  const systemPrompt = buildSystemPrompt(config.persona, botName);
  const userPrompt = buildUserPrompt(historyText, {
    senderName,
    senderId,
    text,
    timestamp,
  });

  const result = await callLlmJudge({ config, systemPrompt, userPrompt, currentMessage: { senderName, text } });

  if (result?.reply === true) {
    return true;
  }

  return false;
}

// ──────────────────────────── Test Helpers ────────────────────────────

/** Reset tracking for a single group (mainly for testing). */
export function resetAiTriggerTracking(groupId: string | number): void {
  getState().groups.delete(String(groupId));
}

/** Reset all tracking (mainly for testing). */
export function resetAllAiTriggerTracking(): void {
  getState().groups.clear();
}
