# foliomd

A quiet, book-style reader for a folder of Markdown files. Built with React, TypeScript, and Vite. Files are read in your browser and are never uploaded. Fonts are bundled locally.

## Run locally

Requires Node.js 22.12 or newer.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite, then select **Open folder**. A sample book is available immediately.

Detailed documentation: [Project guide](docs/PROJECT_GUIDE.md) · [Performance validation](docs/PERFORMANCE.md).

Privacy: folders, file contents, paths, and searches stay in your browser. There is no upload API or server-side book storage. Production builds block network upload APIs and remote document images. Only reading state and preferences are saved locally. See [Local-only file handling](docs/PRIVACY.md) for verification and hosting requirements.

## Reading your files

- Choose a folder or drag it into the app. Subfolders are included.
- `.md`, `.markdown`, and `.mdown` files become chapters. Filenames sort naturally (`2` before `10`), with `README.md` first in each folder. Hidden folders and `node_modules` are ignored.
- Titles come from a simple frontmatter `title`, the first Markdown H1, or the filename. Frontmatter is hidden from the reading view.
- Tables, lists, blockquotes, fenced code, and links are supported. Relative images and links resolve inside the selected folder.
- Search chapter titles, filenames, and text. Bookmark chapters and adjust the typeface, size, page width, or paper/sepia/night theme.
- Use the **On this page** side panel to jump to any heading in the current chapter. Nested headings are indented and the current section is highlighted as you scroll. On smaller screens, open the panel with the **On this page** button.
- Reading position, bookmarks, and settings are remembered in browser local storage. **Reopen your folder after a refresh**; browser permissions do not persist file access. File contents are not stored.
- Remote images are replaced with a placeholder to keep imported documents from making background network requests. External links open in a new tab when clicked.
- Large chapters are parsed in a background worker and split into reading pages. Search also runs in a worker, and long section lists render only their visible rows. Imports are limited to 25 MiB per Markdown file and 100 MiB total Markdown; oversized individual blocks may use plain-text continuations.

Keyboard shortcuts: **Ctrl/Cmd K** to search, **Alt Left/Right** to change chapters, **Escape** to dismiss menus.

## Build and verify

```sh
npm run build
npm test
npx playwright install chromium
npm run test:e2e
```

`npm run preview` serves the production build locally. The `dist` folder can be deployed to a static web host; no backend is required.
