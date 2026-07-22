import { createServer } from "node:http";
import type { IncomingMessage } from "node:http";
import { execFile } from "node:child_process";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WebSocketServer, WebSocket } from "ws";
import type { OpenClawConfig } from "openclaw/plugin-sdk/core";
import { resolveDirectDmAuthorizationOutcome, resolveSenderCommandAuthorizationWithRuntime } from "openclaw/plugin-sdk/command-auth";
import { resolveOutboundMediaUrls } from "openclaw/plugin-sdk/reply-payload";
import { resolveDefaultGroupPolicy } from "openclaw/plugin-sdk/config-runtime";
import { resolveInboundRouteEnvelopeBuilderWithRuntime } from "openclaw/plugin-sdk/inbound-envelope";
import { waitUntilAbort } from "openclaw/plugin-sdk/channel-lifecycle";
import { issuePairingChallenge } from "openclaw/plugin-sdk/conversation-runtime";

// Inline stubs for internal SDK functions not available in public API
// These are minimal implementations for compatibility

// TypingCallbacks stub - returns object with required properties
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createTypingCallbacks(params: { intervalSeconds?: number; start?: () => void; onStartError?: () => void }): any {
  return {
    start: params.start ?? (() => {}),
    stop: () => {},
    onReplyStart: () => {},
    onStop: () => {},
  };
}

// ScopedPairingAccess stub - accepts core, channel, accountId
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createScopedPairingAccess(params: { core: unknown; channel: string; accountId: string }): any {
  return {
    core: params.core,
    accountId: params.accountId,
    readAllowFromStore: () => Promise.resolve([]),
    readStoreForDmPolicy: () => Promise.resolve([]),
    upsertPairingRequest: () => Promise.resolve({ code: "", created: false }),
  };
}

// ReplyPrefixOptions stub - returns object with prefix options and onModelSelected
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createReplyPrefixOptions(params: { cfg: OpenClawConfig; agentId?: string; channel?: string; accountId?: string }): any {
  return {
    prefix: "",
    stripPrefix: false,
    onModelSelected: () => {},
  };
}
import type { ResolvedNapCatAccount } from "./types.js";
import type { OneBotMessageEvent, OneBotSegment } from "./types.js";
import { sendGroupMsg, sendPrivateMsg, textSegment, replySegment, recordSegment, videoSegment, uploadGroupFile, uploadPrivateFile, getMsg } from "./api.js";
import { getNapCatRuntime } from "./runtime.js";
import { KeywordTriggerEngine } from "./features/keyword-trigger.js";
import { stripMarkdownForQQ, resolveMarkdownStripConfig } from "./features/markdown-strip.js";
import { parseCQCodes } from "./features/cq-parse.js";
import {
  fetchAndFormatGroupHistory,
  markGroupMessagesSeen,
  resolveGroupHistoryConfig,
} from "./features/group-history.js";
import {
  resolveAiTriggerConfig,
  shouldTriggerAiReply,
  markBotReply,
} from "./features/ai-trigger.js";

export type NapCatRuntimeEnv = {
  log?: (message: string) => void;
  error?: (message: string) => void;
};

export type NapCatMonitorOptions = {
  account: ResolvedNapCatAccount;
  config: OpenClawConfig;
  runtime: NapCatRuntimeEnv;
  abortSignal: AbortSignal;
  /** Port for the reverse WS server that NapCat connects to. */
  wsPort: number;
  statusSink?: (patch: { lastInboundAt?: number; lastOutboundAt?: number }) => void;
};

type NapCatCoreRuntime = ReturnType<typeof getNapCatRuntime>;

const QQ_TEXT_LIMIT = 4500;

/**
 * Per-account keyword engine cache. Rebuilt when the account's keywordTriggers
 * config object identity changes (e.g. on hot reload).
 */
const keywordEngineCache = new Map<string, { source: unknown; engine: KeywordTriggerEngine }>();

/** Build (or reuse) the keyword trigger engine for an account, or null if not configured. */
function getKeywordEngine(account: ResolvedNapCatAccount): KeywordTriggerEngine | null {
  const kw = account.config.keywordTriggers;
  if (!kw) return null;

  const triggers = kw.triggers ?? [];
  const blocklist = kw.blocklist ?? [];
  const defaultAction = kw.defaultAction ?? "passthrough";
  const hasRules = triggers.length > 0 || blocklist.length > 0 || defaultAction === "block";
  if (!hasRules) return null;

  const cached = keywordEngineCache.get(account.accountId);
  if (cached && cached.source === kw) return cached.engine;

  const engine = new KeywordTriggerEngine({
    triggers: triggers
      .filter((t) => t && t.pattern)
      .map((t) => ({
        name: t.name ?? t.pattern,
        type: t.type ?? "contains",
        pattern: t.pattern,
        action: t.action ?? "passthrough",
        command: t.command,
        caseSensitive: t.caseSensitive ?? false,
        enabled: t.enabled !== false,
      })),
    defaultAction,
    blocklist,
  });
  keywordEngineCache.set(account.accountId, { source: kw, engine });
  return engine;
}

/** Extract the reply message ID from segments (if any). */
function extractReplyMessageId(segments: OneBotSegment[]): number | undefined {
  const reply = segments.find((s) => s.type === "reply");
  if (!reply?.data.id) return undefined;
  const id = Number(reply.data.id);
  return Number.isFinite(id) ? id : undefined;
}

/** Fetch the quoted message text via get_msg API. Returns formatted quote or undefined. */
async function fetchQuotedMessageText(
  httpApi: string,
  messageId: number,
  accessToken?: string,
): Promise<string | undefined> {
  try {
    const msg = await getMsg(httpApi, messageId, accessToken);
    const senderName =
      (msg.sender.card as string) || (msg.sender.nickname as string) || String(msg.sender.user_id ?? "unknown");
    // Extract text from the quoted message segments
    const quotedText = msg.message
      .map((s) => {
        if (s.type === "text") return s.data.text ?? "";
        if (s.type === "at") return `@${s.data.qq}`;
        if (s.type === "image") return "[图片]";
        if (s.type === "face") return "[表情]";
        if (s.type === "record") return "[语音]";
        if (s.type === "video") return "[视频]";
        if (s.type === "file") return "[文件]";
        return "";
      })
      .join("")
      .trim();
    if (!quotedText) return undefined;
    return `[引用 ${senderName} 的消息: ${quotedText}]`;
  } catch {
    return undefined;
  }
}

/** Extract plain text from OneBot message segments, converting @mentions to readable form. */
function extractText(segments: OneBotSegment[]): string {
  return segments
    .map((s) => {
      if (s.type === "text") return s.data.text ?? "";
      if (s.type === "at") return `@${s.data.qq}`;
      return "";
    })
    .join("")
    .trim();
}

/** Extract image URLs from OneBot message segments. */
function extractImageUrls(segments: OneBotSegment[]): string[] {
  return segments
    .filter((s) => s.type === "image")
    .map((s) => s.data.url ?? s.data.file ?? "")
    .filter(Boolean);
}

/** Extract voice/record URL from OneBot message segments. */
function extractRecordUrl(segments: OneBotSegment[]): string | undefined {
  const record = segments.find((s) => s.type === "record");
  if (!record) return undefined;
  return record.data.url ?? record.data.file ?? undefined;
}

/** Classify outbound media by file extension. */
type MediaKind = "image" | "audio" | "video" | "file";
const AUDIO_EXTENSIONS = new Set([".mp3", ".opus", ".ogg", ".wav", ".flac", ".m4a", ".aac", ".silk", ".amr"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".avi", ".mkv", ".mov", ".webm", ".flv", ".wmv"]);
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".tiff", ".ico", ".svg"]);

function getFileExtension(url: string): string {
  const pathname = url.includes("?") ? url.slice(0, url.indexOf("?")) : url;
  const dot = pathname.lastIndexOf(".");
  if (dot === -1) return "";
  return pathname.slice(dot).toLowerCase();
}

function classifyMediaUrl(url: string): MediaKind {
  const ext = getFileExtension(url);
  if (!ext) return "image"; // fallback for extensionless URLs
  if (AUDIO_EXTENSIONS.has(ext)) return "audio";
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  return "file"; // pdf, doc, zip, etc.
}

/** Extract the file name from a URL/path. */
function extractFileName(url: string): string {
  const pathname = url.includes("?") ? url.slice(0, url.indexOf("?")) : url;
  const slash = pathname.lastIndexOf("/");
  return slash === -1 ? pathname : pathname.slice(slash + 1);
}

/** Download a URL and convert to wav using ffmpeg. Returns the wav file path. */
async function downloadAndConvertToWav(
  url: string,
  fetcher: (params: { url: string; maxBytes: number }) => Promise<{ buffer: Buffer; contentType: string }>,
  maxBytes: number,
): Promise<string | undefined> {
  const fetched = await fetcher({ url, maxBytes });
  const ts = Date.now();
  const inputPath = join(tmpdir(), `napcat-voice-${ts}.silk`);
  const outputPath = join(tmpdir(), `napcat-voice-${ts}.wav`);

  await writeFile(inputPath, fetched.buffer);

  return new Promise<string | undefined>((resolve) => {
    execFile(
      "ffmpeg",
      ["-y", "-i", inputPath, "-ar", "16000", "-ac", "1", "-f", "wav", outputPath],
      { timeout: 15_000 },
      async (err) => {
        // Clean up input file
        await unlink(inputPath).catch(() => {});
        if (err) {
          await unlink(outputPath).catch(() => {});
          resolve(undefined);
        } else {
          resolve(outputPath);
        }
      },
    );
  });
}

/** Check if the message contains an @bot mention. */
function hasBotMention(segments: OneBotSegment[], selfId: string): boolean {
  return segments.some(
    (s) => s.type === "at" && s.data.qq === selfId,
  );
}

/**
 * Check whether the message text contains any of the configured activation
 * keywords (case-insensitive). In group chats this acts as an alternative to an
 * @bot mention for deciding whether to handle the message.
 */
function hasTriggerKeyword(segments: OneBotSegment[], keywords?: string[]): boolean {
  if (!keywords || keywords.length === 0) return false;
  const text = extractText(segments).toLowerCase();
  if (!text) return false;
  return keywords.some((k) => k && text.includes(k.toLowerCase()));
}

/** Strip @bot mention segments and leading whitespace from text. */
function stripBotMention(segments: OneBotSegment[], selfId: string): OneBotSegment[] {
  return segments.filter(
    (s) => !(s.type === "at" && s.data.qq === selfId),
  );
}

/** Determine if sender is allowed based on allowlist. */
function isNapCatSenderAllowed(
  senderId: string,
  allowFrom: Array<string | number>,
): boolean {
  return allowFrom.some((entry) => String(entry) === "*" || String(entry) === senderId);
}

/**
 * Start a reverse WebSocket server for NapCat to connect to.
 * NapCat will initiate the connection to this server.
 */
export async function monitorNapCatProvider(options: NapCatMonitorOptions): Promise<void> {
  const { account, config, runtime, abortSignal, wsPort, statusSink } = options;
  const core = getNapCatRuntime();

  runtime.log?.(`[${account.accountId}] NapCat starting reverse WS server on port ${wsPort}`);

  const server = createServer();
  const wss = new WebSocketServer({ server });

  let activeWs: WebSocket | null = null;

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const selfId = req.headers["x-self-id"];
    runtime.log?.(`[${account.accountId}] NapCat connected, self_id=${selfId ?? "unknown"}`);
    activeWs = ws;

    ws.on("message", (raw: Buffer) => {
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(raw.toString()) as Record<string, unknown>;
      } catch {
        runtime.error?.(`[${account.accountId}] NapCat: invalid JSON from WS`);
        return;
      }

      // Ignore meta events (heartbeat, lifecycle)
      if (data.post_type === "meta_event") return;

      // Only handle message events
      if (data.post_type !== "message") return;

      const event = data as unknown as OneBotMessageEvent;
      processMessage(event, account, config, runtime, core, statusSink).catch((err) => {
        runtime.error?.(`[${account.accountId}] NapCat message processing error: ${String(err)}`);
      });
    });

    ws.on("close", () => {
      runtime.log?.(`[${account.accountId}] NapCat WS disconnected`);
      if (activeWs === ws) activeWs = null;
    });

    ws.on("error", (err) => {
      runtime.error?.(`[${account.accountId}] NapCat WS error: ${String(err)}`);
    });
  });

  return new Promise<void>((resolve, reject) => {
    server.listen(wsPort, "0.0.0.0", () => {
      runtime.log?.(`[${account.accountId}] NapCat reverse WS server listening on ws://0.0.0.0:${wsPort}`);
    });

    server.on("error", (err) => {
      runtime.error?.(`[${account.accountId}] NapCat WS server error: ${String(err)}`);
      reject(err);
    });

    // Cleanup on abort
    const onAbort = () => {
      runtime.log?.(`[${account.accountId}] NapCat stopping WS server`);
      wss.clients.forEach((client) => client.close());
      wss.close();
      server.close();
      resolve();
    };

    if (abortSignal.aborted) {
      onAbort();
      return;
    }
    abortSignal.addEventListener("abort", onAbort, { once: true });
  });
}

async function processMessage(
  event: OneBotMessageEvent,
  account: ResolvedNapCatAccount,
  config: OpenClawConfig,
  runtime: NapCatRuntimeEnv,
  core: NapCatCoreRuntime,
  statusSink?: (patch: { lastInboundAt?: number; lastOutboundAt?: number }) => void,
): Promise<void> {
  const isGroup = event.message_type === "group";
  const senderId = String(event.user_id);
  const senderName = event.sender.card || event.sender.nickname;
  const chatId = isGroup ? String(event.group_id) : senderId;
  const selfId = account.selfId || String(event.self_id);

  // In group chats, require an @bot mention OR one of the configured activation keywords.
  // If neither matches, try AI trigger (small model judges whether to reply).
  if (
    isGroup &&
    !hasBotMention(event.message, selfId) &&
    !hasTriggerKeyword(event.message, account.config.keywordMention)
  ) {
    const aiConfig = resolveAiTriggerConfig(account.config.aiTrigger);
    if (!aiConfig) return;

    const triggerText = extractText(event.message);
    if (!triggerText.trim()) return;

    const botName = account.name || selfId;
    const shouldReply = await shouldTriggerAiReply({
      groupKey: chatId,
      groupId: Number(chatId),
      senderId,
      senderName: senderName || senderId,
      text: triggerText,
      timestamp: event.time || Math.floor(Date.now() / 1000),
      selfId,
      botName,
      httpApi: account.httpApi,
      accessToken: account.accessToken,
      config: aiConfig,
      messageId: event.message_id,
    });
    if (!shouldReply) return;
    // shouldReply=true → fall through to normal processing
  }

  // Strip @bot mention from message for processing
  const cleanSegments = isGroup
    ? stripBotMention(event.message, selfId)
    : event.message;

  let text = extractText(cleanSegments);

  // Keyword trigger filtering: drop blocked messages, strip trigger words, or map to a command.
  const keywordEngine = getKeywordEngine(account);
  if (keywordEngine && text) {
    const kw = keywordEngine.match(text);
    if (kw.blockMessage) {
      runtime.log?.(`[${account.accountId}] keyword filter blocked message from ${senderId}`);
      return;
    }
    if (kw.matched && kw.trigger) {
      if (kw.trigger.action === "command" && kw.trigger.command) {
        text = kw.trigger.command;
      } else if (kw.trigger.action === "passthrough" && kw.remainingText) {
        // Strip the trigger keyword; keep original text when nothing remains (e.g. exact activation words).
        text = kw.remainingText;
      }
    }
  }

  const imageUrls = extractImageUrls(cleanSegments);
  const recordUrl = extractRecordUrl(cleanSegments);

  // Fetch quoted message content if this is a reply
  const replyMsgId = extractReplyMessageId(event.message);
  if (replyMsgId) {
    const quotedText = await fetchQuotedMessageText(
      account.httpApi,
      replyMsgId,
      account.accessToken,
    );
    if (quotedText) {
      text = quotedText + "\n" + text;
    }
  }

  // Skip empty messages
  if (!text && imageUrls.length === 0 && !recordUrl) return;

  // Will be set if voice STT succeeds.
  let voiceTranscript: string | undefined;

  statusSink?.({ lastInboundAt: Date.now() });

  // Download first image if present
  let mediaPath: string | undefined;
  let mediaType: string | undefined;
  if (imageUrls.length > 0) {
    try {
      const mediaMaxMb = account.config.mediaMaxMb ?? 5;
      const maxBytes = mediaMaxMb * 1024 * 1024;
      const fetched = await core.channel.media.fetchRemoteMedia({
        url: imageUrls[0],
        maxBytes,
      });
      const saved = await core.channel.media.saveMediaBuffer(
        fetched.buffer,
        fetched.contentType,
        "inbound",
        maxBytes,
      );
      mediaPath = saved.path;
      mediaType = saved.contentType;
    } catch (err) {
      runtime.error?.(`[${account.accountId}] Failed to download QQ image: ${String(err)}`);
    }
  } else if (recordUrl) {
    // Voice message: download → ffmpeg wav → STT transcribe → text
    try {
      const mediaMaxMb = account.config.mediaMaxMb ?? 5;
      const maxBytes = mediaMaxMb * 1024 * 1024;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wavPath = await downloadAndConvertToWav(
        recordUrl,
        core.channel.media.fetchRemoteMedia as any,
        maxBytes,
      );
      if (wavPath) {
        try {
          const result = await core.stt.transcribeAudioFile({
            filePath: wavPath,
            cfg: config,
            mime: "audio/wav",
          });
          if (result.text) {
            // Transcription succeeded — use text instead of raw audio.
            voiceTranscript = result.text;
            await unlink(wavPath).catch(() => {});
            runtime.log?.(`[${account.accountId}] Voice transcribed: ${result.text.slice(0, 80)}`);
          } else {
            // STT returned empty; fall back to passing audio file.
            mediaPath = wavPath;
            mediaType = "audio/wav";
          }
        } catch (sttErr) {
          runtime.error?.(`[${account.accountId}] STT failed, falling back to audio: ${String(sttErr)}`);
          mediaPath = wavPath;
          mediaType = "audio/wav";
        }
      } else {
        runtime.error?.(`[${account.accountId}] ffmpeg voice conversion failed`);
      }
    } catch (err) {
      runtime.error?.(`[${account.accountId}] Failed to process QQ voice: ${String(err)}`);
    }
  }

  // Authorization pipeline
  const pairing = createScopedPairingAccess({
    core,
    channel: "napcat",
    accountId: account.accountId,
  });

  const dmPolicy = account.config.dmPolicy ?? "allowlist";
  const configAllowFrom = (account.config.allowFrom ?? []).map((v) => String(v));
  const configuredGroupAllowFrom = (account.config.groupAllowFrom ?? []).map((v) => String(v));
  const groupAllowFrom =
    configuredGroupAllowFrom.length > 0 ? configuredGroupAllowFrom : configAllowFrom;

  // Group access control
  if (isGroup) {
    const groupPolicy = account.config.groupPolicy ?? resolveDefaultGroupPolicy(config);
    if (groupPolicy === "disabled") {
      return;
    }
    if (groupPolicy === "allowlist") {
      if (!isNapCatSenderAllowed(senderId, groupAllowFrom)) {
        return;
      }
    }
  }

  // Merge voice transcript into message body when available.
  const effectiveText = voiceTranscript
    ? (text ? `${text}\n[语音转文字] ${voiceTranscript}` : `[语音转文字] ${voiceTranscript}`)
    : text;
  const rawBody = effectiveText || (mediaPath ? "<media:image>" : "");
  const { senderAllowedForCommands, commandAuthorized } =
    await resolveSenderCommandAuthorizationWithRuntime({
      cfg: config,
      rawBody,
      isGroup,
      dmPolicy,
      configuredAllowFrom: configAllowFrom,
      configuredGroupAllowFrom: groupAllowFrom,
      senderId,
      isSenderAllowed: isNapCatSenderAllowed,
      readAllowFromStore: pairing.readAllowFromStore,
      runtime: core.channel.commands,
    });

  // DM authorization
  const directDmOutcome = resolveDirectDmAuthorizationOutcome({
    isGroup,
    dmPolicy,
    senderAllowedForCommands,
  });
  if (directDmOutcome === "disabled") return;
  if (directDmOutcome === "unauthorized") {
    if (dmPolicy === "pairing") {
      await issuePairingChallenge({
        channel: "napcat",
        senderId,
        senderIdLine: `Your QQ number: ${senderId}`,
        meta: { name: senderName ?? undefined },
        upsertPairingRequest: pairing.upsertPairingRequest,
        onCreated: () => {
          runtime.log?.(`[${account.accountId}] napcat pairing request sender=${senderId}`);
        },
        sendPairingReply: async (replyText) => {
          try {
            await sendPrivateMsg(
              account.httpApi,
              Number(senderId),
              [textSegment(replyText)],
              account.accessToken,
            );
            statusSink?.({ lastOutboundAt: Date.now() });
          } catch (err) {
            runtime.error?.(`[${account.accountId}] pairing reply failed: ${String(err)}`);
          }
        },
        onReplyError: (err) => {
          runtime.error?.(`[${account.accountId}] pairing reply error: ${String(err)}`);
        },
      });
    }
    return;
  }

  // Route resolution — groups share one session per group by default
  // (aligned with OpenClaw standard `agent:<agentId>:napcat:group:<id>`).
  // Set groupSessionScope: "per-user" to isolate each sender's context.
  const groupScope = account.config.groupSessionScope ?? "per-group";
  const groupPeerId =
    isGroup && groupScope === "per-user" ? `${chatId}:${senderId}` : chatId;
  const fromLabel = isGroup ? `group:${chatId}` : senderName || `user:${senderId}`;
  const { route, buildEnvelope } = resolveInboundRouteEnvelopeBuilderWithRuntime({
    cfg: config,
    channel: "napcat",
    accountId: account.accountId,
    peer: {
      kind: isGroup ? "group" : "direct",
      id: isGroup ? groupPeerId : chatId,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    runtime: core.channel as any,
    sessionStore: config.session?.store,
  });

  // Block unauthorized control commands in groups
  if (
    isGroup &&
    core.channel.commands.isControlCommandMessage(rawBody, config) &&
    commandAuthorized !== true
  ) {
    return;
  }

  // ── Group chat history context ──────────────────────────────────
  // For group triggers, fetch messages since the bot's last activation
  // and pass them to the AI via BodyForAgent only. RawBody / Body /
  // CommandBody stay as the original rawBody so the SDK's command
  // detection and session management are unaffected.
  let historyContext: string | undefined;
  if (isGroup) {
    const historyConfig = resolveGroupHistoryConfig(account.config.groupHistory);
    if (historyConfig.limit > 0) {
      // Mark the trigger message as seen so it won't appear in history.
      markGroupMessagesSeen(chatId, [event.message_id]);
      const historyStartedAt = Date.now();
      const history = await fetchAndFormatGroupHistory({
        httpApi: account.httpApi,
        accessToken: account.accessToken,
        groupId: Number(chatId),
        config: historyConfig,
        excludeMessageIds: [event.message_id],
      });
      if (history) {
        historyContext = history.text;
        runtime.log?.(
          `[${account.accountId}] group history attached: ${history.count} msgs, ${history.text.length} chars, ${Date.now() - historyStartedAt}ms`,
        );
      }
    }
  }

  // BodyForAgent = history + original body (only seen by the AI model).
  // All other fields (Body, RawBody, CommandBody) use the original
  // rawBody so the SDK's envelope / command / session pipeline is not
  // disturbed by the prepended history block.
  const bodyForAgent = historyContext
    ? `${historyContext}\n\n${rawBody}`
    : rawBody;

  const { storePath, body } = buildEnvelope({
    channel: "QQ",
    from: fromLabel,
    timestamp: event.time ? event.time * 1000 : undefined,
    body: rawBody,
  });

  const targetPrefix = isGroup ? `napcat:group:${chatId}` : `napcat:${senderId}`;
  const ctxPayload = core.channel.reply.finalizeInboundContext({
    Body: body,
    BodyForAgent: bodyForAgent,
    RawBody: rawBody,
    CommandBody: rawBody,
    From: targetPrefix,
    To: isGroup ? `napcat:group:${chatId}` : `napcat:${chatId}`,
    SessionKey: route.sessionKey,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    AccountId: (route as any).accountId ?? account.accountId,
    ChatType: isGroup ? "group" : "direct",
    ConversationLabel: fromLabel,
    SenderName: senderName || undefined,
    SenderId: senderId,
    CommandAuthorized: commandAuthorized,
    Provider: "napcat",
    Surface: "napcat",
    MessageSid: String(event.message_id),
    MediaPath: mediaPath,
    MediaType: mediaType,
    MediaUrl: mediaPath,
    OriginatingChannel: "napcat",
    OriginatingTo: isGroup ? `napcat:group:${chatId}` : `napcat:${chatId}`,
  });

  await core.channel.session.recordInboundSession({
    storePath,
    sessionKey: ctxPayload.SessionKey ?? route.sessionKey,
    ctx: ctxPayload,
    onRecordError: (err) => {
      runtime.error?.(`napcat: failed updating session meta: ${String(err)}`);
    },
  });

  const tableMode = core.channel.text.resolveMarkdownTableMode({
    cfg: config,
    channel: "napcat",
    accountId: account.accountId,
  });

  const { onModelSelected, ...prefixOptions } = createReplyPrefixOptions({
    cfg: config,
    agentId: route.agentId,
    channel: "napcat",
    accountId: account.accountId,
  });

  const typingCallbacks = createTypingCallbacks({
    start: async () => {
      // QQ doesn't have a "typing" indicator via OneBot, no-op
    },
    onStartError: () => {},
  });

  await core.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
    ctx: ctxPayload,
    cfg: config,
    dispatcherOptions: {
      ...prefixOptions,
      typingCallbacks,
      deliver: async (payload) => {
        await deliverNapCatReply({
          payload,
          account,
          chatId,
          isGroup,
          runtime,
          core,
          config,
          statusSink,
          tableMode,
          replyToMessageId: event.message_id,
        });
      },
      onError: (err, info) => {
        runtime.error?.(`[${account.accountId}] NapCat ${info.kind} reply failed: ${String(err)}`);
      },
    },
    replyOptions: {
      onModelSelected,
    },
  });
}

async function deliverNapCatReply(params: {
  payload: { text?: string; mediaUrls?: string[] };
  account: ResolvedNapCatAccount;
  chatId: string;
  isGroup: boolean;
  runtime: NapCatRuntimeEnv;
  core: NapCatCoreRuntime;
  config: OpenClawConfig;
  statusSink?: (patch: { lastInboundAt?: number; lastOutboundAt?: number }) => void;
  tableMode?: string;
  /** Original message ID to quote-reply in group chats. */
  replyToMessageId?: number;
}): Promise<void> {
  const { payload, account, chatId, isGroup, runtime, core, config, statusSink } = params;
  const tableMode = (params.tableMode ?? "code") as any;
  const stripCfg = resolveMarkdownStripConfig(account.config.markdownStrip);
  const stripped = stripCfg.enabled
    ? stripMarkdownForQQ(payload.text ?? "")
    : (payload.text ?? "");
  let text = core.channel.text.convertMarkdownTables(stripped, tableMode);
  if (stripCfg.enabled) {
    // SDK bullets 模式给表头加 **bold**；strip 已清用户 markdown，
    // 剩余的 ** 必来自 SDK，转为 【】 与标题风格统一
    text = text.replace(/^\*\*(.+?)\*\*$/gm, "【$1】");
  }
  const mediaUrls = resolveOutboundMediaUrls(payload);

  // In group chats, prepend a reply segment to quote the original message.
  const replyPrefix: OneBotSegment[] =
    isGroup && params.replyToMessageId
      ? [replySegment(params.replyToMessageId)]
      : [];

  // Classify outbound media into categories for QQ delivery.
  const imageSegments: OneBotSegment[] = [];
  const audioSegments: OneBotSegment[] = [];
  const videoSegments: OneBotSegment[] = [];
  const fileUrls: string[] = [];
  for (const url of mediaUrls) {
    const kind = classifyMediaUrl(url);
    if (kind === "audio") {
      audioSegments.push(recordSegment(url));
    } else if (kind === "video") {
      videoSegments.push(videoSegment(url));
    } else if (kind === "file") {
      fileUrls.push(url);
    } else {
      imageSegments.push({ type: "image", data: { file: url } });
    }
  }

  // Helper: send a message via group or private.
  // In group chats, the resulting message_id is marked as "seen" so it
  // won't reappear in the next group-history context block (it's already
  // in the agent's session as the bot's own reply). AI replies are still
  // kept in history on first fetch — only the just-sent reply is skipped
  // on the next trigger, avoiding redundant context.
  const send = async (segments: OneBotSegment[]) => {
    if (isGroup) {
      const result = await sendGroupMsg(account.httpApi, Number(chatId), segments, account.accessToken);
      statusSink?.({ lastOutboundAt: Date.now() });
      if (result?.message_id) {
        markGroupMessagesSeen(chatId, [result.message_id]);
      }
      markBotReply(chatId);
    } else {
      await sendPrivateMsg(account.httpApi, Number(chatId), segments, account.accessToken);
      statusSink?.({ lastOutboundAt: Date.now() });
    }
  };

  // Add text (chunked if needed)
  if (text) {
    const chunkMode = core.channel.text.resolveChunkMode(config, "napcat", account.accountId);
    const chunks = core.channel.text.chunkMarkdownTextWithMode(text, QQ_TEXT_LIMIT, chunkMode);
    for (let i = 0; i < chunks.length; i++) {
      // First chunk gets reply-quote + images; subsequent chunks are plain text.
      const toSend =
        i === 0
          ? [...replyPrefix, ...imageSegments, ...parseCQCodes(chunks[i])]
          : [...parseCQCodes(chunks[i])];

      try {
        await send(toSend);
      } catch (err) {
        runtime.error?.(`NapCat message send failed: ${String(err)}`);
      }
    }
  } else if (imageSegments.length > 0) {
    // Image only, no text — still quote the original message.
    try {
      await send([...replyPrefix, ...imageSegments]);
    } catch (err) {
      runtime.error?.(`NapCat image send failed: ${String(err)}`);
    }
  }

  // Voice segments must be sent separately (QQ record segments cannot mix with text/image).
  for (const seg of audioSegments) {
    try {
      await send([seg]);
    } catch (err) {
      runtime.error?.(`NapCat voice send failed: ${String(err)}`);
    }
  }

  // Video segments must also be sent individually.
  for (const seg of videoSegments) {
    try {
      await send([seg]);
    } catch (err) {
      runtime.error?.(`NapCat video send failed: ${String(err)}`);
    }
  }

  // Files (pdf, doc, zip, etc.) use the upload_file API (NapCat extension).
  for (const url of fileUrls) {
    const name = extractFileName(url);
    try {
      if (isGroup) {
        await uploadGroupFile(account.httpApi, Number(chatId), url, name, account.accessToken);
      } else {
        await uploadPrivateFile(account.httpApi, Number(chatId), url, name, account.accessToken);
      }
      statusSink?.({ lastOutboundAt: Date.now() });
    } catch (err) {
      runtime.error?.(`NapCat file upload failed: ${String(err)}`);
    }
  }
}
