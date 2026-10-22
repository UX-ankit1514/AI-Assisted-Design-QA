import { readFileSync } from "node:fs";
import { chooseOption, expect, FILES, openIssue, startComparison, test, upload } from "./helpers";

/* PRD §14 acceptance criteria, end to end against a production build. */

test.describe("New Comparison", () => {
  test("AC-01: two valid screenshots show previews and dimensions, then enable Run Comparison", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Compare Your Design With the Developed Website");
    const run = page.getByRole("button", { name: "Run Comparison" });
    await expect(run).toBeDisabled();

    await page.getByLabel("Project name").fill("Arnifi Homepage QA");
    await upload(page, "design", FILES.design);
    await expect(page.getByRole("img", { name: "Preview of arnifi-home-design.png" })).toBeVisible();
    await expect(page.getByTestId("dims-design")).toContainText("1440 × 3083 px");
    await expect(page.getByText("Now add the developed website screenshot")).toBeVisible();
    await expect(run).toBeDisabled();

    await upload(page, "build", FILES.build);
    await expect(page.getByRole("img", { name: "Preview of arnifi-home-build.png" })).toBeVisible();
    await expect(page.getByTestId("dims-build")).toContainText("1440 × 3083 px");
    await expect(run).toBeEnabled();
  });

  test("AC-02: different dimensions are explained and never stretched", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Project name").fill("Mismatch");
    await upload(page, "design", FILES.design);
    await upload(page, "build", FILES.mismatch);
    await expect(page.getByTestId("mismatch")).toHaveText("The design is 1440 × 3083 px but the website screenshot is 1440 × 900 px.");
    await expect(page.getByText("We never resize or stretch screenshots")).toBeVisible();
    await expect(page.getByRole("button", { name: "Run Comparison" })).toBeDisabled();

    // Recovery: replace the screenshot and the comparison becomes available.
    await upload(page, "build", FILES.build);
    await expect(page.getByTestId("mismatch")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Run Comparison" })).toBeEnabled();
  });

  test("rejects unsupported and unreadable files with a specific message", async ({ page }) => {
    await page.goto("/");
    await upload(page, "design", FILES.gif);
    await expect(page.getByTestId("error-design")).toContainText("This isn't a PNG, JPG or WebP image.");
    await upload(page, "build", FILES.corrupt);
    await expect(page.getByTestId("error-build")).toContainText("couldn't be opened");
    await expect(page.getByRole("button", { name: "Run Comparison" })).toBeDisabled();
  });

  test("shows progress and blocks duplicate submissions while comparing", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Project name").fill("Slow run");
    await upload(page, "design", FILES.design);
    await upload(page, "build", FILES.build);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 40 });
    await page.getByRole("button", { name: "Run Comparison" }).click();
    await expect(page.getByTestId("progress")).toBeVisible();
    await expect(page.getByRole("button", { name: "Comparing…" })).toBeDisabled();
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    await page.waitForURL(/\/comparisons\//);
  });
});

test.describe("Comparison Workspace", () => {
  test("AC-03: identical screenshots produce no issue cards", async ({ page }) => {
    await startComparison(page, FILES.design, FILES.design, "Identical pair");
    await expect(page.getByTestId("no-differences")).toContainText("No meaningful visual differences detected.");
    await expect(page.getByTestId("stat-difference")).toHaveText("0%");
    await expect(page.getByTestId("stat-regions")).toHaveText("0");
    await expect(page.locator("[data-testid^='issue-R']")).toHaveCount(0);
    await expect(page.locator("[data-testid^='highlight-']")).toHaveCount(0);
  });

  test("AC-04 + AC-05: real differences are highlighted and selection stays in sync", async ({ page }) => {
    await startComparison(page, FILES.design, FILES.build);
    const regions = Number(await page.getByTestId("stat-regions").textContent());
    expect(regions).toBeGreaterThanOrEqual(6);
    await expect(page.getByTestId("pane-design").locator("[data-testid^='highlight-']")).toHaveCount(regions);
    await expect(page.getByTestId("pane-build").locator("[data-testid^='highlight-']")).toHaveCount(regions);

    // Card → highlight, on both screenshots.
    await openIssue(page, "R1");
    await expect(page.getByTestId("pane-design").getByTestId("highlight-R1")).toHaveAttribute("data-selected", "true");
    await expect(page.getByTestId("pane-build").getByTestId("highlight-R1")).toHaveAttribute("data-selected", "true");
    await expect(page.getByTestId("issue-detail")).toContainText("This is a potential difference until you review it.");

    // Highlight → card (fit the page first so R2 is on screen).
    await page.keyboard.press("0");
    await page.waitForTimeout(400);
    await page.getByTestId("pane-build").getByTestId("highlight-R2").click();
    await expect(page.getByTestId("issue-R2")).toHaveAttribute("data-selected", "true");
    await expect(page.getByTestId("pane-design").getByTestId("highlight-R2")).toHaveAttribute("data-selected", "true");
  });

  test("offers overlay and difference mask views", async ({ page }) => {
    await startComparison(page, FILES.design, FILES.build);
    await page.getByRole("radio", { name: "Overlay" }).click();
    await expect(page.getByTestId("pane-overlay")).toBeVisible();
    await expect(page.getByTestId("overlay-controls")).toBeVisible();
    await page.getByRole("radio", { name: "Difference Mask" }).click();
    await expect(page.getByTestId("pane-mask").getByRole("img", { name: "Difference mask" })).toBeVisible();
    await page.getByRole("radio", { name: "Side by Side" }).click();
    await expect(page.getByTestId("pane-build")).toBeVisible();
  });

  test("warns about misaligned screenshots instead of listing misleading bugs", async ({ page }) => {
    await startComparison(page, FILES.design, FILES.shifted, "Shifted capture");
    await expect(page.getByTestId("misalignment-warning")).toContainText("moved about 12 px up");
    await expect(page.getByTestId("stat-regions")).not.toHaveText("0");
    await expect(page.locator("[data-testid^='issue-R']")).toHaveCount(0);
    await page.getByRole("button", { name: "Review Regions Anyway" }).first().click();
    await expect(page.locator("[data-testid^='issue-R']").first()).toBeVisible();
  });

  test("keyboard: J selects, C confirms and D dismisses", async ({ page }) => {
    await startComparison(page, FILES.design, FILES.build);
    await page.keyboard.press("j");
    await expect(page.getByTestId("issue-R1")).toHaveAttribute("data-selected", "true");
    await page.keyboard.press("c");
    await expect(page.getByTestId("last-action")).toContainText("R1 confirmed as BUG-1");
    await expect(page.getByTestId("issue-R2")).toHaveAttribute("data-selected", "true");
    await page.keyboard.press("d");
    await expect(page.getByTestId("last-action")).toContainText("R2 dismissed");
    await expect(page.getByTestId("stat-confirmed")).toHaveText("1");
    await expect(page.getByTestId("stat-dismissed")).toHaveText("1");
  });

  test("a missed problem can be marked by hand", async ({ page }) => {
    await startComparison(page, FILES.design, FILES.design, "Manual check");
    await page.getByRole("button", { name: "Add Issue" }).click();
    const pane = await page.getByTestId("pane-build").boundingBox();
    await page.mouse.move(pane!.x + 120, pane!.y + 120);
    await page.mouse.down();
    await page.mouse.move(pane!.x + 260, pane!.y + 200, { steps: 6 });
    await page.mouse.up();
    await expect(page.getByTestId("issue-M1")).toBeVisible();
    await expect(page.getByTestId("issue-M1")).toContainText("BUG-1");
    await expect(page.getByTestId("stat-confirmed")).toHaveText("1");
  });
});

test.describe("Review and tracking", () => {
  test("AC-06, AC-07, AC-08, AC-09: confirm, dismiss, track statuses and export", async ({ page }) => {
    await startComparison(page, FILES.design, FILES.build);

    // AC-06 — confirm becomes an Open bug.
    await openIssue(page, "R1");
    await page.getByTestId("issue-title").fill("Header CTA uses the wrong blue");
    await page.getByTestId("issue-title").press("Enter");
    await page.getByTestId("confirm-bug").click();
    await expect(page.getByTestId("stat-confirmed")).toHaveText("1");

    // AC-07 — dismiss is excluded from the tracker.
    await expect(page.getByTestId("issue-R2")).toHaveAttribute("data-selected", "true");
    const dismissedTitle = await page.getByTestId("issue-title").inputValue();
    await page.getByTestId("dismiss").click();
    await expect(page.getByTestId("stat-dismissed")).toHaveText("1");

    await page.getByTestId("tab-Confirmed").click();
    await expect(page.getByTestId("issue-R1")).toContainText("BUG-1");
    await expect(page.getByTestId("issue-R1")).toContainText("Open");

    await page.getByRole("link", { name: "Design Issues" }).first().click();
    await page.waitForURL(/\/issues/);
    await expect(page.getByTestId("row-BUG-1")).toContainText("Header CTA uses the wrong blue");
    await expect(page.getByTestId("tracker-list")).not.toContainText(dismissedTitle);
    await expect(page.getByTestId("count-Total")).toHaveText("1");
    await expect(page.getByTestId("count-Open")).toHaveText("1");

    // AC-08 — status changes keep the summary consistent; Verified only after Fixed.
    const row = page.getByTestId("row-BUG-1");
    await row.getByTestId("status-select").click();
    await expect(page.getByRole("option", { name: "Verified" })).toHaveCount(0);
    await page.getByRole("option", { name: "In Progress", exact: true }).click();
    await expect(page.getByTestId("count-Open")).toHaveText("0");
    await expect(page.getByTestId("count-In Progress")).toHaveText("1");
    await chooseOption(page, row.getByTestId("status-select"), "Fixed");
    await chooseOption(page, row.getByTestId("status-select"), "Verified");
    await expect(page.getByTestId("count-Verified")).toHaveText("1");
    await chooseOption(page, row.getByTestId("severity-select"), "High");

    // Status filter.
    await page.getByTestId("summary-Open").click();
    await expect(page.getByText("No open issues")).toBeVisible();
    await page.getByTestId("summary-Total").click();

    // AC-09 — CSV contains the current data.
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("tracker-export").click()]);
    expect(download.suggestedFilename()).toMatch(/^all-projects-design-issues-\d{4}-\d{2}-\d{2}\.csv$/);
    const csv = readFileSync((await download.path())!, "utf8").replace(/^﻿/, "");
    const [header, first] = csv.trim().split("\r\n");
    expect(header).toBe("Project name,Issue ID,Issue title,Description,Severity,Status,Region coordinates,Created date");
    expect(first).toContain("Arnifi Homepage QA,BUG-1,Header CTA uses the wrong blue,");
    expect(first).toContain(",High,Verified,");
    expect(first).toMatch(/"x \d+, y \d+, width \d+, height \d+"/);
    expect(csv.trim().split("\r\n")).toHaveLength(2);
  });

  test("reloading keeps comparisons and review state", async ({ page }) => {
    await startComparison(page, FILES.design, FILES.build);
    await openIssue(page, "R1");
    await page.getByTestId("confirm-bug").click();
    await expect(page.getByTestId("stat-confirmed")).toHaveText("1");
    await page.waitForTimeout(300);
    await page.reload();
    await expect(page.getByTestId("stat-confirmed")).toHaveText("1");
    await page.getByTestId("tab-Confirmed").click();
    await expect(page.getByTestId("issue-R1")).toContainText("BUG-1");
    await page.goto("/");
    await expect(page.getByTestId("recent-list")).toContainText("Arnifi Homepage QA");
    await page.goto("/issues");
    await expect(page.getByTestId("row-BUG-1")).toBeVisible();
  });

  test("the tracker explains when there are no confirmed issues", async ({ page }) => {
    await page.goto("/issues");
    await expect(page.getByTestId("tracker-empty")).toContainText("No confirmed issues yet. Review the highlighted differences to add bugs.");
    await expect(page.getByTestId("tracker-export")).toBeDisabled();
  });

  test("AC-10: no request leaves the browser during a comparison", async ({ page, external }) => {
    await startComparison(page, FILES.design, FILES.build, "Privacy check");
    await openIssue(page, "R1");
    await page.getByTestId("confirm-bug").click();
    expect(external).toEqual([]);
  });
});

test.describe("Long landing pages", () => {
  test("compares a 22-megapixel full-page capture and finds changes far down the page", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Project name").fill("Long landing page");
    await upload(page, "design", FILES.longDesign);
    await expect(page.getByTestId("dims-design")).toContainText("1440 × 15415 px");
    await upload(page, "build", FILES.longBuild);
    await expect(page.getByTestId("dims-build")).toContainText("1440 × 15415 px");
    await expect(page.getByTestId("error-design")).toHaveCount(0);
    await page.getByRole("button", { name: "Run Comparison" }).click();
    await page.waitForURL(/\/comparisons\//, { timeout: 30_000 });

    await expect(page.getByTestId("dimensions")).toContainText("1440 × 15415 px");
    await expect(page.getByTestId("stat-regions")).toHaveText("7");
    await expect(page.getByTestId("workspace-notices")).toHaveCount(0);
    // Every change sits in the 4th copy of the page, between y 9,249 and 12,332.
    await openIssue(page, "R1");
    await expect(page.getByTestId("issue-detail")).toContainText(/ y (9\d{3}|1[0-2]\d{3}) /);
    await page.getByTestId("confirm-bug").click();
    await expect(page.getByTestId("stat-confirmed")).toHaveText("1");
  });

  test("rejects a page longer than browsers can handle, without decoding it", async ({ page }) => {
    await page.goto("/");
    await upload(page, "design", FILES.tooTall);
    await expect(page.getByTestId("error-design")).toContainText("1,440 × 40,000 px — one side is longer than 32,000 px");
    await expect(page.getByTestId("error-design")).toContainText("split the page into two comparisons");
  });
});

test.describe("Small screens", () => {
  test("@mobile the journey works without horizontal scrolling", async ({ page }) => {
    await page.goto("/");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Try With Sample Screenshots" }).click();
    await expect(page.getByTestId("dims-build")).toBeVisible();
    await page.getByRole("button", { name: "Run Comparison" }).click();
    await page.waitForURL(/\/comparisons\//);
    await expect(page.getByTestId("issue-R1")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.goto("/issues");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
