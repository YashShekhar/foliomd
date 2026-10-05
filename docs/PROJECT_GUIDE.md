# foliomd — Project guide

Version 1.0 · Updated 5 October 2026

## 1. Purpose

**foliomd** turns a folder of Markdown files into a book-style reading experience in a browser. It is intended for personal notes, documentation, essay collections, manuscripts, and learning material that already live in ordinary files.

Select a folder, and the app discovers supported files in its subfolders, sorts them into chapters, and renders them with adjustable typography. A chapter sidebar navigates between files. An **On this page** panel navigates between headings within a file. Large chapters are split into reading pages to limit the amount of document content mounted in the browser.

The application has no backend, account system, or upload service. Its sample book demonstrates the interface before a folder is selected.

## 2. Getting started

### Requirements

- Node.js **22.12 or later on a compatible supported release line**. This project has been run with Node.js 22.23.2. Use a supported Node.js LTS release for development.
- npm and a modern browser with Web Worker support.
- A browser that supports directory selection. Automated verification currently uses Chromium; other browsers have not been certified by this project's test suite.

### Installation and development

From the project directory:

```sh
npm ci
npm run dev
```

Open the address printed by Vite, normally `http://127.0.0.1:5173`. The development server listens on the local machine by default.

For Windows environments that restrict PowerShell script execution, use `npm.cmd` and `npx.cmd` in place of `npm` and `npx`.

### Production build

```sh
npm run build
npm run preview
```

The build type-checks the project and creates `dist/`. Preview serves those generated assets locally. It does not publish the app to the internet.

The `dist/` directory can be served by a static host. Preserve its `assets/` directory, including the worker JavaScript and bundled font files. Serve JavaScript with the appropriate MIME type. Use HTTP or HTTPS rather than opening `index.html` through `file://`; module workers require a proper origin. Deployment beneath a URL subpath requires configuring Vite's `base` before building. The current configuration assumes the origin root.

## 3. User guide

### Open a book

Select **Open folder**, then choose a directory containing Markdown. Alternatively, drag a directory into the application. A collection of separately dropped files is also accepted where the browser supports the drag-and-drop file entry API.

Supported extensions, case-insensitively:

- `.md`
- `.markdown`
- `.mdown`

Nested folders are included. Hidden path components and `node_modules` are ignored. Images and other companion files in the selected folder are registered as local assets rather than chapters.

An import containing no supported Markdown leaves the current book open and displays an explanatory message. For browser stability, a file larger than **25 MiB** or a folder containing more than **100 MiB of Markdown** is rejected before its text is loaded. Here, MiB means 1,048,576 bytes. The UI uses the shorter label “MB.” Assets are not included in these Markdown limits.

### Chapter order and titles

Chapters follow natural filename ordering: `2-chapter.md` comes before `10-chapter.md`. Sorting compares path components, so subfolders retain their path-based organization. `README.md` is prioritized within a folder. There is no manually editable chapter order.

A chapter's title is selected in this order:

1. A simple `title:` value in leading YAML-style frontmatter.
2. Its first ATX level-one Markdown heading, such as `# Introduction`.
3. A cleaned filename, with a leading numeric prefix removed and hyphens or underscores replaced by spaces.

Frontmatter is hidden from the rendered text. This is a deliberately small title extractor, not a complete YAML parser; nested metadata and multiline YAML values are not interpreted.

An example folder:

```text
my-book/
  README.md
  01-getting-started.md
  02-background.md
  03-examples/
    01-first-example.md
    02-second-example.md
  images/
    overview.png
```

### Read and navigate

- Select a chapter in **Contents** to open that file.
- Use **Next chapter** and **Previous chapter** to move between small chapters.
- Large chapters display **Page X of Y**. The same controls become **Next page** and **Previous page** until the chapter boundary is reached.
- Select a heading in **On this page** to jump to that section. If it is on another reading page, the app opens that page first.
- Heading levels are indented, duplicate heading names receive distinct anchors, and the section at the reading position is highlighted.
- On viewports narrower than 1,200 pixels, **On this page** opens a side drawer.
- Chapters with more than 150 headings have a **Find a section** input and a windowed outline. Scroll the outline or filter by a heading's name to reach distant sections.

Reading pages are content chunks, not fixed printed pages. Their length changes with Markdown structure, while the amount of visible text still depends on viewport and font settings.

### Search and bookmarks

**Search this book** searches chapter titles, filenames, and Markdown source text. Search runs in a background worker and waits 140 milliseconds after a query change before starting. Results are chapter-level matches, with a short context snippet when the match occurs in content.

Selecting a result opens the chapter at its saved place. Search does not currently highlight every occurrence or jump directly to the occurrence within a long chapter. Use **Find a section** for heading-based navigation.

The ribbon icon bookmarks the current chapter. The **Bookmarks** tab shows bookmarked chapters, and its list can also be searched. Bookmarks are chapter-level; they do not represent text annotations or separate paragraph locations.

### Reading preferences

The **Reading settings** menu offers:

| Setting    | Available values                                |
| ---------- | ----------------------------------------------- |
| Appearance | Paper, sepia, night                             |
| Typeface   | Serif or sans serif                             |
| Text size  | 15–24 pixels before the small-screen adjustment |
| Page width | Comfortable or wide                             |

A separate theme button switches between paper and night on wider screens. Font files are bundled with the application, so no external font service is contacted to read a book.

### Keyboard shortcuts

| Shortcut             | Action                                                                    |
| -------------------- | ------------------------------------------------------------------------- |
| Ctrl K / Cmd K       | Open the chapter sidebar and focus book search                            |
| Alt Left / Alt Right | Change chapters                                                           |
| Escape               | Dismiss settings and section navigation; close the mobile chapter sidebar |
| Tab / Shift Tab      | Move among visible interactive controls                                   |

Alt-arrow shortcuts retain their chapter-level behavior even when the current chapter has multiple reading pages.

### Resume a book

Preferences, bookmarks, and reading progress are stored in the browser's local storage. File contents and folder permissions are not persisted.

After a reload, the sample book appears. **Reopen the same folder** to restore its chapter and reading position. Storage is tied to the browser profile and origin, so a different browser, port, or deployed URL has separate saved state. Clearing site data clears saved preferences and progress.

The book identity currently combines its folder name and ordered Markdown paths. Changes to that set of paths can produce a new saved book identity. Two different folders with the same name and identical paths can share saved state. There is no content fingerprint or cross-device synchronization.

## 4. Markdown and local assets

The parser supports headings, paragraphs, emphasis, lists, blockquotes, fenced code, horizontal rules, links, and GitHub-style tables. The application is a reader; it does not execute scripts, MDX components, or code samples. Code blocks are displayed as text, without syntax highlighting. Math typesetting and Mermaid rendering are not included.

Relative references resolve from the current chapter's folder:

```markdown
![Overview](../images/overview.png)
[Next chapter](02-next.md)
[A section in another chapter](../03-example.md#details)
[A section in this chapter](#details)
```

Paths may contain URL-encoded characters. A reference cannot traverse above the selected folder. Missing images display a placeholder; missing local links are disabled and receive an explanatory tooltip. Links to selected non-Markdown assets are download links.

Remote image URLs are replaced by a privacy placeholder. External links can be opened deliberately in a new tab. Embedded media, forms, scripts, inline styles, and SVG markup inside the document are removed or excluded by sanitization. A local SVG file used as an image may be displayed through the browser's image element.

The section outline is generated from parsed Markdown heading tokens. Arbitrary headings embedded in raw HTML are not added to that outline. Heading anchors are derived from their displayed text, lowercased, with spaces replaced by hyphens and most punctuation removed. Unicode letters and numbers are retained; repeated names are suffixed.

## 5. Architecture

### Main responsibilities

| Module                               | Responsibility                                                                                                               |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `src/App.tsx`                        | Application state, file import flow, chapter/page navigation, reading settings, progress persistence, and overall layout     |
| `src/components/MarkdownContent.tsx` | Memoized rendered content; prevents progress updates from reconciling the chapter's HTML again                               |
| `src/components/PageOutline.tsx`     | Section navigation, active-section tracking, filtering, and a windowed list for long outlines                                |
| `src/lib/book.ts`                    | Book/chapter models, metadata extraction, ordering, path resolution, size checks, local storage helpers, and asset lifecycle |
| `src/lib/drop.ts`                    | Recursive browser drag-and-drop directory traversal                                                                          |
| `src/lib/parse.ts`                   | Markdown-to-HTML parsing, unique heading IDs, and bounded reading-page construction                                          |
| `src/lib/reader.worker.ts`           | Background import, Markdown parsing, search indexing, and search requests                                                    |
| `src/lib/worker-client.ts`           | Worker creation, one-shot requests, error handling, cancellation, and termination                                            |
| `src/lib/useReader.ts`               | React hooks for asynchronous parsing and search, stale-response protection, and a small chapter cache                        |
| `src/lib/render.ts`                  | Sanitization and local-link/image resolution for the current reading page                                                    |
| `src/lib/demo.ts`                    | Built-in sample book                                                                                                         |
| `src/styles.css`                     | Responsive layout, themes, typography, panels, and document styles                                                           |

### Import pipeline

```text
Folder selection / drop
    ↓
Filter supported paths and validate Markdown sizes
    ↓
Import worker: read files sequentially and extract chapter metadata
    ↓
Book in browser memory + object URLs for local assets
    ↓
Restore saved chapter/progress and initialize search worker
```

Sequential file reads avoid launching every text read simultaneously. Imported chapter strings still remain in memory for the open book; this is not a streaming disk-backed library.

### Rendering pipeline

```text
Selected chapter
    ↓
Dedicated parse worker → tokens, heading index, bounded HTML pages
    ↓
Select current reading page
    ↓
Main thread: sanitize only that page, resolve local assets/links
    ↓
Memoized document content + section outline
```

HTML received from the worker is not trusted for insertion. `renderPage()` sanitizes it with DOMPurify before React mounts it. The worker performs parsing but does not have DOM access.

### Data and state

A `Book` contains an ID, title, folder name, ordered chapters, and a map of relative asset paths to object URLs. Each `Chapter` contains a relative path, title, Markdown source, word count, and estimated reading time.

A parsed chapter contains HTML pages, heading metadata with its page index, a level-one-heading flag, and a count of oversized blocks that required splitting or plain-text fallback.

Reading state stores the current chapter index, a progress ratio for each chapter, and bookmarked paths. A chapter's ratio combines its reading-page index and local scroll position:

```text
chapter progress = (page index + scroll fraction within page) / page count
```

The book progress indicator averages those chapter ratios. It is chapter-weighted, not weighted by words or reading time, and moving backward can reduce the stored ratio.

The visible product name is **foliomd**. Existing `folio:preferences`, `folio:reading:*`, and sample-book identifiers are intentionally retained as internal storage keys so the rename does not discard earlier preferences and bookmarks.

## 6. Performance design and limits

The goal is to keep input and navigation responsive while processing multi-megabyte documents. It is not a guarantee that an arbitrarily large or unusually structured file will have no delay on every device.

### Background work

- Imports extract metadata in a worker rather than scanning document strings on the UI thread.
- Each uncached chapter is parsed in a dedicated worker. Switching chapters terminates the obsolete parse request, and aborted results cannot replace the new chapter.
- Search indexes lowercase source once per book in a separate worker. Queries are debounced, and sequence IDs discard stale search results.

### Bounded rendering

- Pages have a target ceiling of **24,000 HTML string code units**, not a fixed byte size or printed-page size.
- A page also stops after 160 appended top-level blocks.
- Ordinary paragraphs, headings, lists, and tables are kept together where they fit.
- Oversized lists are divided into item batches, preserving ordered-list starting numbers.
- Oversized tables are divided into row batches with repeated headers.
- A huge code block is split into escaped, readable pieces. Other indivisible oversized structures may fall back to escaped plain text in smaller pieces. The reader displays a note when this occurs.
- Very large raw HTML and complex oversized individual cells or list items may therefore lose rich formatting, but their text remains readable.
- Only the current page is sanitized and mounted. Browser Find, selection, and copying operate on mounted content; use book search and the outline to navigate elsewhere.

### Cheap recurring updates

- The rendered Markdown component is memoized.
- Scroll-driven progress state is throttled to roughly one update per 120 milliseconds.
- Progress storage is debounced by 250 milliseconds, with lifecycle saves when the page is hidden or exits.
- Heading positions are measured after layout changes, and active-section lookup uses a binary search during scrolling rather than measuring every heading on every scroll event.
- Outlines above 150 entries use 44-pixel virtual rows with a small overscan area. Only the visible window is mounted. A filter makes distant headings reachable by name.
- The parsed-chapter cache retains at most three entries and only accepts an entry whose HTML is below one million string code units. The current large chapter still resides in memory while it is being read.

### Resource limits

The 25 MiB per-file and 100 MiB aggregate Markdown checks prevent accidentally unbounded imports. These limits are not a memory reservation or a guarantee of performance on low-memory devices. The application retains source strings, a search index, and the current parsed chapter; images and browser overhead use additional memory.

See [Performance validation](PERFORMANCE.md) for the measured workload, methodology, and current limitations.

## 7. Privacy and security model

See [Local-only file handling](PRIVACY.md) for the enforced browser policy, network tests, local persistence, and deployment headers. Production builds block upload connections with `connect-src 'none'`; static hosts must apply the provided response headers to worker scripts as well as HTML.

- Folder selection gives access only to the files the user selects for this session.
- File text is processed inside the browser and its workers. The app does not send it to a server.
- Preferences and progress use local storage; Markdown content is not written there.
- Images resolve to local object URLs; replacing a book revokes its old asset URLs.
- Fonts and application assets are served from the app's own origin.
- Sanitization removes executable document markup and unsafe attributes before insertion.
- Remote images and source sets are not loaded automatically from imported Markdown.
- External links open with `noopener noreferrer` when the reader chooses to follow them.

A hosted deployment still serves application assets over the network, and Vite's development server uses its usual development connection. “Local files” describes the handling of imported file contents, not an assertion that a hosted app never makes an asset request. There is no service worker or offline-installation feature yet.

## 8. Verification

### Unit tests

```sh
npm test
```

`book.test.ts` covers natural sorting, frontmatter, path resolution, Unicode anchors, folder filtering, and errors. `parse.test.ts` covers page-size bounds, reference links and tables, large code/list/table handling, and heading ID collisions.

### Browser tests

```sh
npx playwright install chromium
npm run test:e2e
```

Playwright starts or reuses the development server on port 5173. Tests use temporary folders and remove their generated fixtures afterward. Current scenarios cover:

- Sample-book navigation, search, bookmarks, and saved preferences.
- Folder import, sanitized HTML, local images, internal links, and reading-position restoration.
- Error handling without losing the open book.
- Mobile chapter and section drawers.
- Section navigation, active-section updates, and repeated heading names.
- A generated multi-megabyte book, bounded DOM growth, distant section jumps, search, pagination, and resume after reopening.

To test an already-running production preview in PowerShell:

```powershell
npm.cmd run build
# In another terminal:
npm.cmd run preview -- --port 5174 --strictPort
# In the test terminal:
$env:PLAYWRIGHT_BASE_URL = 'http://127.0.0.1:5174'
npm.cmd run test:e2e
Remove-Item Env:PLAYWRIGHT_BASE_URL
```

When `PLAYWRIGHT_BASE_URL` is set, Playwright uses that server without starting its own. No deployment is performed by the tests.

## 9. Troubleshooting

| Symptom                                              | What to check                                                                                                         |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| No chapters appear                                   | Confirm that the selected folder contains a supported Markdown extension outside hidden folders and `node_modules`.   |
| Folder import is rejected                            | Split files above 25 MiB or select a subfolder with no more than 100 MiB of Markdown.                                 |
| A local image is missing                             | Check the path relative to the Markdown file and ensure the asset was inside the selected folder.                     |
| A remote image is a placeholder                      | This is intentional; save a local copy and reference it relatively if needed.                                         |
| My book disappeared after refresh                    | Reopen its folder. Only reading state is persisted, not file access or contents.                                      |
| Progress was not restored                            | Check browser profile, origin/port, storage availability, folder name, and the set of Markdown paths.                 |
| A very large block looks like plain text             | The block exceeded the bounded-rendering threshold. Divide it into smaller Markdown structures for richer formatting. |
| A section is not found by the browser's Find command | The section may be on another reading page. Use book search or the section panel.                                     |
| A worker cannot start in production                  | Serve the built files over HTTP(S), preserve worker assets, and check JavaScript MIME types and host policies.        |
| A changed disk file still shows old content          | Reopen the folder. The app does not watch the filesystem.                                                             |
| `npm` is blocked by PowerShell                       | Use `npm.cmd` and `npx.cmd`.                                                                                          |

## 10. Scope and possible extensions

Implemented: local folder reading, nested Markdown discovery, book/chapter navigation, section navigation, large-document pages, local assets, background search, bookmarks, saved preferences/progress, and responsive themes.

Not implemented: Markdown editing, autosave back to disk, annotations, cross-device sync, filesystem watching, persistent folder handles, PDF/EPUB export, rich code highlighting, math/diagram rendering, or full-document printing.

Useful future work includes location-level search results, annotations tied to stable source offsets, persistent folder access where supported, broader browser coverage, and performance profiles for large image-heavy books. Each would require its own behavior and compatibility decisions.
