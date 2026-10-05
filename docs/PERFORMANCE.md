# foliomd — Performance validation

Measured on 5 October 2026. These results describe a specific automated Chromium run on the development machine, not a universal performance guarantee.

## Workload

The browser test in `tests/large-file.spec.ts` generates one Markdown file containing:

- **7,032,974 UTF-8 bytes**: approximately 7.03 MB or 6.71 MiB.
- **12,002 headings**, including a distant final section.
- Repeated prose paragraphs and a unique search phrase at the end.
- **310 generated reading pages** with the current parser budget.

The test opens the folder through the real browser file input. It then verifies a bounded document and outline, searches the entire chapter, filters and jumps to the final heading, reloads the browser, reopens the folder, restores the final reading page, and turns backward and forward.

## Recorded result

| Measurement                                                               | Observed value |
| ------------------------------------------------------------------------- | -------------: |
| Folder selection to first chapter heading visible                         |       1,048 ms |
| Search input to chapter result                                            |         263 ms |
| Descendant elements mounted inside the first document page                |             81 |
| Main-thread long tasks observed during the first import/search/jump cycle |              0 |
| Reported maximum long-task duration                                       |           0 ms |

The zero long-task result means Chromium's Long Tasks observer recorded no task over its approximately 50 ms threshold during the measured interval. It does not mean parsing used no CPU, that every animation frame was perfect, or that all workloads will meet this result. Parsing happens in workers and is intentionally outside the main-thread observer.

The full eight-test browser suite also passed against the built production preview. In that run, with two test workers active, the same fixture opened in **1,564 ms**, search completed in **250 ms**, **81 document descendants** were mounted, and the observer again recorded **zero main-thread long tasks**. The development and production figures come from separate runs with different concurrent work; they are not a controlled speed comparison.

The observed search time includes the debounce and browser-test overhead. The initial load timing includes file selection, worker startup, import, parsing, sanitization, and the first visible heading. It does not measure network download of the app from a remote host.

## Reproduce

```sh
npm ci
npx playwright install chromium
npm run test:e2e -- tests/large-file.spec.ts
```

The test prints a JSON measurement summary and attaches it to Playwright's test result. The fixture is generated in a temporary directory and removed when the test completes. Measurements vary with CPU, browser version, concurrent work, development versus production mode, and caching.

To verify the built application, set `PLAYWRIGHT_BASE_URL` to a running production preview as described in the [project guide](PROJECT_GUIDE.md#8-verification).

## What is enforced

Unit tests check that generated HTML pages stay within `PAGE_HTML_LIMIT`, including large code blocks, lists, and tables. Browser tests assert that this large fixture mounts fewer than 2,500 document descendants and fewer than 50 outline links at once. They also verify that pagination does not lose distant content, search matches, or saved reading position.

Timing figures are recorded rather than used as machine-dependent pass/fail thresholds. The structural bounds and user-visible behavior are asserted. Compare timing measurements on the same machine and browser when investigating a regression.

## Important tradeoffs

- Import is capped at 25 MiB per Markdown file and 100 MiB total Markdown. These checks happen before reading the file contents.
- Large chapters are paginated. Native browser Find, copy, and selection see the current mounted page.
- Unusually large individual blocks may be broken into plain-text continuations. Large code blocks retain escaped text, while complex formatting can be simplified.
- The whole open book's source and search index still live in memory. This is not an unlimited-size streaming reader.
- Very large images, pathological Markdown structures, slow storage, low-memory devices, and other browser tabs can affect responsiveness.
- The current benchmark is prose- and heading-heavy. Unit tests cover large code/list/table structures, but equivalent browser performance measurements for image-heavy books and other engines remain future work.

## Investigating a slowdown

1. Reproduce with a copy of the file and note its byte size, heading count, and unusually large blocks.
2. Check whether the delay occurs during import, worker parsing, page sanitization, layout, search, or image decoding.
3. Confirm that only the current page is mounted and that an outline above 150 headings is windowed.
4. Use browser performance tools to distinguish main-thread tasks from worker CPU time.
5. Retain a representative fixture or generator and add a focused regression test before changing the rendering pipeline.
