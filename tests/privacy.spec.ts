import { test, expect } from "@playwright/test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("import, search, and navigation never transmit selected folder data", async ({
  page,
  context,
  baseURL,
}) => {
  const secret = "PRIVATE-foliomd-network-canary-83e72";
  const folder = await mkdtemp(path.join(tmpdir(), secret));
  try {
    await mkdir(path.join(folder, "nested"));
    await writeFile(
      path.join(folder, `01-${secret}.md`),
      `# Private chapter\n\n${secret}\n\n[Next](nested/next.md)\n\n![Remote](https://example.com/${secret})\n\n<img src="/${secret}" srcset="https://example.com/${secret} 2x" onerror="fetch('/${secret}')">\n\n<iframe src="/${secret}"></iframe><form action="/${secret}"><input value="${secret}"></form>\n\n<a href="https://example.com/" ping="/${secret}" attributionsrc="/${secret}">External</a>\n\n<table background="/${secret}"><tr><td>Text</td></tr></table>`,
    );
    await writeFile(
      path.join(folder, "nested/next.md"),
      "# Another private chapter\n\n## Local section\n\nMore local words.",
    );
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "A little less noise" }),
    ).toBeVisible();
    const transmitted: { url: string; method: string; body: string | null }[] =
      [];
    await context.route("**/*", (route) => {
      const request = route.request();
      transmitted.push({
        url: request.url(),
        method: request.method(),
        body: request.postData(),
      });
      if (new URL(request.url()).origin !== new URL(baseURL!).origin)
        return route.abort();
      return route.continue();
    });
    await page.getByLabel("Select a Markdown folder").setInputFiles(folder);
    await expect(
      page.getByRole("heading", { name: "Private chapter", exact: true }),
    ).toBeVisible();
    await expect(
      page.locator(
        "article [ping], article [attributionsrc], article [background], article [srcset], article iframe, article form",
      ),
    ).toHaveCount(0);
    await page.getByRole("textbox", { name: "Search this book" }).fill(secret);
    await expect(
      page
        .getByRole("navigation", { name: "Chapters", exact: true })
        .getByRole("button"),
    ).toHaveCount(1);
    await page.getByRole("link", { name: "Next", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Another private chapter" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Bookmark chapter", exact: true })
      .click();
    await page.waitForTimeout(350);
    expect(
      transmitted.every(
        (request) => request.method === "GET" && request.body === null,
      ),
    ).toBe(true);
    expect(
      transmitted.every(
        (request) => new URL(request.url).origin === new URL(baseURL!).origin,
      ),
    ).toBe(true);
    expect(JSON.stringify(transmitted)).not.toContain(secret);
    expect(
      transmitted.every((request) =>
        /^\/(assets|src|node_modules|@vite|@react-refresh)\//.test(
          new URL(request.url).pathname,
        ),
      ),
    ).toBe(true);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

test("production policies block page and worker network uploads", async ({
  page,
  context,
  baseURL,
}) => {
  const response = await page.goto("/");
  const policy = response!.headers()["content-security-policy"] ?? "";
  test.skip(
    !policy.includes("connect-src 'none'"),
    "Requires production preview with its response headers; development permits Vite's connection.",
  );
  await expect(
    page.getByRole("heading", { name: "A little less noise" }),
  ).toBeVisible();
  const attemptedNetwork: string[] = [];
  await context.route("**/*", (route) => {
    attemptedNetwork.push(route.request().url());
    return route.continue();
  });
  const blocked = await page.evaluate(async () => {
    try {
      await fetch("/privacy-upload-probe", {
        method: "POST",
        body: "test-only",
      });
      return false;
    } catch {
      return true;
    }
  });
  expect(blocked).toBe(true);
  expect(
    attemptedNetwork.some((url) => url.includes("privacy-upload-probe")),
  ).toBe(false);
  const workerUrl = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .find((url) => /reader\.worker.*\.js/.test(url)),
  );
  expect(workerUrl).toBeTruthy();
  const workerResponse = await context.request.get(workerUrl!);
  expect(workerResponse.headers()["content-security-policy"]).toContain(
    "connect-src 'none'",
  );
  expect(new URL(workerUrl!).origin).toBe(new URL(baseURL!).origin);
});
