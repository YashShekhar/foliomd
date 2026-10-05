# foliomd — Local-only file handling

## What stays in the browser

Selected folder names, relative paths, Markdown contents, companion assets, and search queries are processed locally. The application has no upload endpoint, API for saving books, database, analytics SDK, or telemetry service. Browser workers are local background threads; their `postMessage` calls do not send data to the application server.

The server serves the application code, fonts, and other static application assets. It does not receive or store the selected book. This applies equally to nested folders and individually dropped files.

## Local persistence

Reading progress, bookmarked chapter paths, book identifiers, and appearance preferences remain in this browser's local storage. File contents are held in memory for the current reading session, not persisted in local storage. Clearing the site's browser data removes its saved reading state. Reopen a folder after refreshing to resume reading it.

This is browser-local persistence, not server storage or synchronization. Imported files are not modified on disk.

## Enforced network restrictions

Production builds include a Content Security Policy with `connect-src 'none'`, blocking fetch, XMLHttpRequest, beacon uploads, and WebSocket connections from the reader. Requests for the app's own scripts, workers, fonts, and styles remain allowed so it can load.

The image policy allows only browser-local blob and data URLs. Imported Markdown cannot cause a request to a remote tracking image or even an image path on the application server. Local companion images are displayed through object URLs. Rendering also removes image source sets, link pings, attribution URLs, background-image attributes, forms, frames, embedded media, scripts, and inline document styles.

Sanitized content is processed in a detached fragment, local references are resolved, and only then is it inserted into the reader. External links remain available for deliberate clicks, open in a separate tab, and do not send a referrer. Clicking an external link visits that destination normally; it does not upload the folder.

## Deployment requirements

The policy is embedded in built HTML. Vite development and preview servers also send security response headers; preview uses the strict production policy. Development permits the local connection needed for Vite's live updates. Use the production build for the strict no-upload policy.

`public/_headers` is copied into `dist/_headers`. Static hosts that support this format can apply the policy to **all responses**, including worker scripts. For other hosts, configure the equivalent response headers:

```text
Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src blob: data:; worker-src 'self'; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
```

Apply the headers to worker JavaScript as well as HTML, because separately served workers require their own response policy. Keep the same-origin static worker and font assets available. Do not add analytics, remote error reporting, or an upload backend to this application.

The app does not configure a third-party host's access-log retention. A host may log requests for public application assets, IP addresses, or browser metadata according to its own configuration. These requests contain no selected folder names, paths, file text, or searches. If infrastructure-level access logs must also be disabled, configure that on the chosen host. No hosting deployment is part of this local project.

## Verification

`tests/privacy.spec.ts` imports a temporary private folder containing a unique marker, hostile image references, link pings, a frame, and a form. It searches the file, navigates between chapters, and bookmarks a chapter while inspecting requests that reach the network routing layer. The test checks that no request contains the marker, every observed application request is a static asset GET, and no cross-origin request is made.

A production-only test attempts a POST request and verifies that the browser blocks it before it reaches that network layer. It also checks the worker script's security response header. Run these checks against a production preview using `PLAYWRIGHT_BASE_URL` as documented in the [project guide](PROJECT_GUIDE.md#8-verification).
