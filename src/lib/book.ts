export type Chapter = {
  path: string;
  title: string;
  markdown: string;
  words: number;
  minutes: number;
};

export type Book = {
  id: string;
  title: string;
  folder: string;
  chapters: Chapter[];
  assets: Map<string, string>;
  demo?: boolean;
};

export const isMarkdown = (path: string) =>
  /\.(md|markdown|mdown)$/i.test(path);

export function titleFromPath(path: string) {
  const name = path
    .split("/")
    .pop()!
    .replace(/\.(md|markdown|mdown)$/i, "");
  return name
    .replace(/^\d+[\s._-]+/, "")
    .replace(/[_-]+/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

export function makeChapter(path: string, content: string): Chapter {
  let markdown = content.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  let metadataTitle = "";
  const frontmatter = markdown.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (frontmatter) {
    metadataTitle =
      frontmatter[1]
        .match(/^title:\s*(.+)$/m)?.[1]
        ?.trim()
        .replace(/^(['"])(.*)\1$/, "$2") ?? "";
    markdown = markdown.slice(frontmatter[0].length);
  }
  const heading = markdown.match(/^#\s+(.+?)\s*#*\s*$/m)?.[1];
  const title =
    metadataTitle || heading?.replace(/[*_`]/g, "") || titleFromPath(path);
  let words = 0;
  for (const _word of markdown.matchAll(/\S+/g)) words++;
  return {
    path,
    title,
    markdown,
    words,
    minutes: Math.max(1, Math.ceil(words / 220)),
  };
}

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});
export function sortPaths(paths: string[]) {
  return [...paths].sort((a, b) => {
    const aParts = a.split("/"),
      bParts = b.split("/");
    for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
      // A folder's introduction comes before its numbered chapters.
      const aReadme = /^readme\.md$/i.test(aParts[i]);
      const bReadme = /^readme\.md$/i.test(bParts[i]);
      if (aReadme !== bReadme) return aReadme ? -1 : 1;
      const result = collator.compare(aParts[i], bParts[i]);
      if (result) return result;
    }
    return aParts.length - bParts.length;
  });
}

/** Resolve a local reference against a chapter, without escaping the selected folder. */
export function resolveLocalPath(
  from: string,
  reference: string,
): { path: string; hash: string } | null {
  if (/^[a-z][a-z\d+.-]*:/i.test(reference) || reference.startsWith("//"))
    return null;
  const [rawPath, ...hashParts] = reference.split("#");
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawPath.split("?")[0]);
  } catch {
    return null;
  }
  const segments =
    rawPath === ""
      ? from.split("/")
      : decoded.startsWith("/")
        ? []
        : from.split("/").slice(0, -1);
  if (rawPath !== "") {
    for (const part of decoded.replace(/\\/g, "/").split("/")) {
      if (part === "..") {
        if (!segments.length) return null;
        segments.pop();
      } else if (part && part !== ".") segments.push(part);
    }
  }
  return { path: segments.join("/"), hash: hashParts.join("#") };
}

export function headingSlug(text: string) {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}\s_-]/gu, "")
      .replace(/\s+/g, "-") || "section"
  );
}

export async function loadFolder(files: File[]): Promise<Book> {
  if (!files.length)
    throw new Error(
      "No files were selected. Please choose a folder with Markdown files.",
    );
  const filePath = (file: File) => file.webkitRelativePath || file.name;
  const firstPath = filePath(files[0]);
  const folder = firstPath.includes("/") ? firstPath.split("/")[0] : "My book";
  const relativePath = (file: File) =>
    file.webkitRelativePath
      ? file.webkitRelativePath.split("/").slice(1).join("/")
      : file.name;
  const visibleFiles = files.filter(
    (file) =>
      !relativePath(file)
        .split("/")
        .some((part) => part.startsWith(".") || part === "node_modules"),
  );
  const markdownFiles = visibleFiles.filter((file) => isMarkdown(file.name));
  if (!markdownFiles.length)
    throw new Error(
      "This folder has no Markdown files. Choose a folder containing .md, .markdown, or .mdown files.",
    );
  const paths = sortPaths(markdownFiles.map(relativePath));
  if (markdownFiles.some((file) => file.size > 25 * 1024 * 1024))
    throw new Error(
      "A Markdown file exceeds 25 MB. Split it into smaller chapters before opening this folder.",
    );
  if (
    markdownFiles.reduce((total, file) => total + file.size, 0) >
    100 * 1024 * 1024
  )
    throw new Error(
      "This folder contains more than 100 MB of Markdown. Open a smaller subfolder to keep reading responsive.",
    );
  const byPath = new Map(
    markdownFiles.map((file) => [relativePath(file), file]),
  );
  const chapters =
    typeof Worker === "undefined"
      ? await Promise.all(
          paths.map(async (path) =>
            makeChapter(path, await byPath.get(path)!.text()),
          ),
        )
      : await (
          await import("./worker-client")
        ).workerRequest<Chapter[]>({
          type: "import",
          files: paths.map((path) => ({ path, file: byPath.get(path)! })),
        });
  const assets = new Map<string, string>();
  visibleFiles
    .filter((file) => !isMarkdown(file.name))
    .forEach((file) =>
      assets.set(relativePath(file), URL.createObjectURL(file)),
    );
  return {
    id: `folder:${folder}:${paths.join("|")}`,
    title: folder.replace(/[_-]+/g, " "),
    folder,
    chapters,
    assets,
  };
}

export function disposeBook(book: Book) {
  book.assets.forEach((url) => URL.revokeObjectURL(url));
}

export function readStorage<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Reading works when storage is unavailable. */
  }
}
