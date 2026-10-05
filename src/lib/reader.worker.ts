import { makeChapter, type Chapter } from "./book";
import { parseChapter } from "./parse";

export type SearchMatch = { index: number; snippet: string };
type Request =
  | { type: "parse"; markdown: string }
  | { type: "import"; files: { path: string; file: File }[] }
  | { type: "index"; chapters: Chapter[] }
  | { type: "search"; query: string; id: number };
let index: { title: string; path: string; text: string }[] = [];

self.onmessage = async ({ data }: MessageEvent<Request>) => {
  try {
    if (data.type === "parse")
      self.postMessage({ result: parseChapter(data.markdown) });
    else if (data.type === "import") {
      const chapters: Chapter[] = [];
      for (const item of data.files)
        chapters.push(makeChapter(item.path, await item.file.text()));
      self.postMessage({ result: chapters });
    } else if (data.type === "index") {
      index = data.chapters.map((chapter) => ({
        title: chapter.title.toLowerCase(),
        path: chapter.path.toLowerCase(),
        text: chapter.markdown.toLowerCase(),
      }));
    } else {
      const term = data.query.trim().toLowerCase();
      const matches: SearchMatch[] = [];
      index.forEach((chapter, position) => {
        const offset = chapter.text.indexOf(term);
        if (
          chapter.title.includes(term) ||
          chapter.path.includes(term) ||
          offset >= 0
        ) {
          const start = Math.max(0, offset - 20);
          const snippet =
            offset < 0
              ? "Matched in filename"
              : `${start ? "…" : ""}${chapter.text
                  .slice(start, offset + term.length + 45)
                  .replace(/[#*`>\[\]]/g, "")
                  .replace(/\s+/g, " ")}…`;
          matches.push({ index: position, snippet });
        }
      });
      self.postMessage({ id: data.id, matches });
    }
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error
          ? error.message
          : "This document could not be processed.",
    });
  }
};
