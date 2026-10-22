import path from "node:path";
import { expect, type Page, test as base } from "@playwright/test";

const root = path.resolve(__dirname, "../..");

export const FILES = {
  design: path.join(root, "public/samples/arnifi-home-design.png"),
  build: path.join(root, "public/samples/arnifi-home-build.png"),
  mismatch: path.join(root, "tests/fixtures/mismatch-1440x900.png"),
  shifted: path.join(root, "tests/fixtures/build-shifted.png"),
  gif: path.join(root, "tests/fixtures/not-an-image.gif"),
  corrupt: path.join(root, "tests/fixtures/corrupt.png"),
  longDesign: path.join(root, "tests/fixtures/long-design.png"),
  longBuild: path.join(root, "tests/fixtures/long-build.png"),
  tooTall: path.join(root, "tests/fixtures/too-tall.png"),
};

/**
 * Every test runs with a network guard (AC-10): any request that leaves localhost fails the test,
 * so screenshots provably stay in the browser during the standard comparison.
 */
export const test = base.extend<{ external: string[] }>({
  external: [
    async ({ page, baseURL }, use) => {
      const external: string[] = [];
      page.on("request", (request) => {
        const url = request.url();
        if (!url.startsWith(baseURL!) && !url.startsWith("blob:") && !url.startsWith("data:")) external.push(url);
      });
      await use(external);
      expect(external, "requests outside this origin").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export async function upload(page: Page, slot: "design" | "build", file: string) {
  await page.getByTestId(`file-${slot}`).setInputFiles(file);
}

export async function startComparison(page: Page, design: string, build: string, name = "Arnifi Homepage QA") {
  await page.goto("/");
  await page.getByLabel("Project name").fill(name);
  await upload(page, "design", design);
  await upload(page, "build", build);
  await expect(page.getByTestId("dims-build")).toBeVisible();
  await page.getByRole("button", { name: "Run Comparison" }).click();
  await page.waitForURL(/\/comparisons\//);
  await expect(page.getByTestId("project-name")).toHaveText(name);
}

export async function openIssue(page: Page, label: string) {
  await page.getByTestId(`issue-${label}`).getByRole("button").first().click();
  await expect(page.getByTestId(`issue-${label}`)).toHaveAttribute("data-selected", "true");
}

export async function chooseOption(page: Page, trigger: ReturnType<Page["getByTestId"]>, option: string) {
  await trigger.click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
