import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const gameUrl = `file://${path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "index.html")}`;
const trainUrl = `file://${path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "train.html")}`;

test.describe("green digger carrot game", () => {
  test("any typing advances the digger and unlocks the next horse level", async ({ page }) => {
    await page.goto(gameUrl);

    await expect(page.getByTestId("message")).toHaveText("Level 1: 1 horse");
    await expect(page.getByTestId("level-label")).toHaveText("Level 1");
    await expect(page.getByTestId("horse-count")).toHaveText("1 horse");
    await expect(page.getByTestId("carrot-count")).toHaveText("0/2");
    await expect(page.locator(".horse-zone.visible")).toHaveCount(1);
    await expect(page.getByTestId("carrot-dots").locator(".dot")).toHaveCount(2);

    await page.keyboard.press("A");
    await expect(page.getByTestId("carried-carrot")).toHaveClass(/visible/);
    await expect(page.getByTestId("message")).toHaveText("Carrot found");

    await page.keyboard.press("z");
    await expect(page.getByTestId("carrot-count")).toHaveText("1/2");
    await expect(page.locator(".horse-zone.visible .mini-carrot")).toHaveCount(1);
    await expect(page.getByTestId("message")).toHaveText("Ready to dig");

    await page.keyboard.press("B");
    await expect(page.getByTestId("carried-carrot")).toHaveClass(/visible/);
    await page.keyboard.press("1");

    await expect(page.locator(".horse-zone.visible .horse")).toHaveClass(/happy/);
    await expect(page.getByTestId("message")).toHaveText("Happy horses");
    await expect(page.locator(".horse-zone.visible .mini-carrot")).toHaveCount(2);

    await expect(page.getByTestId("level-label")).toHaveText("Level 2");
    await expect(page.getByTestId("horse-count")).toHaveText("2 horses");
    await expect(page.getByTestId("carrot-count")).toHaveText("0/4");
    await expect(page.locator(".horse-zone.visible")).toHaveCount(2);
    await expect(page.getByTestId("carrot-dots").locator(".dot")).toHaveCount(4);
  });

  test("the big button also performs the next action", async ({ page }) => {
    await page.goto(gameUrl);

    await page.getByTestId("action-button").click();
    await expect(page.getByTestId("carried-carrot")).toHaveClass(/visible/);
  });

  test("extra keys do not build a delayed digger action buffer", async ({ page }) => {
    await page.goto(gameUrl);

    await page.keyboard.press("A");
    await page.keyboard.press("B");
    await page.keyboard.press("C");

    await expect(page.getByTestId("carried-carrot")).toHaveClass(/visible/);
    await expect(page.getByTestId("carrot-count")).toHaveText("0/2");
  });

  test("the final level displays three horses", async ({ page }) => {
    await page.goto(gameUrl);

    await page.evaluate(() => {
      startLevel(2);
    });

    await expect(page.getByTestId("level-label")).toHaveText("Level 3");
    await expect(page.getByTestId("horse-count")).toHaveText("3 horses");
    await expect(page.getByTestId("carrot-count")).toHaveText("0/6");
    await expect(page.locator(".horse-zone.visible")).toHaveCount(3);
    await expect(page.getByTestId("carrot-dots").locator(".dot")).toHaveCount(6);
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

test.describe("toy train driver game", () => {
  test("clicking makes the train move faster around the track", async ({ page }) => {
    await page.goto(trainUrl);

    await expect(page.getByTestId("train-speed")).toHaveText("0");

    await page.getByTestId("train-action").click();
    await expect(page.getByTestId("train-speed")).not.toHaveText("0");
    await expect(page.getByTestId("train-message")).toHaveText("Choo choo");

    const firstAngle = await page.evaluate(() => window.trainGame.getState().angle);
    await page.waitForTimeout(350);
    const secondAngle = await page.evaluate(() => window.trainGame.getState().angle);

    expect(secondAngle).not.toBe(firstAngle);
  });

  test("keyboard input also accelerates the train", async ({ page }) => {
    await page.goto(trainUrl);

    await page.keyboard.press("T");

    const speed = await page.evaluate(() => window.trainGame.getState().speed);
    expect(speed).toBeGreaterThan(0);
  });

  test("the top-down map and first-person view render pixels", async ({ page }) => {
    await page.goto(trainUrl);

    const trackState = await page.evaluate(() => window.trainGame.getState());
    expect(trackState.trackShape).toBe("figure-eight");
    expect(trackState.bridge).toBe(true);

    const rendered = await page.evaluate(() => {
      const canvases = [
        document.querySelector("[data-testid='driver-canvas']"),
        document.querySelector("[data-testid='map-canvas']"),
      ];

      return canvases.map((canvas) => {
        const context = canvas.getContext("2d");
        const { width, height } = canvas;
        const samples = context.getImageData(0, 0, width, height).data;
        let paintedPixels = 0;

        for (let index = 0; index < samples.length; index += 16) {
          if (samples[index + 3] > 0) {
            paintedPixels += 1;
          }
        }

        return paintedPixels;
      });
    });

    expect(rendered[0]).toBeGreaterThan(100);
    expect(rendered[1]).toBeGreaterThan(100);
  });
});
