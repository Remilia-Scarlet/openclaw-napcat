/**
 * src/features/markdown-strip.ts
 *
 * Strip Markdown formatting from AI reply text for QQ.
 * QQ does not render Markdown — raw syntax like **bold**, ## headings,
 * |tables|, etc. would show as literal characters. This module converts
 * Markdown to readable plain text while preserving structure.
 *
 * Strategy: extract code spans first (so their contents are protected
 * from syntax transformations), then convert structure/syntax markers,
 * then restore code contents.
 */

import type { MarkdownStripConfig } from "../types.js";

/** Normalized strip config. */
export type ResolvedMarkdownStripConfig = {
  enabled: boolean;
};

/** Normalize raw config (boolean | object | undefined) into a resolved form. */
export function resolveMarkdownStripConfig(
  raw?: MarkdownStripConfig | boolean,
): ResolvedMarkdownStripConfig {
  if (typeof raw === "boolean") return { enabled: raw };
  if (raw && typeof raw === "object") return { enabled: raw.enabled !== false };
  return { enabled: true };
}

const CODE_PLACEHOLDER = "\u0000";

/**
 * Convert Markdown text to QQ-friendly plain text.
 *
 * Code blocks and inline code are protected so their contents survive
 * intact (only the fence/backticks are removed).
 */
export function stripMarkdownForQQ(text: string): string {
  if (!text) return text;

  const codes: string[] = [];

  // 1. Extract fenced code blocks ```lang\ncode``` → placeholder
  let out = text.replace(/```[\w-]*\n?([\s\S]*?)```/g, (_, code) => {
    const i = codes.length;
    codes.push(code.trim());
    return `${CODE_PLACEHOLDER}c${i}${CODE_PLACEHOLDER}`;
  });

  // 2. Extract inline code `code` → placeholder
  out = out.replace(/`([^`\n]+)`/g, (_, code) => {
    const i = codes.length;
    codes.push(code);
    return `${CODE_PLACEHOLDER}c${i}${CODE_PLACEHOLDER}`;
  });

  // 3. Horizontal rules  --- / *** / ___  →  ————
  //    Use [ \t]* (not \s*) so the rule stays on one line and doesn't
  //    swallow the newline between two consecutive rules.
  out = out.replace(/^ {0,3}([-*_])([ \t]*\1){2,}[ \t]*$/gm, "————");

  // 4. ATX headers  ## 标题  →  【标题】\n
  //    Append a newline so the heading is visually separated from the
  //    following content. Any resulting 3+ newlines are compressed later.
  //    Use [ \t] (not \s) for indent so we don't swallow preceding blank lines.
  out = out.replace(/^[ \t]{0,3}#{1,6}\s+(.+?)(?:\s+#+)?\s*$/gm, "【$1】\n");

  // 5. Blockquotes  > 引用  →  『引用』\n  (per line)
  out = out.replace(/^[ \t]{0,3}>\s?(.*)$/gm, "『$1』\n");

  // 6. Unordered list markers  - / * / +  →  •  (preserve indent)
  out = out.replace(/^(\s*)([-*+])\s+/gm, "$1• ");

  // 7. Ordered list  1.  →  keep as-is (natural numbering preserved)

  // 8. Images  ![alt](url)  →  alt(url)  (no alt → [图片](url))
  //    Protect the result so the link rule below doesn't re-process
  //    [图片](url) (which would otherwise match the link pattern).
  out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
    const i = codes.length;
    codes.push(`${alt || "[图片]"}(${url})`);
    return `${CODE_PLACEHOLDER}c${i}${CODE_PLACEHOLDER}`;
  });

  // 9. Links  [text](url)  →  text(url)
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1($2)");

  // 10. Bold  **text** / __text__  →  text
  //     Use [\s\S]+? (non-greedy) so **a *b* c** matches as one bold span,
  //     letting the inner *b* fall through to the italic rule below.
  out = out.replace(/\*\*([\s\S]+?)\*\*/g, "$1");
  out = out.replace(/__([^_]+?)__/g, "$1");

  // 11. Italic  *text*  →  text  (skip _ italic to preserve identifiers like my_var)
  out = out.replace(/\*([^*\n]+?)\*/g, "$1");

  // 12. Strikethrough  ~~text~~  →  text
  out = out.replace(/~~([^~]+?)~~/g, "$1");

  // 13. Compress 3+ consecutive newlines → 2  (before restoring code,
  //     so code block contents keep their original line breaks intact)
  out = out.replace(/\n{3,}/g, "\n\n");

  // 14. Restore code/image placeholders
  out = out.replace(/\u0000c(\d+)\u0000/g, (_, i) => codes[Number(i)] ?? "");

  return out;
}
