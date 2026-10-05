import { describe, expect, it } from "vitest";
import { PAGE_HTML_LIMIT, parseChapter } from "./parse";

describe("bounded Markdown pages", () => {
  it("keeps small chapters on one page and preserves GFM", () => {
    const result = parseChapter(
      "# Example\n\n## A section\n\n**Bold** and [reference][link].\n\n| One | Two |\n| --- | --- |\n| a | b |\n\n[link]: https://example.com",
    );
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0]).toContain("<strong>Bold</strong>");
    expect(result.pages[0]).toContain('href="https://example.com"');
    expect(result.pages[0]).toContain("<table>");
    expect(result.sections.map((section) => section.id)).toEqual([
      "example",
      "a-section",
    ]);
  });

  it("bounds every page and indexes headings across the whole document", () => {
    const source = Array.from(
      { length: 1500 },
      (_, index) =>
        `## Section ${index}\n\n${"Some words to read. ".repeat(20)}\n\n`,
    ).join("");
    const result = parseChapter(source);
    expect(result.pages.length).toBeGreaterThan(20);
    expect(result.pages.every((page) => page.length <= PAGE_HTML_LIMIT)).toBe(
      true,
    );
    expect(result.sections).toHaveLength(1500);
    const last = result.sections[1499];
    expect(last.page).toBeGreaterThan(0);
    expect(result.pages[last.page]).toContain(`id="${last.id}"`);
  });

  it("splits giant code blocks without creating an unbounded page or losing content", () => {
    const code = 'const sample = "<&>";\n'.repeat(10000);
    const result = parseChapter("```js\n" + code + "```");
    expect(result.pages.length).toBeGreaterThan(5);
    expect(result.pages.every((page) => page.length <= PAGE_HTML_LIMIT)).toBe(
      true,
    );
    expect(result.pages.join("").match(/const sample/g)).toHaveLength(10000);
    expect(result.pages.join("")).not.toContain('"<&>"');
  });

  it("preserves rows and ordered-list numbering when splitting oversized structures", () => {
    const table =
      "| Value |\n| --- |\n" +
      Array.from({ length: 2000 }, (_, index) => `| row-${index} |\n`).join("");
    const tableResult = parseChapter(table);
    expect(
      tableResult.pages.every((page) => page.length <= PAGE_HTML_LIMIT),
    ).toBe(true);
    expect(tableResult.pages.join("")).toContain("row-1999");
    const list = Array.from(
      { length: 2000 },
      (_, index) => `${index + 1}. item-${index}\n`,
    ).join("");
    const listResult = parseChapter(list);
    expect(
      listResult.pages.every((page) => page.length <= PAGE_HTML_LIMIT),
    ).toBe(true);
    expect(listResult.pages.join("")).toContain("item-1999");
    expect(listResult.pages.join("")).toMatch(/<ol start="\d+">/);
  });

  it("assigns unique anchors even when repeated names collide with suffixes", () => {
    const result = parseChapter(
      "# A\n\n## A\n\n### A-1\n\n#### A\n\n## Caf&#233;",
    );
    expect(result.sections.map((section) => section.id)).toEqual([
      "a",
      "a-1",
      "a-1-1",
      "a-2",
      "café",
    ]);
  });
});
