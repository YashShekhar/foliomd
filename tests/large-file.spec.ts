import { test, expect } from "@playwright/test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("multi-megabyte chapters stay bounded, searchable, and navigable", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const directory = await mkdtemp(path.join(tmpdir(), "foliomd-large-"));
  const paragraph =
    "Thoughtful reading makes room for ideas, curiosity, and a little more attention. ".repeat(
      7,
    );
  const source =
    "# A very large book\n\n" +
    Array.from(
      { length: 12_000 },
      (_, index) => `## Section ${index}\n\n${paragraph}\n\n`,
    ).join("") +
    "\n## The final destination\n\nA unique needle: marshmallow-orbit.\n";
  try {
    await writeFile(path.join(directory, "large.md"), source);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "A little less noise" }),
    ).toBeVisible();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.evaluate(() => {
      const timings: number[] = [];
      (window as unknown as { largeFileTimings: number[] }).largeFileTimings =
        timings;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) timings.push(entry.duration);
      }).observe({ type: "longtask", buffered: false });
    });
    const start = Date.now();
    await page.getByLabel("Select a Markdown folder").setInputFiles(directory);
    await expect(
      page.getByRole("heading", { name: "A very large book" }),
    ).toBeVisible({ timeout: 60_000 });
    const readyMs = Date.now() - start;
    await expect(page.getByLabel("Chapter pages")).toContainText("Page 1 of");
    const renderedNodes = await page.locator("article *").count();
    expect(renderedNodes).toBeLessThan(2500);
    expect(
      await page
        .getByRole("navigation", { name: "On this page" })
        .getByRole("link")
        .count(),
    ).toBeLessThan(50);
    const beforeSearch = Date.now();
    await page
      .getByRole("textbox", { name: "Search this book" })
      .fill("marshmallow-orbit");
    await expect(
      page
        .getByRole("navigation", { name: "Chapters", exact: true })
        .getByRole("button"),
    ).toHaveCount(1);
    const searchMs = Date.now() - beforeSearch;
    await page
      .getByRole("textbox", { name: "Find a section" })
      .fill("The final destination");
    await page
      .getByRole("navigation", { name: "On this page" })
      .getByRole("link", { name: "The final destination" })
      .click();
    await expect(
      page.getByRole("heading", { name: "The final destination" }),
    ).toBeInViewport();
    await expect(page.locator("article")).toContainText("marshmallow-orbit");
    const finalPagination = (await page
      .getByLabel("Chapter pages")
      .textContent())!;
    await page.locator(".reader-scroller").evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await page.waitForTimeout(500);
    const longTasks = await page.evaluate(
      () =>
        (window as unknown as { largeFileTimings: number[] }).largeFileTimings,
    );
    const metrics = {
      bytes: Buffer.byteLength(source),
      sections: 12002,
      readyMs,
      searchMs,
      renderedNodes,
      finalPagination,
      longTasks: longTasks.length,
      longestMainThreadTaskMs: Math.round(Math.max(0, ...longTasks)),
    };
    console.log("Large file measurements:", JSON.stringify(metrics));
    await page.reload();
    await page.getByLabel("Select a Markdown folder").setInputFiles(directory);
    await expect(page.getByLabel("Chapter pages")).toHaveText(finalPagination, {
      timeout: 60_000,
    });
    await expect(page.locator("article")).toContainText("marshmallow-orbit");
    await page
      .getByRole("button", { name: "Previous page", exact: true })
      .click();
    await expect(page.getByLabel("Chapter pages")).not.toHaveText(
      finalPagination,
    );
    await page
      .locator(".reader-footer")
      .getByRole("button", { name: "Next page", exact: true })
      .click();
    await expect(page.getByLabel("Chapter pages")).toHaveText(finalPagination);
    expect(errors).toEqual([]);
    // Attach measurements from the first load; a hard assertion on DOM growth is more portable than a machine-specific timing limit.
    await testInfo.attach("large-file-measurements", {
      body: JSON.stringify(metrics, null, 2),
      contentType: "application/json",
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
