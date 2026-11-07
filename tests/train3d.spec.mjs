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
  const diagnostics = await page.evaluate(() => window.train3D.getDebug());
  console.log("3D renderer diagnostics", JSON.stringify(diagnostics));
  const screenshot = await page.screenshot({ path: testInfo.outputPath("bluebell-3d-train.png") });

  // A functioning canvas must contain 3D objects, not just the plain CSS sky.
  // Sample away from HUD panels and buttons so a broken renderer is detected.
  const distinctSceneColours = await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = "data:image/png;base64," + base64;
    await image.decode();
    const helper = document.createElement("canvas");
    helper.width = image.naturalWidth;
    helper.height = image.naturalHeight;
    const helperContext = helper.getContext("2d");
    helperContext.drawImage(image, 0, 0);
    const stage = document.querySelector(".scene-frame").getBoundingClientRect();
    const pixels = new Set();
    for (let row = 0; row < 6; row += 1) {
      for (let column = 0; column < 14; column += 1) {
        const x = stage.left + stage.width * (0.08 + column * 0.058);
        const y = stage.top + stage.height * (0.29 + row * 0.11);
        const px = Math.round(x * helper.width / innerWidth);
        const py = Math.round(y * helper.height / innerHeight);
        const rgba = helperContext.getImageData(px, py, 1, 1).data;
        pixels.add(Array.from(rgba.slice(0, 3)).join(","));
      }
    }
    return pixels.size;
  }, screenshot.toString("base64"));
  console.log("3D scene distinct colours", distinctSceneColours);
  expect(diagnostics.renderCount).toBeGreaterThan(5);
  expect(distinctSceneColours).toBeGreaterThan(8);
  expect(errors).toEqual([]);
});


test("all unassigned keys accelerate the 3D train while assigned keys retain their functions", async ({ page }) => {
  await page.goto("http://127.0.0.1:5173/train3d.html", { waitUntil: "domcontentloaded" });
  await expect.poll(
    () => page.evaluate(() => window.train3D?.getState().modelFormat || "loading"),
    { timeout: 25_000 },
  ).toBe("gltf");

  // Previously ignored keys now do exactly the same thing as GO.
  const goKeys = [
    "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
    "Backspace", "Delete", "Home", "End", "PageDown", "Escape",
    "1", "Q", "Enter", "Shift",
  ];
  for (const key of goKeys) {
    const before = await page.evaluate(() => window.train3D.getState().boostCount);
    await page.keyboard.press(key);
    expect(await page.evaluate(() => window.train3D.getState().boostCount),
      key + " should operate GO").toBe(before + 1);
  }

  const beforeSpecialKeys = await page.evaluate(() => window.train3D.getState().boostCount);
  await page.keyboard.press("b");
  await expect(page.getByTestId("train3d-branch")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("v");
  expect(await page.evaluate(() => window.train3D.getState().view)).toBe("driver");
  await page.keyboard.press("Space");
  await expect(page.getByTestId("train3d-message")).toContainText("Whoo whoo");
  expect(await page.evaluate(() => window.train3D.getState().boostCount)).toBe(beforeSpecialKeys);

  // Leave browser keyboard navigation and system shortcuts intact.
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => window.train3D.getState().boostCount)).toBe(beforeSpecialKeys);
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "p", ctrlKey: true, cancelable: true }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "F5", cancelable: true }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", repeat: true, cancelable: true }));
  });
  expect(await page.evaluate(() => window.train3D.getState().boostCount)).toBe(beforeSpecialKeys);

  // An unassigned key still operates GO if a navigation link has focus.
  await page.locator(".topbar nav a").first().focus();
  await page.keyboard.press("ArrowUp");
  expect(await page.evaluate(() => window.train3D.getState().boostCount)).toBe(beforeSpecialKeys + 1);

  // Enter/Space still activate the focused on-screen controls normally.
  await page.getByTestId("train3d-go").focus();
  await page.keyboard.press("Enter");
  expect(await page.evaluate(() => window.train3D.getState().boostCount)).toBe(beforeSpecialKeys + 2);
  await page.keyboard.press("Space");
  expect(await page.evaluate(() => window.train3D.getState().boostCount)).toBe(beforeSpecialKeys + 3);

  await page.getByTestId("train3d-branch").focus();
  await page.keyboard.press("Space");
  await expect(page.getByTestId("train3d-branch")).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(() => window.train3D.getState().boostCount)).toBe(beforeSpecialKeys + 3);
});
