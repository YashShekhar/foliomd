import { describe, expect, it } from "vitest";
import {
  headingSlug,
  loadFolder,
  makeChapter,
  resolveLocalPath,
  sortPaths,
} from "./book";

describe("chapter organization", () => {
  it("naturally orders chapters and nested sections, with README first", () => {
    expect(
      sortPaths([
        "10-end.md",
        "2-middle.md",
        "README.md",
        "1-start.md",
        "3-notes/10-b.md",
        "3-notes/2-a.md",
      ]),
    ).toEqual([
      "README.md",
      "1-start.md",
      "2-middle.md",
      "3-notes/2-a.md",
      "3-notes/10-b.md",
      "10-end.md",
    ]);
  });
  it("extracts a frontmatter title without exposing metadata in the book", () => {
    const chapter = makeChapter(
      "01-example.md",
      '\uFEFF---\r\ntitle: "A thoughtful title"\r\nauthor: Reader\r\n---\r\n# A heading\r\n\r\nSome text.',
    );
    expect(chapter.title).toBe("A thoughtful title");
    expect(chapter.markdown).toBe("# A heading\n\nSome text.");
  });
  it("falls back to a readable filename when there is no heading", () => {
    expect(
      makeChapter("notes/02-a-new-idea.md", "Just a paragraph.").title,
    ).toBe("A new idea");
  });
});

describe("local chapter and asset links", () => {
  it("resolves encoded paths and anchors relative to nested chapters", () => {
    expect(
      resolveLocalPath("notes/02-chapter.md", "../images/a%20photo.png"),
    ).toEqual({ path: "images/a photo.png", hash: "" });
    expect(
      resolveLocalPath("notes/02-chapter.md", "./03-next.md#next-section"),
    ).toEqual({ path: "notes/03-next.md", hash: "next-section" });
    expect(resolveLocalPath("notes/02-chapter.md", "#section")).toEqual({
      path: "notes/02-chapter.md",
      hash: "section",
    });
  });
  it("rejects traversal beyond the selected folder and nonlocal protocols", () => {
    for (const path of [
      "../../outside.md",
      "https://example.com/image.png",
      "//example.com/a",
      "javascript:alert(1)",
      "data:image/png;base64,test",
      "%notvalid",
    ]) {
      expect(resolveLocalPath("notes/chapter.md", path)).toBeNull();
    }
  });
  it("supports international heading anchors", () => {
    expect(headingSlug("Hello, 世界! A new idea")).toBe(
      "hello-世界-a-new-idea",
    );
  });
});

describe("folder imports", () => {
  function file(path: string, content: string) {
    const result = new File([content], path.split("/").pop()!);
    Object.defineProperty(result, "webkitRelativePath", { value: path });
    return result;
  }
  it("rejects oversized Markdown files before reading their text", async () => {
    const large = file("book/large.md", "# Too large");
    Object.defineProperty(large, "size", { value: 25 * 1024 * 1024 + 1 });
    Object.defineProperty(large, "text", {
      value: () => {
        throw new Error("File text must not be read");
      },
    });
    await expect(loadFolder([large])).rejects.toThrow("exceeds 25 MB");
  });
  it("rejects excessive total Markdown even when each file fits", async () => {
    const files = Array.from({ length: 5 }, (_, index) => {
      const chapter = file(`book/${index}.md`, "# Chapter");
      Object.defineProperty(chapter, "size", { value: 21 * 1024 * 1024 });
      return chapter;
    });
    await expect(loadFolder(files)).rejects.toThrow("more than 100 MB");
  });
  it("reads nested Markdown while ignoring hidden and dependency folders", async () => {
    const book = await loadFolder([
      file("my-book/10-end.md", "# The end"),
      file("my-book/chapters/2-middle.MD", "# The middle"),
      file("my-book/1-start.markdown", "# A beginning"),
      file("my-book/.secret/private.md", "# Private"),
      file("my-book/node_modules/lib/README.md", "# Dependency"),
    ]);
    expect(book.title).toBe("my book");
    expect(book.chapters.map((chapter) => chapter.title)).toEqual([
      "A beginning",
      "The end",
      "The middle",
    ]);
  });
  it("gives an actionable error when a folder contains no Markdown", async () => {
    await expect(
      loadFolder([file("photos/readme.txt", "Hello")]),
    ).rejects.toThrow("no Markdown files");
  });
});
