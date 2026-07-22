/**
 * src/features/cq-parse.ts
 *
 * Parse OneBot 11 CQ codes ([CQ:type,key=val,...]) embedded in plain text
 * into structured message segments. This lets AI replies — which arrive as
 * pure strings — produce @mentions, faces, images, etc. without the caller
 * needing to build segment arrays manually.
 *
 * Reference: https://github.com/botuniverse/onebot-11/blob/master/message/segment.md
 */

import type { OneBotSegment } from "../types.js";

const CQ_CODE_RE = /\[CQ:([\w.-]+),?([^\]]*)\]/g;

function unescapeCQValue(value: string): string {
  return value
    .replace(/&#91;/g, "[")
    .replace(/&#93;/g, "]")
    .replace(/&#44;/g, ",")
    .replace(/&amp;/g, "&");
}

/**
 * Parse a text string into OneBot message segments, splitting out any
 * embedded CQ codes. Plain text without CQ codes returns a single text
 * segment, preserving the original behavior of textSegment().
 */
export function parseCQCodes(text: string): OneBotSegment[] {
  if (!text) return [];

  const segments: OneBotSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  CQ_CODE_RE.lastIndex = 0;
  while ((match = CQ_CODE_RE.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index);
    if (before) {
      segments.push({ type: "text", data: { text: before } });
    }

    const type = match[1];
    const paramsRaw = match[2];
    const data: Record<string, string | undefined> = {};

    if (paramsRaw) {
      for (const pair of paramsRaw.split(",")) {
        const eq = pair.indexOf("=");
        if (eq === -1) continue;
        const key = pair.slice(0, eq).trim();
        if (key) data[key] = unescapeCQValue(pair.slice(eq + 1));
      }
    }

    segments.push({ type, data });
    lastIndex = CQ_CODE_RE.lastIndex;
  }

  const tail = text.slice(lastIndex);
  if (tail) {
    segments.push({ type: "text", data: { text: tail } });
  }

  return segments;
}
