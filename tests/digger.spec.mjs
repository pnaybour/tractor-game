import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const gameUrl = `file://${path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "index.html")}`;

test.describe("green digger carrot game", () => {
  test("any typing advances the digger and fills the horse", async ({ page }) => {
    await page.goto(gameUrl);

    await expect(page.getByTestId("message")).toHaveText("Ready to dig");
    await expect(page.getByTestId("carrot-count")).toHaveText("0/5");

    await page.keyboard.press("A");
    await expect(page.getByTestId("carried-carrot")).toHaveClass(/visible/);
    await expect(page.getByTestId("message")).toHaveText("Carrot found");

    await page.keyboard.press("z");
    await expect(page.getByTestId("carrot-count")).toHaveText("1/5");

    for (const key of ["B", "1", "Space", "Enter", "x", "Y", "3", "q"]) {
      await page.keyboard.press(key);
    }

    await expect(page.getByTestId("horse")).toHaveClass(/happy/);
    await expect(page.getByTestId("message")).toHaveText("Happy full horse");
    await expect(page.getByTestId("trough-carrots").locator(".mini-carrot")).toHaveCount(5);
  });

  test("the big button also performs the next action", async ({ page }) => {
    await page.goto(gameUrl);

    await page.getByTestId("action-button").click();
    await expect(page.getByTestId("carried-carrot")).toHaveClass(/visible/);
  });

  test("the digger treads sit into the dirt track", async ({ page }) => {
    await page.goto(gameUrl);

    const track = await page.locator(".track").boundingBox();
    const tread = await page.locator(".tread").boundingBox();

    expect(track).not.toBeNull();
    expect(tread).not.toBeNull();

    const trackBottom = track.y + track.height;
    const treadBottom = tread.y + tread.height;
    const overlap = Math.min(treadBottom, trackBottom) - Math.max(tread.y, track.y);
    const overlapRatio = overlap / track.height;

    expect(overlapRatio).toBeGreaterThan(0.35);
    expect(overlapRatio).toBeLessThan(0.75);
  });
});
