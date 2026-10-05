import { Lexer, Parser, Renderer, type Token, type Tokens } from "marked";
import { headingSlug } from "./book";

export type Section = {
  id: string;
  title: string;
  level: number;
  page: number;
};
export type ParsedChapter = {
  pages: string[];
  sections: Section[];
  hasTitle: boolean;
  plainBlocks: number;
};
export const PAGE_HTML_LIMIT = 24_000;
const BLOCK_SOURCE_LIMIT = 12_000;
const escape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function plainTitle(html: string) {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(
      /&(?:amp|lt|gt|quot|#39|apos);/g,
      (entity) =>
        ({
          "&amp;": "&",
          "&lt;": "<",
          "&gt;": ">",
          "&quot;": '"',
          "&#39;": "'",
          "&apos;": "'",
        })[entity]!,
    )
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, value: string) => {
      const code =
        value[0].toLowerCase() === "x"
          ? parseInt(value.slice(1), 16)
          : Number(value);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "�";
    });
}

/** Runs in a worker. Pages end at block boundaries and share one link/heading context. */
export function parseChapter(markdown: string): ParsedChapter {
  const tokens = Lexer.lex(markdown, { gfm: true });
  const pages: string[] = [];
  const sections: Section[] = [];
  const used = new Set<string>();
  const counts = new Map<string, number>();
  let pending: Omit<Section, "page">[] = [];
  let html = "";
  let blocks = 0;
  let plainBlocks = 0;
  let hasTitle = false;
  const renderer = new Renderer();
  renderer.heading = function ({ tokens: inline, depth }: Tokens.Heading) {
    const content = this.parser.parseInline(inline);
    const title = plainTitle(content);
    const base = headingSlug(title);
    let suffix = counts.get(base) ?? 0;
    let id = suffix ? `${base}-${suffix}` : base;
    while (used.has(id)) id = `${base}-${++suffix}`;
    counts.set(base, suffix + 1);
    used.add(id);
    if (depth === 1) hasTitle = true;
    pending.push({ id, title, level: depth });
    return `<h${depth} id="${escape(id)}">${content}</h${depth}>\n`;
  };
  const parser = new Parser({ gfm: true, renderer });
  const append = (block: string) => {
    if (
      html &&
      (html.length + block.length > PAGE_HTML_LIMIT || blocks >= 160)
    ) {
      pages.push(html);
      html = "";
      blocks = 0;
    }
    for (const heading of pending)
      sections.push({ ...heading, page: pages.length });
    pending = [];
    html += block;
    blocks++;
  };
  const plain = (text: string, code: boolean) => {
    // Keep even a single enormous code block / paragraph bounded, including escaping expansion.
    plainBlocks++;
    for (let start = 0; start < text.length;) {
      let end = Math.min(start + 3500, text.length);
      if (end < text.length) {
        const boundary = text.lastIndexOf(code ? "\n" : " ", end);
        if (boundary > start + 1750) end = boundary + 1;
        else if (/[\uD800-\uDBFF]/.test(text[end - 1])) end--;
      }
      const content = escape(text.slice(start, end));
      append(
        code
          ? `<pre><code>${content}</code></pre>`
          : `<p class="plain-continuation">${content}</p>`,
      );
      start = end;
    }
  };
  const renderToken = (token: Token) => {
    if (token.type === "space") return;
    if (token.raw.length > BLOCK_SOURCE_LIMIT) {
      if (token.type === "list") {
        const list = token as Tokens.List;
        let batch: Tokens.ListItem[] = [],
          size = 0,
          offset = 0;
        const flush = () => {
          if (!batch.length) return;
          renderToken({
            ...list,
            raw: batch.map((item) => item.raw).join(""),
            items: batch,
            start: list.ordered ? Number(list.start) + offset : "",
          });
          offset += batch.length;
          batch = [];
          size = 0;
        };
        for (const item of list.items) {
          if (item.raw.length > BLOCK_SOURCE_LIMIT) {
            flush();
            plain(item.raw, false);
            offset++;
          } else {
            if (size + item.raw.length > BLOCK_SOURCE_LIMIT) flush();
            batch.push(item);
            size += item.raw.length;
          }
        }
        flush();
        return;
      }
      if (token.type === "table") {
        const table = token as Tokens.Table;
        // Repeat headers across batches; pathological individual cells use readable plain text.
        if (
          [...table.header, ...table.rows.flat()].some(
            (cell) => cell.text.length > 1500,
          )
        ) {
          plain(token.raw, true);
          return;
        }
        for (let start = 0; start < table.rows.length; start += 10) {
          const block = parser.parse([
            { ...table, rows: table.rows.slice(start, start + 10) },
          ]);
          if (block.length > PAGE_HTML_LIMIT)
            plain(
              table.rows
                .slice(start, start + 10)
                .map((row) => row.map((cell) => cell.text).join(" | "))
                .join("\n"),
              true,
            );
          else append(block);
        }
        return;
      }
      plain(
        token.type === "code" ? (token as Tokens.Code).text : token.raw,
        token.type === "code" || token.type === "html",
      );
      return;
    }
    const block = parser.parse([token]);
    if (block.length > PAGE_HTML_LIMIT) {
      pending = [];
      plain(token.raw, true);
    } else append(block);
  };
  for (const token of tokens) renderToken(token);
  if (html || !pages.length) pages.push(html);
  return { pages, sections, hasTitle, plainBlocks };
}
