import DOMPurify from "dompurify";
import { headingSlug, resolveLocalPath, type Book, type Chapter } from "./book";

export function renderPage(rawHtml: string, chapter: Chapter, book: Book) {
  const html = DOMPurify.sanitize(rawHtml, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: [
      "style",
      "form",
      "input",
      "button",
      "iframe",
      "video",
      "audio",
      "source",
      "link",
      "base",
    ],
    FORBID_ATTR: [
      "style",
      "ping",
      "attributionsrc",
      "background",
      "poster",
      "srcset",
      "srcdoc",
    ],
    RETURN_DOM_FRAGMENT: true,
  });
  // Keep the fragment detached until every asset reference has been resolved locally.
  html.querySelectorAll("img").forEach((img) => {
    // Prevent remote images from making requests while reading local documents.
    const source = img.getAttribute("src") ?? "";
    const local = resolveLocalPath(chapter.path, source);
    const url = local ? book.assets.get(local.path) : undefined;
    img.removeAttribute("srcset");
    img.removeAttribute("sizes");
    if (url) {
      img.src = url;
      img.loading = "lazy";
    } else {
      const placeholder = document.createElement("span");
      placeholder.className = "image-placeholder";
      placeholder.textContent = `${img.alt || "Image"} · ${local ? "File not found in this folder" : "Remote image not loaded for privacy"}`;
      img.replaceWith(placeholder);
    }
  });
  html.querySelectorAll("a").forEach((link) => {
    const href = link.getAttribute("href") ?? "";
    const local = resolveLocalPath(chapter.path, href);
    if (local) {
      const targetIndex = book.chapters.findIndex(
        (candidate) => candidate.path === local.path,
      );
      if (targetIndex >= 0) {
        link.dataset.chapter = String(targetIndex);
        link.dataset.anchor = local.hash;
        link.href = `#${local.hash || headingSlug(book.chapters[targetIndex].title)}`;
      } else if (book.assets.has(local.path)) {
        link.href = book.assets.get(local.path)!;
        link.download = local.path.split("/").pop()!;
      } else {
        link.removeAttribute("href");
        link.title = "This file was not found in the selected folder";
        link.classList.add("missing-link");
      }
    } else {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
  });
  const template = document.createElement("template");
  template.content.append(html);
  return template.innerHTML;
}
