import { test, expect } from "@playwright/test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("sample book: navigation, search, bookmarks, and saved preferences", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "A little less noise" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Bookmark chapter", exact: true })
    .click();
  await page.getByRole("tab", { name: /Bookmarks/ }).click();
  await expect(
    page
      .getByRole("navigation", { name: "Bookmarked chapters" })
      .getByRole("button"),
  ).toHaveCount(1);
  await page.getByRole("tab", { name: /Contents/ }).click();
  await page
    .getByRole("textbox", { name: "Search this book" })
    .fill("multitasking");
  await expect(
    page
      .getByRole("navigation", { name: "Chapters", exact: true })
      .getByRole("button"),
  ).toHaveCount(1);
  await page
    .getByRole("navigation", { name: "Chapters", exact: true })
    .getByRole("button")
    .click();
  await expect(
    page.getByRole("heading", { name: "The practice of attention" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reading settings", exact: true })
    .click();
  await page.getByRole("button", { name: "Night", exact: true }).click();
  await page.getByRole("button", { name: "Sans serif", exact: true }).click();
  await page.getByRole("button", { name: "Increase text size" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "night");
  await expect(page.locator("article")).toHaveClass(/font-sans/);
  await expect(
    page.getByRole("heading", { name: "The practice of attention" }),
  ).toBeVisible();
  await expect(page.locator(".app")).toHaveAttribute("style", /19px/);
  expect(errors).toEqual([]);
});

test("imports a folder, renders safely, follows relative links, and restores reading position", async ({
  page,
}) => {
  const directory = await mkdtemp(path.join(tmpdir(), "folio-reader-"));
  try {
    await mkdir(path.join(directory, "chapters"));
    await mkdir(path.join(directory, "images"));
    await writeFile(
      path.join(directory, "images", "dot.svg"),
      '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><circle cx="40" cy="40" r="30" fill="orange"/></svg>',
    );
    await writeFile(
      path.join(directory, "1-introduction.md"),
      '# My introduction\n\n[Read next](chapters/2-next.md#special-section)\n\n![Local illustration](images/dot.svg)\n\n<img src="x" onerror="window.injected=true"><script>window.injected=true</script>\n\n![Tracking pixel](https://example.com/track.png)',
    );
    await writeFile(
      path.join(directory, "10-last.md"),
      "# Last chapter\n\nThe end.",
    );
    await writeFile(
      path.join(directory, "chapters", "2-next.md"),
      `# My second chapter\n\n${"A long paragraph for reading. ".repeat(100)}\n\n## Special section\n\nWe arrived here.\n\n${"More content to read. ".repeat(300)}`,
    );
    await page.goto("/");
    await page.getByLabel("Select a Markdown folder").setInputFiles(directory);
    await expect(
      page.getByRole("heading", { name: "My introduction" }),
    ).toBeVisible();
    await expect(page.locator("article img")).toHaveAttribute("src", /^blob:/);
    await expect(page.locator("article img")).toHaveJSProperty(
      "naturalWidth",
      80,
    );
    expect(await page.evaluate(() => "injected" in window)).toBe(false);
    await expect(
      page.getByText("Remote image not loaded for privacy", { exact: false }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Read next" }).click();
    await expect(
      page.getByRole("heading", { name: "Special section" }),
    ).toBeInViewport();
    await page.locator(".reader-scroller").evaluate((element) => {
      element.scrollTop = (element.scrollHeight - element.clientHeight) * 0.6;
    });
    await expect
      .poll(() =>
        page
          .locator(".reader-scroller")
          .evaluate(
            (element) =>
              element.scrollTop / (element.scrollHeight - element.clientHeight),
          ),
      )
      .toBeCloseTo(0.6, 1);
    await expect
      .poll(() =>
        page.evaluate(() =>
          Object.keys(localStorage)
            .filter((key) => key.startsWith("folio:reading:folder:"))
            .map(
              (key) =>
                JSON.parse(localStorage.getItem(key)!).positions[
                  "chapters/2-next.md"
                ],
            )
            .some((value) => value > 0.5),
        ),
      )
      .toBe(true);
    await page.reload();
    await page.getByLabel("Select a Markdown folder").setInputFiles(directory);
    await expect(
      page.getByRole("heading", { name: "My second chapter" }),
    ).toBeAttached();
    await expect
      .poll(() =>
        page
          .locator(".reader-scroller")
          .evaluate(
            (element) =>
              element.scrollTop / (element.scrollHeight - element.clientHeight),
          ),
      )
      .toBeCloseTo(0.6, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("empty folders show an error without replacing the open book", async ({
  page,
}) => {
  const directory = await mkdtemp(path.join(tmpdir(), "folio-empty-"));
  try {
    await writeFile(path.join(directory, "note.txt"), "Not markdown");
    await page.goto("/");
    await page.getByLabel("Select a Markdown folder").setInputFiles(directory);
    await expect(page.getByRole("alert")).toContainText("no Markdown files");
    await expect(
      page.getByRole("heading", { name: "A little less noise" }),
    ).toBeVisible();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("mobile layout opens the chapter drawer and remains inside the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Show sidebar" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Show sidebar" }).click();
  await page
    .getByRole("button", { name: "02 The practice of attention" })
    .click();
  await expect(
    page.getByRole("heading", { name: "The practice of attention" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Show sidebar" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Reading settings", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Reading settings" }),
  ).toBeInViewport();
});

test("section side panel navigates headings, tracks scrolling, and updates per chapter", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const outline = page.getByRole("navigation", { name: "On this page" });
  await expect(outline).toBeVisible();
  await expect(outline.getByRole("link")).toHaveCount(4);
  const invitation = outline.getByRole("link", {
    name: "An invitation to slow down",
  });
  await invitation.click();
  await expect(
    page.getByRole("heading", { name: "An invitation to slow down" }),
  ).toBeInViewport();
  await expect(invitation).toHaveAttribute("aria-current", "location");
  await page.locator(".reader-scroller").evaluate((element) => {
    element.scrollTop = 0;
  });
  await expect(
    outline.getByRole("link", { name: "A little less noise" }),
  ).toHaveAttribute("aria-current", "location");
  await page
    .getByRole("button", { name: "02 The practice of attention" })
    .click();
  await expect(
    outline.getByRole("link", { name: "Notice the ordinary" }),
  ).toBeVisible();
  await expect(invitation).toHaveCount(0);
});

test("mobile section drawer jumps to a section and closes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const toggle = page.getByRole("button", {
    name: "On this page",
    exact: true,
  });
  const outline = page.getByRole("navigation", { name: "On this page" });
  await expect(outline).not.toBeVisible();
  await toggle.click();
  await expect(outline).toBeVisible();
  await outline
    .getByRole("link", { name: "A little room for thought" })
    .click();
  await expect(
    page.getByRole("heading", { name: "A little room for thought" }),
  ).toBeInViewport();
  await expect(outline).not.toBeVisible();
  await page.locator(".reader-scroller").evaluate((element) => {
    element.scrollTop = 0;
  });
  await toggle.click();
  await page.keyboard.press("Escape");
  await expect(outline).not.toBeVisible();
  await expect(toggle).toBeFocused();
});

test("section anchors remain unique for repeated headings and include deep headings", async ({
  page,
}) => {
  const directory = await mkdtemp(path.join(tmpdir(), "folio-sections-"));
  try {
    await writeFile(
      path.join(directory, "chapter.md"),
      `# Example\n\n## A\n\n${"First section. ".repeat(100)}\n\n## A\n\n${"Second section. ".repeat(100)}\n\n### A-1\n\n${"Third section. ".repeat(100)}\n\n#### Deep heading\n\n${"Last section. ".repeat(100)}`,
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    await page.getByLabel("Select a Markdown folder").setInputFiles(directory);
    const outline = page.getByRole("navigation", { name: "On this page" });
    await expect(outline.getByRole("link")).toHaveCount(5);
    const ids = await page
      .locator("article :is(h1,h2,h3,h4)")
      .evaluateAll((headings) => headings.map((heading) => heading.id));
    expect(new Set(ids).size).toBe(ids.length);
    await outline.getByRole("link", { name: "A", exact: true }).nth(1).click();
    await expect(
      page.getByRole("heading", { name: "A", exact: true }).nth(1),
    ).toBeInViewport();
    await outline.getByRole("link", { name: "Deep heading" }).click();
    await expect(
      page.getByRole("heading", { name: "Deep heading" }),
    ).toBeInViewport();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
