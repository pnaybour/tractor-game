import { expect, test } from "@playwright/test";

test.use({
  launchOptions: {
    args: ["--enable-webgl", "--use-gl=angle", "--use-angle=swiftshader"],
  },
});

test("storybook 3D train loads glTF assets and operates the points", async ({ page }, testInfo) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:5173/train3d.html", { waitUntil: "domcontentloaded" });

  await expect.poll(
    () => page.evaluate(() => window.train3D?.getState().modelFormat || "loading"),
    { timeout: 25_000 },
  ).toBe("gltf");

  await expect(page.getByTestId("train3d-message")).toContainText("Press GO");
  await expect(page.getByTestId("train3d-speed")).toHaveText("0");
  await page.getByTestId("train3d-go").click();
  await expect.poll(() => page.evaluate(() => window.train3D.getState().speed)).toBeGreaterThan(0);

  const branch = page.getByTestId("train3d-branch");
  await branch.click();
  await expect(branch).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("train3d-view").click();
  await expect.poll(() => page.evaluate(() => window.train3D.getState().view)).toBe("driver");

  await page.getByTestId("train3d-view").click();
  await page.getByTestId("train3d-view").click();
  // Back to the front-facing follow camera which shows the smiling face.
  await page.waitForTimeout(900);
  await page.screenshot({ path: testInfo.outputPath("bluebell-3d-train.png") });
  expect(errors).toEqual([]);
});
