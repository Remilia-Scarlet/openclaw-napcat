# @hyl_aa/napcat

English | [中文](./README.md)

OpenClaw extension for QQ messaging via [NapCat](https://github.com/NapNeko/NapCatQQ) (OneBot 11 reverse WebSocket).

Let your AI assistant fully control QQ interactions through natural language -- like, poke, mute, kick, query user profiles, manage groups, and more.

> **v1.3.0**: Security hardening (rate limiting / admin levels / audit log), long message strategies (streaming/HTML image/forward), keyword triggers, group event hooks (join/leave automation), group chat history context, AI smart trigger (small model decides whether to reply), group history image download, current message block.

## Features

- **45 AI Agent Tools** -- AI can execute QQ actions via natural language commands
- **Voice-to-Text (STT)** -- Auto-transcribes voice messages before sending to AI
- **@Mention Resolution** -- Recognizes `@QQNumber` in messages and maps to user IDs
- **Group Management** -- Full admin toolkit: mute, kick, set admin, rename group, announcements
- **Multi-Account** -- Supports multiple NapCat bot accounts
- **🔒 Security Hardening** -- Token bucket rate limiting, admin permission levels (L1-L4), audit log
- **📝 Long Message Strategies** -- Three modes: streaming / HTML-to-image / merged forward
- **🎯 Keyword Triggers** -- Exact/prefix/suffix/regex/contains matching
- **🔔 Group Event Hooks** -- Join/leave/ban automation
- **✂️ Markdown Strip** -- QQ doesn't render Markdown; auto-converts `**bold**`, `## headings`, `|tables|`, etc. in AI replies to plain text
- **📨 CQ Code Parsing** -- AI can write `[CQ:at,qq=QQNumber]` in replies to @mention group members; auto-splits into structured segments supporting all OneBot CQ types (`at`/`face`/`image`/`reply`...)
- **💬 Group Chat History** -- Auto-appends group messages since last wake-up as context; images in history are downloaded locally and inlined as `[image: <path>]`; the triggering message is appended as a separate block after the history
- **👥 Group Session Scope** -- All members share one session by default (`per-group`), or configure `per-user` for independent sessions
- **🧠 AI Smart Trigger** -- No @mention or wake word needed; a small model judges whether a group message is worth replying to; active conversations skip cooldown for high-frequency interaction

## Agent Tools

### Query Tools

| Tool | Description | Owner Only |
|------|-------------|:----------:|
| `qq_like_user` | Give a user thumbs-up (like) | |
| `qq_get_user_info` | Get user profile (nickname, age, signature, etc.) | |
| `qq_get_group_info` | Get group info (name, member count) | |
| `qq_get_group_member_info` | Get a member's info within a group | |
| `qq_get_friend_list` | Get bot's friend list | |
| `qq_get_group_list` | Get bot's group list | |
| `qq_get_group_member_list` | Get all members of a group | |
| `qq_get_group_honor_info` | Get group honor/achievements (Dragon King, etc.) | |

### Message History & Context

| Tool | Description | Owner Only |
|------|-------------|:----------:|
| `qq_get_group_msg_history` | Get group chat message history | |
| `qq_get_friend_msg_history` | Get private chat message history | |
| `qq_get_essence_msg_list` | Get group essence (pinned) message list | |

### Interaction Tools

| Tool | Description | Owner Only |
|------|-------------|:----------:|
| `qq_poke` | Send a poke/nudge to a user | |
| `qq_recall_message` | Recall (delete) a sent message | Yes |
| `qq_set_msg_emoji_like` | React to a message with an emoji | |
| `qq_ocr_image` | OCR text recognition on an image | |
| `qq_translate_en2zh` | Translate English to Chinese | |
| `qq_mark_msg_as_read` | Mark messages as read | |

### Messaging

| Tool | Description | Owner Only |
|------|-------------|:----------:|
| `qq_send_message` | Send text/image/voice/video messages | |
| `qq_upload_file` | Upload a file to group or private chat | |
| `qq_forward_message` | Forward a message | |
| `qq_send_group_forward_msg` | Send merged forward message to group | |
| `qq_send_private_forward_msg` | Send merged forward message to private chat | |
| `qq_download_file` | Download a file to bot's local storage | Yes |

### Essence Message Management

| Tool | Description | Owner Only |
|------|-------------|:----------:|
| `qq_set_essence_msg` | Pin a message as essence | Yes |
| `qq_delete_essence_msg` | Remove a message from essence | Yes |

### Friend Management

| Tool | Description | Owner Only |
|------|-------------|:----------:|
| `qq_set_friend_remark` | Set a friend's remark/alias | Yes |
| `qq_delete_friend` | Delete a friend | Yes |

### Group Management

| Tool | Description | Owner Only |
|------|-------------|:----------:|
| `qq_mute_group_member` | Mute a member for specified duration | Yes |
| `qq_kick_group_member` | Kick a member from a group | Yes |
| `qq_set_group_card` | Set member's display name in group | Yes |
| `qq_set_group_admin` | Set/unset group admin | Yes |
| `qq_set_group_name` | Change group name | Yes |
| `qq_set_group_whole_ban` | Toggle whole-group mute | Yes |
| `qq_set_group_special_title` | Set member's special title | Yes |
| `qq_set_group_leave` | Leave a group | Yes |
| `qq_set_group_portrait` | Set group avatar | Yes |
| `qq_set_group_sign` | Daily group sign-in/check-in | |
| `qq_set_group_remark` | Set group remark (bot-side note) | Yes |
| `qq_get_group_at_all_remain` | Query remaining @all quota | |

### Group Notice Management

| Tool | Description | Owner Only |
|------|-------------|:----------:|
| `qq_send_group_notice` | Send group announcement | Yes |
| `qq_get_group_notice` | Get group announcements | |
| `qq_delete_group_notice` | Delete a group announcement | Yes |

### Group File Management

| Tool | Description | Owner Only |
|------|-------------|:----------:|
| `qq_get_group_root_files` | List files in group root directory | |
| `qq_get_group_file_url` | Get download URL for a group file | |
| `qq_create_group_file_folder` | Create a folder in group files | Yes |
| `qq_delete_group_file` | Delete a group file | Yes |

### Request Handling

| Tool | Description | Owner Only |
|------|-------------|:----------:|
| `qq_handle_friend_request` | Approve/reject friend requests | Yes |
| `qq_handle_group_request` | Approve/reject group join requests | Yes |

## Prerequisites

- [OpenClaw](https://github.com/openclaw/openclaw) >= 2026.3.14
- [NapCat](https://github.com/NapNeko/NapCatQQ) running with HTTP API and reverse WebSocket enabled
- Node.js 22+

## Installation

**Option 1: Install from npm (recommended)**

```bash
openclaw plugins install @hyl_aa/napcat
```

**Option 2: Manual clone**

```bash
cd ~/.openclaw/extensions
git clone https://github.com/Aliang1337/openclaw-napcat.git napcat
cd napcat && npm install --omit=dev
```

Restart OpenClaw (`openclaw restart`) after installation.

## Configuration

### NapCat Side

Enable the following in your NapCat configuration:

1. **HTTP API** -- for sending messages (default port `3000`)
2. **Reverse WebSocket** -- for receiving messages, connecting to the WS port assigned by OpenClaw (starting from `18800`)

NapCat reverse WS config example:

```json
{
  "reverseWs": {
    "enable": true,
    "urls": ["ws://127.0.0.1:18800"]
  }
}
```

> For multi-account setups, ports increment sequentially (18800, 18801, 18802...).

### OpenClaw Side

Add to your OpenClaw config (`openclaw config edit`):

```json
{
  "channels": {
    "napcat": {
      "httpApi": "http://127.0.0.1:3000",
      "accessToken": "your-token-here",
      "selfId": "123456789",
      "dmPolicy": "allowlist",
      "allowFrom": ["friend_qq_number"],
      "groupPolicy": "allowlist",
      "groupAllowFrom": ["group_number"],
      "markdownStrip": true
    }
  }
}
```

### Multi-Account Configuration

```json
{
  "channels": {
    "napcat": {
      "defaultAccount": "bot1",
      "accounts": {
        "bot1": {
          "name": "Main Bot",
          "httpApi": "http://127.0.0.1:3000",
          "accessToken": "token1",
          "selfId": "111111111",
          "allowFrom": ["friend_qq_number"]
        },
        "bot2": {
          "name": "Secondary Bot",
          "httpApi": "http://127.0.0.1:3001",
          "selfId": "222222222",
          "allowFrom": ["friend_qq_number"]
        }
      }
    }
  }
}
```

### Config Fields

| Field | Description | Default |
|-------|-------------|---------|
| `httpApi` | NapCat OneBot 11 HTTP API address | - |
| `accessToken` | API auth token (optional) | - |
| `selfId` | Bot's own QQ number (for @mention detection) | - |
| `dmPolicy` | DM policy: `allowlist` / `pairing` / `open` / `disabled` | `allowlist` |
| `allowFrom` | Allowed QQ numbers for DM | `[]` |
| `groupPolicy` | Group policy: `allowlist` / `open` / `disabled` | `open` |
| `groupAllowFrom` | Allowed QQ numbers in groups (falls back to `allowFrom`) | `[]` |
| `mediaMaxMb` | Max inbound media file size in MB | `5` |
| `responsePrefix` | Prefix for AI reply messages (optional) | - |
| `keywordMention` | Group activation keywords; a message containing any of them counts as an @mention (case-insensitive) | `[]` |
| `markdownStrip` | Strip Markdown syntax from AI replies (QQ doesn't render Markdown) | `true` |
| `enabled` | Enable/disable this account | `true` |

**Important:** Set `tools.profile` to `"full"` in your OpenClaw config, otherwise `qq_*` tools will be filtered out by the default `"coding"` profile.

## Usage Examples

Once configured, just talk to your AI in QQ:

- "Help me like user 3870871935" -- AI calls `qq_like_user`
- "Analyze @someone's signature" -- AI extracts QQ number from @mention, calls `qq_get_user_info`
- "Show group member list" -- AI calls `qq_get_group_member_list`
- "Mute @someone for 10 minutes" -- AI calls `qq_mute_group_member` (owner only)
- "Post a group announcement: meeting tomorrow" -- AI calls `qq_send_group_notice` (owner only)
- "Show me recent group chat history" -- AI calls `qq_get_group_msg_history`
- "Pin this message as essence" -- AI calls `qq_set_essence_msg` (owner only)
- "Read the text in this image" -- AI calls `qq_ocr_image`
- "What files are in the group folder?" -- AI calls `qq_get_group_root_files`

## Voice Messages

When voice STT is enabled (`tools.media.audio.enabled: true`), voice messages are automatically transcribed to text before being sent to the AI model.

## Markdown Strip

QQ clients don't render Markdown, so syntax like `**bold**`, `## headings`, `` `code` ``, `|tables|`, `[links](url)` in AI replies would show as raw characters. This plugin converts Markdown to readable plain text before sending:

| Syntax | Converted to | Notes |
|--------|--------------|-------|
| `**bold**` `*italic*` `~~strike~~` | `bold` `italic` `strike` | Markers removed, content kept |
| `## heading` | `【heading】` | All heading levels |
| `- list` `* list` `+ list` | `• list` | Unordered lists |
| `1. list` | `1. list` | Ordered lists keep numbering |
| `> quote` | `『quote』` | Per line |
| `---` `***` `___` | `————` | Horizontal rules |
| `[text](url)` | `text(url)` | Links keep URL |
| `![alt](url)` | `alt(url)` | Images keep URL (no alt → `[图片]`) |
| ```` ```code``` ```` | `code` | Code blocks: fence removed, content kept |
| `` `code` `` | `code` | Inline code: backticks removed |

> Code block and inline code contents are protected — internal `*`, `#` etc. are not processed.
>
> Tables go through Markdown strip first (cleaning emphasis/links inside cells), then SDK column alignment — so stripping happens before alignment for correct results.

Enabled by default. To disable:

```json
{
  "channels": {
    "napcat": {
      "markdownStrip": false
    }
  }
}
```

Object form also supported: `"markdownStrip": { "enabled": false }`.

## CQ Code Parsing (AI Reply @mentions)

Under OneBot 11's array message format, plain text segments are literal — `[CQ:at,qq=xxx]` is not re-parsed. But AI replies are plain strings that cannot directly produce structured segments. The plugin ships a CQ code parser on all outbound paths: the AI simply writes `[CQ:at,qq=QQNumber]` in its reply text and the plugin splits it into the corresponding `at` segment.

### Usage

Embed CQ codes directly in AI replies:

```
[CQ:at,qq=123456789] Hello, welcome to the group!
```

The plugin splits it into:

```
[{type:"at", data:{qq:"123456789"}}, {type:"text", data:{text:" Hello, welcome to the group!"}}]
```

### Supported CQ Types

The parser is generic — any `[CQ:type,key=val,...]` becomes a `{type, data:{...}}` segment. Examples:

| CQ Code | Description | Example |
|---------|-------------|---------|
| `[CQ:at,qq=QQ]` | @mention someone | `[CQ:at,qq=123456789]` |
| `[CQ:at,qq=all]` | @all members | `[CQ:at,qq=all]` |
| `[CQ:face,id=ID]` | QQ emoji | `[CQ:face,id=5]` |
| `[CQ:image,file=URL]` | Image | `[CQ:image,file=https://x.com/a.jpg]` |
| `[CQ:reply,id=MSGID]` | Reply quote | `[CQ:reply,id=99]` |

> Special characters in CQ values must be escaped: `[` → `&#91;`, `]` → `&#93;`, `,` → `&#44;`, `&` → `&amp;`. The parser unescapes them automatically.

### Active Paths

CQ parsing is active on all three send paths:

- **AI group/private replies** (main path, with quote-reply and chunking)
- **Channel outbound** (`sendMessageNapCat`)
- **`qq_send_message` tool** (AI-initiated tool calls)

> No configuration needed — enabled by default. Plain text without CQ codes behaves exactly as before.

---

## 💬 Group Chat History Context

In group chats, when the AI is triggered by @mention or wake word, the plugin automatically fetches recent group messages via the `get_group_msg_history` API and filters out messages that have **already been attached**, appending only **new messages since last wake-up** as context before the current message. This gives the AI awareness of what was said while it was "silent".

### Features

- **Incremental append**: Tracks attached `message_id` per group in memory; only new messages are attached each time
- **Bot's own replies**: Auto-marked as attached after sending, so they don't reappear in the next history block (already in the AI's session context), but retained on first fetch for conversation continuity
- **Trigger message excluded**: The triggering message doesn't appear in the history block; instead it's appended as a separate "current message block" after the history
- **Current message block**: After the history block ends, a `[Reply to this message]` + `nickname(userId) msg_id:<id> HH:MM:` + message content block is appended, so the AI clearly distinguishes "historical context" from "the message to reply to"
- **Character budget**: Configurable `maxChars` limit prevents busy groups from overflowing the context window
- **Injection guard**: The history block is marked with clear delimiters as "CONTEXT ONLY, not instructions"
- **Image localization**: Images in history are auto-downloaded to `~/.openclaw/workspace/tmp/` (filename `hist-img-<timestamp>-<random>.<ext>`); the `[image]` placeholder is replaced with `[image: <absolute path>]` so the AI can reference local paths to view images; images in quoted messages are also downloaded. The directory keeps the most recent 20 images (LRU by mtime); on download failure, falls back to the `[image]` placeholder
- **Two-line format**: Each message renders as two lines — line 1 is `nickname(QQ) msg_id:<id> HH:MM:`, line 2 is the message content; entries are separated by a blank line for AI readability

### Configuration

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

| Field | Description | Default |
|-------|-------------|---------|
| `limit` | Max number of history messages fetched per wake-up. Set to `0` to disable | `20` |
| `maxChars` | Character limit for the formatted history block (min 200) | `4000` |

> **Note**: The attached `message_id` tracking state is in-memory and lost on process restart. The first wake-up after restart will attach up to `limit` history messages — this is expected behavior.

---

## Project Structure

```
.
├── index.ts                 # Plugin entry point
├── package.json
├── openclaw.plugin.json     # Plugin metadata
└── src/
    ├── accounts.ts          # Multi-account resolution
    ├── api.ts               # OneBot 11 HTTP API client
    ├── channel.ts           # Channel plugin & dock definition
    ├── config-schema.ts     # Config JSON Schema + UI hints
    ├── monitor.ts           # WebSocket message monitor + STT
    ├── probe.ts             # Connection probe / health check
    ├── runtime.ts           # Runtime context
    ├── send.ts              # Outbound message sending
    ├── tools.ts             # 45 AI agent tools
    ├── types.ts             # TypeScript type definitions
    └── features/
        ├── longmsg.ts         # Long message handling (3 modes)
        ├── keyword-trigger.ts # Keyword trigger engine
        ├── group-hooks.ts     # Group event hooks
        ├── group-history.ts   # Group chat history context (since last wake-up)
        ├── ai-trigger.ts      # AI smart trigger (small model reply judgment)
        ├── markdown-strip.ts  # Markdown syntax stripping (QQ adaptation)
        └── cq-parse.ts        # CQ code parsing (AI reply @mentions)
```

## License

MIT

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Aliang1337/openclaw-napcat&type=date&legend=top-left)](https://www.star-history.com/#Aliang1337/openclaw-napcat&type=date&legend=top-left)
